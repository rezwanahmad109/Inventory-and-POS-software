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
import { Customer } from './customer.entity';
import { Sale } from './sale.entity';

export enum PaymentType {
  DEPOSIT = 'deposit',
  SALE_DUE = 'sale_due',
  DUE_PAYMENT = 'due_payment',
}

export enum PaymentMethodType {
  CASH = 'cash',
  CARD = 'card',
  MOBILE = 'mobile',
}

@Entity({ name: 'payments' })
export class Payment {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @ManyToOne(() => Customer, (customer) => customer.payments, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'customer_id' })
  customer!: Customer;

  @Column({ name: 'customer_id' })
  customerId!: number;

  @Index()
  @Column({
    type: 'enum',
    enum: PaymentType,
  })
  type!: PaymentType;

  @Column({
    type: 'enum',
    enum: PaymentMethodType,
  })
  method!: PaymentMethodType;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: decimalTransformer,
  })
  amount!: number;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @Column({ name: 'sale_id', nullable: true })
  saleId!: string | null;

  @ManyToOne(() => Sale, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'sale_id' })
  sale!: Sale | null;

  @Index()
  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
