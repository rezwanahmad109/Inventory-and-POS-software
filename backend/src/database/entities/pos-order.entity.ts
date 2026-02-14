import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { DiscountType } from '../../common/enums/discount-type.enum';
import { TaxMethod } from '../../common/enums/tax-method.enum';
import { decimalTransformer } from '../../common/transformers/decimal.transformer';

export type PosOrderStatus = 'cart' | 'held' | 'completed' | 'cancelled';

export interface PosOrderItem {
  productId: string;
  quantity: number;
  unitPriceOverride?: number;
  priceTierId?: string;
  lineDiscountType?: DiscountType;
  lineDiscountValue?: number;
}

@Entity({ name: 'pos_orders' })
export class PosOrder {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'order_number', length: 40, unique: true })
  orderNumber!: string;

  @Column({ length: 20, default: 'cart' })
  status!: PosOrderStatus;

  @Column({ name: 'branch_id', type: 'uuid', nullable: true })
  branchId!: string | null;

  @Column({ name: 'customer_name', length: 160, nullable: true })
  customerName!: string | null;

  @Column({ name: 'customer_id', nullable: true })
  customerId!: number | null;

  @Column({ type: 'jsonb' })
  items!: PosOrderItem[];

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
    transformer: decimalTransformer,
    nullable: true,
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
    name: 'shipping_total',
    type: 'numeric',
    precision: 14,
    scale: 2,
    transformer: decimalTransformer,
    default: 0,
  })
  shippingTotal!: number;

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

  @Column({ name: 'invoice_id', type: 'uuid', nullable: true })
  invoiceId!: string | null;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @Column({ name: 'created_by_user_id', type: 'uuid', nullable: true })
  createdByUserId!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
