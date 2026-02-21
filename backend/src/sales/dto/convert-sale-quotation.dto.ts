import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class ConvertSaleQuotationItemDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  orderItemId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class ConvertSaleQuotationDto {
  @ApiPropertyOptional({ example: '2026-02-14', description: 'Override conversion date' })
  @IsOptional()
  @IsDateString()
  conversionDate?: string;

  @ApiPropertyOptional({
    type: [ConvertSaleQuotationItemDto],
    description: 'Optional partial invoice lines from delivered quantities.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConvertSaleQuotationItemDto)
  items?: ConvertSaleQuotationItemDto[];

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
