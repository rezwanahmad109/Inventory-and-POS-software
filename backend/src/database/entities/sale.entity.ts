import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { PaymentMethod } from '../../common/enums/payment-method.enum';
import { decimalTransformer } from '../../common/transformers/decimal.transformer';
import { BranchEntity } from './branch.entity';
import { Customer } from './customer.entity';
import { SaleItem } from './sale-item.entity';
import { SalesReturn } from './sales-return.entity';
import { User } from './user.entity';

@Entity({ name: 'sales' })
@Unique(['invoiceNumber'])
export class Sale {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Legacy customer name field — kept for backward compatibility */
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
  invoiceNumber!: string;

  @Column({
    name: 'payment_method',
    type: 'enum',
    enum: PaymentMethod,
  })
  paymentMethod!: PaymentMethod;

  @Column({
    name: 'total_amount',
    type: 'numeric',
    precision: 14,
    scale: 2,
    transformer: decimalTransformer,
  })
  totalAmount!: number;

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

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
