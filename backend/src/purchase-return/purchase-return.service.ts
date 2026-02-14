import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';

import { BranchesService } from '../branches/branches.service';
import { PurchaseStatus } from '../common/enums/purchase-status.enum';
import { AccountingEventBusService } from '../common/services/accounting-event-bus.service';
import { PartyBalanceService } from '../common/services/party-balance.service';
import { TransactionRunnerService } from '../common/services/transaction-runner.service';
import { Product } from '../database/entities/product.entity';
import { PurchaseReturn } from '../database/entities/purchase-return.entity';
import { PurchaseReturnItem } from '../database/entities/purchase-return-item.entity';
import { Purchase } from '../database/entities/purchase.entity';
import { Supplier } from '../database/entities/supplier.entity';
import { CreatePurchaseReturnDto } from './dto/create-purchase-return.dto';

/**
 * Service for handling purchase return operations.
 * Manages the creation and retrieval of purchase returns, ensuring data integrity
 * by validating original purchases, updating product stock, and maintaining relations.
 */
@Injectable()
export class PurchaseReturnService {
  constructor(
    @InjectRepository(PurchaseReturn)
    private readonly purchaseReturnRepository: Repository<PurchaseReturn>,
    private readonly accountingEventBus: AccountingEventBusService,
    private readonly transactionRunner: TransactionRunnerService,
    private readonly branchesService: BranchesService,
    private readonly partyBalanceService: PartyBalanceService,
  ) {}

