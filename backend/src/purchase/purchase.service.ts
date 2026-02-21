import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';

import { BranchesService } from '../branches/branches.service';
import { PurchaseDocumentType } from '../common/enums/purchase-document-type.enum';
import { PurchaseStatus } from '../common/enums/purchase-status.enum';
import { QuotationStatus } from '../common/enums/quotation-status.enum';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { AccountingEventBusService } from '../common/services/accounting-event-bus.service';
import { InventoryCostingService } from '../common/services/inventory-costing.service';
import { PartyBalanceService } from '../common/services/party-balance.service';
import { TransactionRunnerService } from '../common/services/transaction-runner.service';
import { Product } from '../database/entities/product.entity';
import { PurchaseItem } from '../database/entities/purchase-item.entity';
import { PurchasePayment } from '../database/entities/purchase-payment.entity';
import { Purchase } from '../database/entities/purchase.entity';
import { Supplier } from '../database/entities/supplier.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { ConvertPurchaseEstimateDto } from './dto/convert-purchase-estimate.dto';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { PurchaseQueryDto } from './dto/purchase-query.dto';
import { RecordPurchasePaymentDto } from './dto/record-purchase-payment.dto';
import { UpdatePurchaseDto } from './dto/update-purchase.dto';
import { PaginatedResponse } from '../common/interfaces/paginated-response.interface';
import { toPaginatedResponse } from '../common/utils/pagination.util';

@Injectable()
export class PurchaseService {
  private readonly logger = new Logger(PurchaseService.name);

  constructor(
    @InjectRepository(Purchase)
    private readonly purchaseRepository: Repository<Purchase>,
    private readonly accountingEventBus: AccountingEventBusService,
    private readonly transactionRunner: TransactionRunnerService,
    private readonly inventoryCostingService: InventoryCostingService,
    private readonly partyBalanceService: PartyBalanceService,
    private readonly branchesService: BranchesService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async findAll(query: PurchaseQueryDto): Promise<PaginatedResponse<Purchase>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.purchaseRepository
      .createQueryBuilder('purchase')
      .leftJoinAndSelect('purchase.items', 'items')
      .leftJoinAndSelect('purchase.payments', 'payments')
      .distinct(true)
      .orderBy('purchase.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query.branchId) {
      qb.andWhere('purchase.branch_id = :branchId', { branchId: query.branchId });
    }
    if (query.supplierId) {
      qb.andWhere('purchase.supplier_id = :supplierId', {
        supplierId: query.supplierId,
      });
    }
    if (query.status) {
      qb.andWhere('purchase.status = :status', { status: query.status });
    }
    if (query.documentType) {
      qb.andWhere('purchase.document_type = :documentType', {
        documentType: query.documentType,
      });
    }
    if (query.from) {
      qb.andWhere('purchase.created_at >= :from', { from: query.from });
    }
    if (query.to) {
      qb.andWhere('purchase.created_at <= :to', { to: query.to });
    }

    const [purchases, total] = await qb.getManyAndCount();
    return toPaginatedResponse(purchases, total, page, limit);
  }

  async findOne(id: string): Promise<Purchase> {
    const purchase = await this.purchaseRepository.findOne({
      where: { id },
      relations: { items: true, payments: true },
    });
    if (!purchase) {
      throw new NotFoundException(`Purchase "${id}" not found.`);
    }
    return purchase;
  }

  async create(
    createPurchaseDto: CreatePurchaseDto,
    requestUser?: RequestUser,
  ): Promise<Purchase> {
    const purchase = await this.transactionRunner.runInTransaction(async (manager) =>
      this.persistPurchaseDocument(manager, createPurchaseDto, requestUser),
    );
    await this.sendPurchaseNotificationIfPossible(purchase);
    if (purchase.documentType === PurchaseDocumentType.BILL) {
      this.accountingEventBus.publish('purchase.billed', {
        purchaseId: purchase.id,
        invoiceNumber: purchase.invoiceNumber,
        subtotal: purchase.subtotal,
        taxTotal: purchase.taxTotal,
        grandTotal: purchase.grandTotal,
        branchId: purchase.branchId,
        occurredAt: purchase.createdAt ?? new Date(),
      });
    }
    return purchase;
  }

