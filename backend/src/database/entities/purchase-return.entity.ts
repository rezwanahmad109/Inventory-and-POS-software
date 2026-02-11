import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { decimalTransformer } from '../../common/transformers/decimal.transformer';
import { Purchase } from './purchase.entity';
import { PurchaseReturnItem } from './purchase-return-item.entity';

@Entity({ name: 'purchase_returns' })
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

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}