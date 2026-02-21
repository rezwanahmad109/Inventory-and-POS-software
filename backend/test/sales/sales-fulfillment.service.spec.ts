import { BadRequestException } from '@nestjs/common';

import { QuotationStatus } from '../../src/common/enums/quotation-status.enum';
import { SaleDocumentType } from '../../src/common/enums/sale-document-type.enum';
import { SaleStatus } from '../../src/common/enums/sale-status.enum';
import { PeriodLock } from '../../src/database/entities/period-lock.entity';
import { Product } from '../../src/database/entities/product.entity';
import { SaleDelivery } from '../../src/database/entities/sale-delivery.entity';
import { SaleItem } from '../../src/database/entities/sale-item.entity';
import { Sale } from '../../src/database/entities/sale.entity';
import { SalesService } from '../../src/sales/sales.service';

function buildOrderLine(overrides: Partial<SaleItem> = {}): SaleItem {
  return {
    id: overrides.id ?? 'line-1',
    saleId: overrides.saleId ?? 'order-1',
    productId: overrides.productId ?? 'product-1',
    warehouseId: overrides.warehouseId ?? 'warehouse-1',
    quantity: overrides.quantity ?? 10,
    deliveredQuantity: overrides.deliveredQuantity ?? 0,
    invoicedQuantity: overrides.invoicedQuantity ?? 0,
    unitPrice: overrides.unitPrice ?? 10,
    priceTierId: null,
    priceTierName: null,
    lineDiscountType: 'none' as any,
    lineDiscountValue: 0,
    lineDiscountAmount: 0,
    lineTaxRate: 0,
    lineTaxAmount: 0,
    lineTotal: 0,
    sale: {} as Sale,
    product: {} as Product,
    warehouse: {} as any,
  };
}

function buildOrder(overrides: Partial<Sale> = {}): Sale {
  return {
    id: overrides.id ?? 'order-1',
    customer: 'Customer',
    customerEntity: null,
    customerId: 1,
    invoiceNumber: overrides.invoiceNumber ?? 'QUO-1',
    legacyPaymentMethod: null,
    paymentMethod: null,
    documentType: overrides.documentType ?? SaleDocumentType.QUOTATION,
    quotationStatus: overrides.quotationStatus ?? QuotationStatus.ACTIVE,
    validUntil: null,
    convertedAt: null,
    convertedToSaleId: null,
    totalAmount: 0,
    subtotal: 0,
    discountTotal: 0,
    taxTotal: 0,
    grandTotal: 0,
    shippingTotal: 0,
    invoiceDiscountType: 'none' as any,
    invoiceDiscountValue: 0,
    invoiceTaxRate: null,
    invoiceTaxMethod: null,
    paidAmount: 0,
    dueAmount: 0,
    paidTotal: 0,
    dueTotal: 0,
    refundedTotal: 0,
    status: SaleStatus.UNPAID,
    branch: null,
    branchId: 'branch-1',
    items: overrides.items ?? [buildOrderLine()],
    payments: [],
    deliveries: [],
    salesReturns: [],
    createdBy: null,
    createdByUserId: null,
    notes: null,
    attachments: null,
    createdAt: new Date('2026-02-01T00:00:00.000Z'),
    updatedAt: new Date('2026-02-01T00:00:00.000Z'),
  };
}

function createService(manager: any) {
  const salesRepository = {
    manager: {
      findOne: jest.fn(),
    },
  } as any;

  const outboxService = {
    enqueue: jest.fn().mockResolvedValue({ id: 'evt-1' }),
  };

  const inventoryCostingService = {
    consumeForSale: jest.fn().mockResolvedValue({ totalCost: 20 }),
  };

  const transactionRunner = {
    runInTransaction: jest.fn(async (cb: (m: any) => Promise<any>) => cb(manager)),
  };

  const partyBalanceService = {
    adjustCustomerDue: jest.fn(),
  };

  const branchesService = {
    decreaseStockInBranch: jest.fn().mockResolvedValue(undefined),
    getBranchOrFail: jest.fn(),
  };

  const notificationsService = {
    sendOrderConfirmation: jest.fn(),
    sendReceipt: jest.fn(),
  };

  const service = new SalesService(
    salesRepository,
    outboxService as any,
    inventoryCostingService as any,
    transactionRunner as any,
    partyBalanceService as any,
    branchesService as any,
    notificationsService as any,
  );

  return {
    service,
    outboxService,
    inventoryCostingService,
    branchesService,
  };
}

