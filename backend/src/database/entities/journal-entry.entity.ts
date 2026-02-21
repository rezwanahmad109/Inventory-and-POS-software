import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { decimalTransformer } from '../../common/transformers/decimal.transformer';
import { FinanceAccount } from './finance-account.entity';
import { FinanceParty } from './finance-party.entity';

@Entity({ name: 'journal_entries' })
@Unique(['entryNo'])
export class JournalEntry {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_journal_entries_entry_no')
  @Column({ name: 'entry_no', length: 40 })
  entryNo!: string;

  @Column({ name: 'entry_date', type: 'date' })
  entryDate!: Date;

  @Column({ name: 'source_type', length: 40 })
  sourceType!: string;

  @Column({ name: 'source_id', type: 'varchar', length: 80, nullable: true })
  sourceId!: string | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Index('ux_journal_entries_idempotency_key', { unique: true })
  @Column({ name: 'idempotency_key', length: 120, nullable: true })
  idempotencyKey!: string | null;

  @Index('idx_journal_entries_status')
  @Column({ length: 20, default: 'draft' })
  status!: 'draft' | 'posted' | 'reversed';

  @Column({ name: 'posted_at', type: 'timestamp', nullable: true })
  postedAt!: Date | null;

  @Column({ name: 'posted_by', type: 'uuid', nullable: true })
  postedBy!: string | null;

  @Column({ name: 'reversal_of_id', type: 'uuid', nullable: true })
  reversalOfId!: string | null;

  @ManyToOne(() => JournalEntry, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'reversal_of_id' })
  reversalOf!: JournalEntry | null;

  @OneToMany(() => JournalEntry, (entry) => entry.reversalOf)
  reversals!: JournalEntry[];

  @OneToMany(() => JournalLine, (line) => line.journalEntry)
  lines!: JournalLine[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}

@Entity({ name: 'journal_lines' })
@Check('chk_journal_lines_single_side', '("debit" = 0 AND "credit" > 0) OR ("credit" = 0 AND "debit" > 0)')
export class JournalLine {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'journal_entry_id', type: 'uuid' })
  journalEntryId!: string;

  @ManyToOne(() => JournalEntry, (entry) => entry.lines, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'journal_entry_id' })
  journalEntry!: JournalEntry;

  @Column({ name: 'line_no', type: 'integer' })
  lineNo!: number;

  @Column({ name: 'account_id', type: 'uuid' })
  accountId!: string;

  @ManyToOne(() => FinanceAccount, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'account_id' })
  account!: FinanceAccount;

  @Column({ name: 'party_id', type: 'uuid', nullable: true })
  partyId!: string | null;

  @ManyToOne(() => FinanceParty, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'party_id' })
  party!: FinanceParty | null;

  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
    transformer: decimalTransformer,
  })
  debit!: number;

  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
    transformer: decimalTransformer,
  })
  credit!: number;

  @Column({ name: 'branch_id', type: 'uuid', nullable: true })
  branchId!: string | null;

  @Column({ type: 'text', nullable: true })
  memo!: string | null;
}
