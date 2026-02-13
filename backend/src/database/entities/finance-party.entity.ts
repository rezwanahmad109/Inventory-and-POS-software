import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Customer } from './customer.entity';
import { Supplier } from './supplier.entity';

@Entity({ name: 'finance_parties' })
export class FinanceParty {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_finance_parties_party_type')
  @Column({ name: 'party_type', length: 20 })
  partyType!: 'customer' | 'supplier' | 'both' | 'other';

  @Column({ name: 'display_name', length: 160 })
  displayName!: string;

  @Column({ name: 'phone', length: 40, nullable: true })
  phone!: string | null;

  @Column({ name: 'email', length: 160, nullable: true })
  email!: string | null;

  @ManyToOne(() => Customer, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'customer_id' })
  customer!: Customer | null;

  @Column({ name: 'customer_id', nullable: true })
  customerId!: number | null;

  @ManyToOne(() => Supplier, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'supplier_id' })
  supplier!: Supplier | null;

  @Column({ name: 'supplier_id', nullable: true })
  supplierId!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