  async update(
    id: string,
    updatePurchaseDto: UpdatePurchaseDto,
    requestUser?: RequestUser,
  ): Promise<Purchase> {
    if (!updatePurchaseDto.items || updatePurchaseDto.items.length === 0) {
      throw new BadRequestException('items are required to update a purchase document.');
    }

    const purchase = await this.transactionRunner.runInTransaction(async (manager) => {
      const purchase = await this.getPurchaseForMutation(manager, id);
      if (purchase.purchaseReturns.length > 0) {
        throw new BadRequestException(
          'Purchases with linked returns cannot be modified.',
        );
      }

      await this.rollbackPurchaseEffects(manager, purchase);
      await manager.delete(PurchaseItem, { purchaseId: purchase.id });
      await manager.delete(PurchasePayment, { purchaseId: purchase.id });

      return this.persistPurchaseDocument(
        manager,
        updatePurchaseDto as CreatePurchaseDto,
        requestUser,
        purchase,
      );
    });
    return purchase;
  }

  async remove(id: string): Promise<void> {
    await this.transactionRunner.runInTransaction(async (manager) => {
      const purchase = await this.getPurchaseForMutation(manager, id);
      if (purchase.purchaseReturns.length > 0) {
        throw new BadRequestException(
          'Purchases with linked returns cannot be deleted.',
        );
      }

      await this.rollbackPurchaseEffects(manager, purchase);
      await manager.remove(Purchase, purchase);
    });
  }

  async addPayment(
    purchaseId: string,
    paymentDto: RecordPurchasePaymentDto,
    requestUser?: RequestUser,
  ): Promise<Purchase> {
    const purchase = await this.transactionRunner.runInTransaction(async (manager) => {
      const purchase = await manager.findOne(Purchase, {
        where: { id: purchaseId },
        relations: { payments: true },
        lock: { mode: 'pessimistic_write' },
      });
      if (!purchase) {
        throw new NotFoundException(`Purchase "${purchaseId}" not found.`);
      }

      if (purchase.documentType !== PurchaseDocumentType.BILL) {
        throw new BadRequestException('Payments can only be applied to purchase bills.');
      }

      const amount = Number(paymentDto.amount.toFixed(2));
      if (amount <= 0) {
        throw new BadRequestException('Payment amount must be positive.');
      }
      if (amount > purchase.dueTotal) {
        throw new BadRequestException(
          `Payment amount (${amount}) exceeds bill due (${purchase.dueTotal}).`,
        );
      }

      const payment = manager.create(PurchasePayment, {
        purchaseId: purchase.id,
        method: paymentDto.method,
        amount,
        reference: paymentDto.reference?.trim() ?? null,
        meta: paymentDto.meta ?? null,
        createdBy: requestUser?.userId ?? null,
      });
      await manager.save(PurchasePayment, payment);

      purchase.paidTotal = this.roundMoney(purchase.paidTotal + amount);
      purchase.dueTotal = this.roundMoney(
        Math.max(purchase.grandTotal - purchase.paidTotal, 0),
      );
      purchase.status = this.resolvePurchaseStatus(purchase.paidTotal, purchase.dueTotal);
      await manager.save(Purchase, purchase);

      if (amount > 0) {
        await this.adjustSupplierPayable(manager, purchase.supplierId, -amount);
      }

      return this.findOneWithManager(manager, purchase.id);
    });

    this.accountingEventBus.publish('purchase.payment_sent', {
      purchaseId: purchase.id,
      amount: paymentDto.amount,
      branchId: purchase.branchId,
      occurredAt: new Date(),
    });
    return purchase;
  }

