import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { decimalTransformer } from '../../common/transformers/decimal.transformer';
import { BranchProductEntity } from './branch-product.entity';
import { PurchaseItem } from './purchase-item.entity';
import { PurchaseReturnItem } from './purchase-return-item.entity';
import { SaleItem } from './sale-item.entity';
import { SalesReturnItem } from './sales-return-item.entity';
import { StockTransferEntity } from './stock-transfer.entity';

@Entity({ name: 'categories' })
export class Category {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 120 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @OneToMany(() => Product, (product) => product.category)
  products!: Product[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt!: Date | null;
}

@Entity({ name: 'units' })
export class Unit {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 80 })
  name!: string;

  @Column({ length: 30 })
  symbol!: string;

  @Column({
    name: 'conversion_factor',
    type: 'numeric',
    precision: 14,
    scale: 4,
    transformer: decimalTransformer,
    default: 1,
  })
  conversionFactor!: number;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @OneToMany(() => Product, (product) => product.unit)
  products!: Product[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

@Entity({ name: 'products' })
@Unique(['sku'])
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 160 })
  name!: string;

  @Column({ length: 80 })
  sku!: string;

  @ManyToOne(() => Category, (category) => category.products, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'category_id' })
  category!: Category;

  @Column({ name: 'category_id' })
  categoryId!: string;

  @ManyToOne(() => Unit, (unit) => unit.products, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'unit_id' })
  unit!: Unit;

  @Column({ name: 'unit_id' })
  unitId!: string;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: decimalTransformer,
  })
  price!: number;

  @Column({ name: 'stock_qty', type: 'integer', default: 0 })
  stockQty!: number;

  @Column({ name: 'low_stock_threshold', type: 'integer', default: 0 })
  lowStockThreshold!: number;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'text', nullable: true })
  image!: string | null;

  @OneToMany(() => SaleItem, (saleItem) => saleItem.product)
  saleItems!: SaleItem[];

  @OneToMany(() => PurchaseItem, (purchaseItem) => purchaseItem.product)
  purchaseItems!: PurchaseItem[];

  @OneToMany(() => SalesReturnItem, (salesReturnItem) => salesReturnItem.product)
  salesReturnItems!: SalesReturnItem[];

  @OneToMany(() => PurchaseReturnItem, (purchaseReturnItem) => purchaseReturnItem.product)
  purchaseReturnItems!: PurchaseReturnItem[];

  @OneToMany(() => BranchProductEntity, (branchProduct) => branchProduct.product)
  branchProducts!: BranchProductEntity[];

  @OneToMany(() => StockTransferEntity, (stockTransfer) => stockTransfer.product)
  stockTransfers!: StockTransferEntity[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt!: Date | null;
}
