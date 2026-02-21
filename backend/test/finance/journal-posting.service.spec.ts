import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { JournalEntry } from '../../src/database/entities/journal-entry.entity';
import { PeriodLock } from '../../src/database/entities/period-lock.entity';
import {
  JournalPostingService,
  PostJournalEntryInput,
} from '../../src/finance/services/journal-posting.service';

function buildPostInput(): PostJournalEntryInput {
  return {
    entryDate: new Date('2026-02-01T00:00:00.000Z'),
    sourceType: 'test',
    sourceId: 'source-1',
    description: 'Test posting',
    idempotencyKey: 'idempotency-1',
    postedBy: '00000000-0000-0000-0000-000000000001',
    lines: [
      { accountId: 'acc-1', debit: 100, credit: 0 },
      { accountId: 'acc-2', debit: 0, credit: 100 },
    ],
  };
}

function createManagerStub() {
  const periodLockQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(null),
  };

  const entryNoQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    getCount: jest.fn().mockResolvedValue(0),
  };

  const manager: any = {
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn((_: unknown, payload: unknown) => payload),
    save: jest.fn(async (_: unknown, payload: any) => {
      if (Array.isArray(payload)) {
        return payload;
      }
      return {
        id: payload.id ?? 'entry-1',
        ...payload,
      };
    }),
    findOneOrFail: jest.fn().mockResolvedValue({
      id: 'entry-1',
      entryNo: 'JE-202602-00001',
      status: 'posted',
      lines: [
        {
          lineNo: 1,
          accountId: 'acc-1',
          debit: 100,
          credit: 0,
        },
        {
          lineNo: 2,
          accountId: 'acc-2',
          debit: 0,
          credit: 100,
        },
      ],
    }),
    createQueryBuilder: jest.fn((entity: unknown) => {
      if (entity === JournalEntry) {
        return entryNoQueryBuilder;
      }
      if (entity === PeriodLock) {
        return periodLockQueryBuilder;
      }
      throw new Error('Unexpected query builder entity');
    }),
  };

  return { manager, periodLockQueryBuilder, entryNoQueryBuilder };
}

describe('JournalPostingService', () => {
  it('rejects unbalanced journal input', async () => {
    const { manager } = createManagerStub();
    const dataSource = {
      transaction: jest.fn(async (cb: (m: any) => any) => cb(manager)),
    } as unknown as DataSource;

    const service = new JournalPostingService(dataSource);
    const input = buildPostInput();
    input.lines[1].credit = 90;

    await expect(service.post(input)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns existing journal for duplicate idempotency key', async () => {
    const { manager } = createManagerStub();
    const existing = {
      id: 'existing-entry',
      idempotencyKey: 'idempotency-1',
      lines: [],
    };
    manager.findOne.mockResolvedValueOnce(existing);

    const dataSource = {
      transaction: jest.fn(async (cb: (m: any) => any) => cb(manager)),
    } as unknown as DataSource;

    const service = new JournalPostingService(dataSource);
    const result = await service.post(buildPostInput());

    expect(result).toBe(existing);
  });

  it('blocks posting into locked period', async () => {
    const { manager, periodLockQueryBuilder } = createManagerStub();
    periodLockQueryBuilder.getOne.mockResolvedValueOnce({
      id: 'lock-1',
      startDate: new Date('2026-02-01T00:00:00.000Z'),
      endDate: new Date('2026-02-28T00:00:00.000Z'),
    });

    const dataSource = {
      transaction: jest.fn(async (cb: (m: any) => any) => cb(manager)),
    } as unknown as DataSource;

    const service = new JournalPostingService(dataSource);

    await expect(service.post(buildPostInput())).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('creates reversal entry with reversal_of_id link', async () => {
    const { manager } = createManagerStub();
    manager.findOneOrFail
      .mockResolvedValueOnce({
        id: 'posted-entry',
        entryNo: 'JE-202602-00001',
        status: 'posted',
        lines: [
          {
            accountId: 'acc-1',
            partyId: null,
            debit: 100,
            credit: 0,
            branchId: null,
          },
          {
            accountId: 'acc-2',
            partyId: null,
            debit: 0,
            credit: 100,
            branchId: null,
          },
        ],
      })
      .mockResolvedValueOnce({
        id: 'reversal-entry',
        status: 'posted',
        lines: [],
      });

    const dataSource = {
      transaction: jest.fn(async (cb: (m: any) => any) => cb(manager)),
    } as unknown as DataSource;

    const service = new JournalPostingService(dataSource);
    await service.reverse('posted-entry', 'Correction', 'user-1');

    const savedEntryPayload = manager.save.mock.calls.find(
      (call: unknown[]) => call[0] === JournalEntry,
    )?.[1];

    expect(savedEntryPayload).toBeDefined();
    expect(savedEntryPayload.reversalOfId).toBe('posted-entry');
    expect(savedEntryPayload.sourceType).toBe('journal_reversal');
  });
});
