import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { decimalTransformer } from '../../common/transformers/decimal.transformer';

export interface BusinessProfileSetting {
  businessName: string;
  address: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  website: string | null;
  taxId: string | null;
}

export interface InvoiceTemplateSetting {
  headerText: string | null;
  footerText: string | null;
  logoUrl: string | null;
  invoicePrefix: string;
  nextNumber: number;
}

export interface TaxRateSetting {
  branchId: string | null;
  taxName: string;
  taxRate: number;
  isInclusive: boolean;
}

export interface StockPolicySetting {
  defaultLowStockThreshold: number;
  allowStockTransfers: boolean;
  allowNegativeStock: boolean;
  autoReorderEnabled: boolean;
}

export interface DiscountRuleSetting {
  id: string;
  name: string;
  discountType: 'percentage' | 'fixed';
  value: number;
  appliesToCategoryId: string | null;
  appliesToProductId: string | null;
  isActive: boolean;
}

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

  @Column({ name: 'business_profile', type: 'jsonb', nullable: true })
  businessProfile!: BusinessProfileSetting | null;

  @Column({ name: 'invoice_template', type: 'jsonb', nullable: true })
  invoiceTemplate!: InvoiceTemplateSetting | null;

  @Column({ name: 'tax_settings', type: 'jsonb', nullable: true })
  taxSettings!: TaxRateSetting[] | null;

  @Column({ name: 'discount_rules', type: 'jsonb', nullable: true })
  discountRules!: DiscountRuleSetting[] | null;

  @Column({ name: 'stock_policy', type: 'jsonb', nullable: true })
  stockPolicy!: StockPolicySetting | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
