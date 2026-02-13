import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { Wallet } from './wallet.entity';

@Entity({ name: 'bank_statements' })
@Unique(['statementRef'])
export class BankStatement {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'wallet_id', type: 'uuid' })
  walletId!: string;

  @ManyToOne(() => Wallet, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'wallet_id' })
  wallet!: Wallet;

  @Column({ name: 'statement_ref', length: 80 })
  statementRef!: string;

  @Column({ name: 'period_from', type: 'date', nullable: true })
  periodFrom!: Date | null;

  @Column({ name: 'period_to', type: 'date', nullable: true })
  periodTo!: Date | null;

  @Column({ name: 'imported_by', type: 'uuid', nullable: true })
  importedBy!: string | null;

  @CreateDateColumn({ name: 'imported_at' })
  importedAt!: Date;
}
