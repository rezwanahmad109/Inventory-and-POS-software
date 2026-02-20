import { CanActivate, ExecutionContext, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';

import { AuthController } from '../../src/auth/auth.controller';
import { AuthService } from '../../src/auth/auth.service';
import { JwtAuthGuard } from '../../src/common/guards/jwt-auth.guard';
import { RolesGuard } from '../../src/common/guards/roles.guard';
import { ProductsController } from '../../src/products/products.controller';
import { ProductsService } from '../../src/products/products.service';
import { SalesController } from '../../src/sales/sales.controller';
import { SalesPdfService } from '../../src/sales/sales-pdf.service';
import { SalesService } from '../../src/sales/sales.service';

class MockAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const requestContext = context.switchToHttp().getRequest<{ user?: unknown }>();
    requestContext.user = {
      userId: '00000000-0000-0000-0000-000000000001',
      email: 'qa@example.com',
      role: 'admin',
      roles: ['admin'],
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

describe('Auth + Product + Sales flows (e2e)', () => {
  let app: INestApplication;

  const authService = {
    login: jest.fn().mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      tokenType: 'Bearer',
      expiresIn: '8h',
      refreshExpiresIn: '7d',
      user: {
        id: '00000000-0000-0000-0000-000000000001',
        email: 'qa@example.com',
        name: 'QA User',
        role: 'admin',
        roles: ['admin'],
        permissions: ['products.read', 'products.create', 'sales.create'],
      },
    }),
    refresh: jest.fn(),
    logout: jest.fn(),
  };

  const productsService = {
    create: jest.fn().mockResolvedValue({ id: 'product-1', name: 'Scanner' }),
    findAll: jest.fn().mockResolvedValue({
      items: [{ id: 'product-1', name: 'Scanner' }],
      meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
    }),
    search: jest.fn().mockResolvedValue([]),
    findByBarcode: jest.fn(),
    findLowStockProducts: jest.fn().mockResolvedValue([]),
    exportCsv: jest.fn().mockResolvedValue('id,name\n1,Scanner'),
    importCsv: jest.fn(),
    findOne: jest.fn().mockResolvedValue({ id: 'product-1', name: 'Scanner' }),
    update: jest.fn().mockResolvedValue({ id: 'product-1', name: 'Scanner X' }),
    adjustStock: jest.fn(),
    remove: jest.fn().mockResolvedValue(undefined),
  };

  const salesService = {
    createInvoice: jest.fn().mockResolvedValue({ id: 'sale-1', invoiceNumber: 'INV-1' }),
    findAll: jest.fn().mockResolvedValue({
      items: [{ id: 'sale-1', invoiceNumber: 'INV-1' }],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    }),
    findOne: jest.fn(),
    updateInvoice: jest.fn(),
    removeInvoice: jest.fn(),
    addPayment: jest.fn().mockResolvedValue({ id: 'sale-1', dueTotal: 0 }),
    convertQuotationToSale: jest.fn(),
  };

  beforeAll(async () => {
    const moduleBuilder = Test.createTestingModule({
      controllers: [AuthController, ProductsController, SalesController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: ProductsService, useValue: productsService },
        { provide: SalesService, useValue: salesService },
        { provide: SalesPdfService, useValue: { generateInvoicePdf: jest.fn() } },
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

  it('handles login, product CRUD, and sale payment flow', async () => {
    const productId = '00000000-0000-0000-0000-000000000011';
    const saleId = '00000000-0000-0000-0000-000000000022';

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'qa@example.com', password: 'ChangeMe123!' })
      .expect(200)
      .expect((response) => {
        expect(response.body.accessToken).toBe('access-token');
      });

    await request(app.getHttpServer())
      .post('/products')
      .send({ name: 'Scanner' })
      .expect(201);

    await request(app.getHttpServer())
      .get('/products')
      .query({ page: 1, limit: 10 })
      .expect(200)
      .expect((response) => {
        expect(response.body.meta.page).toBe(1);
      });

    await request(app.getHttpServer())
      .put(`/products/${productId}`)
      .send({ name: 'Scanner X' })
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/products/${productId}`)
      .expect(200);

    await request(app.getHttpServer())
      .post('/sales')
      .send({
        items: [{ productId, quantity: 1 }],
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/sales/${saleId}/payments`)
      .send({ amount: 10, method: 'cash' })
      .expect(201);

    expect(authService.login).toHaveBeenCalled();
    expect(productsService.create).toHaveBeenCalled();
    expect(productsService.update).toHaveBeenCalled();
    expect(productsService.remove).toHaveBeenCalled();
    expect(salesService.createInvoice).toHaveBeenCalled();
    expect(salesService.addPayment).toHaveBeenCalled();
  });
});
