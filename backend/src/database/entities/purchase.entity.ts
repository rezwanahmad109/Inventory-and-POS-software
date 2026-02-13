import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { decimalTransformer } from '../../common/transformers/decimal.transformer';
import { BranchEntity } from './branch.entity';
import { PurchaseItem } from './purchase-item.entity';
import { PurchaseReturn } from './purchase-return.entity';
import { Supplier } from './supplier.entity';

@Entity({ name: 'purchases' })
@Unique(['invoiceNumber'])
export class Purchase {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'invoice_number', length: 40 })
  invoiceNumber!: string;

  @ManyToOne(() => Supplier, (supplier) => supplier.purchases, {
    nullable: false,
    eager: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'supplier_id' })
  supplier!: Supplier;

  @Column({ name: 'supplier_id' })
  supplierId!: string;

  @ManyToOne(() => BranchEntity, {
    nullable: true,
    eager: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'branch_id' })
  branch!: BranchEntity | null;

  @Column({ name: 'branch_id', nullable: true })
  branchId!: string | null;

  @OneToMany(() => PurchaseItem, (item) => item.purchase)
  items!: PurchaseItem[];

  @OneToMany(() => PurchaseReturn, (purchaseReturn) => purchaseReturn.originalPurchase)
  purchaseReturns!: PurchaseReturn[];

  @Column({
    name: 'total_amount',
    type: 'numeric',
    precision: 14,
    scale: 2,
    transformer: decimalTransformer,
  })
  totalAmount!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
