import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';

import { RequestUser } from '../common/interfaces/request-user.interface';
import { Product } from '../database/entities/product.entity';
import { Sale } from '../database/entities/sale.entity';
import { SaleItem } from '../database/entities/sale-item.entity';
import { ProductsService } from '../products/products.service';
import { CreateSaleDto } from './dto/create-sale.dto';

@Injectable()
export class SalesService {
  constructor(
    @InjectRepository(Sale)
    private readonly salesRepository: Repository<Sale>,
    private readonly dataSource: DataSource,
    private readonly productsService: ProductsService,
  ) {}

  async createInvoice(
    createSaleDto: CreateSaleDto,
    requestUser: RequestUser,
  ): Promise<Sale> {
    return this.dataSource.transaction(async (manager) => {
      const sale = manager.create(Sale, {
        customer: createSaleDto.customer?.trim() ?? null,
        invoiceNumber: await this.generateInvoiceNumber(manager),
        paymentMethod: createSaleDto.paymentMethod,
        totalAmount: 0,
        createdByUserId: requestUser.userId,
      });

      const persistedSale = await manager.save(Sale, sale);
      const persistedItems: SaleItem[] = [];
      let runningTotal = 0;

      for (const item of createSaleDto.items) {
        const product = await manager.findOne(Product, {
          where: { id: item.productId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!product) {
          throw new NotFoundException(`Product "${item.productId}" not found.`);
        }

        if (product.stockQty < item.quantity) {
          throw new BadRequestException(
            `Insufficient stock for "${product.name}". Available: ${product.stockQty}, requested: ${item.quantity}.`,
          );
        }

        const previousStockQty = product.stockQty;
        product.stockQty -= item.quantity;
        await manager.save(Product, product);
        this.productsService.handleStockLevelChange(
          product,
          previousStockQty,
          'sale',
        );

        const unitPrice = Number(product.price);
        const lineTotal = Number((unitPrice * item.quantity).toFixed(2));
        runningTotal += lineTotal;

        const saleItem = manager.create(SaleItem, {
          sale: persistedSale,
          saleId: persistedSale.id,
          product,
          productId: product.id,
          quantity: item.quantity,
          unitPrice,
          lineTotal,
        });

        persistedItems.push(await manager.save(SaleItem, saleItem));
      }

      persistedSale.totalAmount = Number(runningTotal.toFixed(2));
      await manager.save(Sale, persistedSale);

      const createdSale = await manager.findOne(Sale, {
        where: { id: persistedSale.id },
        relations: { items: true },
      });

      if (!createdSale) {
        throw new NotFoundException('Unable to load created sale invoice.');
      }

      // Keep the saved items order stable in response.
      createdSale.items = persistedItems;
      return createdSale;
    });
  }

  async findAll(): Promise<Sale[]> {
    return this.salesRepository.find({
      relations: { items: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Sale> {
    const sale = await this.salesRepository.findOne({
      where: { id },
      relations: { items: true },
    });
    if (!sale) {
      throw new NotFoundException(`Sale "${id}" not found.`);
    }
    return sale;
  }

  private async generateInvoiceNumber(manager: EntityManager): Promise<string> {
    // Retry a few times to guarantee uniqueness before insert.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const now = new Date();
      const year = now.getFullYear().toString().slice(-2);
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hour = String(now.getHours()).padStart(2, '0');
      const minute = String(now.getMinutes()).padStart(2, '0');
      const second = String(now.getSeconds()).padStart(2, '0');
      const random = String(Math.floor(Math.random() * 900) + 100);
      const candidate = `INV-${year}${month}${day}-${hour}${minute}${second}-${random}`;

      const exists = await manager.exists(Sale, {
        where: { invoiceNumber: candidate },
      });
      if (!exists) {
        return candidate;
      }
    }

    throw new BadRequestException(
      'Unable to allocate a unique invoice number. Please retry.',
    );
  }
}
