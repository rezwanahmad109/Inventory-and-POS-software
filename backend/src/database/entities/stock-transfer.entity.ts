import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { BranchEntity } from './branch.entity';
import { Product } from './product.entity';

export enum StockTransferStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

@Entity({ name: 'stock_transfers' })
export class StockTransferEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => BranchEntity, {
    nullable: false,
    eager: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'from_branch_id' })
  fromBranch!: BranchEntity;

  @Column({ name: 'from_branch_id' })
  fromBranchId!: string;

  @ManyToOne(() => BranchEntity, {
    nullable: false,
    eager: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'to_branch_id' })
  toBranch!: BranchEntity;

  @Column({ name: 'to_branch_id' })
  toBranchId!: string;

  @ManyToOne(() => Product, (product) => product.stockTransfers, {
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

  @Column({ name: 'initiated_by', length: 160 })
  initiatedBy!: string;

  @Column({
    type: 'enum',
    enum: StockTransferStatus,
    default: StockTransferStatus.COMPLETED,
  })
  status!: StockTransferStatus;

  @CreateDateColumn({ name: 'timestamp' })
  timestamp!: Date;
}
