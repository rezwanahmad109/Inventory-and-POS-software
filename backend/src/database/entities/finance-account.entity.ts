import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'finance_accounts' })
export class FinanceAccount {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('ux_finance_accounts_code', { unique: true })
  @Column({ length: 30 })
  code!: string;

  @Column({ length: 160 })
  name!: string;

  @Column({ name: 'account_type', length: 30 })
  accountType!: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

  @Column({ name: 'sub_type', length: 80, nullable: true })
  subType!: string | null;

  @Column({ name: 'is_contra', type: 'boolean', default: false })
  isContra!: boolean;

  @Column({ length: 3, default: 'USD' })
  currency!: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
