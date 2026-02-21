import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

import { JournalEntry, JournalLine } from '../../database/entities/journal-entry.entity';
import { PeriodLock } from '../../database/entities/period-lock.entity';

interface PostJournalLineInput {
  accountId: string;
  partyId?: string | null;
  debit: number;
  credit: number;
  memo?: string | null;
  branchId?: string | null;
}

export interface PostJournalEntryInput {
  entryDate: Date;
  sourceType: string;
  sourceId?: string | null;
  description?: string | null;
  idempotencyKey?: string | null;
  postedBy?: string | null;
  reversalOfId?: string | null;
  lines: PostJournalLineInput[];
}

@Injectable()
export class JournalPostingService {
  constructor(private readonly dataSource: DataSource) {}

  async post(
    input: PostJournalEntryInput,
    manager?: EntityManager,
  ): Promise<JournalEntry> {
    if (manager) {
      return this.postWithinManager(input, manager);
    }

    return this.dataSource.transaction((transactionManager) =>
      this.postWithinManager(input, transactionManager),
    );
  }

  // IFRS/GAAP audit trail principle: posted entries are immutable; corrections use reversing entries.
  async reverse(entryId: string, reason: string, postedBy?: string): Promise<JournalEntry> {
    return this.dataSource.transaction(async (manager) => {
      const existing = await manager.findOneOrFail(JournalEntry, {
        where: { id: entryId },
        relations: { lines: true },
      });

      if (existing.status !== 'posted') {
        throw new BadRequestException('Only posted entries can be reversed.');
      }

      const priorReversal = await manager.findOne(JournalEntry, {
        where: { reversalOfId: existing.id },
      });
      if (priorReversal) {
        return manager.findOneOrFail(JournalEntry, {
          where: { id: priorReversal.id },
          relations: { lines: true },
        });
      }

      return this.postWithinManager(
        {
          entryDate: new Date(),
          sourceType: 'journal_reversal',
          sourceId: entryId,
          description: reason,
          postedBy,
          reversalOfId: existing.id,
          lines: existing.lines.map((line) => ({
            accountId: line.accountId,
            partyId: line.partyId,
            debit: Number(line.credit),
            credit: Number(line.debit),
            memo: `Reversal of ${existing.entryNo}`,
            branchId: line.branchId,
          })),
        },
        manager,
      );
    });
  }

  private async postWithinManager(
    input: PostJournalEntryInput,
    manager: EntityManager,
  ): Promise<JournalEntry> {
    if (input.lines.length < 2) {
      throw new BadRequestException('Journal requires at least two lines.');
    }

    for (const line of input.lines) {
      const debit = Number(line.debit.toFixed(2));
      const credit = Number(line.credit.toFixed(2));
      const singleSide = (debit > 0 && credit === 0) || (credit > 0 && debit === 0);
      if (!singleSide) {
        throw new BadRequestException(
          'Each journal line must be single-sided: either debit or credit.',
        );
      }
    }

    const totalDebit = Number(
      input.lines.reduce((sum, line) => sum + Number(line.debit), 0).toFixed(2),
    );
    const totalCredit = Number(
      input.lines.reduce((sum, line) => sum + Number(line.credit), 0).toFixed(2),
    );

    if (totalDebit <= 0 || totalCredit <= 0) {
      throw new BadRequestException('Both total debit and credit must be positive.');
    }

    if (totalDebit !== totalCredit) {
      throw new BadRequestException(
        `Unbalanced journal entry: debit ${totalDebit} != credit ${totalCredit}`,
      );
    }

    await this.ensurePostingDateIsOpen(input.entryDate, manager);

    if (input.idempotencyKey) {
      const existing = await manager.findOne(JournalEntry, {
        where: { idempotencyKey: input.idempotencyKey },
        relations: { lines: true },
      });
      if (existing) {
        return existing;
      }
    }

    const entryNo = await this.generateEntryNo(manager);
    const entry = manager.create(JournalEntry, {
      entryNo,
      entryDate: input.entryDate,
      sourceType: input.sourceType,
      sourceId: input.sourceId ?? null,
      description: input.description ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      status: 'posted',
      postedAt: new Date(),
      postedBy: input.postedBy ?? null,
      reversalOfId: input.reversalOfId ?? null,
    });

    const savedEntry = await manager.save(JournalEntry, entry);

    const lines = input.lines.map((line, index) =>
      manager.create(JournalLine, {
        journalEntryId: savedEntry.id,
        lineNo: index + 1,
        accountId: line.accountId,
        partyId: line.partyId ?? null,
        debit: Number(line.debit.toFixed(2)),
        credit: Number(line.credit.toFixed(2)),
        memo: line.memo ?? null,
        branchId: line.branchId ?? null,
      }),
    );

    await manager.save(JournalLine, lines);

    const reloaded = await manager.findOneOrFail(JournalEntry, {
      where: { id: savedEntry.id },
      relations: { lines: true },
    });

    return reloaded;
  }

  private async ensurePostingDateIsOpen(
    postingDate: Date,
    manager: EntityManager,
  ): Promise<void> {
    const activeLock = await manager
      .createQueryBuilder(PeriodLock, 'period')
      .where('period.is_locked = TRUE')
      .andWhere('period.start_date <= :postingDate', { postingDate })
      .andWhere('period.end_date >= :postingDate', { postingDate })
      .getOne();

    if (!activeLock) {
      return;
    }

    throw new BadRequestException(
      `Posting date ${postingDate.toISOString().slice(0, 10)} is inside a locked accounting period.`,
    );
  }

  private async generateEntryNo(manager: EntityManager): Promise<string> {
    const now = new Date();
    const prefix = `JE-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

    const count = await manager
      .createQueryBuilder(JournalEntry, 'entry')
      .where('entry.entry_no LIKE :prefix', { prefix: `${prefix}%` })
      .getCount();

    return `${prefix}-${String(count + 1).padStart(5, '0')}`;
  }
}
