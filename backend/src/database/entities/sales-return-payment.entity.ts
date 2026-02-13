import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { SalePaymentMethod } from '../../common/enums/sale-payment-method.enum';
import { decimalTransformer } from '../../common/transformers/decimal.transformer';
import { SalesReturn } from './sales-return.entity';

@Entity({ name: 'sales_return_payments' })
export class SalesReturnPayment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_sales_return_payments_return_id')
  @Column({ name: 'sales_return_id' })
  salesReturnId!: string;

  @ManyToOne(() => SalesReturn, (salesReturn) => salesReturn.refundPayments, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'sales_return_id' })
  salesReturn!: SalesReturn;

  @Column({
    type: 'enum',
    enum: SalePaymentMethod,
  })
  method!: SalePaymentMethod;

  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    transformer: decimalTransformer,
  })
  amount!: number;

  @Column({ type: 'varchar', length: 120, nullable: true })
  reference!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  meta!: Record<string, unknown> | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
