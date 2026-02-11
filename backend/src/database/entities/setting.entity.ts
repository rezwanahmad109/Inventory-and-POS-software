import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { decimalTransformer } from '../../common/transformers/decimal.transformer';

@Entity({ name: 'settings' })
export class Setting {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({
    name: 'tax_rate',
    type: 'numeric',
    precision: 5,
    scale: 4,
    default: 0,
    transformer: decimalTransformer,
  })
  taxRate!: number;

  @Column({ length: 3, default: 'USD' })
  currency!: string;

  @Column({ name: 'logo_url', type: 'text', nullable: true })
  logoUrl!: string | null;

  @Column({ name: 'business_name', length: 255 })
  businessName!: string;

  @Column({ name: 'footer_note', type: 'text', nullable: true })
  footerNote!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