  /**
   * Creates a new purchase return by validating the original purchase and items,
   * updating product stock, and calculating the total refund.
   * @param createPurchaseReturnDto - DTO containing return details
   * @returns The created purchase return with relations
   * @throws BadRequestException if validation fails
   * @throws NotFoundException if purchase or product not found
   */
  async create(
    createPurchaseReturnDto: CreatePurchaseReturnDto,
    actorUserId?: string,
  ): Promise<PurchaseReturn> {
    const purchaseReturn = await this.transactionRunner.runInTransaction(async (manager) => {
      // Validate original purchase exists
      const originalPurchase = await manager.findOne(Purchase, {
        where: { id: createPurchaseReturnDto.originalPurchaseId },
        relations: { items: true },
        lock: { mode: 'pessimistic_write' },
      });

      if (!originalPurchase) {
        throw new NotFoundException(`Original purchase "${createPurchaseReturnDto.originalPurchaseId}" not found.`);
      }

      const existingReturnedRows = await manager
        .createQueryBuilder(PurchaseReturnItem, 'item')
        .innerJoin(PurchaseReturn, 'purchaseReturn', 'purchaseReturn.id = item.purchase_return_id')
        .select('item.product_id', 'productId')
        .addSelect('COALESCE(SUM(item.quantity), 0)', 'returnedQty')
        .where('purchaseReturn.original_purchase_id = :originalPurchaseId', {
          originalPurchaseId: originalPurchase.id,
        })
        .groupBy('item.product_id')
        .getRawMany<{ productId: string; returnedQty: string }>();

      const previouslyReturnedByProduct = new Map<string, number>(
        existingReturnedRows.map((row) => [row.productId, Number(row.returnedQty) || 0]),
      );

      for (const item of createPurchaseReturnDto.items) {
        const purchaseItem = originalPurchase.items.find((pi) => pi.productId === item.productId);
        if (!purchaseItem) {
          throw new BadRequestException(
            `Product "${item.productId}" was not part of the original purchase.`,
          );
        }

        const alreadyReturned = previouslyReturnedByProduct.get(item.productId) ?? 0;
        if (alreadyReturned + item.quantity > purchaseItem.quantity) {
          throw new BadRequestException(
            `Return quantity for product "${item.productId}" exceeds remaining allowable quantity.`,
          );
        }
      }

      // Create purchase return
      const purchaseReturn = manager.create(PurchaseReturn, {
        originalPurchase,
        originalPurchaseId: originalPurchase.id,
        debitNoteNumber: await this.generateDebitNoteNumber(manager),
        returnDate: createPurchaseReturnDto.returnDate || new Date(),
        totalRefund: 0,
        note: createPurchaseReturnDto.note?.trim() ?? null,
        createdByUserId: actorUserId ?? null,
      });

      const persistedReturn = await manager.save(PurchaseReturn, purchaseReturn);
      const persistedItems: PurchaseReturnItem[] = [];
      let runningTotal = 0;

      for (const item of createPurchaseReturnDto.items) {
        // Validate product exists
        const product = await manager.findOne(Product, {
          where: { id: item.productId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!product) {
          throw new NotFoundException(`Product "${item.productId}" not found.`);
        }

        // Find corresponding purchase item to validate quantity
        const purchaseItem = originalPurchase.items.find((pi) => pi.productId === item.productId);
        if (!purchaseItem) {
          throw new BadRequestException(`Product "${product.name}" was not part of the original purchase.`);
        }

        // Update product stock (decrease by returned quantity)
        if (!originalPurchase.branchId && product.stockQty < item.quantity) {
          throw new BadRequestException(
            `Insufficient stock for "${product.name}". Available: ${product.stockQty}, requested to return: ${item.quantity}.`,
          );
        }

        if (originalPurchase.branchId) {
          await this.branchesService.decreaseStockInBranch(
            manager,
            originalPurchase.branchId,
            product,
            item.quantity,
            'purchase_return',
          );
        } else {
          product.stockQty -= item.quantity;
          await manager.save(Product, product);
        }

        // Always use original purchase price to prevent client-side refund tampering.
        const unitPrice = Number(purchaseItem.unitPrice);
        const subtotal = Number((unitPrice * item.quantity).toFixed(2));
        runningTotal += subtotal;

        const returnItem = manager.create(PurchaseReturnItem, {
          purchaseReturn: persistedReturn,
          purchaseReturnId: persistedReturn.id,
          product,
          productId: product.id,
          quantity: item.quantity,
          unitPrice,
          subtotal,
        });

        persistedItems.push(await manager.save(PurchaseReturnItem, returnItem));
      }

      persistedReturn.totalRefund = Number(runningTotal.toFixed(2));
      await manager.save(PurchaseReturn, persistedReturn);

      const previousDue = originalPurchase.dueTotal;
      originalPurchase.dueTotal = Number(
        Math.max(originalPurchase.dueTotal - persistedReturn.totalRefund, 0).toFixed(2),
      );
      originalPurchase.status = this.resolvePurchaseStatus(
        originalPurchase.paidTotal,
        originalPurchase.dueTotal,
      );
      await manager.save(Purchase, originalPurchase);

      if (previousDue > originalPurchase.dueTotal) {
        const delta = Number((previousDue - originalPurchase.dueTotal).toFixed(2));
        await this.adjustSupplierPayable(
          manager,
          originalPurchase.supplierId,
          -delta,
        );
      }

      const createdReturn = await manager.findOne(PurchaseReturn, {
        where: { id: persistedReturn.id },
        relations: { returnedItems: true },
      });

      if (!createdReturn) {
        throw new NotFoundException('Unable to load created purchase return.');
      }

      // Keep the saved items order stable in response
      createdReturn.returnedItems = persistedItems;
      return createdReturn;
    });

    this.accountingEventBus.publish('purchase_return.created', {
      purchaseReturnId: purchaseReturn.id,
      totalRefund: purchaseReturn.totalRefund,
      branchId: purchaseReturn.originalPurchase?.branchId ?? null,
      occurredAt: purchaseReturn.returnDate ?? new Date(),
    });
    return purchaseReturn;
  }

  /**
   * Retrieves all purchase returns with pagination.
   * @returns Array of purchase returns with relations
   */
  async findAll(): Promise<PurchaseReturn[]> {
    return this.purchaseReturnRepository.find({
      relations: { returnedItems: true },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Retrieves a specific purchase return by ID.
   * @param id - Purchase return ID
   * @returns The purchase return with relations
   * @throws NotFoundException if not found
   */
  async findOne(id: string): Promise<PurchaseReturn> {
    const purchaseReturn = await this.purchaseReturnRepository.findOne({
      where: { id },
      relations: { returnedItems: true },
    });
    if (!purchaseReturn) {
      throw new NotFoundException(`Purchase return "${id}" not found.`);
    }
    return purchaseReturn;
  }

  private async adjustSupplierPayable(
    manager: EntityManager,
    supplierId: string,
    amountDelta: number,
  ): Promise<void> {
    await this.partyBalanceService.adjustSupplierPayable(
      manager,
      supplierId,
      amountDelta,
    );
  }

  private resolvePurchaseStatus(
    paidTotal: number,
    dueTotal: number,
  ): PurchaseStatus {
    if (dueTotal <= 0) {
      return PurchaseStatus.PAID;
    }
    if (paidTotal > 0) {
      return PurchaseStatus.PARTIAL;
    }
    return PurchaseStatus.UNPAID;
  }

  private async generateDebitNoteNumber(manager: EntityManager): Promise<string> {
    const latest = await manager
      .createQueryBuilder(PurchaseReturn, 'purchaseReturn')
      .setLock('pessimistic_write')
      .orderBy('purchaseReturn.createdAt', 'DESC')
      .addOrderBy('purchaseReturn.id', 'DESC')
      .getOne();

    if (!latest) {
      return 'DN-0001';
    }

    const match = /^DN-(\d+)$/.exec(latest.debitNoteNumber);
    const lastNumber = match ? Number(match[1]) : 0;
    return `DN-${String(lastNumber + 1).padStart(4, '0')}`;
  }
}
