import { CanActivate, ExecutionContext, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';

import { JwtAuthGuard } from '../../src/common/guards/jwt-auth.guard';
import { RolesGuard } from '../../src/common/guards/roles.guard';
import { NotificationsController } from '../../src/notifications/notifications.controller';
import { NotificationsService } from '../../src/notifications/notifications.service';
import { ReportsController } from '../../src/reports/reports.controller';
import { ReportsService } from '../../src/reports/reports.service';
import { UploadsController } from '../../src/uploads/uploads.controller';
import { UploadsService } from '../../src/uploads/uploads.service';

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

describe('Reports + Notifications + Uploads validation (e2e)', () => {
  let app: INestApplication;

  const notificationsService = {
    findTemplates: jest.fn().mockResolvedValue([]),
    createTemplate: jest.fn(),
    updateTemplate: jest.fn(),
    removeTemplate: jest.fn(),
    sendNotification: jest.fn().mockResolvedValue({
      transport: 'spool',
      templateKey: 'order_confirmation',
      to: 'john@example.com',
      subject: 'Order confirmation',
      body: 'Body',
      queuedAt: new Date().toISOString(),
    }),
  };

  const uploadsService = {
    uploadAttachment: jest.fn(),
    createSignedUrl: jest.fn(),
    linkAttachment: jest.fn().mockResolvedValue({
      id: '00000000-0000-0000-0000-000000000011',
      resourceType: 'sale',
      resourceId: 'INV-1001',
    }),
    resolveDownload: jest.fn(),
  };

  const reportsService = {
    salesSummary: jest.fn().mockResolvedValue({ totalSales: 1000 }),
    purchaseSummary: jest.fn(),
    expenseSummary: jest.fn(),
    profitLoss: jest.fn(),
    stockSummary: jest.fn(),
    rateList: jest.fn(),
    productSalesSummary: jest.fn(),
    usersReport: jest.fn(),
  };

  beforeAll(async () => {
    const moduleBuilder = Test.createTestingModule({
      controllers: [NotificationsController, UploadsController, ReportsController],
      providers: [
        { provide: NotificationsService, useValue: notificationsService },
        { provide: UploadsService, useValue: uploadsService },
        { provide: ReportsService, useValue: reportsService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(new MockAuthGuard())
      .overrideGuard(RolesGuard)
      .useValue(new AllowGuard());

    const moduleRef: TestingModule = await moduleBuilder.compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 400 when notification payload has invalid email', async () => {
    await request(app.getHttpServer())
      .post('/notifications/send')
      .send({
        templateKey: 'order_confirmation',
        to: 'invalid-email',
      })
      .expect(400);
  });

  it('sends notification when payload is valid', async () => {
    await request(app.getHttpServer())
      .post('/notifications/send')
      .send({
        templateKey: 'order_confirmation',
        to: 'john@example.com',
        context: { invoiceNumber: 'INV-1001' },
      })
      .expect(201)
      .expect((response) => {
        expect(response.body.templateKey).toBe('order_confirmation');
      });

    expect(notificationsService.sendNotification).toHaveBeenCalledTimes(1);
  });

  it('rejects unknown fields on upload link DTO', async () => {
    const id = '00000000-0000-0000-0000-000000000011';

    await request(app.getHttpServer())
      .post(`/uploads/attachments/${id}/link`)
      .send({
        resourceType: 'sale',
        resourceId: 'INV-1001',
        unknownField: 'forbidden',
      })
      .expect(400);
  });

  it('validates report date query inputs', async () => {
    await request(app.getHttpServer())
      .get('/reports/sales-summary')
      .query({
        from: 'not-a-date',
        to: '2026-02-28',
      })
      .expect(400);
  });

  it('returns reports data for valid query', async () => {
    await request(app.getHttpServer())
      .get('/reports/sales-summary')
      .query({
        from: '2026-02-01',
        to: '2026-02-28',
      })
      .expect(200)
      .expect((response) => {
        expect(response.body.totalSales).toBe(1000);
      });

    expect(reportsService.salesSummary).toHaveBeenCalledTimes(1);
  });
});
