import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { decimalTransformer } from '../../common/transformers/decimal.transformer';
import { Product } from './product.entity';
import { SalesReturn } from './sales-return.entity';

@Entity({ name: 'sales_return_items' })
export class SalesReturnItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => SalesReturn, (salesReturn) => salesReturn.returnedItems, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'sales_return_id' })
  salesReturn!: SalesReturn;

  @Column({ name: 'sales_return_id' })
  salesReturnId!: string;

  @ManyToOne(() => Product, (product) => product.salesReturnItems, {
    nullable: false,
    eager: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'product_id' })
  product!: Product;

  @Column({ name: 'product_id' })
  productId!: string;

  @Column({ type: 'integer' })
  quantity!: number;

  @Column({
    name: 'unit_price',
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: decimalTransformer,
  })
  unitPrice!: number;

  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    transformer: decimalTransformer,
  })
  subtotal!: number;
}