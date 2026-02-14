import { INestApplication, CanActivate, ExecutionContext } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';

import { BranchesController } from '../../src/branches/branches.controller';
import { BranchesService } from '../../src/branches/branches.service';
import { JwtAuthGuard } from '../../src/common/guards/jwt-auth.guard';
import { RolesGuard } from '../../src/common/guards/roles.guard';
import { WalletsController } from '../../src/finance/wallets.controller';
import { WalletsService } from '../../src/finance/services/wallets.service';
import { PosController } from '../../src/pos/pos.controller';
import { PosService } from '../../src/pos/pos.service';
import { PurchaseController } from '../../src/purchase/purchase.controller';
import { PurchaseService } from '../../src/purchase/purchase.service';
import { PurchaseReturnController } from '../../src/purchase-return/purchase-return.controller';
import { PurchaseReturnService } from '../../src/purchase-return/purchase-return.service';
import { ReportsController } from '../../src/reports/reports.controller';
import { ReportsService } from '../../src/reports/reports.service';
import { SalesController } from '../../src/sales/sales.controller';
import { SalesPdfService } from '../../src/sales/sales-pdf.service';
import { SalesService } from '../../src/sales/sales.service';

class MockAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const requestContext = context.switchToHttp().getRequest<{ user?: unknown }>();
    requestContext.user = {
      userId: '00000000-0000-0000-0000-000000000001',
      email: 'qa@example.com',
      role: 'manager',
      roles: ['manager'],
      permissions: ['*'],
    };
    return true;
  }
}

class AllowGuard implements CanActivate {
  canActivate(): boolean {
    return true;
  }
}

describe('Critical Workflows (e2e)', () => {
  let app: INestApplication;

  const salesService = {
    createInvoice: jest.fn().mockResolvedValue({ id: 'sale-1', invoiceNumber: 'INV-1' }),
    addPayment: jest.fn().mockResolvedValue({ id: 'sale-1', dueTotal: 0 }),
  };

  const purchaseService = {
    create: jest.fn().mockResolvedValue({ id: 'purchase-1', invoiceNumber: 'PUR-1' }),
  };

  const purchaseReturnService = {
    create: jest.fn().mockResolvedValue({ id: 'pr-1', debitNoteNumber: 'DN-1' }),
  };

  const posService = {
    checkoutOrder: jest.fn().mockResolvedValue({ order: { id: 'pos-1' }, sale: { id: 'sale-1' } }),
  };

  const walletsService = {
    transfer: jest.fn().mockResolvedValue({
      fromWallet: { id: 'w1', currentBalance: 50 },
      toWallet: { id: 'w2', currentBalance: 150 },
    }),
  };

  const branchesService = {
    initiateStockTransfer: jest.fn().mockResolvedValue({ id: 'st-1', status: 'pending_approval' }),
    approveStockTransfer: jest.fn().mockResolvedValue({ id: 'st-1', status: 'approved' }),
    receiveStockTransfer: jest.fn().mockResolvedValue({ id: 'st-1', status: 'received' }),
  };

  const reportsService = {
    salesSummary: jest.fn().mockResolvedValue({
      reportName: 'sales_summary',
      format: 'csv',
      fileName: 'sales_summary.csv',
    }),
  };

  beforeAll(async () => {
    const moduleBuilder = Test.createTestingModule({
      controllers: [
        SalesController,
        PurchaseController,
        PurchaseReturnController,
        PosController,
        WalletsController,
        BranchesController,
        ReportsController,
      ],
      providers: [
        { provide: SalesService, useValue: salesService },
        { provide: SalesPdfService, useValue: { generateInvoicePdf: jest.fn() } },
        { provide: PurchaseService, useValue: purchaseService },
        { provide: PurchaseReturnService, useValue: purchaseReturnService },
        { provide: PosService, useValue: posService },
        { provide: WalletsService, useValue: walletsService },
        { provide: BranchesService, useValue: branchesService },
        { provide: ReportsService, useValue: reportsService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(new MockAuthGuard())
      .overrideGuard(RolesGuard)
      .useValue(new AllowGuard());

    const moduleRef: TestingModule = await moduleBuilder.compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('handles sales with payment workflow', async () => {
    const saleId = '00000000-0000-0000-0000-000000000111';
    await request(app.getHttpServer())
      .post('/sales')
      .send({
        items: [{ productId: '00000000-0000-0000-0000-000000000011', quantity: 1 }],
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/sales/${saleId}/payments`)
      .send({ amount: 10, method: 'cash' })
      .expect(201);

    expect(salesService.createInvoice).toHaveBeenCalled();
    expect(salesService.addPayment).toHaveBeenCalled();
  });

  it('handles purchase with return and debit note workflow', async () => {
    await request(app.getHttpServer())
      .post('/purchases')
      .send({
        supplierId: '00000000-0000-0000-0000-000000000012',
        items: [
          {
            productId: '00000000-0000-0000-0000-000000000011',
            quantity: 5,
            unitPrice: 20,
          },
        ],
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/purchase-returns')
      .send({
        originalPurchaseId: '00000000-0000-0000-0000-000000000013',
        items: [
          {
            productId: '00000000-0000-0000-0000-000000000011',
            quantity: 1,
          },
        ],
      })
      .expect(201);

    expect(purchaseService.create).toHaveBeenCalled();
    expect(purchaseReturnService.create).toHaveBeenCalled();
  });

  it('handles POS checkout workflow', async () => {
    await request(app.getHttpServer())
      .post('/pos/orders/00000000-0000-0000-0000-000000000201/checkout')
      .send({
        payments: [{ amount: 30, method: 'cash' }],
      })
      .expect(201);

    expect(posService.checkoutOrder).toHaveBeenCalled();
  });

  it('handles cash transfer workflow', async () => {
    await request(app.getHttpServer())
      .post('/api/wallets/transfer')
      .send({
        fromWalletId: '00000000-0000-0000-0000-000000000301',
        toWalletId: '00000000-0000-0000-0000-000000000302',
        amount: 50,
      })
      .expect(201);

    expect(walletsService.transfer).toHaveBeenCalled();
  });

  it('handles stock transfer lifecycle workflow', async () => {
    const transferId = '00000000-0000-0000-0000-000000000401';
    await request(app.getHttpServer())
      .post('/stock-transfers')
      .send({
        fromBranchId: '00000000-0000-0000-0000-000000000501',
        toBranchId: '00000000-0000-0000-0000-000000000502',
        productId: '00000000-0000-0000-0000-000000000011',
        quantity: 3,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/stock-transfers/${transferId}/approve`)
      .send({})
      .expect(201);

    await request(app.getHttpServer())
      .post(`/stock-transfers/${transferId}/receive`)
      .send({})
      .expect(201);

    expect(branchesService.initiateStockTransfer).toHaveBeenCalled();
    expect(branchesService.approveStockTransfer).toHaveBeenCalled();
    expect(branchesService.receiveStockTransfer).toHaveBeenCalled();
  });

  it('handles report export workflow', async () => {
    await request(app.getHttpServer())
      .get('/reports/sales-summary')
      .query({
        from: '2026-01-01',
        to: '2026-01-31',
        format: 'csv',
      })
      .expect(200);

    expect(reportsService.salesSummary).toHaveBeenCalled();
  });
});
