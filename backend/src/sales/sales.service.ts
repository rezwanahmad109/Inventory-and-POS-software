import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';

import { BranchesService } from '../branches/branches.service';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { InventoryCostingService } from '../common/services/inventory-costing.service';
import { OutboxService } from '../common/services/outbox.service';
import { PartyBalanceService } from '../common/services/party-balance.service';
import { TransactionRunnerService } from '../common/services/transaction-runner.service';
import { QuotationStatus } from '../common/enums/quotation-status.enum';
import { SaleDocumentType } from '../common/enums/sale-document-type.enum';
import { SaleStatus } from '../common/enums/sale-status.enum';
import { TaxMethod } from '../common/enums/tax-method.enum';
import { Customer } from '../database/entities/customer.entity';
import { PeriodLock } from '../database/entities/period-lock.entity';
import { ProductPriceTierEntity } from '../database/entities/product-price-tier.entity';
import { Product } from '../database/entities/product.entity';
import { SaleDeliveryItem } from '../database/entities/sale-delivery-item.entity';
import { SaleDelivery } from '../database/entities/sale-delivery.entity';
import { SaleItem } from '../database/entities/sale-item.entity';
import { SalePayment } from '../database/entities/sale-payment.entity';
import { Sale } from '../database/entities/sale.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { computePricing } from './pricing/pricing-engine';
import { ConvertSaleQuotationDto } from './dto/convert-sale-quotation.dto';
import { CreateSaleDeliveryDto } from './dto/create-sale-delivery.dto';
import { CreateSaleDto } from './dto/create-sale.dto';
import { RecordSalePaymentDto } from './dto/record-sale-payment.dto';
import { SalesQueryDto } from './dto/sales-query.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
import { PaginatedResponse } from '../common/interfaces/paginated-response.interface';
import { toPaginatedResponse } from '../common/utils/pagination.util';

interface PersistSaleOptions {
  consumeInventoryOnInvoice?: boolean;
  emitDeliveryOutbox?: boolean;
}

@Injectable()
export class SalesService {
  private readonly logger = new Logger(SalesService.name);

