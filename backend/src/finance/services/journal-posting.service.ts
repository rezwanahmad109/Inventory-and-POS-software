import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { JournalEntry, JournalLine } from '../../database/entities/journal-entry.entity';

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
  lines: PostJournalLineInput[];
}

@Injectable()
export class JournalPostingService {
  constructor(
    @InjectRepository(JournalEntry)
    private readonly journalEntryRepository: Repository<JournalEntry>,
    private readonly dataSource: DataSource,
  ) {}

  async post(input: PostJournalEntryInput): Promise<JournalEntry> {
    if (input.lines.length < 2) {
      throw new BadRequestException('Journal requires at least two lines.');
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

    return this.dataSource.transaction(async (manager) => {
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
    });
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

      const reversal = await this.post({
        entryDate: new Date(),
        sourceType: 'journal_reversal',
        sourceId: entryId,
        description: reason,
        postedBy,
        lines: existing.lines.map((line) => ({
          accountId: line.accountId,
          partyId: line.partyId,
          debit: Number(line.credit),
          credit: Number(line.debit),
          memo: `Reversal of ${existing.entryNo}`,
          branchId: line.branchId,
        })),
      });

      existing.status = 'reversed';
      await manager.save(JournalEntry, existing);

      return reversal;
    });
  }

  private async generateEntryNo(manager: DataSource['manager']): Promise<string> {
    const now = new Date();
    const prefix = `JE-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

    const count = await manager
      .createQueryBuilder(JournalEntry, 'entry')
      .where('entry.entry_no LIKE :prefix', { prefix: `${prefix}%` })
      .getCount();

    return `${prefix}-${String(count + 1).padStart(5, '0')}`;
  }
}
