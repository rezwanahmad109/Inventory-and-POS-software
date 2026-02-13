import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { decimalTransformer } from '../../common/transformers/decimal.transformer';
import { FinanceParty } from './finance-party.entity';
import { Purchase } from './purchase.entity';
import { Sale } from './sale.entity';

@Entity({ name: 'finance_invoices' })
@Unique(['documentNo'])
export class FinanceInvoice {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_finance_invoices_document_no')
  @Column({ name: 'document_no', length: 40 })
  documentNo!: string;

  @Column({ name: 'document_type', length: 30 })
  documentType!: 'sales_invoice' | 'purchase_bill' | 'credit_note' | 'debit_note';

  @ManyToOne(() => FinanceParty, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'party_id' })
  party!: FinanceParty;

  @Column({ name: 'party_id', type: 'uuid' })
  partyId!: string;

  @ManyToOne(() => Sale, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'sale_id' })
  sale!: Sale | null;

  @Column({ name: 'sale_id', nullable: true })
  saleId!: string | null;

  @ManyToOne(() => Purchase, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'purchase_id' })
  purchase!: Purchase | null;

  @Column({ name: 'purchase_id', nullable: true })
  purchaseId!: string | null;

  @Column({ name: 'issue_date', type: 'date' })
  issueDate!: Date;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate!: Date | null;

  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    transformer: decimalTransformer,
  })
  subtotal!: number;

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
    name: 'total_amount',
    type: 'numeric',
    precision: 14,
    scale: 2,
    transformer: decimalTransformer,
  })
  totalAmount!: number;

  @Column({
    name: 'balance_due',
    type: 'numeric',
    precision: 14,
    scale: 2,
    transformer: decimalTransformer,
  })
  balanceDue!: number;

  @Column({ length: 3, default: 'USD' })
  currency!: string;

  @Index('idx_finance_invoices_status')
  @Column({ length: 20, default: 'open' })
  status!: 'draft' | 'open' | 'partial' | 'paid' | 'void';

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
