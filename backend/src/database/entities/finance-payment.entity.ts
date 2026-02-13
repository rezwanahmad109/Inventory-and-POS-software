import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { decimalTransformer } from '../../common/transformers/decimal.transformer';
import { FinanceParty } from './finance-party.entity';
import { JournalEntry } from './journal-entry.entity';
import { Wallet } from './wallet.entity';

@Entity({ name: 'finance_payments' })
export class FinancePayment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'party_id', type: 'uuid', nullable: true })
  partyId!: string | null;

  @ManyToOne(() => FinanceParty, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'party_id' })
  party!: FinanceParty | null;

  @Column({ name: 'wallet_id', type: 'uuid' })
  walletId!: string;

  @ManyToOne(() => Wallet, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'wallet_id' })
  wallet!: Wallet;

  @Column({ name: 'direction', length: 20 })
  direction!: 'receipt' | 'disbursement' | 'refund';

  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    transformer: decimalTransformer,
  })
  amount!: number;

  @Column({ length: 3, default: 'USD' })
  currency!: string;

  @Column({ name: 'payment_method', length: 20 })
  paymentMethod!: 'cash' | 'card' | 'mobile' | 'bank_transfer';

  @Column({ name: 'payment_reference', length: 160, nullable: true })
  paymentReference!: string | null;

  // Never store raw PAN/CVV; retain token/reference returned by PCI-compliant processor.
  @Column({ name: 'processor_token', length: 255, nullable: true })
  processorToken!: string | null;

  @Column({ length: 20, default: 'pending' })
  status!: 'pending' | 'posted' | 'reversed' | 'failed';

  @Column({ name: 'posted_journal_entry_id', type: 'uuid', nullable: true })
  postedJournalEntryId!: string | null;

  @ManyToOne(() => JournalEntry, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'posted_journal_entry_id' })
  postedJournalEntry!: JournalEntry | null;

  @Column({ name: 'idempotency_key', length: 120, nullable: true, unique: true })
  idempotencyKey!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
