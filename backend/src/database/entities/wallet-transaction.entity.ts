import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { decimalTransformer } from '../../common/transformers/decimal.transformer';
import { Wallet } from './wallet.entity';

@Entity({ name: 'wallet_transactions' })
export class WalletTransaction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'wallet_id', type: 'uuid' })
  walletId!: string;

  @ManyToOne(() => Wallet, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'wallet_id' })
  wallet!: Wallet;

  @Column({ name: 'txn_date', type: 'date' })
  txnDate!: Date;

  @Column({ length: 10 })
  direction!: 'in' | 'out';

  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    transformer: decimalTransformer,
  })
  amount!: number;

  @Column({ name: 'reference_type', length: 40, nullable: true })
  referenceType!: string | null;

  @Column({ name: 'reference_id', length: 80, nullable: true })
  referenceId!: string | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Index('ux_wallet_transactions_idempotency_key', { unique: true })
  @Column({ name: 'idempotency_key', length: 120, nullable: true })
  idempotencyKey!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