function buildPeriodLockQueryBuilder() {
  return {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(null),
  };
}

describe('SalesService fulfillment safeguards', () => {
  it('blocks delivery quantity above ordered remainder', async () => {
    const order = buildOrder({
      items: [
        buildOrderLine({
          id: 'line-1',
          quantity: 10,
          deliveredQuantity: 8,
          invoicedQuantity: 6,
        }),
      ],
    });
    const periodLockQb = buildPeriodLockQueryBuilder();

    const manager = {
      findOne: jest.fn(async (entity: unknown) => {
        if (entity === Sale) {
          return order;
        }
        return null;
      }),
      createQueryBuilder: jest.fn((entity: unknown) => {
        if (entity === PeriodLock) {
          return periodLockQb;
        }
        throw new Error('Unexpected query builder entity');
      }),
      create: jest.fn((_: unknown, payload: any) => payload),
      save: jest.fn(async (_: unknown, payload: any) => payload),
      exists: jest.fn().mockResolvedValue(false),
    };

    const { service } = createService(manager);

    await expect(
      service.createDelivery(
        order.id,
        {
          items: [{ orderItemId: 'line-1', quantity: 3 }],
        },
        {
          userId: 'user-1',
          email: 'qa@example.com',
          role: 'manager',
          roles: ['manager'],
          permissions: ['*'],
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('blocks invoicing quantity above delivered remainder', async () => {
    const order = buildOrder({
      items: [
        buildOrderLine({
          id: 'line-1',
          quantity: 10,
          deliveredQuantity: 5,
          invoicedQuantity: 4,
        }),
      ],
    });

    const manager = {
      findOne: jest.fn(async (entity: unknown) => {
        if (entity === Sale) {
          return order;
        }
        return null;
      }),
      save: jest.fn(async (_: unknown, payload: any) => payload),
    };

    const { service } = createService(manager);

    await expect(
      service.convertQuotationToSale(
        order.id,
        {
          userId: 'user-1',
          email: 'qa@example.com',
          role: 'manager',
          roles: ['manager'],
          permissions: ['*'],
        },
        {
          items: [{ orderItemId: 'line-1', quantity: 3 }],
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('uses delivered-first conversion mode when delivered stock exists', async () => {
    const orderLine = buildOrderLine({
      id: 'line-1',
      quantity: 10,
      deliveredQuantity: 8,
      invoicedQuantity: 4,
    });
    const order = buildOrder({ items: [orderLine] });

    const manager = {
      findOne: jest.fn(async (entity: unknown) => {
        if (entity === Sale) {
          return order;
        }
        return null;
      }),
      save: jest.fn(async (_: unknown, payload: any) => payload),
    };

    const { service } = createService(manager);
    const persistSpy = jest
      .spyOn(service as any, 'persistSaleDocument')
      .mockResolvedValue({
        id: 'invoice-1',
        dueTotal: 40,
        documentType: SaleDocumentType.INVOICE,
      });

    await service.convertQuotationToSale(
      order.id,
      {
        userId: 'user-1',
        email: 'qa@example.com',
        role: 'manager',
        roles: ['manager'],
        permissions: ['*'],
      },
      {},
    );

    expect(persistSpy).toHaveBeenCalledWith(
      manager,
      expect.any(Object),
      expect.any(Object),
      undefined,
      {
        consumeInventoryOnInvoice: false,
        emitDeliveryOutbox: false,
      },
    );
    expect(orderLine.invoicedQuantity).toBe(8);
    expect(orderLine.deliveredQuantity).toBe(8);
  });

  it('falls back to invoice-time fulfillment when no delivery exists', async () => {
    const orderLine = buildOrderLine({
      id: 'line-1',
      quantity: 5,
      deliveredQuantity: 0,
      invoicedQuantity: 0,
    });
    const order = buildOrder({ items: [orderLine] });

    const manager = {
      findOne: jest.fn(async (entity: unknown) => {
        if (entity === Sale) {
          return order;
        }
        return null;
      }),
      save: jest.fn(async (_: unknown, payload: any) => payload),
    };

    const { service } = createService(manager);
    const persistSpy = jest
      .spyOn(service as any, 'persistSaleDocument')
      .mockResolvedValue({
        id: 'invoice-1',
        dueTotal: 50,
        documentType: SaleDocumentType.INVOICE,
      });

    await service.convertQuotationToSale(
      order.id,
      {
        userId: 'user-1',
        email: 'qa@example.com',
        role: 'manager',
        roles: ['manager'],
        permissions: ['*'],
      },
      {},
    );

    expect(persistSpy).toHaveBeenCalledWith(
      manager,
      expect.any(Object),
      expect.any(Object),
      undefined,
      {
        consumeInventoryOnInvoice: true,
        emitDeliveryOutbox: true,
      },
    );
    expect(orderLine.deliveredQuantity).toBe(5);
    expect(orderLine.invoicedQuantity).toBe(5);
  });

  it('posts delivery outbox with unique delivery source id', async () => {
    const orderLine = buildOrderLine({
      id: 'line-1',
      quantity: 10,
      deliveredQuantity: 0,
      invoicedQuantity: 0,
    });
    const order = buildOrder({ items: [orderLine] });
    const periodLockQb = buildPeriodLockQueryBuilder();

    const manager = {
      findOne: jest.fn(async (entity: unknown, options: any) => {
        if (entity === Sale) {
          return order;
        }
        if (entity === Product) {
          return {
            id: orderLine.productId,
            name: 'Item A',
          };
        }
        if (entity === SaleDelivery) {
          return {
            id: options.where.id,
            deliveryNumber: 'DLV-1',
            orderSaleId: order.id,
            totalCogs: 20,
            items: [],
          };
        }
        return null;
      }),
      createQueryBuilder: jest.fn((entity: unknown) => {
        if (entity === PeriodLock) {
          return periodLockQb;
        }
        throw new Error('Unexpected query builder entity');
      }),
      create: jest.fn((_: unknown, payload: any) => payload),
      save: jest.fn(async (entity: unknown, payload: any) => {
        if (entity === SaleDelivery && !payload.id) {
          return {
            ...payload,
            id: 'delivery-1',
            deliveryNumber: payload.deliveryNumber ?? 'DLV-1',
          };
        }
        return payload;
      }),
      exists: jest.fn().mockResolvedValue(false),
    };

    const { service, outboxService, branchesService, inventoryCostingService } =
      createService(manager);

    await service.createDelivery(
      order.id,
      {
        items: [{ orderItemId: orderLine.id, quantity: 2 }],
      },
      {
        userId: 'user-1',
        email: 'qa@example.com',
        role: 'manager',
        roles: ['manager'],
        permissions: ['*'],
      },
    );

    expect(branchesService.decreaseStockInBranch).toHaveBeenCalledTimes(1);
    expect(inventoryCostingService.consumeForSale).toHaveBeenCalledTimes(1);
    expect(outboxService.enqueue).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({
        eventType: 'sales.delivery_posted',
        idempotencyKey: 'sales:delivery:delivery-1',
        sourceId: 'delivery-1',
      }),
    );
    expect(orderLine.deliveredQuantity).toBe(2);
  });

  it('blocks delivery posting inside locked period', async () => {
    const order = buildOrder({
      items: [
        buildOrderLine({
          id: 'line-1',
          quantity: 10,
          deliveredQuantity: 0,
          invoicedQuantity: 0,
        }),
      ],
    });
    const periodLockQb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({
        id: 'lock-1',
        startDate: new Date('2026-02-01'),
        endDate: new Date('2026-02-28'),
      }),
    };

    const manager = {
      findOne: jest.fn(async (entity: unknown) => {
        if (entity === Sale) {
          return order;
        }
        return null;
      }),
      createQueryBuilder: jest.fn((entity: unknown) => {
        if (entity === PeriodLock) {
          return periodLockQb;
        }
        throw new Error('Unexpected query builder entity');
      }),
      create: jest.fn((_: unknown, payload: any) => payload),
      save: jest.fn(async (_: unknown, payload: any) => payload),
      exists: jest.fn().mockResolvedValue(false),
    };

    const { service } = createService(manager);

    await expect(
      service.createDelivery(
        order.id,
        {
          deliveryDate: '2026-02-15',
          items: [{ orderItemId: 'line-1', quantity: 1 }],
        },
        {
          userId: 'user-1',
          email: 'qa@example.com',
          role: 'manager',
          roles: ['manager'],
          permissions: ['*'],
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
