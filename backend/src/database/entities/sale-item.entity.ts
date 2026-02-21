import {
  Check,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { DiscountType } from '../../common/enums/discount-type.enum';
import { decimalTransformer } from '../../common/transformers/decimal.transformer';
import { BranchEntity } from './branch.entity';
import { Product } from './product.entity';
import { Sale } from './sale.entity';

@Entity({ name: 'sale_items' })
@Check(
  'chk_sale_items_delivered_not_exceed_quantity',
  '"delivered_quantity" >= 0 AND "delivered_quantity" <= "quantity"',
)
@Check(
  'chk_sale_items_invoiced_not_exceed_delivered',
  '"invoiced_quantity" >= 0 AND "invoiced_quantity" <= "delivered_quantity"',
)
export class SaleItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Sale, (sale) => sale.items, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'sale_id' })
  sale!: Sale;

  @Column({ name: 'sale_id' })
  saleId!: string;

  @ManyToOne(() => Product, (product) => product.saleItems, {
    nullable: false,
    eager: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'product_id' })
  product!: Product;

  @Column({ name: 'product_id' })
  productId!: string;

  @Column({ name: 'warehouse_id', type: 'uuid' })
  warehouseId!: string;

  @ManyToOne(() => BranchEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'warehouse_id' })
  warehouse!: BranchEntity;

  @Column({ type: 'integer' })
  quantity!: number;

  @Column({ name: 'delivered_quantity', type: 'integer', default: 0 })
  deliveredQuantity!: number;

  @Column({ name: 'invoiced_quantity', type: 'integer', default: 0 })
  invoicedQuantity!: number;

  @Column({
    name: 'unit_price',
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: decimalTransformer,
  })
  unitPrice!: number;

  @Column({ name: 'price_tier_id', nullable: true })
  priceTierId!: string | null;

  @Column({ name: 'price_tier_name', length: 120, nullable: true })
  priceTierName!: string | null;

  @Column({
    name: 'line_discount_type',
    type: 'enum',
    enum: DiscountType,
    default: DiscountType.NONE,
  })
  lineDiscountType!: DiscountType;

  @Column({
    name: 'line_discount_value',
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: decimalTransformer,
    default: 0,
  })
  lineDiscountValue!: number;

  @Column({
    name: 'line_discount_amount',
    type: 'numeric',
    precision: 14,
    scale: 2,
    transformer: decimalTransformer,
    default: 0,
  })
  lineDiscountAmount!: number;

  @Column({
    name: 'line_tax_rate',
    type: 'numeric',
    precision: 5,
    scale: 2,
    transformer: decimalTransformer,
    default: 0,
  })
  lineTaxRate!: number;

  @Column({
    name: 'line_tax_amount',
    type: 'numeric',
    precision: 14,
    scale: 2,
    transformer: decimalTransformer,
    default: 0,
  })
  lineTaxAmount!: number;

  @Column({
    name: 'line_total',
    type: 'numeric',
    precision: 14,
    scale: 2,
    transformer: decimalTransformer,
  })
  lineTotal!: number;
}
