import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { decimalTransformer } from '../../common/transformers/decimal.transformer';
import { BankStatement } from './bank-statement.entity';

@Entity({ name: 'bank_statement_lines' })
export class BankStatementLine {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'statement_id', type: 'uuid' })
  statementId!: string;

  @ManyToOne(() => BankStatement, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'statement_id' })
  statement!: BankStatement;

  @Column({ name: 'line_no', type: 'integer' })
  lineNo!: number;

  @Column({ name: 'txn_date', type: 'date' })
  txnDate!: Date;

  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    transformer: decimalTransformer,
  })
  amount!: number;

  @Column({ length: 3, default: 'USD' })
  currency!: string;

  @Column({ name: 'external_ref', length: 160, nullable: true })
  externalRef!: string | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'counterparty_name', length: 160, nullable: true })
  counterpartyName!: string | null;

  @Column({ name: 'match_status', length: 20, default: 'unmatched' })
  matchStatus!: 'unmatched' | 'partially_matched' | 'matched';

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
