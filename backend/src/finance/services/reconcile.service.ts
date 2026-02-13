import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, DataSource, Repository } from 'typeorm';

import { AuditLog } from '../../database/entities/audit-log.entity';
import { BankStatement } from '../../database/entities/bank-statement.entity';
import { BankStatementLine } from '../../database/entities/bank-statement-line.entity';
import { ReconciliationMatch } from '../../database/entities/reconciliation-match.entity';
import { WalletTransaction } from '../../database/entities/wallet-transaction.entity';
import { Wallet } from '../../database/entities/wallet.entity';
import { ImportStatementDto } from '../dto/import-statement.dto';
import { ReconcileMatchDto } from '../dto/reconcile-match.dto';

@Injectable()
export class ReconcileService {
  constructor(
    @InjectRepository(BankStatement)
    private readonly bankStatementRepository: Repository<BankStatement>,
    @InjectRepository(BankStatementLine)
    private readonly bankStatementLineRepository: Repository<BankStatementLine>,
    @InjectRepository(WalletTransaction)
    private readonly walletTransactionRepository: Repository<WalletTransaction>,
    @InjectRepository(ReconciliationMatch)
    private readonly reconciliationMatchRepository: Repository<ReconciliationMatch>,
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
    private readonly dataSource: DataSource,
  ) {}

  async importStatement(dto: ImportStatementDto, actorId: string): Promise<BankStatement> {
    return this.dataSource.transaction(async (manager) => {
      const wallet = await manager.findOne(Wallet, { where: { id: dto.walletId } });
      if (!wallet) {
        throw new NotFoundException(`Wallet "${dto.walletId}" not found.`);
      }

      const statement = manager.create(BankStatement, {
        walletId: wallet.id,
        statementRef: dto.statementRef,
        periodFrom: dto.periodFrom ? new Date(dto.periodFrom) : null,
        periodTo: dto.periodTo ? new Date(dto.periodTo) : null,
        importedBy: actorId,
      });

      const savedStatement = await manager.save(BankStatement, statement);

      for (let index = 0; index < dto.lines.length; index += 1) {
        const line = dto.lines[index];
        const statementLine = manager.create(BankStatementLine, {
          statementId: savedStatement.id,
          lineNo: index + 1,
          txnDate: new Date(line.txnDate),
          amount: Number(line.amount.toFixed(2)),
          currency: (line.currency ?? wallet.currency ?? 'USD').toUpperCase(),
          externalRef: line.externalRef ?? null,
          description: line.description ?? null,
          counterpartyName: line.counterpartyName ?? null,
          matchStatus: 'unmatched',
        });

        await manager.save(BankStatementLine, statementLine);
      }

      await manager.save(
        AuditLog,
        manager.create(AuditLog, {
          actorId,
          action: 'finance.reconcile.import_statement',
          entity: 'bank_statements',
          entityId: savedStatement.id,
          before: null,
          after: {
            statementRef: savedStatement.statementRef,
            lineCount: dto.lines.length,
            walletId: savedStatement.walletId,
          },
          requestId: null,
          correlationId: savedStatement.statementRef,
        }),
      );

      return savedStatement;
    });
  }

  async suggestMatches(statementId: string) {
    const statement = await this.bankStatementRepository.findOne({
      where: { id: statementId },
    });
    if (!statement) {
      throw new NotFoundException(`Statement "${statementId}" not found.`);
    }

    const lines = await this.bankStatementLineRepository.find({
      where: { statementId, matchStatus: 'unmatched' },
      order: { lineNo: 'ASC' },
    });

    const suggestions: Array<{
      statementLineId: string;
      walletTransactionId: string;
      confidenceScore: number;
    }> = [];

    for (const line of lines) {
      const start = new Date(line.txnDate);
      start.setDate(start.getDate() - 3);
      const end = new Date(line.txnDate);
      end.setDate(end.getDate() + 3);

      const candidates = await this.walletTransactionRepository.find({
        where: {
          walletId: statement.walletId,
          txnDate: Between(start, end),
        },
        order: { createdAt: 'DESC' },
        take: 20,
      });

      const absAmount = Math.abs(line.amount);

      for (const candidate of candidates) {
        const delta = Math.abs(candidate.amount - absAmount);
        if (delta > 0.01) {
          continue;
        }

        suggestions.push({
          statementLineId: line.id,
          walletTransactionId: candidate.id,
          confidenceScore: 95,
        });
        break;
      }
    }

    return {
      statementId,
      suggestions,
    };
  }

  async match(dto: ReconcileMatchDto, actorId: string): Promise<ReconciliationMatch> {
    return this.dataSource.transaction(async (manager) => {
      const line = await manager.findOne(BankStatementLine, {
        where: { id: dto.statementLineId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!line) {
        throw new NotFoundException(`Statement line "${dto.statementLineId}" not found.`);
      }

      const match = manager.create(ReconciliationMatch, {
        statementLineId: dto.statementLineId,
        walletTransactionId: dto.walletTransactionId ?? null,
        journalEntryId: dto.journalEntryId ?? null,
        matchedAmount: Number(dto.matchedAmount.toFixed(2)),
        confidenceScore: Number((dto.confidenceScore ?? 80).toFixed(2)),
        matchedBy: actorId,
      });

      const saved = await manager.save(ReconciliationMatch, match);

      line.matchStatus = 'matched';
      await manager.save(BankStatementLine, line);

      await manager.save(
        AuditLog,
        manager.create(AuditLog, {
          actorId,
          action: 'finance.reconcile.match',
          entity: 'bank_statement_lines',
          entityId: line.id,
          before: { matchStatus: 'unmatched' },
          after: {
            matchStatus: line.matchStatus,
            walletTransactionId: saved.walletTransactionId,
            journalEntryId: saved.journalEntryId,
          },
          requestId: null,
          correlationId: line.statementId,
        }),
      );

      return saved;
    });
  }
}
