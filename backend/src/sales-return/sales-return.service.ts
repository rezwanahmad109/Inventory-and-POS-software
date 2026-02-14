import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';

import { BranchesService } from '../branches/branches.service';
import { SaleStatus } from '../common/enums/sale-status.enum';
import { Customer } from '../database/entities/customer.entity';
import { Product } from '../database/entities/product.entity';
import { Sale } from '../database/entities/sale.entity';
import { SalesReturnPayment } from '../database/entities/sales-return-payment.entity';
import { SalesReturn } from '../database/entities/sales-return.entity';
import { SalesReturnItem } from '../database/entities/sales-return-item.entity';
import { CreateSalesReturnDto } from './dto/create-sales-return.dto';

/**
 * Service for handling sales return operations.
 * Manages the creation and retrieval of sales returns, ensuring data integrity
 * by validating original sales, updating product stock, and maintaining relations.
 */
@Injectable()
export class SalesReturnService {
  constructor(
    @InjectRepository(SalesReturn)
    private readonly salesReturnRepository: Repository<SalesReturn>,
    private readonly dataSource: DataSource,
    private readonly branchesService: BranchesService,
  ) {}

  /**
   * Creates a new sales return by validating the original sale and items,
   * updating product stock, and calculating the total refund.
   * @param createSalesReturnDto - DTO containing return details
   * @returns The created sales return with relations
   * @throws BadRequestException if validation fails
   * @throws NotFoundException if sale or product not found
   */
  async create(
    createSalesReturnDto: CreateSalesReturnDto,
    actorUserId?: string,
  ): Promise<SalesReturn> {
    return this.dataSource.transaction(async (manager) => {
      // Validate original sale exists
      const originalSale = await manager.findOne(Sale, {
        where: { id: createSalesReturnDto.originalSaleId },
        relations: { items: true },
        lock: { mode: 'pessimistic_write' },
      });

      if (!originalSale) {
        throw new NotFoundException(`Original sale "${createSalesReturnDto.originalSaleId}" not found.`);
      }

      const existingReturnedRows = await manager
        .createQueryBuilder(SalesReturnItem, 'item')
        .innerJoin(SalesReturn, 'salesReturn', 'salesReturn.id = item.sales_return_id')
        .select('item.product_id', 'productId')
        .addSelect('COALESCE(SUM(item.quantity), 0)', 'returnedQty')
        .where('salesReturn.original_sale_id = :originalSaleId', {
          originalSaleId: originalSale.id,
        })
        .groupBy('item.product_id')
        .getRawMany<{ productId: string; returnedQty: string }>();

      const previouslyReturnedByProduct = new Map<string, number>(
        existingReturnedRows.map((row) => [row.productId, Number(row.returnedQty) || 0]),
      );

      for (const item of createSalesReturnDto.items) {
        const saleItem = originalSale.items.find((si) => si.productId === item.productId);
        if (!saleItem) {
          throw new BadRequestException(
            `Product "${item.productId}" was not part of the original sale.`,
          );
        }

        const alreadyReturned = previouslyReturnedByProduct.get(item.productId) ?? 0;
        if (alreadyReturned + item.quantity > saleItem.quantity) {
          throw new BadRequestException(
            `Return quantity for product "${item.productId}" exceeds remaining allowable quantity.`,
          );
        }
      }

      // Create sales return
      const salesReturn = manager.create(SalesReturn, {
        originalSale,
        originalSaleId: originalSale.id,
        creditNoteNumber: await this.generateCreditNoteNumber(manager),
        returnDate: createSalesReturnDto.returnDate || new Date(),
        totalRefund: 0,
        note: createSalesReturnDto.note?.trim() ?? null,
        createdByUserId: actorUserId ?? null,
      });

      const persistedReturn = await manager.save(SalesReturn, salesReturn);
      const persistedItems: SalesReturnItem[] = [];
      let runningTotal = 0;

      for (const item of createSalesReturnDto.items) {
        // Validate product exists
        const product = await manager.findOne(Product, {
          where: { id: item.productId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!product) {
          throw new NotFoundException(`Product "${item.productId}" not found.`);
        }

        // Find corresponding sale item to validate quantity
        const saleItem = originalSale.items.find((si) => si.productId === item.productId);
        if (!saleItem) {
          throw new BadRequestException(`Product "${product.name}" was not part of the original sale.`);
        }

        if (originalSale.branchId) {
          await this.branchesService.increaseStockInBranch(
            manager,
            originalSale.branchId,
            product,
            item.quantity,
            'sales_return',
          );
        } else {
          // Update product stock (add back returned quantity)
          product.stockQty += item.quantity;
          await manager.save(Product, product);
        }

        // Always use original sale price to prevent client-side refund tampering.
        const unitPrice = Number(saleItem.unitPrice);
        const subtotal = Number((unitPrice * item.quantity).toFixed(2));
        runningTotal += subtotal;

        const returnItem = manager.create(SalesReturnItem, {
          salesReturn: persistedReturn,
          salesReturnId: persistedReturn.id,
          product,
          productId: product.id,
          quantity: item.quantity,
          unitPrice,
          subtotal,
        });

        persistedItems.push(await manager.save(SalesReturnItem, returnItem));
      }

      persistedReturn.totalRefund = Number(runningTotal.toFixed(2));
      await manager.save(SalesReturn, persistedReturn);

      const refundPayments = createSalesReturnDto.refundPayments ?? [];
      const totalPaidOut = Number(
        refundPayments
          .reduce((sum, payment) => sum + payment.amount, 0)
          .toFixed(2),
      );

      if (totalPaidOut > persistedReturn.totalRefund) {
        throw new BadRequestException(
          'Refund payment total cannot exceed return total refund.',
        );
      }

      for (const payment of refundPayments) {
        const refundPayment = manager.create(SalesReturnPayment, {
          salesReturnId: persistedReturn.id,
          method: payment.method,
          amount: Number(payment.amount.toFixed(2)),
          reference: payment.reference?.trim() ?? null,
          meta: payment.meta ?? null,
          createdBy: actorUserId ?? null,
        });
        await manager.save(SalesReturnPayment, refundPayment);
      }

      originalSale.refundedTotal = Number(
        (originalSale.refundedTotal + persistedReturn.totalRefund).toFixed(2),
      );

      const previousDue = originalSale.dueTotal;
      const nextDue = Math.max(originalSale.dueTotal - persistedReturn.totalRefund, 0);
      originalSale.dueTotal = Number(nextDue.toFixed(2));
      originalSale.dueAmount = originalSale.dueTotal;

      if (originalSale.refundedTotal >= originalSale.grandTotal) {
        originalSale.status = SaleStatus.REFUNDED;
      } else if (originalSale.dueTotal <= 0) {
        originalSale.status = SaleStatus.PAID;
      } else if (originalSale.paidTotal > 0) {
        originalSale.status = SaleStatus.PARTIAL;
      } else {
        originalSale.status = SaleStatus.UNPAID;
      }

      await manager.save(Sale, originalSale);

      if (originalSale.customerId && previousDue > originalSale.dueTotal) {
        const delta = Number((previousDue - originalSale.dueTotal).toFixed(2));
        await this.adjustCustomerDue(manager, originalSale.customerId, -delta);
      }

      const createdReturn = await manager.findOne(SalesReturn, {
        where: { id: persistedReturn.id },
        relations: { returnedItems: true, refundPayments: true },
      });

      if (!createdReturn) {
        throw new NotFoundException('Unable to load created sales return.');
      }

      // Keep the saved items order stable in response
      createdReturn.returnedItems = persistedItems;
      return createdReturn;
    });
  }

  /**
   * Retrieves all sales returns with pagination.
   * @returns Array of sales returns with relations
   */
  async findAll(): Promise<SalesReturn[]> {
    return this.salesReturnRepository.find({
      relations: { returnedItems: true, refundPayments: true },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Retrieves a specific sales return by ID.
   * @param id - Sales return ID
   * @returns The sales return with relations
   * @throws NotFoundException if not found
   */
  async findOne(id: string): Promise<SalesReturn> {
    const salesReturn = await this.salesReturnRepository.findOne({
      where: { id },
      relations: { returnedItems: true, refundPayments: true },
    });
    if (!salesReturn) {
      throw new NotFoundException(`Sales return "${id}" not found.`);
    }
    return salesReturn;
  }

  private async adjustCustomerDue(
    manager: EntityManager,
    customerId: number,
    amountDelta: number,
  ): Promise<void> {
    if (amountDelta === 0) {
      return;
    }

    await manager
      .createQueryBuilder()
      .update(Customer)
      .set({ totalDue: () => `GREATEST(total_due + ${amountDelta}, 0)` })
      .where('id = :id', { id: customerId })
      .execute();
  }

  private async generateCreditNoteNumber(manager: EntityManager): Promise<string> {
    const latest = await manager
      .createQueryBuilder(SalesReturn, 'salesReturn')
      .setLock('pessimistic_write')
      .orderBy('salesReturn.createdAt', 'DESC')
      .addOrderBy('salesReturn.id', 'DESC')
      .getOne();

    if (!latest) {
      return 'CN-0001';
    }

    const match = /^CN-(\d+)$/.exec(latest.creditNoteNumber);
    const lastNumber = match ? Number(match[1]) : 0;
    return `CN-${String(lastNumber + 1).padStart(4, '0')}`;
  }
}
