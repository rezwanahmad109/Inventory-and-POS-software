import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { PosOrder } from '../../src/database/entities/pos-order.entity';
import { Product } from '../../src/database/entities/product.entity';
import { ProductsService } from '../../src/products/products.service';
import { SalesService } from '../../src/sales/sales.service';
import { PosService } from '../../src/pos/pos.service';
import { TaxMethod } from '../../src/common/enums/tax-method.enum';

describe('PosService', () => {
  let service: PosService;

  const posOrderRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
  };

  const productsRepository = {
    find: jest.fn(),
  };

  const productsService = {
    search: jest.fn(),
  };

  const salesService = {
    createInvoice: jest.fn(),
    findOne: jest.fn(),
  };

  const dataSource = {
    transaction: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PosService,
        {
          provide: getRepositoryToken(PosOrder),
          useValue: posOrderRepository,
        },
        {
          provide: getRepositoryToken(Product),
          useValue: productsRepository,
        },
        {
          provide: ProductsService,
          useValue: productsService,
        },
        {
          provide: SalesService,
          useValue: salesService,
        },
        {
          provide: DataSource,
          useValue: dataSource,
        },
      ],
    }).compile();

    service = module.get<PosService>(PosService);
  });

  it('creates cart with calculated totals', async () => {
    productsRepository.find.mockResolvedValue([
      {
        id: 'prod-1',
        price: 25,
        taxRate: 0,
        taxMethod: TaxMethod.EXCLUSIVE,
      } as Product,
    ]);

    const manager = {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockImplementation((_entity: any, payload: any) => payload),
      save: jest.fn().mockImplementation((_entity: any, payload: any) => Promise.resolve(payload)),
    };

    dataSource.transaction.mockImplementation(async (cb: any) => cb(manager));

    const result = await service.createCart(
      {
        items: [
          {
            productId: 'prod-1',
            quantity: 2,
          },
        ],
      },
      {
        userId: 'user-1',
        email: 'tester@example.com',
        role: 'cashier',
        roles: ['cashier'],
        permissions: ['pos.access'],
      },
    );

    expect(result.orderNumber).toBe('POS-000001');
    expect(result.grandTotal).toBe(50);
    expect(manager.save).toHaveBeenCalled();
  });

  it('returns existing invoice payload for completed order checkout', async () => {
    posOrderRepository.findOne.mockResolvedValue({
      id: 'order-1',
      status: 'completed',
      invoiceId: 'sale-1',
    } as PosOrder);

    salesService.findOne.mockResolvedValue({ id: 'sale-1', invoiceNumber: 'INV-001' });

    const result = await service.checkoutOrder(
      'order-1',
      {},
      {
        userId: 'user-1',
        email: 'tester@example.com',
        role: 'cashier',
        roles: ['cashier'],
        permissions: ['pos.access'],
      },
    );

    expect(result.sale.id).toBe('sale-1');
    expect(salesService.createInvoice).not.toHaveBeenCalled();
  });
});
