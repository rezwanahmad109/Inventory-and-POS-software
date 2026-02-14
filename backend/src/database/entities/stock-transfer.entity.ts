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
  PENDING_APPROVAL = 'pending_approval',
  APPROVED = 'approved',
  RECEIVED = 'received',
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
    default: StockTransferStatus.PENDING_APPROVAL,
  })
  status!: StockTransferStatus;

  @Column({ name: 'approved_by', length: 160, nullable: true })
  approvedBy!: string | null;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt!: Date | null;

  @Column({ name: 'received_by', length: 160, nullable: true })
  receivedBy!: string | null;

  @Column({ name: 'received_at', type: 'timestamptz', nullable: true })
  receivedAt!: Date | null;

  @Column({ name: 'cancelled_by', length: 160, nullable: true })
  cancelledBy!: string | null;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn({ name: 'timestamp' })
  timestamp!: Date;
}
