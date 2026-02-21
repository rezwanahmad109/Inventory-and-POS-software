import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { FinancePaymentDirection } from '../../src/finance/finance.enums';
import { FinancePaymentsService } from '../../src/finance/services/finance-payments.service';

function createServiceWithManager(manager: any) {
  const dataSource = {
    transaction: jest.fn(async (cb: (m: any) => any) => cb(manager)),
  } as unknown as DataSource;

  const journalPostingService = {
    post: jest.fn().mockResolvedValue({ id: 'journal-1' }),
  } as any;

  return new FinancePaymentsService(
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    journalPostingService,
    dataSource,
  );
}

function baseDto() {
  return {
    partyId: 'party-1',
    walletId: 'wallet-1',
    direction: FinancePaymentDirection.RECEIPT,
    amount: 50,
    paymentMethod: 'cash' as const,
    idempotencyKey: 'pay-1',
  };
}

describe('FinancePaymentsService allocation safety', () => {
  it('rejects non-receipt payment direction for AR flow', async () => {
    const service = createServiceWithManager({});

    await expect(
      service.create(
        {
          ...baseDto(),
          direction: FinancePaymentDirection.DISBURSEMENT,
        } as any,
        'user-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('prevents allocation above invoice balance', async () => {
    const invoice = {
      id: 'inv-1',
      documentNo: 'SI-1',
      documentType: 'sales_invoice',
      partyId: 'party-1',
      invoiceBalance: 20,
      balanceDue: 20,
      status: 'open',
    };

    const manager: any = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce({ id: 'wallet-1', currency: 'USD', currentBalance: 10 })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(invoice),
      create: jest.fn((_: unknown, payload: any) => payload),
      save: jest.fn(async (_: unknown, payload: any) => ({ id: payload.id ?? 'row-1', ...payload })),
    };

    const service = createServiceWithManager(manager);

    await expect(
      service.create(
        {
          ...baseDto(),
          allocations: [{ invoiceId: 'inv-1', allocatedAmount: 30 }],
        } as any,
        'user-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('auto-allocates FIFO when no explicit allocations are provided', async () => {
    const invoices = [
      {
        id: 'inv-1',
        documentNo: 'SI-1',
        documentType: 'sales_invoice',
        partyId: 'party-1',
        invoiceBalance: 30,
        balanceDue: 30,
        status: 'open',
      },
      {
        id: 'inv-2',
        documentNo: 'SI-2',
        documentType: 'sales_invoice',
        partyId: 'party-1',
        invoiceBalance: 40,
        balanceDue: 40,
        status: 'open',
      },
    ];

    const byId = new Map(invoices.map((invoice) => [invoice.id, invoice]));

    const qb = {
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(invoices),
    };

    const manager: any = {
      findOne: jest.fn(async (_entity: unknown, options: any) => {
        if (options?.where?.id === 'wallet-1') {
          return { id: 'wallet-1', currency: 'USD', currentBalance: 100 };
        }
        if (options?.where?.idempotencyKey) {
          return null;
        }
        if (options?.where?.id) {
          return byId.get(options.where.id) ?? null;
        }
        return null;
      }),
      create: jest.fn((_: unknown, payload: any) => payload),
      save: jest.fn(async (_: unknown, payload: any) => ({ id: payload.id ?? 'row-1', ...payload })),
      createQueryBuilder: jest.fn(() => qb),
      getRepository: jest.fn(() => ({ findOne: jest.fn().mockResolvedValue({ id: 'acc' }) })),
    };

    const service = createServiceWithManager(manager);

    await service.create(baseDto() as any, 'user-1');

    expect(invoices[0].invoiceBalance).toBe(0);
    expect(invoices[1].invoiceBalance).toBe(20);

    const paymentAllocationSaves = manager.save.mock.calls.filter(
      (call: unknown[]) => (call[0] as { name?: string } | undefined)?.name === 'PaymentAllocation',
    );
    expect(paymentAllocationSaves.length).toBe(2);
  });
});
