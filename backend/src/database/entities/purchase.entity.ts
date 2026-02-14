import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { PurchaseDocumentType } from '../../common/enums/purchase-document-type.enum';
import { PurchaseStatus } from '../../common/enums/purchase-status.enum';
import { QuotationStatus } from '../../common/enums/quotation-status.enum';
import { decimalTransformer } from '../../common/transformers/decimal.transformer';
import { BranchEntity } from './branch.entity';
import { PurchasePayment } from './purchase-payment.entity';
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

  @OneToMany(() => PurchasePayment, (payment) => payment.purchase)
  payments!: PurchasePayment[];

  @Column({
    name: 'document_type',
    type: 'enum',
    enum: PurchaseDocumentType,
    default: PurchaseDocumentType.BILL,
  })
  documentType!: PurchaseDocumentType;

  @Column({
    name: 'quotation_status',
    type: 'enum',
    enum: QuotationStatus,
    nullable: true,
  })
  quotationStatus!: QuotationStatus | null;

  @Column({ name: 'valid_until', type: 'date', nullable: true })
  validUntil!: Date | null;

  @Column({ name: 'converted_at', type: 'timestamptz', nullable: true })
  convertedAt!: Date | null;

  @Column({ name: 'converted_to_purchase_id', type: 'uuid', nullable: true })
  convertedToPurchaseId!: string | null;

  @Column({
    name: 'subtotal',
    type: 'numeric',
    precision: 14,
    scale: 2,
    transformer: decimalTransformer,
    default: 0,
  })
  subtotal!: number;

  @Column({
    name: 'discount_total',
    type: 'numeric',
    precision: 14,
    scale: 2,
    transformer: decimalTransformer,
    default: 0,
  })
  discountTotal!: number;

  @Column({
    name: 'tax_total',
    type: 'numeric',
    precision: 14,
    scale: 2,
    transformer: decimalTransformer,
    default: 0,
  })
  taxTotal!: number;

  @Column({
    name: 'grand_total',
    type: 'numeric',
    precision: 14,
    scale: 2,
    transformer: decimalTransformer,
    default: 0,
  })
  grandTotal!: number;

  @Column({
    name: 'total_amount',
    type: 'numeric',
    precision: 14,
    scale: 2,
    transformer: decimalTransformer,
  })
  totalAmount!: number;

  @Column({
    name: 'paid_total',
    type: 'numeric',
    precision: 14,
    scale: 2,
    transformer: decimalTransformer,
    default: 0,
  })
  paidTotal!: number;

  @Column({
    name: 'due_total',
    type: 'numeric',
    precision: 14,
    scale: 2,
    transformer: decimalTransformer,
    default: 0,
  })
  dueTotal!: number;

  @Column({
    name: 'status',
    type: 'enum',
    enum: PurchaseStatus,
    default: PurchaseStatus.UNPAID,
  })
  status!: PurchaseStatus;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  attachments!: string[] | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
