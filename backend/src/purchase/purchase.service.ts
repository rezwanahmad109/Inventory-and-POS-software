import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';

import { BranchesService } from '../branches/branches.service';
import { Product } from '../database/entities/product.entity';
import { PurchaseItem } from '../database/entities/purchase-item.entity';
import { Purchase } from '../database/entities/purchase.entity';
import { ProductsService } from '../products/products.service';
import { Supplier } from '../database/entities/supplier.entity';
import { CreatePurchaseDto } from './dto/create-purchase.dto';

@Injectable()
export class PurchaseService {
  constructor(
    @InjectRepository(Purchase)
    private readonly purchaseRepository: Repository<Purchase>,
    private readonly dataSource: DataSource,
    private readonly productsService: ProductsService,
    private readonly branchesService: BranchesService,
  ) {}

  async findAll(): Promise<Purchase[]> {
    return this.purchaseRepository.find({
      relations: { items: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Purchase> {
    const purchase = await this.purchaseRepository.findOne({
      where: { id },
      relations: { items: true },
    });
    if (!purchase) {
      throw new NotFoundException(`Purchase "${id}" not found.`);
    }
    return purchase;
  }

  async create(createPurchaseDto: CreatePurchaseDto): Promise<Purchase> {
    return this.dataSource.transaction(async (manager) => {
      let branchId: string | null = null;
      if (createPurchaseDto.branchId) {
        const branch = await this.branchesService.getBranchOrFail(
          createPurchaseDto.branchId,
          manager,
        );
        if (!branch.isActive) {
          throw new BadRequestException(
            `Branch "${branch.name}" is inactive. Purchases cannot be posted to this branch.`,
          );
        }
        branchId = branch.id;
      }

      const supplier = await manager.findOne(Supplier, {
        where: { id: createPurchaseDto.supplierId },
      });
      if (!supplier) {
        throw new NotFoundException(
          `Supplier "${createPurchaseDto.supplierId}" not found.`,
        );
      }

      const purchase = manager.create(Purchase, {
        supplier,
        supplierId: supplier.id,
        invoiceNumber: await this.generateInvoiceNumber(manager),
        totalAmount: 0,
        branchId,
      });

      const persistedPurchase = await manager.save(Purchase, purchase);
      const persistedItems: PurchaseItem[] = [];
      let runningTotal = 0;

      for (const inputItem of createPurchaseDto.items) {
        const product = await manager.findOne(Product, {
          where: { id: inputItem.productId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!product) {
          throw new NotFoundException(
            `Product "${inputItem.productId}" not found.`,
          );
        }

        const unitPrice = Number(inputItem.unitPrice);
        const lineTotal = Number((unitPrice * inputItem.quantity).toFixed(2));
        runningTotal += lineTotal;

        if (branchId) {
          await this.branchesService.increaseStockInBranch(
            manager,
            branchId,
            product,
            inputItem.quantity,
            'purchase',
          );
        } else {
          // Stock-in logic: purchase increases inventory stock.
          const previousStockQty = product.stockQty;
          product.stockQty += inputItem.quantity;
          await manager.save(Product, product);
          this.productsService.handleStockLevelChange(
            product,
            previousStockQty,
            'purchase',
          );
        }

        const purchaseItem = manager.create(PurchaseItem, {
          purchase: persistedPurchase,
          purchaseId: persistedPurchase.id,
          product,
          productId: product.id,
          quantity: inputItem.quantity,
          unitPrice,
          total: lineTotal,
        });

        persistedItems.push(await manager.save(PurchaseItem, purchaseItem));
      }

      persistedPurchase.totalAmount = Number(runningTotal.toFixed(2));
      await manager.save(Purchase, persistedPurchase);

      const createdPurchase = await manager.findOne(Purchase, {
        where: { id: persistedPurchase.id },
        relations: { items: true },
      });
      if (!createdPurchase) {
        throw new NotFoundException('Unable to load created purchase record.');
      }

      createdPurchase.items = persistedItems;
      return createdPurchase;
    });
  }

  async remove(id: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const purchase = await manager.findOne(Purchase, {
        where: { id },
        relations: { items: true },
      });
      if (!purchase) {
        throw new NotFoundException(`Purchase "${id}" not found.`);
      }

      // Reverse stock-in to keep inventory consistent after delete.
      for (const item of purchase.items) {
        const product = await manager.findOne(Product, {
          where: { id: item.productId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!product) {
          throw new NotFoundException(`Product "${item.productId}" not found.`);
        }
        if (!purchase.branchId && product.stockQty < item.quantity) {
          throw new BadRequestException(
            `Cannot delete purchase. Product "${product.name}" stock would become negative.`,
          );
        }

        if (purchase.branchId) {
          await this.branchesService.decreaseStockInBranch(
            manager,
            purchase.branchId,
            product,
            item.quantity,
            'purchase_delete',
          );
        } else {
          const previousStockQty = product.stockQty;
          product.stockQty -= item.quantity;
          await manager.save(Product, product);
          this.productsService.handleStockLevelChange(
            product,
            previousStockQty,
            'purchase_delete',
          );
        }
      }

      await manager.remove(Purchase, purchase);
    });
  }

  private async generateInvoiceNumber(manager: EntityManager): Promise<string> {
    // Lock latest row to reduce race conditions for sequential invoice numbers.
    const latest = await manager
      .createQueryBuilder(Purchase, 'purchase')
      .setLock('pessimistic_write')
      .orderBy('purchase.createdAt', 'DESC')
      .addOrderBy('purchase.id', 'DESC')
      .getOne();

    if (!latest) {
      return 'PUR-0001';
    }

    const match = /^PUR-(\d+)$/.exec(latest.invoiceNumber);
    const lastNumber = match ? Number(match[1]) : 0;
    const nextNumber = lastNumber + 1;
    return `PUR-${String(nextNumber).padStart(4, '0')}`;
  }
}