  async convertEstimateToPurchase(
    id: string,
    requestUser: RequestUser,
    convertDto: ConvertPurchaseEstimateDto,
  ): Promise<{ estimate: Purchase; purchase: Purchase }> {
    return this.transactionRunner.runInTransaction(async (manager) => {
      const estimate = await manager.findOne(Purchase, {
        where: { id },
        relations: { items: true },
        lock: { mode: 'pessimistic_write' },
      });

      if (!estimate) {
        throw new NotFoundException(`Purchase "${id}" not found.`);
      }

      if (estimate.documentType !== PurchaseDocumentType.ESTIMATE) {
        throw new BadRequestException('Only estimates can be converted to bills.');
      }

      if (estimate.quotationStatus === QuotationStatus.CONVERTED) {
        throw new BadRequestException('Estimate is already converted.');
      }

      const createDto: CreatePurchaseDto = {
        branchId: estimate.branchId ?? undefined,
        documentType: PurchaseDocumentType.BILL,
        supplierId: estimate.supplierId,
        items: estimate.items.map((item) => ({
          productId: item.productId,
          warehouseId: item.warehouseId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
        payments: [],
        notes: convertDto.note?.trim() ?? estimate.notes ?? undefined,
      };

      const convertedPurchase = await this.persistPurchaseDocument(
        manager,
        createDto,
        requestUser,
      );

      estimate.quotationStatus = QuotationStatus.CONVERTED;
      estimate.convertedAt = convertDto.conversionDate
        ? new Date(convertDto.conversionDate)
        : new Date();
      estimate.convertedToPurchaseId = convertedPurchase.id;
      await manager.save(Purchase, estimate);

      return {
        estimate,
        purchase: convertedPurchase,
      };
    });
  }

  private async persistPurchaseDocument(
    manager: EntityManager,
    dto: CreatePurchaseDto,
    requestUser?: RequestUser,
    existingPurchase?: Purchase,
  ): Promise<Purchase> {
    if (dto.items.length === 0) {
      throw new BadRequestException('At least one item is required.');
    }

    const supplierId = dto.supplierId ?? existingPurchase?.supplierId;
    if (!supplierId) {
      throw new BadRequestException('supplierId is required.');
    }

    const supplier = await manager.findOne(Supplier, {
      where: { id: supplierId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!supplier) {
      throw new NotFoundException(`Supplier "${supplierId}" not found.`);
    }

    const documentType =
      dto.documentType ??
      existingPurchase?.documentType ??
      PurchaseDocumentType.BILL;
    if (
      existingPurchase &&
      existingPurchase.documentType !== documentType &&
      existingPurchase.documentType === PurchaseDocumentType.BILL
    ) {
      throw new BadRequestException('Purchase bill cannot be downgraded to estimate.');
    }

    const branchId =
      dto.branchId === undefined
        ? (existingPurchase?.branchId ?? null)
        : dto.branchId;

    if (branchId) {
      const branch = await this.branchesService.getBranchOrFail(branchId, manager);
      if (!branch.isActive) {
        throw new BadRequestException(
          `Branch "${branch.name}" is inactive. Purchases cannot be posted to this branch.`,
        );
      }
    }

    const purchase =
      existingPurchase ??
      manager.create(Purchase, {
        invoiceNumber: await this.generateInvoiceNumber(manager, documentType),
      });

    purchase.supplier = supplier;
    purchase.supplierId = supplier.id;
    purchase.branchId = branchId;
    purchase.documentType = documentType;
    purchase.validUntil =
      dto.validUntil !== undefined ? new Date(dto.validUntil) : (existingPurchase?.validUntil ?? null);
    purchase.convertedAt = existingPurchase?.convertedAt ?? null;
    purchase.convertedToPurchaseId = existingPurchase?.convertedToPurchaseId ?? null;
    purchase.notes = dto.notes?.trim() ?? null;
    purchase.attachments =
      dto.attachments !== undefined
        ? dto.attachments
        : (existingPurchase?.attachments ?? null);

    const payments = dto.payments ?? [];
    if (documentType === PurchaseDocumentType.ESTIMATE && payments.length > 0) {
      throw new BadRequestException('Estimate documents cannot receive payments.');
    }

    const productsById = new Map<string, Product>();
    const lines: Array<{
      productId: string;
      warehouseId: string;
      quantity: number;
      unitPrice: number;
      total: number;
    }> = [];
    let subtotal = 0;

    for (const inputItem of dto.items) {
      const product = await manager.findOne(Product, {
        where: { id: inputItem.productId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!product) {
        throw new NotFoundException(`Product "${inputItem.productId}" not found.`);
      }

      const resolvedWarehouseId =
        inputItem.warehouseId ?? branchId ?? product.defaultWarehouseId ?? null;
      if (!resolvedWarehouseId) {
        throw new BadRequestException(
          `Warehouse is required for product "${product.name}" purchase line.`,
        );
      }

      const unitPrice = Number(inputItem.unitPrice.toFixed(2));
      const total = this.roundMoney(unitPrice * inputItem.quantity);
      subtotal = this.roundMoney(subtotal + total);

      productsById.set(product.id, product);
      lines.push({
        productId: product.id,
        warehouseId: resolvedWarehouseId,
        quantity: inputItem.quantity,
        unitPrice,
        total,
      });
    }

    purchase.subtotal = subtotal;
    purchase.discountTotal = 0;
    purchase.taxTotal = 0;
    purchase.grandTotal = subtotal;
    purchase.totalAmount = subtotal;

    purchase.paidTotal = this.roundMoney(
      payments.reduce((sum, payment) => sum + payment.amount, 0),
    );
    if (purchase.paidTotal > purchase.grandTotal) {
      throw new BadRequestException(
        `Paid amount (${purchase.paidTotal}) cannot exceed bill total (${purchase.grandTotal}).`,
      );
    }

    purchase.dueTotal = this.roundMoney(
      Math.max(purchase.grandTotal - purchase.paidTotal, 0),
    );
    purchase.status =
      documentType === PurchaseDocumentType.ESTIMATE
        ? PurchaseStatus.UNPAID
        : this.resolvePurchaseStatus(purchase.paidTotal, purchase.dueTotal);

    purchase.quotationStatus =
      documentType === PurchaseDocumentType.ESTIMATE
        ? this.resolveQuotationStatus(
            purchase.validUntil,
            dto.quotationStatus ?? null,
          )
        : null;

    const persistedPurchase = await manager.save(Purchase, purchase);

    const persistedItems: PurchaseItem[] = [];
    for (const line of lines) {
      const product = productsById.get(line.productId);
      if (!product) {
        throw new NotFoundException(`Product "${line.productId}" not found.`);
      }

      if (documentType === PurchaseDocumentType.BILL) {
        await this.branchesService.increaseStockInBranch(
          manager,
          line.warehouseId,
          product,
          line.quantity,
          'purchase',
        );
      }

      const item = manager.create(PurchaseItem, {
        purchaseId: persistedPurchase.id,
        productId: product.id,
        warehouseId: line.warehouseId,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        total: line.total,
      });
      const savedItem = await manager.save(PurchaseItem, item);
      persistedItems.push(savedItem);

      if (documentType === PurchaseDocumentType.BILL) {
        await this.inventoryCostingService.createPurchaseLayer(manager, {
          productId: product.id,
          warehouseId: line.warehouseId,
          quantity: line.quantity,
          unitCost: line.unitPrice,
          sourceId: persistedPurchase.id,
          sourceLineId: savedItem.id,
        });
      }
    }

    const persistedPayments: PurchasePayment[] = [];
    for (const payment of payments) {
      const row = manager.create(PurchasePayment, {
        purchaseId: persistedPurchase.id,
        method: payment.method,
        amount: Number(payment.amount.toFixed(2)),
        reference: payment.reference?.trim() ?? null,
        meta: payment.meta ?? null,
        createdBy: requestUser?.userId ?? null,
      });
      persistedPayments.push(await manager.save(PurchasePayment, row));
    }

    if (documentType === PurchaseDocumentType.BILL && persistedPurchase.dueTotal > 0) {
      await this.adjustSupplierPayable(
        manager,
        persistedPurchase.supplierId,
        persistedPurchase.dueTotal,
      );
    }

    const createdPurchase = await manager.findOne(Purchase, {
      where: { id: persistedPurchase.id },
      relations: { items: true, payments: true },
    });

    if (!createdPurchase) {
      throw new NotFoundException('Unable to load saved purchase document.');
    }

    createdPurchase.items = persistedItems;
    createdPurchase.payments = persistedPayments;
    return createdPurchase;
  }

  private async rollbackPurchaseEffects(
    manager: EntityManager,
    purchase: Purchase,
  ): Promise<void> {
    if (purchase.documentType === PurchaseDocumentType.BILL) {
      const items = purchase.items ?? [];
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

        await this.branchesService.decreaseStockInBranch(
          manager,
          item.warehouseId,
          product,
          item.quantity,
          'purchase_delete',
        );

        await this.inventoryCostingService.consumeForPurchaseReturn(manager, {
          productId: product.id,
          warehouseId: item.warehouseId,
          quantity: item.quantity,
          referenceType: 'purchase_delete',
          referenceId: purchase.id,
          referenceLineId: item.id,
          actorId: null,
        });
      }
    }

    if (purchase.dueTotal > 0) {
      await this.adjustSupplierPayable(manager, purchase.supplierId, -purchase.dueTotal);
    }
  }

  private async getPurchaseForMutation(
    manager: EntityManager,
    id: string,
  ): Promise<Purchase> {
    const purchase = await manager.findOne(Purchase, {
      where: { id },
      relations: {
        items: true,
        payments: true,
        purchaseReturns: true,
      },
      lock: { mode: 'pessimistic_write' },
    });

    if (!purchase) {
      throw new NotFoundException(`Purchase "${id}" not found.`);
    }

    return purchase;
  }

  private async findOneWithManager(
    manager: EntityManager,
    purchaseId: string,
  ): Promise<Purchase> {
    const purchase = await manager.findOne(Purchase, {
      where: { id: purchaseId },
      relations: { items: true, payments: true },
    });
    if (!purchase) {
      throw new NotFoundException(`Purchase "${purchaseId}" not found.`);
    }
    return purchase;
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

  private async generateInvoiceNumber(
    manager: EntityManager,
    documentType: PurchaseDocumentType,
  ): Promise<string> {
    const code = documentType === PurchaseDocumentType.ESTIMATE ? 'EST' : 'PUR';

    const latest = await manager
      .createQueryBuilder(Purchase, 'purchase')
      .setLock('pessimistic_write')
      .where('purchase.invoice_number LIKE :prefix', { prefix: `${code}-%` })
      .orderBy('purchase.created_at', 'DESC')
      .addOrderBy('purchase.id', 'DESC')
      .getOne();

    if (!latest) {
      return `${code}-0001`;
    }

    const match = new RegExp(`^${code}-(\\d+)$`).exec(latest.invoiceNumber);
    const lastNumber = match ? Number(match[1]) : 0;
    const nextNumber = lastNumber + 1;
    return `${code}-${String(nextNumber).padStart(4, '0')}`;
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

  private roundMoney(value: number): number {
    return Number(value.toFixed(2));
  }

  private async sendPurchaseNotificationIfPossible(
    purchase: Purchase,
  ): Promise<void> {
    if (purchase.documentType !== PurchaseDocumentType.BILL) {
      return;
    }

    const supplier = await this.purchaseRepository.manager.findOne(Supplier, {
      where: { id: purchase.supplierId },
    });
    if (!supplier?.email) {
      return;
    }

    try {
      await this.notificationsService.sendPurchaseOrder(supplier.email, {
        supplierName: supplier.name,
        invoiceNumber: purchase.invoiceNumber,
        grandTotal: purchase.grandTotal,
      });
    } catch (error) {
      this.logger.warn(
        `Purchase notification failed for purchase ${purchase.id}: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }
}
