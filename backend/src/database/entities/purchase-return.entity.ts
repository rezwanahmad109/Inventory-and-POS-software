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
import { Purchase } from './purchase.entity';
import { PurchaseReturnItem } from './purchase-return-item.entity';

@Entity({ name: 'purchase_returns' })
@Unique(['debitNoteNumber'])
export class PurchaseReturn {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Purchase, (purchase) => purchase.purchaseReturns, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'original_purchase_id' })
  originalPurchase!: Purchase;

  @Column({ name: 'original_purchase_id' })
  originalPurchaseId!: string;

  @Index('idx_purchase_returns_debit_note_number')
  @Column({ name: 'debit_note_number', length: 40 })
  debitNoteNumber!: string;

  @Column({ name: 'return_date', type: 'date' })
  returnDate!: Date;

  @OneToMany(() => PurchaseReturnItem, (item) => item.purchaseReturn, {
    cascade: true,
  })
  returnedItems!: PurchaseReturnItem[];

  @Column({
    name: 'total_refund',
    type: 'numeric',
    precision: 14,
    scale: 2,
    transformer: decimalTransformer,
  })
  totalRefund!: number;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @Column({ name: 'created_by_user_id', nullable: true })
  createdByUserId!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
