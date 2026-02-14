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
import { Purchase } from './purchase.entity';

@Entity({ name: 'purchase_payments' })
export class PurchasePayment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_purchase_payments_purchase_id')
  @Column({ name: 'purchase_id' })
  purchaseId!: string;

  @ManyToOne(() => Purchase, (purchase) => purchase.payments, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'purchase_id' })
  purchase!: Purchase;

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
