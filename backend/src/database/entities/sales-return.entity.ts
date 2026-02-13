import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { decimalTransformer } from '../../common/transformers/decimal.transformer';
import { Sale } from './sale.entity';
import { SalesReturnItem } from './sales-return-item.entity';
import { SalesReturnPayment } from './sales-return-payment.entity';

@Entity({ name: 'sales_returns' })
@Unique(['creditNoteNumber'])
export class SalesReturn {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Sale, (sale) => sale.salesReturns, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'original_sale_id' })
  originalSale!: Sale;

  @Column({ name: 'original_sale_id' })
  originalSaleId!: string;

  @Index('idx_sales_returns_credit_note_number')
  @Column({ name: 'credit_note_number', length: 40 })
  creditNoteNumber!: string;

  @Column({ name: 'return_date', type: 'date' })
  returnDate!: Date;

  @OneToMany(() => SalesReturnItem, (item) => item.salesReturn, {
    cascade: true,
  })
  returnedItems!: SalesReturnItem[];

  @Column({
    name: 'total_refund',
    type: 'numeric',
    precision: 14,
    scale: 2,
    transformer: decimalTransformer,
  })
  totalRefund!: number;

  @OneToMany(() => SalesReturnPayment, (refundPayment) => refundPayment.salesReturn)
  refundPayments!: SalesReturnPayment[];

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @Column({ name: 'created_by_user_id', nullable: true })
  createdByUserId!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
