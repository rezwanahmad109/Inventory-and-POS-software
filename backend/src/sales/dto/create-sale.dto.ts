import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { DiscountType } from '../../common/enums/discount-type.enum';
import { QuotationStatus } from '../../common/enums/quotation-status.enum';
import { SaleDocumentType } from '../../common/enums/sale-document-type.enum';
import { CreateSaleItemDto } from './create-sale-item.dto';
import { CreateSalePaymentDto } from './create-sale-payment.dto';
import { InvoiceTaxOverrideDto } from './invoice-tax-override.dto';

export class CreateSaleDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({ enum: SaleDocumentType, default: SaleDocumentType.INVOICE })
  @IsOptional()
  @IsEnum(SaleDocumentType)
  documentType?: SaleDocumentType;

  @ApiPropertyOptional({
    enum: QuotationStatus,
    description: 'Used only when documentType is quotation',
  })
  @IsOptional()
  @IsEnum(QuotationStatus)
  quotationStatus?: QuotationStatus;

  @ApiPropertyOptional({ example: '2026-03-01' })
  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @ApiPropertyOptional({ example: 'Walk-in Customer' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  customer?: string;

  @ApiPropertyOptional({ example: 7 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  customerId?: number;

  @ApiPropertyOptional({ enum: DiscountType, default: DiscountType.NONE })
  @IsOptional()
  @IsEnum(DiscountType)
  invoiceDiscountType?: DiscountType;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  invoiceDiscountValue?: number;

  @ApiPropertyOptional({ type: InvoiceTaxOverrideDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => InvoiceTaxOverrideDto)
  invoiceTaxOverride?: InvoiceTaxOverrideDto;

  @ApiProperty({
    type: [CreateSaleItemDto],
    example: [{ productId: 'uuid-here', quantity: 1 }],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateSaleItemDto)
  items!: CreateSaleItemDto[];

  @ApiPropertyOptional({ type: [CreateSalePaymentDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSalePaymentDto)
  payments?: CreateSalePaymentDto[];

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];

  @ApiPropertyOptional({ example: 15 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  shippingTotal?: number;
}
