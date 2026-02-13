import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { decimalTransformer } from '../../common/transformers/decimal.transformer';
import { BankStatementLine } from './bank-statement-line.entity';
import { JournalEntry } from './journal-entry.entity';
import { WalletTransaction } from './wallet-transaction.entity';

@Entity({ name: 'reconciliation_matches' })
export class ReconciliationMatch {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'statement_line_id', type: 'uuid' })
  statementLineId!: string;

  @ManyToOne(() => BankStatementLine, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'statement_line_id' })
  statementLine!: BankStatementLine;

  @Column({ name: 'wallet_transaction_id', type: 'uuid', nullable: true })
  walletTransactionId!: string | null;

  @ManyToOne(() => WalletTransaction, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'wallet_transaction_id' })
  walletTransaction!: WalletTransaction | null;

  @Column({ name: 'journal_entry_id', type: 'uuid', nullable: true })
  journalEntryId!: string | null;

  @ManyToOne(() => JournalEntry, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'journal_entry_id' })
  journalEntry!: JournalEntry | null;

  @Column({
    name: 'matched_amount',
    type: 'numeric',
    precision: 14,
    scale: 2,
    transformer: decimalTransformer,
  })
  matchedAmount!: number;

  @Column({
    name: 'confidence_score',
    type: 'numeric',
    precision: 5,
    scale: 2,
    default: 0,
    transformer: decimalTransformer,
  })
  confidenceScore!: number;

  @Column({ name: 'matched_by', type: 'uuid', nullable: true })
  matchedBy!: string | null;

  @CreateDateColumn({ name: 'matched_at' })
  matchedAt!: Date;
}
