import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { decimalTransformer } from '../../common/transformers/decimal.transformer';
import { FinanceInvoice } from './finance-invoice.entity';
import { FinancePayment } from './finance-payment.entity';

@Entity({ name: 'payment_allocations' })
export class PaymentAllocation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'payment_id', type: 'uuid' })
  paymentId!: string;

  @ManyToOne(() => FinancePayment, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'payment_id' })
  payment!: FinancePayment;

  @Column({ name: 'invoice_id', type: 'uuid' })
  invoiceId!: string;

  @ManyToOne(() => FinanceInvoice, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoice_id' })
  invoice!: FinanceInvoice;

  @Column({
    name: 'allocated_amount',
    type: 'numeric',
    precision: 14,
    scale: 2,
    transformer: decimalTransformer,
  })
  allocatedAmount!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
