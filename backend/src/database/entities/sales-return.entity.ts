import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { decimalTransformer } from '../../common/transformers/decimal.transformer';
import { Sale } from './sale.entity';
import { SalesReturnItem } from './sales-return-item.entity';

@Entity({ name: 'sales_returns' })
export class SalesReturn {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Sale, (sale) => sale.salesReturns, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'original_sale_id' })
  originalSale!: Sale;

  @Column({ name: 'original_sale_id' })
  originalSaleId!: string;

  @Column({ name: 'return_date', type: 'date' })
  returnDate!: Date;

  @OneToMany(() => SalesReturnItem, (item) => item.salesReturn, {
    cascade: true,
  })
  returnedItems!: SalesReturnItem[];

  @Column({
    name: 'total_refund',
    type: 'numeric',
    precision: 14,
    scale: 2,
    transformer: decimalTransformer,
  })
  totalRefund!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}