  constructor(
    @InjectRepository(Sale)
    private readonly salesRepository: Repository<Sale>,
    private readonly outboxService: OutboxService,
    private readonly inventoryCostingService: InventoryCostingService,
    private readonly transactionRunner: TransactionRunnerService,
    private readonly partyBalanceService: PartyBalanceService,
    private readonly branchesService: BranchesService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createInvoice(
    createSaleDto: CreateSaleDto,
    requestUser: RequestUser,
  ): Promise<Sale> {
    const sale = await this.transactionRunner.runInTransaction(async (manager) =>
      this.persistSaleDocument(manager, createSaleDto, requestUser),
    );

    await this.sendOrderConfirmationIfPossible(sale);
    if (sale.dueTotal <= 0) {
      await this.sendReceiptIfPossible(sale);
    }

    return sale;
  }

  async updateInvoice(
    id: string,
    updateSaleDto: UpdateSaleDto,
    requestUser: RequestUser,
  ): Promise<Sale> {
    if (!updateSaleDto.items || updateSaleDto.items.length === 0) {
      throw new BadRequestException('items are required to update a sale invoice.');
    }

    return this.transactionRunner.runInTransaction(async (manager) => {
      const sale = await this.getSaleForMutation(manager, id);
      if (sale.documentType === SaleDocumentType.INVOICE) {
        throw new BadRequestException(
          'Posted invoices are immutable. Use delivery return/credit note adjustments.',
        );
      }

      if (sale.salesReturns.length > 0) {
        throw new BadRequestException(
          'Sales with linked returns cannot be modified.',
        );
      }
      if (
        sale.items.some(
          (item) => item.deliveredQuantity > 0 || item.invoicedQuantity > 0,
        )
      ) {
        throw new BadRequestException(
          'Orders with posted deliveries or invoices cannot be modified.',
        );
      }

      await this.rollbackSaleEffects(manager, sale);
      await manager.delete(SaleItem, { saleId: sale.id });
      await manager.delete(SalePayment, { saleId: sale.id });

      return this.persistSaleDocument(
        manager,
        updateSaleDto as CreateSaleDto,
        requestUser,
        sale,
      );
    });
  }

  async removeInvoice(id: string): Promise<void> {
    await this.transactionRunner.runInTransaction(async (manager) => {
      const sale = await this.getSaleForMutation(manager, id);
      if (sale.documentType === SaleDocumentType.INVOICE) {
        throw new BadRequestException(
          'Posted invoices are immutable. Use delivery return/credit note adjustments.',
        );
      }

      if (sale.salesReturns.length > 0) {
        throw new BadRequestException(
          'Sales with linked returns cannot be deleted.',
        );
      }
      if (
        sale.items.some(
          (item) => item.deliveredQuantity > 0 || item.invoicedQuantity > 0,
        )
      ) {
        throw new BadRequestException(
          'Orders with posted deliveries or invoices cannot be deleted.',
        );
      }

      await this.rollbackSaleEffects(manager, sale);
      await manager.remove(Sale, sale);
    });
  }

  async addPayment(
    saleId: string,
    paymentDto: RecordSalePaymentDto,
    requestUser: RequestUser,
  ): Promise<Sale> {
    const now = new Date();
    const sale = await this.transactionRunner.runInTransaction(async (manager) => {
      await this.assertPostingPeriodOpen(manager, now);

      const sale = await manager.findOne(Sale, {
        where: { id: saleId },
        lock: { mode: 'pessimistic_write' },
        relations: { payments: true },
      });

      if (!sale) {
        throw new NotFoundException(`Sale "${saleId}" not found.`);
      }

      if (sale.documentType !== SaleDocumentType.INVOICE) {
        throw new BadRequestException('Payments can only be applied to invoices.');
      }

      if (sale.status === SaleStatus.PAID) {
        throw new BadRequestException('Invoice is already fully paid.');
      }

      const amount = Number(paymentDto.amount.toFixed(2));
      if (amount <= 0) {
        throw new BadRequestException('Payment amount must be positive.');
      }
      if (amount > sale.dueTotal) {
        throw new BadRequestException(
          `Payment amount (${amount}) exceeds invoice due (${sale.dueTotal}).`,
        );
      }

      const payment = manager.create(SalePayment, {
        saleId: sale.id,
        method: paymentDto.method,
        amount,
        reference: paymentDto.reference?.trim() ?? null,
        meta: paymentDto.meta ?? null,
        createdBy: requestUser.userId,
      });
      await manager.save(SalePayment, payment);

      sale.paidTotal = this.roundMoney(sale.paidTotal + amount);
      sale.dueTotal = this.roundMoney(Math.max(sale.grandTotal - sale.paidTotal, 0));
      sale.paidAmount = sale.paidTotal;
      sale.dueAmount = sale.dueTotal;
      sale.paymentMethod = payment.method;
      sale.status = this.resolveSaleStatus(sale.paidTotal, sale.dueTotal);
      await manager.save(Sale, sale);

      if (sale.customerId && amount > 0) {
        await this.adjustCustomerDue(manager, sale.customerId, -amount);
      }

      await this.outboxService.enqueue(manager, {
        eventType: 'sales.payment_received',
        idempotencyKey: `sales:payment:${payment.id}`,
        sourceType: 'sale_payment',
        sourceId: payment.id,
        payload: {
          saleId: sale.id,
          paymentId: payment.id,
          amount,
          branchId: sale.branchId,
          occurredAt: now.toISOString(),
        },
      });

      return this.findOneWithManager(manager, sale.id);
    });

    if (sale.dueTotal <= 0) {
      await this.sendReceiptIfPossible(sale);
    }

    return sale;
  }

  async createDelivery(
    orderSaleId: string,
    createDeliveryDto: CreateSaleDeliveryDto,
    requestUser: RequestUser,
  ): Promise<SaleDelivery> {
    const postingDate = createDeliveryDto.deliveryDate
      ? new Date(createDeliveryDto.deliveryDate)
      : new Date();

    return this.transactionRunner.runInTransaction(async (manager) => {
      await this.assertPostingPeriodOpen(manager, postingDate);

      const quotation = await manager.findOne(Sale, {
        where: { id: orderSaleId },
        relations: { items: true },
        lock: { mode: 'pessimistic_write' },
      });
      if (!quotation) {
        throw new NotFoundException(`Sale "${orderSaleId}" not found.`);
      }
      if (quotation.documentType !== SaleDocumentType.QUOTATION) {
        throw new BadRequestException(
          'Sales deliveries can only be posted against quotation/order documents.',
        );
      }
      if (quotation.quotationStatus === QuotationStatus.CONVERTED) {
        throw new BadRequestException('Order is already fully invoiced.');
      }

      const orderItemsById = new Map(
        (quotation.items ?? []).map((item) => [item.id, item]),
      );
      if (orderItemsById.size === 0) {
        throw new BadRequestException('Order has no lines to deliver.');
      }

      const delivery = manager.create(SaleDelivery, {
        deliveryNumber: await this.generateDeliveryNumber(manager),
        orderSaleId: quotation.id,
        totalCogs: 0,
        note: createDeliveryDto.note?.trim() ?? null,
        createdByUserId: requestUser.userId,
      });
      const savedDelivery = await manager.save(SaleDelivery, delivery);

      const persistedDeliveryItems: SaleDeliveryItem[] = [];
      let totalCogs = 0;

      for (const requestedLine of createDeliveryDto.items) {
        const orderItem = orderItemsById.get(requestedLine.orderItemId);
        if (!orderItem) {
          throw new BadRequestException(
            `Order line "${requestedLine.orderItemId}" was not found on order ${quotation.invoiceNumber}.`,
          );
        }

        const remainingToDeliver = Math.max(
          orderItem.quantity - orderItem.deliveredQuantity,
          0,
        );
        if (requestedLine.quantity > remainingToDeliver) {
          throw new BadRequestException(
            `Delivery quantity ${requestedLine.quantity} exceeds remaining ordered quantity ${remainingToDeliver} for line ${orderItem.id}.`,
          );
        }
        if (!orderItem.warehouseId) {
          throw new BadRequestException(
            `Warehouse is required for order line ${orderItem.id}.`,
          );
        }

        const product = await manager.findOne(Product, {
          where: { id: orderItem.productId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!product) {
          throw new NotFoundException(`Product "${orderItem.productId}" not found.`);
        }

        await this.branchesService.decreaseStockInBranch(
          manager,
          orderItem.warehouseId,
          product,
          requestedLine.quantity,
          'sale_delivery',
        );

        const costing = await this.inventoryCostingService.consumeForSale(manager, {
          productId: orderItem.productId,
          warehouseId: orderItem.warehouseId,
          quantity: requestedLine.quantity,
          referenceType: 'sale_delivery',
          referenceId: savedDelivery.id,
          referenceLineId: null,
          actorId: requestUser.userId,
        });

        const unitCost =
          requestedLine.quantity > 0
            ? Number((costing.totalCost / requestedLine.quantity).toFixed(4))
            : 0;

        const deliveryItem = manager.create(SaleDeliveryItem, {
          deliveryId: savedDelivery.id,
          orderItemId: orderItem.id,
          productId: orderItem.productId,
          warehouseId: orderItem.warehouseId,
          quantity: requestedLine.quantity,
          unitCost,
          totalCost: costing.totalCost,
        });
        persistedDeliveryItems.push(await manager.save(SaleDeliveryItem, deliveryItem));

        orderItem.deliveredQuantity += requestedLine.quantity;
        if (orderItem.deliveredQuantity > orderItem.quantity) {
          throw new BadRequestException(
            `Delivered quantity cannot exceed ordered quantity for line ${orderItem.id}.`,
          );
        }
        if (orderItem.invoicedQuantity > orderItem.deliveredQuantity) {
          throw new BadRequestException(
            `Invoiced quantity cannot exceed delivered quantity for line ${orderItem.id}.`,
          );
        }
        await manager.save(SaleItem, orderItem);

        totalCogs = this.roundMoney(totalCogs + costing.totalCost);
      }

      savedDelivery.totalCogs = totalCogs;
      await manager.save(SaleDelivery, savedDelivery);

      await this.syncQuotationConversionStatus(manager, quotation, postingDate, null);

      await this.outboxService.enqueue(manager, {
        eventType: 'sales.delivery_posted',
        idempotencyKey: `sales:delivery:${savedDelivery.id}`,
        sourceType: 'sale_delivery',
        sourceId: savedDelivery.id,
        payload: {
          saleId: quotation.id,
          deliveryId: savedDelivery.id,
          deliveryNumber: savedDelivery.deliveryNumber,
          cogsTotal: totalCogs,
          branchId: quotation.branchId,
          occurredAt: postingDate.toISOString(),
        },
      });

      const reloaded = await manager.findOne(SaleDelivery, {
        where: { id: savedDelivery.id },
        relations: { items: true },
      });
      if (!reloaded) {
        throw new NotFoundException('Saved delivery could not be reloaded.');
      }
      reloaded.items = persistedDeliveryItems;
      return reloaded;
    });
  }

  async convertQuotationToSale(
    id: string,
    requestUser: RequestUser,
    convertDto: ConvertSaleQuotationDto,
  ): Promise<{ quotation: Sale; sale: Sale }> {
    return this.transactionRunner.runInTransaction(async (manager) => {
      const quotation = await manager.findOne(Sale, {
        where: { id },
        relations: { items: true, payments: true },
        lock: { mode: 'pessimistic_write' },
      });

      if (!quotation) {
        throw new NotFoundException(`Sale "${id}" not found.`);
      }

      if (quotation.documentType !== SaleDocumentType.QUOTATION) {
        throw new BadRequestException('Only quotations can be converted to invoices.');
      }

      if (!quotation.items || quotation.items.length === 0) {
        throw new BadRequestException('Quotation has no lines to convert.');
      }

      const quotationItems = quotation.items;
      const availableDeliveredToInvoice = quotationItems
        .map((item) => ({
          item,
          available: Math.max(item.deliveredQuantity - item.invoicedQuantity, 0),
        }))
        .filter((row) => row.available > 0);

      let fallbackLegacyFulfillment = false;
      const selectedRows: Array<{ item: SaleItem; quantity: number }> = [];

      if (convertDto.items && convertDto.items.length > 0) {
        const mergedByOrderLine = new Map<string, number>();
        const orderItemById = new Map<string, SaleItem>();

        for (const input of convertDto.items) {
          const candidates = quotationItems.filter((item) => {
            if (input.orderItemId) {
              return item.id === input.orderItemId;
            }
            if (input.productId) {
              return item.productId === input.productId;
            }
            return false;
          });

          if (candidates.length === 0) {
            throw new BadRequestException(
              'Each conversion line must match an order item by orderItemId or productId.',
            );
          }
          if (candidates.length > 1) {
            throw new BadRequestException(
              `Product ${input.productId} appears in multiple order lines. Use orderItemId instead.`,
            );
          }

          const orderItem = candidates[0];
          orderItemById.set(orderItem.id, orderItem);
          mergedByOrderLine.set(
            orderItem.id,
            (mergedByOrderLine.get(orderItem.id) ?? 0) + input.quantity,
          );
        }

        for (const [orderItemId, requestedQty] of mergedByOrderLine.entries()) {
          const orderItem = orderItemById.get(orderItemId);
          if (!orderItem) {
            throw new NotFoundException(`Order line "${orderItemId}" not found.`);
          }

          const available = Math.max(
            orderItem.deliveredQuantity - orderItem.invoicedQuantity,
            0,
          );
          if (requestedQty > available) {
            throw new BadRequestException(
              `Invoice quantity ${requestedQty} exceeds delivered and uninvoiced quantity ${available} for order line ${orderItem.id}.`,
            );
          }

          selectedRows.push({
            item: orderItem,
            quantity: requestedQty,
          });
        }
      } else if (availableDeliveredToInvoice.length > 0) {
        for (const row of availableDeliveredToInvoice) {
          selectedRows.push({ item: row.item, quantity: row.available });
        }
      } else {
        const outstandingOrderedRows = quotationItems
          .map((item) => ({
            item,
            available: Math.max(item.quantity - item.invoicedQuantity, 0),
          }))
          .filter((row) => row.available > 0);

        if (outstandingOrderedRows.length === 0) {
          throw new BadRequestException('Quotation is already fully invoiced.');
        }

        fallbackLegacyFulfillment = true;
        for (const row of outstandingOrderedRows) {
          selectedRows.push({ item: row.item, quantity: row.available });
        }
      }

      const createDto: CreateSaleDto = {
        branchId: quotation.branchId ?? undefined,
        documentType: SaleDocumentType.INVOICE,
        customer: quotation.customer ?? undefined,
        customerId: quotation.customerId ?? undefined,
        invoiceDiscountType: quotation.invoiceDiscountType,
        invoiceDiscountValue: quotation.invoiceDiscountValue,
        invoiceTaxOverride:
          quotation.invoiceTaxRate !== null && quotation.invoiceTaxMethod !== null
            ? {
                rate: quotation.invoiceTaxRate,
                method: quotation.invoiceTaxMethod,
              }
            : undefined,
        items: selectedRows.map((row) => ({
          productId: row.item.productId,
          warehouseId: row.item.warehouseId,
          quantity: row.quantity,
          unitPriceOverride: row.item.unitPrice,
          lineDiscountType: row.item.lineDiscountType,
          lineDiscountValue: row.item.lineDiscountValue,
        })),
        payments: [],
        notes: convertDto.note?.trim() ?? quotation.notes ?? undefined,
        shippingTotal: quotation.shippingTotal,
      };

      const convertedSale = await this.persistSaleDocument(
        manager,
        createDto,
        requestUser,
        undefined,
        {
          consumeInventoryOnInvoice: fallbackLegacyFulfillment,
          emitDeliveryOutbox: fallbackLegacyFulfillment,
        },
      );

      for (const row of selectedRows) {
        if (fallbackLegacyFulfillment) {
          row.item.deliveredQuantity += row.quantity;
        }
        row.item.invoicedQuantity += row.quantity;

        if (row.item.deliveredQuantity > row.item.quantity) {
          throw new BadRequestException(
            `Delivered quantity cannot exceed ordered quantity for line ${row.item.id}.`,
          );
        }
        if (row.item.invoicedQuantity > row.item.deliveredQuantity) {
          throw new BadRequestException(
            `Invoiced quantity cannot exceed delivered quantity for line ${row.item.id}.`,
          );
        }

        await manager.save(SaleItem, row.item);
      }

      const conversionDate = convertDto.conversionDate
        ? new Date(convertDto.conversionDate)
        : new Date();
      await this.syncQuotationConversionStatus(
        manager,
        quotation,
        conversionDate,
        convertedSale.id,
      );

      return {
        quotation,
        sale: convertedSale,
      };
    });
  }

  async findAll(query: SalesQueryDto): Promise<PaginatedResponse<Sale>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.salesRepository
      .createQueryBuilder('sale')
      .leftJoinAndSelect('sale.items', 'items')
      .leftJoinAndSelect('sale.payments', 'payments')
      .leftJoinAndSelect('sale.customerEntity', 'customerEntity')
      .distinct(true)
      .orderBy('sale.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query.branchId) {
      qb.andWhere('sale.branch_id = :branchId', { branchId: query.branchId });
    }
    if (query.status) {
      qb.andWhere('sale.status = :status', { status: query.status });
    }
    if (query.documentType) {
      qb.andWhere('sale.document_type = :documentType', {
        documentType: query.documentType,
      });
    }
    if (query.from) {
      qb.andWhere('sale.created_at >= :from', { from: query.from });
    }
    if (query.to) {
      qb.andWhere('sale.created_at <= :to', { to: query.to });
    }

    const [sales, total] = await qb.getManyAndCount();
    return toPaginatedResponse(
      sales.map((sale) => this.decorateOverdueFlags(sale)),
      total,
      page,
      limit,
    );
  }

  async findOne(id: string): Promise<Sale> {
    return this.findOneWithManager(this.salesRepository.manager, id);
  }

  private async findOneWithManager(
    manager: EntityManager,
    id: string,
  ): Promise<Sale> {
    const sale = await manager.findOne(Sale, {
      where: { id },
      relations: { items: true, payments: true, customerEntity: true },
    });
    if (!sale) {
      throw new NotFoundException(`Sale "${id}" not found.`);
    }
    return this.decorateOverdueFlags(sale);
  }

  private async persistSaleDocument(
    manager: EntityManager,
    createSaleDto: CreateSaleDto,
    requestUser: RequestUser,
    existingSale?: Sale,
    options?: PersistSaleOptions,
  ): Promise<Sale> {
    if (createSaleDto.items.length === 0) {
      throw new BadRequestException('At least one item is required.');
    }

    const documentType =
      createSaleDto.documentType ??
      existingSale?.documentType ??
      SaleDocumentType.INVOICE;
    const consumeInventoryOnInvoice =
      documentType === SaleDocumentType.INVOICE
        ? (options?.consumeInventoryOnInvoice ?? true)
        : false;
    const emitDeliveryOutbox =
      documentType === SaleDocumentType.INVOICE
        ? (options?.emitDeliveryOutbox ?? consumeInventoryOnInvoice)
        : false;
    const branchId =
      createSaleDto.branchId === undefined
        ? (existingSale?.branchId ?? null)
        : createSaleDto.branchId;

    if (branchId) {
      const branch = await this.branchesService.getBranchOrFail(branchId, manager);
      if (!branch.isActive) {
        throw new BadRequestException(
          `Branch "${branch.name}" is inactive. Sales cannot be posted to this branch.`,
        );
      }
    }
    if (documentType === SaleDocumentType.INVOICE) {
      await this.assertPostingPeriodOpen(manager, new Date());
    }

    const customer = await this.resolveCustomer(manager, createSaleDto.customerId);
    const sale =
      existingSale ??
      manager.create(Sale, {
        invoiceNumber: await this.generateInvoiceNumber(manager, documentType),
        createdByUserId: requestUser.userId,
      });

    if (
      existingSale &&
      existingSale.documentType !== documentType &&
      existingSale.documentType === SaleDocumentType.INVOICE
    ) {
      throw new BadRequestException('Invoice cannot be downgraded to quotation.');
    }

    const productsById = new Map<string, Product>();
    const linePriceTierMeta: Array<{
      priceTierId: string | null;
      priceTierName: string | null;
      warehouseId: string | null;
    }> = [];
    const pricingInput: Array<{
      productId: string;
      quantity: number;
      unitPrice: number;
      lineDiscountType: any;
      lineDiscountValue: number;
      taxRate: number;
      taxMethod: TaxMethod;
    }> = [];

    for (const item of createSaleDto.items) {
      const product = await manager.findOne(Product, {
        where: { id: item.productId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!product) {
        throw new NotFoundException(`Product "${item.productId}" not found.`);
      }

      const resolvedWarehouseId =
        item.warehouseId ?? branchId ?? product.defaultWarehouseId ?? null;
      if (!resolvedWarehouseId) {
        throw new BadRequestException(
          `Warehouse is required for product "${product.name}" delivery line.`,
        );
      }

      let resolvedPriceTierId: string | null = null;
      let resolvedPriceTierName: string | null = null;
      let unitPrice = Number(product.price);

      if (item.unitPriceOverride !== undefined) {
        unitPrice = Number(item.unitPriceOverride);
      } else if (item.priceTierId) {
        const tierPrice = await manager.findOne(ProductPriceTierEntity, {
          where: {
            productId: product.id,
            priceTierId: item.priceTierId,
          },
          relations: {
            priceTier: true,
          },
        });
        if (!tierPrice || !tierPrice.priceTier.isActive) {
          throw new NotFoundException(
            `Price tier "${item.priceTierId}" is not configured for product "${product.name}".`,
          );
        }

        resolvedPriceTierId = tierPrice.priceTierId;
        resolvedPriceTierName = tierPrice.priceTier.name;
        unitPrice = Number(tierPrice.price);
      }

      unitPrice = Number(unitPrice.toFixed(2));
      pricingInput.push({
        productId: product.id,
        quantity: item.quantity,
        unitPrice,
        lineDiscountType: item.lineDiscountType,
        lineDiscountValue: item.lineDiscountValue ?? 0,
        taxRate: Number(product.taxRate ?? 0),
        taxMethod: product.taxMethod,
      });
      productsById.set(product.id, product);
      linePriceTierMeta.push({
        priceTierId: resolvedPriceTierId,
        priceTierName: resolvedPriceTierName,
        warehouseId: resolvedWarehouseId,
      });
    }

    const pricing = computePricing({
      items: pricingInput,
      invoiceDiscountType: createSaleDto.invoiceDiscountType,
      invoiceDiscountValue: createSaleDto.invoiceDiscountValue,
      invoiceTaxOverride: createSaleDto.invoiceTaxOverride
        ? {
            rate: createSaleDto.invoiceTaxOverride.rate,
            method: createSaleDto.invoiceTaxOverride.method,
          }
        : null,
    });

    const shippingTotal = this.roundMoney(createSaleDto.shippingTotal ?? 0);
    const grandTotal = this.roundMoney(pricing.grandTotal + shippingTotal);

    const payments = createSaleDto.payments ?? [];
    if (documentType === SaleDocumentType.QUOTATION && payments.length > 0) {
      throw new BadRequestException('Quotation documents cannot receive payments.');
    }

    const paidTotal = this.roundMoney(
      payments.reduce((sum, payment) => sum + payment.amount, 0),
    );
    if (paidTotal > grandTotal) {
      throw new BadRequestException(
        `Paid amount (${paidTotal}) cannot exceed invoice total (${grandTotal}).`,
      );
    }
    const dueTotal = this.roundMoney(Math.max(grandTotal - paidTotal, 0));
    if (documentType === SaleDocumentType.INVOICE) {
      this.assertCreditLimit(customer, dueTotal, requestUser);
    }

    sale.customer = createSaleDto.customer?.trim() ?? customer?.name ?? null;
    sale.customerEntity = customer;
    sale.customerId = customer?.id ?? null;
    sale.documentType = documentType;
    sale.validUntil =
      createSaleDto.validUntil !== undefined
        ? new Date(createSaleDto.validUntil)
        : (existingSale?.validUntil ?? null);
    sale.convertedAt = existingSale?.convertedAt ?? null;
    sale.convertedToSaleId = existingSale?.convertedToSaleId ?? null;

    sale.subtotal = pricing.subtotal;
    sale.discountTotal = pricing.discountTotal;
    sale.taxTotal = pricing.taxTotal;
    sale.grandTotal = grandTotal;
    sale.shippingTotal = shippingTotal;
    sale.totalAmount = grandTotal;

    sale.invoiceDiscountType = pricing.invoiceDiscountType;
    sale.invoiceDiscountValue = pricing.invoiceDiscountValue;
    sale.invoiceTaxRate = pricing.invoiceTaxOverride?.rate ?? null;
    sale.invoiceTaxMethod = pricing.invoiceTaxOverride?.method ?? null;

    sale.paidTotal = paidTotal;
    sale.dueTotal = dueTotal;
    sale.paidAmount = sale.paidTotal;
    sale.dueAmount = sale.dueTotal;

    sale.status =
      documentType === SaleDocumentType.QUOTATION
        ? SaleStatus.UNPAID
        : this.resolveSaleStatus(sale.paidTotal, sale.dueTotal);

    sale.paymentMethod = payments[0]?.method ?? null;
    sale.legacyPaymentMethod = null;
    sale.branchId = branchId;
    sale.notes = createSaleDto.notes?.trim() ?? null;
    sale.attachments =
      createSaleDto.attachments !== undefined
        ? createSaleDto.attachments
        : (existingSale?.attachments ?? null);

    sale.quotationStatus =
      documentType === SaleDocumentType.QUOTATION
        ? this.resolveQuotationStatus(
            sale.validUntil,
            createSaleDto.quotationStatus ?? null,
          )
        : null;

    const persistedSale = await manager.save(Sale, sale);

    const persistedItems: SaleItem[] = [];
    let totalCogs = 0;
    for (let index = 0; index < pricing.lines.length; index += 1) {
      const line = pricing.lines[index];
      const product = productsById.get(line.productId);
      if (!product) {
        throw new NotFoundException(`Product "${line.productId}" not found.`);
      }
      const tierMeta = linePriceTierMeta[index] ?? {
        priceTierId: null,
        priceTierName: null,
        warehouseId: null,
      };

      if (documentType === SaleDocumentType.INVOICE && consumeInventoryOnInvoice) {
        if (!tierMeta.warehouseId) {
          throw new BadRequestException(
            `Warehouse is required for product "${product.name}" delivery line.`,
          );
        }
        const warehouseId = tierMeta.warehouseId;
        await this.branchesService.decreaseStockInBranch(
          manager,
          warehouseId,
          product,
          line.quantity,
          'sale_delivery',
        );
      }

      const saleItem = manager.create(SaleItem, {
        saleId: persistedSale.id,
        productId: product.id,
        warehouseId: tierMeta.warehouseId as string,
        quantity: line.quantity,
        deliveredQuantity:
          documentType === SaleDocumentType.INVOICE ? line.quantity : 0,
        invoicedQuantity:
          documentType === SaleDocumentType.INVOICE ? line.quantity : 0,
        unitPrice: line.unitPrice,
        priceTierId: tierMeta.priceTierId,
        priceTierName: tierMeta.priceTierName,
        lineDiscountType: line.lineDiscountType,
        lineDiscountValue: line.lineDiscountValue,
        lineDiscountAmount: line.lineDiscountAmount,
        lineTaxRate: line.taxRate,
        lineTaxAmount: line.lineTaxAmount,
        lineTotal: line.lineTotal,
      });

      const savedItem = await manager.save(SaleItem, saleItem);
      persistedItems.push(savedItem);

      if (
        documentType === SaleDocumentType.INVOICE &&
        consumeInventoryOnInvoice &&
        tierMeta.warehouseId
      ) {
        const costing = await this.inventoryCostingService.consumeForSale(manager, {
          productId: product.id,
          warehouseId: tierMeta.warehouseId,
          quantity: line.quantity,
          referenceType: 'sale_delivery',
          referenceId: persistedSale.id,
          referenceLineId: savedItem.id,
          actorId: requestUser.userId,
        });
        totalCogs = this.roundMoney(totalCogs + costing.totalCost);
      }
    }

    const persistedPayments: SalePayment[] = [];
    for (const payment of payments) {
      const row = manager.create(SalePayment, {
        saleId: persistedSale.id,
        method: payment.method,
        amount: Number(payment.amount.toFixed(2)),
        reference: payment.reference?.trim() ?? null,
        meta: payment.meta ?? null,
        createdBy: requestUser.userId,
      });
      persistedPayments.push(await manager.save(SalePayment, row));
    }

    if (documentType === SaleDocumentType.INVOICE && persistedSale.customerId) {
      await this.adjustCustomerDue(manager, persistedSale.customerId, persistedSale.dueTotal);
    }

    if (documentType === SaleDocumentType.INVOICE) {
      const occurredAt = (persistedSale.createdAt ?? new Date()).toISOString();

      await this.outboxService.enqueue(manager, {
        eventType: 'sales.invoice_issued',
        idempotencyKey: `sales:invoice:${persistedSale.id}`,
        sourceType: 'sale',
        sourceId: persistedSale.id,
        payload: {
          saleId: persistedSale.id,
          invoiceNumber: persistedSale.invoiceNumber,
          subtotal: persistedSale.subtotal,
          taxTotal: persistedSale.taxTotal,
          grandTotal: persistedSale.grandTotal,
          branchId: persistedSale.branchId,
          occurredAt,
        },
      });

      if (emitDeliveryOutbox) {
        await this.outboxService.enqueue(manager, {
          eventType: 'sales.delivery_posted',
          idempotencyKey: `sales:delivery:${persistedSale.id}`,
          sourceType: 'sale_delivery',
          sourceId: persistedSale.id,
          payload: {
            saleId: persistedSale.id,
            invoiceNumber: persistedSale.invoiceNumber,
            cogsTotal: totalCogs,
            branchId: persistedSale.branchId,
            occurredAt,
          },
        });
      }

      for (const payment of persistedPayments) {
        await this.outboxService.enqueue(manager, {
          eventType: 'sales.payment_received',
          idempotencyKey: `sales:payment:${payment.id}`,
          sourceType: 'sale_payment',
          sourceId: payment.id,
          payload: {
            saleId: persistedSale.id,
            paymentId: payment.id,
            amount: payment.amount,
            branchId: persistedSale.branchId,
            occurredAt,
          },
        });
      }
    }

    const createdSale = await manager.findOne(Sale, {
      where: { id: persistedSale.id },
      relations: { items: true, payments: true, customerEntity: true },
    });

    if (!createdSale) {
      throw new NotFoundException('Unable to load saved sale invoice.');
    }

    createdSale.items = persistedItems;
    createdSale.payments = persistedPayments;
    return this.decorateOverdueFlags(createdSale);
  }

  private async resolveCustomer(
    manager: EntityManager,
    customerId?: number,
  ): Promise<Customer | null> {
    if (!customerId) {
      return null;
    }

    const customer = await manager.findOne(Customer, {
      where: { id: customerId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!customer) {
      throw new NotFoundException(`Customer #${customerId} not found.`);
    }
    return customer;
  }

  private async adjustCustomerDue(
    manager: EntityManager,
    customerId: number,
    amountDelta: number,
  ): Promise<void> {
    await this.partyBalanceService.adjustCustomerDue(
      manager,
      customerId,
      amountDelta,
    );
  }

  private assertCreditLimit(
    customer: Customer | null,
    dueAmount: number,
    requestUser: RequestUser,
  ): void {
    if (!customer || customer.creditLimit === null || dueAmount <= 0) {
      return;
    }

    const projectedAr = this.roundMoney(Number(customer.totalDue) + dueAmount);
    if (projectedAr <= customer.creditLimit) {
      return;
    }

    if (this.canOverrideCreditLimit(requestUser)) {
      return;
    }

    throw new BadRequestException(
      `Credit limit exceeded for customer "${customer.name}". Projected AR ${projectedAr} exceeds limit ${customer.creditLimit}.`,
    );
  }

  private canOverrideCreditLimit(requestUser: RequestUser): boolean {
    const normalizedRoles = new Set(
      [
        ...(requestUser.role ? [requestUser.role] : []),
        ...(requestUser.roles ?? []),
      ]
        .map((role) => role.toLowerCase().trim())
        .filter((role) => role.length > 0),
    );

    if (normalizedRoles.has('super_admin') || normalizedRoles.has('admin')) {
      return true;
    }

    return (requestUser.permissions ?? []).includes('sales.credit_limit_override');
  }

  private async assertPostingPeriodOpen(
    manager: EntityManager,
    postingDate: Date,
  ): Promise<void> {
    const activeLock = await manager
      .createQueryBuilder(PeriodLock, 'period')
      .where('period.is_locked = TRUE')
      .andWhere('period.start_date <= :postingDate', { postingDate })
      .andWhere('period.end_date >= :postingDate', { postingDate })
      .getOne();

    if (!activeLock) {
      return;
    }

    throw new BadRequestException(
      `Posting date ${postingDate.toISOString().slice(0, 10)} is inside a locked accounting period.`,
    );
  }

  private async getSaleForMutation(
    manager: EntityManager,
    id: string,
  ): Promise<Sale & { items: SaleItem[]; payments: SalePayment[]; salesReturns: any[] }> {
    const sale = await manager.findOne(Sale, {
      where: { id },
      relations: {
        items: true,
        payments: true,
        salesReturns: true,
      },
      lock: { mode: 'pessimistic_write' },
    });

    if (!sale) {
      throw new NotFoundException(`Sale "${id}" not found.`);
    }

    return sale;
  }

  private async rollbackSaleEffects(manager: EntityManager, sale: Sale): Promise<void> {
    if (sale.documentType === SaleDocumentType.INVOICE) {
      const items = sale.items ?? [];
      for (const item of items) {
        const product = await manager.findOne(Product, {
          where: { id: item.productId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!product) {
          throw new NotFoundException(`Product "${item.productId}" not found.`);
        }

        if (!item.warehouseId) {
          throw new BadRequestException(
            `Warehouse is required for product "${product.name}" rollback.`,
          );
        }

        await this.branchesService.increaseStockInBranch(
          manager,
          item.warehouseId,
          product,
          item.quantity,
          'sale_delete',
        );
      }
    }

    if (sale.customerId && sale.dueTotal > 0) {
      await this.adjustCustomerDue(manager, sale.customerId, -sale.dueTotal);
    }
  }

  private resolveQuotationStatus(
    validUntil: Date | null,
    requestedStatus: QuotationStatus | null,
  ): QuotationStatus {
    if (requestedStatus === QuotationStatus.DRAFT) {
      return QuotationStatus.DRAFT;
    }

    if (validUntil && validUntil.getTime() < Date.now()) {
      return QuotationStatus.EXPIRED;
    }

    if (requestedStatus === QuotationStatus.EXPIRED) {
      return QuotationStatus.EXPIRED;
    }

    return QuotationStatus.ACTIVE;
  }

  private resolveSaleStatus(paidTotal: number, dueTotal: number): SaleStatus {
    if (dueTotal <= 0) {
      return SaleStatus.PAID;
    }
    if (paidTotal > 0) {
      return SaleStatus.PARTIAL;
    }
    return SaleStatus.UNPAID;
  }

  private async syncQuotationConversionStatus(
    manager: EntityManager,
    quotation: Sale,
    conversionDate: Date,
    latestInvoiceId: string | null,
  ): Promise<void> {
    if (quotation.documentType !== SaleDocumentType.QUOTATION) {
      return;
    }

    const items =
      quotation.items && quotation.items.length > 0
        ? quotation.items
        : await manager.find(SaleItem, {
            where: { saleId: quotation.id },
          });

    const fullyInvoiced =
      items.length > 0 &&
      items.every((item) => item.invoicedQuantity >= item.quantity);

    if (fullyInvoiced) {
      quotation.quotationStatus = QuotationStatus.CONVERTED;
      quotation.convertedAt = conversionDate;
      if (latestInvoiceId) {
        quotation.convertedToSaleId = latestInvoiceId;
      }
    } else {
      quotation.quotationStatus = this.resolveQuotationStatus(
        quotation.validUntil,
        QuotationStatus.ACTIVE,
      );
    }

    await manager.save(Sale, quotation);
  }

  private decorateOverdueFlags(sale: Sale): Sale {
    const termsDays = sale.customerEntity?.creditTermsDays ?? null;
    if (
      sale.documentType !== SaleDocumentType.INVOICE ||
      sale.dueTotal <= 0 ||
      !termsDays ||
      termsDays <= 0
    ) {
      return Object.assign(sale, {
        isOverdue: false,
        overdueDays: 0,
        creditDueDate: null,
      }) as Sale;
    }

    const creditDueDate = new Date(sale.createdAt);
    creditDueDate.setDate(creditDueDate.getDate() + termsDays);

    const overdueDays = Math.max(
      Math.floor((Date.now() - creditDueDate.getTime()) / (1000 * 60 * 60 * 24)),
      0,
    );

    return Object.assign(sale, {
      isOverdue: overdueDays > 0,
      overdueDays,
      creditDueDate: creditDueDate.toISOString().slice(0, 10),
    }) as Sale;
  }

  private async generateDeliveryNumber(manager: EntityManager): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const now = new Date();
      const year = now.getFullYear().toString().slice(-2);
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hour = String(now.getHours()).padStart(2, '0');
      const minute = String(now.getMinutes()).padStart(2, '0');
      const second = String(now.getSeconds()).padStart(2, '0');
      const random = String(Math.floor(Math.random() * 900) + 100);
      const candidate = `DLV-${year}${month}${day}-${hour}${minute}${second}-${random}`;

      const exists = await manager.exists(SaleDelivery, {
        where: { deliveryNumber: candidate },
      });
      if (!exists) {
        return candidate;
      }
    }

    throw new BadRequestException(
      'Unable to allocate a unique delivery number. Please retry.',
    );
  }

  private async generateInvoiceNumber(
    manager: EntityManager,
    documentType: SaleDocumentType,
  ): Promise<string> {
    const prefix = documentType === SaleDocumentType.QUOTATION ? 'QUO' : 'INV';

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const now = new Date();
      const year = now.getFullYear().toString().slice(-2);
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hour = String(now.getHours()).padStart(2, '0');
      const minute = String(now.getMinutes()).padStart(2, '0');
      const second = String(now.getSeconds()).padStart(2, '0');
      const random = String(Math.floor(Math.random() * 900) + 100);
      const candidate = `${prefix}-${year}${month}${day}-${hour}${minute}${second}-${random}`;

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

  private roundMoney(value: number): number {
    return Number(value.toFixed(2));
  }

  private async sendOrderConfirmationIfPossible(sale: Sale): Promise<void> {
    if (sale.documentType !== SaleDocumentType.INVOICE || !sale.customerId) {
      return;
    }

    const customer = await this.salesRepository.manager.findOne(Customer, {
      where: { id: sale.customerId },
    });
    if (!customer?.email) {
      return;
    }

    try {
      await this.notificationsService.sendOrderConfirmation(customer.email, {
        customerName: customer.name,
        invoiceNumber: sale.invoiceNumber,
        grandTotal: sale.grandTotal,
      });
    } catch (error) {
      this.logger.warn(
        `Order confirmation email failed for sale ${sale.id}: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }

  private async sendReceiptIfPossible(sale: Sale): Promise<void> {
    if (!sale.customerId) {
      return;
    }
    const customer = await this.salesRepository.manager.findOne(Customer, {
      where: { id: sale.customerId },
    });
    if (!customer?.email) {
      return;
    }

    try {
      await this.notificationsService.sendReceipt(customer.email, {
        customerName: customer.name,
        invoiceNumber: sale.invoiceNumber,
        paidTotal: sale.paidTotal,
        dueTotal: sale.dueTotal,
      });
    } catch (error) {
      this.logger.warn(
        `Receipt email failed for sale ${sale.id}: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }
}
