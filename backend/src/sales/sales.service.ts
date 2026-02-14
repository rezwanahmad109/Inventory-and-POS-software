import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';

import { BranchesService } from '../branches/branches.service';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { QuotationStatus } from '../common/enums/quotation-status.enum';
import { SaleDocumentType } from '../common/enums/sale-document-type.enum';
import { SaleStatus } from '../common/enums/sale-status.enum';
import { TaxMethod } from '../common/enums/tax-method.enum';
import { Customer } from '../database/entities/customer.entity';
import { Product } from '../database/entities/product.entity';
import { SaleItem } from '../database/entities/sale-item.entity';
import { SalePayment } from '../database/entities/sale-payment.entity';
import { Sale } from '../database/entities/sale.entity';
import { ProductsService } from '../products/products.service';
import { computePricing } from './pricing/pricing-engine';
import { ConvertSaleQuotationDto } from './dto/convert-sale-quotation.dto';
import { CreateSaleDto } from './dto/create-sale.dto';
import { RecordSalePaymentDto } from './dto/record-sale-payment.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';

@Injectable()
export class SalesService {
  constructor(
    @InjectRepository(Sale)
    private readonly salesRepository: Repository<Sale>,
    @InjectRepository(SalePayment)
    private readonly salePaymentsRepository: Repository<SalePayment>,
    private readonly dataSource: DataSource,
    private readonly productsService: ProductsService,
    private readonly branchesService: BranchesService,
  ) {}

  async createInvoice(
    createSaleDto: CreateSaleDto,
    requestUser: RequestUser,
  ): Promise<Sale> {
    return this.dataSource.transaction(async (manager) =>
      this.persistSaleDocument(manager, createSaleDto, requestUser),
    );
  }

  async updateInvoice(
    id: string,
    updateSaleDto: UpdateSaleDto,
    requestUser: RequestUser,
  ): Promise<Sale> {
    if (!updateSaleDto.items || updateSaleDto.items.length === 0) {
      throw new BadRequestException('items are required to update a sale invoice.');
    }

    return this.dataSource.transaction(async (manager) => {
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
    await this.dataSource.transaction(async (manager) => {
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
    return this.dataSource.transaction(async (manager) => {
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
  }

  async convertQuotationToSale(
    id: string,
    requestUser: RequestUser,
    convertDto: ConvertSaleQuotationDto,
  ): Promise<{ quotation: Sale; sale: Sale }> {
    return this.dataSource.transaction(async (manager) => {
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

  async findAll(): Promise<Sale[]> {
    return this.salesRepository.find({
      relations: { items: true, payments: true },
      order: { createdAt: 'DESC' },
    });
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

      const unitPrice = Number(
        (item.unitPriceOverride ?? Number(product.price)).toFixed(2),
      );
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

    sale.quotationStatus =
      documentType === SaleDocumentType.QUOTATION
        ? this.resolveQuotationStatus(
            sale.validUntil,
            createSaleDto.quotationStatus ?? null,
          )
        : null;

    const persistedSale = await manager.save(Sale, sale);

    const persistedItems: SaleItem[] = [];
    for (const line of pricing.lines) {
      const product = productsById.get(line.productId);
      if (!product) {
        throw new NotFoundException(`Product "${line.productId}" not found.`);
      }

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
}
