import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { decimalTransformer } from '../../common/transformers/decimal.transformer';
import { Payment } from './payment.entity';
import { Sale } from './sale.entity';

@Entity({ name: 'customers' })
export class Customer {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 160 })
  name!: string;

  @Index({ unique: true })
  @Column({ length: 20, unique: true })
  phone!: string;

  @Column({ length: 160, nullable: true })
  email!: string | null;

  @Column({ type: 'text', nullable: true })
  address!: string | null;

  @Column({
    name: 'total_due',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: decimalTransformer,
  })
  totalDue!: number;

  @Column({
    name: 'total_deposit',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: decimalTransformer,
  })
  totalDeposit!: number;

  @Column({
    name: 'credit_limit',
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  creditLimit!: number | null;

  @Column({
    name: 'credit_terms_days',
    type: 'integer',
    nullable: true,
  })
  creditTermsDays!: number | null;

  @OneToMany(() => Payment, (payment) => payment.customer)
  payments!: Payment[];

  @OneToMany(() => Sale, (sale) => sale.customerEntity)
  sales!: Sale[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
