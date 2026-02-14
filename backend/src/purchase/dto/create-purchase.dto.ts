import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

import { PurchaseDocumentType } from '../../common/enums/purchase-document-type.enum';
import { QuotationStatus } from '../../common/enums/quotation-status.enum';
import { CreatePurchaseItemDto } from './create-purchase-item.dto';
import { CreatePurchasePaymentDto } from './create-purchase-payment.dto';

export class CreatePurchaseDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({
    enum: PurchaseDocumentType,
    default: PurchaseDocumentType.BILL,
  })
  @IsOptional()
  @IsEnum(PurchaseDocumentType)
  documentType?: PurchaseDocumentType;

  @ApiPropertyOptional({
    enum: QuotationStatus,
    description: 'Used only when documentType is estimate',
  })
  @IsOptional()
  @IsEnum(QuotationStatus)
  quotationStatus?: QuotationStatus;

  @ApiPropertyOptional({ example: '2026-03-01' })
  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  supplierId!: string;

  @ApiProperty({
    type: [CreatePurchaseItemDto],
    example: [{ productId: 'uuid-here', quantity: 5, unitPrice: 49.99 }],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseItemDto)
  items!: CreatePurchaseItemDto[];

  @ApiPropertyOptional({ type: [CreatePurchasePaymentDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePurchasePaymentDto)
  payments?: CreatePurchasePaymentDto[];

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
}
