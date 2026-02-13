import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

import {
  StockLedgerReason,
  StockLedgerRefType,
} from '../../common/enums/stock-ledger.enum';

@Entity({ name: 'stock_ledger' })
export class StockLedgerEntry {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_stock_ledger_product_id')
  @Column({ name: 'product_id', type: 'uuid' })
  productId!: string;

  @Index('idx_stock_ledger_branch_id')
  @Column({ name: 'branch_id', type: 'uuid', nullable: true })
  branchId!: string | null;

  @Column({ name: 'qty_delta', type: 'integer' })
  qtyDelta!: number;

  @Column({
    type: 'enum',
    enum: StockLedgerReason,
  })
  reason!: StockLedgerReason;

  @Column({
    name: 'ref_type',
    type: 'enum',
    enum: StockLedgerRefType,
  })
  refType!: StockLedgerRefType;

  @Column({ name: 'ref_id', type: 'uuid' })
  refId!: string;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
