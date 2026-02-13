import {
  Column,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'invoice_sequences' })
export class InvoiceSequence {
  @PrimaryColumn({ length: 32 })
  key!: string;

  @Column({ name: 'last_number', type: 'integer', default: 0 })
  lastNumber!: number;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
