import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class UpdateBusinessProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  businessName?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsUrl()
  website?: string;

  @IsOptional()
  @IsString()
  taxId?: string;
}

export class UpdateInvoiceTemplateDto {
  @IsOptional()
  @IsString()
  headerText?: string;

  @IsOptional()
  @IsString()
  footerText?: string;

  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  invoicePrefix?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  nextNumber?: number;
}

export class TaxRateEntryDto {
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsString()
  @MinLength(1)
  taxName!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  taxRate!: number;

  @IsOptional()
  @IsBoolean()
  isInclusive?: boolean;
}

export class UpdateTaxSettingsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaxRateEntryDto)
  rates!: TaxRateEntryDto[];
}

export class DiscountRuleDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsIn(['percentage', 'fixed'])
  discountType!: 'percentage' | 'fixed';

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  value!: number;

  @IsOptional()
  @IsUUID()
  appliesToCategoryId?: string;

  @IsOptional()
  @IsUUID()
  appliesToProductId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateDiscountRulesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DiscountRuleDto)
  rules!: DiscountRuleDto[];
}

export class UpdateStockPolicyDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  defaultLowStockThreshold?: number;

  @IsOptional()
  @IsBoolean()
  allowStockTransfers?: boolean;

  @IsOptional()
  @IsBoolean()
  allowNegativeStock?: boolean;

  @IsOptional()
  @IsBoolean()
  autoReorderEnabled?: boolean;
}

export class AuditLogQueryDto {
  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsString()
  entity?: string;

  @IsOptional()
  @IsUUID()
  actorId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}

export class CurrencySettingDto {
  @IsString()
  @MinLength(1)
  code!: string;

  @IsString()
  @MinLength(1)
  symbol!: string;

  @IsIn(['left', 'right'])
  position!: 'left' | 'right';

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateCurrenciesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CurrencySettingDto)
  currencies!: CurrencySettingDto[];
}

export class PaymentModeSettingDto {
  @IsString()
  @MinLength(1)
  code!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdatePaymentModesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentModeSettingDto)
  paymentModes!: PaymentModeSettingDto[];
}

export class UpdateEmailNotificationSettingsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  senderName?: string;

  @IsOptional()
  @IsEmail()
  senderEmail?: string;

  @IsOptional()
  @IsString()
  smtpHost?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  smtpPort?: number;

  @IsOptional()
  @IsBoolean()
  useTls?: boolean;
}

export class ExportQueryDto {
  @IsOptional()
  @IsIn([
    'settings',
    'tax',
    'discount_rules',
    'inventory_low_stock',
    'currencies',
    'payment_modes',
  ])
  dataset?:
    | 'settings'
    | 'tax'
    | 'discount_rules'
    | 'inventory_low_stock'
    | 'currencies'
    | 'payment_modes';
}
