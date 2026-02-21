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
  UpdateDateColumn,
} from 'typeorm';

import { DiscountType } from '../../common/enums/discount-type.enum';
import { QuotationStatus } from '../../common/enums/quotation-status.enum';
import { SaleDocumentType } from '../../common/enums/sale-document-type.enum';
import { SalePaymentMethod } from '../../common/enums/sale-payment-method.enum';
import { SaleStatus } from '../../common/enums/sale-status.enum';
import { TaxMethod } from '../../common/enums/tax-method.enum';
import { decimalTransformer } from '../../common/transformers/decimal.transformer';
import { BranchEntity } from './branch.entity';
import { Customer } from './customer.entity';
import { SaleDelivery } from './sale-delivery.entity';
import { SaleItem } from './sale-item.entity';
import { SalePayment } from './sale-payment.entity';
import { SalesReturn } from './sales-return.entity';
import { User } from './user.entity';

@Entity({ name: 'sales' })
@Unique(['invoiceNumber'])
export class Sale {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Legacy customer name field kept for backward compatibility */
  @Column({ length: 160, nullable: true })
  customer!: string | null;

  /** Optional link to a registered Customer record */
  @ManyToOne(() => Customer, (c) => c.sales, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'customer_id' })
  customerEntity!: Customer | null;

  @Column({ name: 'customer_id', nullable: true })
  customerId!: number | null;

  @Column({ name: 'invoice_number', length: 40 })
  @Index('idx_sales_invoice_number')
  invoiceNumber!: string;

  @Column({
    name: 'legacy_payment_method',
    type: 'text',
    nullable: true,
  })
  legacyPaymentMethod!: string | null;

  @Column({
    name: 'payment_method',
    type: 'enum',
    enum: SalePaymentMethod,
    nullable: true,
  })
  paymentMethod!: SalePaymentMethod | null;

  @Column({
    name: 'document_type',
    type: 'enum',
    enum: SaleDocumentType,
    default: SaleDocumentType.INVOICE,
  })
  documentType!: SaleDocumentType;

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

  @Column({ name: 'converted_to_sale_id', type: 'uuid', nullable: true })
  convertedToSaleId!: string | null;

  @Column({
    name: 'total_amount',
    type: 'numeric',
    precision: 14,
    scale: 2,
    transformer: decimalTransformer,
    default: 0,
  })
  totalAmount!: number;

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
    name: 'shipping_total',
    type: 'numeric',
    precision: 14,
    scale: 2,
    transformer: decimalTransformer,
    default: 0,
  })
  shippingTotal!: number;

  @Column({
    name: 'invoice_discount_type',
    type: 'enum',
    enum: DiscountType,
    default: DiscountType.NONE,
  })
  invoiceDiscountType!: DiscountType;

  @Column({
    name: 'invoice_discount_value',
    type: 'numeric',
    precision: 14,
    scale: 2,
    transformer: decimalTransformer,
    default: 0,
  })
  invoiceDiscountValue!: number;

  @Column({
    name: 'invoice_tax_rate',
    type: 'numeric',
    precision: 5,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  invoiceTaxRate!: number | null;

  @Column({
    name: 'invoice_tax_method',
    type: 'enum',
    enum: TaxMethod,
    nullable: true,
  })
  invoiceTaxMethod!: TaxMethod | null;

  @Column({
    name: 'paid_amount',
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
    transformer: decimalTransformer,
  })
  paidAmount!: number;

  @Column({
    name: 'due_amount',
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
    transformer: decimalTransformer,
  })
  dueAmount!: number;

  @Column({
    name: 'paid_total',
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
    transformer: decimalTransformer,
  })
  paidTotal!: number;

  @Column({
    name: 'due_total',
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
    transformer: decimalTransformer,
  })
  dueTotal!: number;

  @Column({
    name: 'refunded_total',
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
    transformer: decimalTransformer,
  })
  refundedTotal!: number;

  @Column({
    name: 'status',
    type: 'enum',
    enum: SaleStatus,
    default: SaleStatus.UNPAID,
  })
  status!: SaleStatus;

  @ManyToOne(() => BranchEntity, {
    nullable: true,
    eager: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'branch_id' })
  branch!: BranchEntity | null;

  @Column({ name: 'branch_id', nullable: true })
  branchId!: string | null;

  @OneToMany(() => SaleItem, (item) => item.sale)
  items!: SaleItem[];

  @OneToMany(() => SalePayment, (payment) => payment.sale)
  payments!: SalePayment[];

  @OneToMany(() => SaleDelivery, (delivery) => delivery.orderSale)
  deliveries!: SaleDelivery[];

  @OneToMany(() => SalesReturn, (salesReturn) => salesReturn.originalSale)
  salesReturns!: SalesReturn[];

  @ManyToOne(() => User, {
    nullable: true,
    eager: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'created_by_user_id' })
  createdBy!: User | null;

  @Column({ name: 'created_by_user_id', nullable: true })
  createdByUserId!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  attachments!: string[] | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

