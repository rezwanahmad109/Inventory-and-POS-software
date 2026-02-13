import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { decimalTransformer } from '../../common/transformers/decimal.transformer';

@Entity({ name: 'wallets' })
export class Wallet {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('ux_wallets_code', { unique: true })
  @Column({ length: 30 })
  code!: string;

  @Column({ length: 120 })
  name!: string;

  @Column({ length: 20 })
  type!: 'cash' | 'bank' | 'mobile_money';

  @Column({ length: 3, default: 'USD' })
  currency!: string;

  @Column({
    name: 'opening_balance',
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
    transformer: decimalTransformer,
  })
  openingBalance!: number;

  @Column({
    name: 'current_balance',
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
    transformer: decimalTransformer,
  })
  currentBalance!: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
