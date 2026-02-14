import {
  IsArray,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateSettingsDto {
  /** Tax rate as a decimal between 0 and 1 (e.g. 0.07 = 7%) */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  taxRate?: number;

  /** ISO 4217 currency code, uppercase 3-letter (e.g. USD, BDT) */
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/, { message: 'currency must be a 3-letter uppercase code' })
  currency?: string;

  /** URL to the business logo */
  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  @IsOptional()
  @IsUrl()
  secondaryLogoUrl?: string;

  /** Business display name */
  @IsOptional()
  @IsString()
  @MinLength(1)
  businessName?: string;

  /** Footer note for receipts/invoices */
  @IsOptional()
  @IsString()
  footerNote?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  theme?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  timeZone?: string;

  @IsOptional()
  @IsObject()
  businessProfile?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  invoiceTemplate?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  taxSettings?: unknown[];

  @IsOptional()
  @IsArray()
  discountRules?: unknown[];

  @IsOptional()
  @IsObject()
  stockPolicy?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  currencies?: unknown[];

  @IsOptional()
  @IsArray()
  paymentModes?: unknown[];

  @IsOptional()
  @IsObject()
  emailNotificationSettings?: Record<string, unknown>;
}
