import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { BranchEntity } from './branch.entity';
import { Product } from './product.entity';

@Entity({ name: 'branch_products' })
@Unique(['branchId', 'productId'])
export class BranchProductEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => BranchEntity, (branch) => branch.branchProducts, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'branch_id' })
  branch!: BranchEntity;

  @Column({ name: 'branch_id' })
  branchId!: string;

  @ManyToOne(() => Product, (product) => product.branchProducts, {
    nullable: false,
    eager: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'product_id' })
  product!: Product;

  @Column({ name: 'product_id' })
  productId!: string;

  @Column({ name: 'stock_quantity', type: 'integer', default: 0 })
  stockQuantity!: number;

  @Column({ name: 'low_stock_threshold', type: 'integer', default: 0 })
  lowStockThreshold!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
