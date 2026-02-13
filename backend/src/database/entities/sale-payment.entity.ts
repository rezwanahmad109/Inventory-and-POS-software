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
import { Sale } from './sale.entity';

@Entity({ name: 'sale_payments' })
export class SalePayment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_sale_payments_sale_id')
  @Column({ name: 'sale_id' })
  saleId!: string;

  @ManyToOne(() => Sale, (sale) => sale.payments, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'sale_id' })
  sale!: Sale;

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
