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
import { AccountingEventBusService } from '../common/services/accounting-event-bus.service';
import { PartyBalanceService } from '../common/services/party-balance.service';
import { TransactionRunnerService } from '../common/services/transaction-runner.service';
import { QuotationStatus } from '../common/enums/quotation-status.enum';
import { SaleDocumentType } from '../common/enums/sale-document-type.enum';
import { SaleStatus } from '../common/enums/sale-status.enum';
import { TaxMethod } from '../common/enums/tax-method.enum';
import { Customer } from '../database/entities/customer.entity';
import { ProductPriceTierEntity } from '../database/entities/product-price-tier.entity';
import { Product } from '../database/entities/product.entity';
import { SaleItem } from '../database/entities/sale-item.entity';
import { SalePayment } from '../database/entities/sale-payment.entity';
import { Sale } from '../database/entities/sale.entity';
import { ProductsService } from '../products/products.service';
import { NotificationsService } from '../notifications/notifications.service';
import { computePricing } from './pricing/pricing-engine';
import { ConvertSaleQuotationDto } from './dto/convert-sale-quotation.dto';
import { CreateSaleDto } from './dto/create-sale.dto';
import { RecordSalePaymentDto } from './dto/record-sale-payment.dto';
import { SalesQueryDto } from './dto/sales-query.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
import { PaginatedResponse } from '../common/interfaces/paginated-response.interface';
import { toPaginatedResponse } from '../common/utils/pagination.util';

@Injectable()
export class SalesService {
  private readonly logger = new Logger(SalesService.name);

  constructor(
    @InjectRepository(Sale)
    private readonly salesRepository: Repository<Sale>,
    @InjectRepository(SalePayment)
    private readonly salePaymentsRepository: Repository<SalePayment>,
    private readonly accountingEventBus: AccountingEventBusService,
    private readonly transactionRunner: TransactionRunnerService,
    private readonly partyBalanceService: PartyBalanceService,
    private readonly productsService: ProductsService,
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

    if (sale.documentType === SaleDocumentType.INVOICE) {
      this.accountingEventBus.publish('sale.invoiced', {
        saleId: sale.id,
        invoiceNumber: sale.invoiceNumber,
        subtotal: sale.subtotal,
        taxTotal: sale.taxTotal,
        grandTotal: sale.grandTotal,
        branchId: sale.branchId,
        occurredAt: sale.createdAt ?? new Date(),
      });
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
      if (sale.salesReturns.length > 0) {
        throw new BadRequestException(
          'Sales with linked returns cannot be modified.',
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

      if (sale.salesReturns.length > 0) {
        throw new BadRequestException(
          'Sales with linked returns cannot be deleted.',
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
    const sale = await this.transactionRunner.runInTransaction(async (manager) => {
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

      return this.findOneWithManager(manager, sale.id);
    });

    if (sale.dueTotal <= 0) {
      await this.sendReceiptIfPossible(sale);
    }

    this.accountingEventBus.publish('sale.payment_received', {
      saleId: sale.id,
      amount: paymentDto.amount,
      branchId: sale.branchId,
      occurredAt: new Date(),
    });
    return sale;
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

      if (quotation.quotationStatus === QuotationStatus.CONVERTED) {
        throw new BadRequestException('Quotation is already converted.');
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
        items: quotation.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPriceOverride: item.unitPrice,
          lineDiscountType: item.lineDiscountType,
          lineDiscountValue: item.lineDiscountValue,
        })),
        payments: [],
        notes: convertDto.note?.trim() ?? quotation.notes ?? undefined,
        shippingTotal: quotation.shippingTotal,
      };

      const convertedSale = await this.persistSaleDocument(
        manager,
        createDto,
        requestUser,
      );

      quotation.quotationStatus = QuotationStatus.CONVERTED;
      quotation.convertedAt = convertDto.conversionDate
        ? new Date(convertDto.conversionDate)
        : new Date();
      quotation.convertedToSaleId = convertedSale.id;
      await manager.save(Sale, quotation);

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
    return toPaginatedResponse(sales, total, page, limit);
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
      relations: { items: true, payments: true },
    });
    if (!sale) {
      throw new NotFoundException(`Sale "${id}" not found.`);
    }
    return sale;
  }

  private async persistSaleDocument(
    manager: EntityManager,
    createSaleDto: CreateSaleDto,
    requestUser: RequestUser,
    existingSale?: Sale,
  ): Promise<Sale> {
    if (createSaleDto.items.length === 0) {
      throw new BadRequestException('At least one item is required.');
    }

    const documentType =
      createSaleDto.documentType ??
      existingSale?.documentType ??
      SaleDocumentType.INVOICE;
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

      if (
        documentType === SaleDocumentType.INVOICE &&
        !branchId &&
        product.stockQty < item.quantity
      ) {
        throw new BadRequestException(
          `Insufficient stock for "${product.name}". Available: ${product.stockQty}, requested: ${item.quantity}.`,
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
    sale.dueTotal = this.roundMoney(Math.max(grandTotal - paidTotal, 0));
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
    for (let index = 0; index < pricing.lines.length; index += 1) {
      const line = pricing.lines[index];
      const product = productsById.get(line.productId);
      if (!product) {
        throw new NotFoundException(`Product "${line.productId}" not found.`);
      }
      const tierMeta = linePriceTierMeta[index] ?? {
        priceTierId: null,
        priceTierName: null,
      };

      if (documentType === SaleDocumentType.INVOICE) {
        if (branchId) {
          await this.branchesService.decreaseStockInBranch(
            manager,
            branchId,
            product,
            line.quantity,
            'sale',
          );
        } else {
          const previousStockQty = product.stockQty;
          product.stockQty -= line.quantity;
          await manager.save(Product, product);
          this.productsService.handleStockLevelChange(product, previousStockQty, 'sale');
        }
      }

      const saleItem = manager.create(SaleItem, {
        saleId: persistedSale.id,
        productId: product.id,
        quantity: line.quantity,
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

      persistedItems.push(await manager.save(SaleItem, saleItem));
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

    const createdSale = await manager.findOne(Sale, {
      where: { id: persistedSale.id },
      relations: { items: true, payments: true },
    });

    if (!createdSale) {
      throw new NotFoundException('Unable to load saved sale invoice.');
    }

    createdSale.items = persistedItems;
    createdSale.payments = persistedPayments;
    return createdSale;
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

        if (sale.branchId) {
          await this.branchesService.increaseStockInBranch(
            manager,
            sale.branchId,
            product,
            item.quantity,
            'sale_delete',
          );
        } else {
          const previousStockQty = product.stockQty;
          product.stockQty += item.quantity;
          await manager.save(Product, product);
          this.productsService.handleStockLevelChange(
            product,
            previousStockQty,
            'sale_delete',
          );
        }
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
