import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { decimalTransformer } from '../../common/transformers/decimal.transformer';

@Entity({ name: 'subscription_plans' })
@Unique(['code'])
export class SubscriptionPlanEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 60 })
  code!: string;

  @Column({ length: 120 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({
    name: 'monthly_price',
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: decimalTransformer,
    default: 0,
  })
  monthlyPrice!: number;

  @Column({
    name: 'yearly_price',
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: decimalTransformer,
    nullable: true,
  })
  yearlyPrice!: number | null;

  @Column({ name: 'max_users', type: 'integer', default: 5 })
  maxUsers!: number;

  @Column({ name: 'max_warehouses', type: 'integer', default: 1 })
  maxWarehouses!: number;

  @Column({ name: 'max_products', type: 'integer', default: 500 })
  maxProducts!: number;

  @Column({ type: 'jsonb', nullable: true })
  features!: Record<string, boolean> | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
