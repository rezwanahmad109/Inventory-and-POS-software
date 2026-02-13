import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  IsEnum,
} from 'class-validator';

import { TaxMethod } from '../../common/enums/tax-method.enum';

export class CreateProductDto {
  @ApiProperty({ example: 'Wireless Barcode Scanner' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;

  @ApiProperty({ example: 'SKU-1001' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  sku!: string;

  @ApiPropertyOptional({ example: '1234567890123' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  barcode?: string;

  @ApiProperty({ example: '0f8fad5b-d9cb-469f-a165-70867728950e' })
  @IsUUID()
  @IsNotEmpty()
  categoryId!: string;

  @ApiProperty({ example: '1d7f4f0f-cc09-4dd4-9582-c8ce7f2188ad' })
  @IsUUID()
  @IsNotEmpty()
  unitId!: string;

  @ApiProperty({ example: 49.99 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price!: number;

  @ApiPropertyOptional({ example: 5.0 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  taxRate?: number;

  @ApiPropertyOptional({ enum: TaxMethod, default: TaxMethod.EXCLUSIVE })
  @IsOptional()
  @IsEnum(TaxMethod)
  taxMethod?: TaxMethod;

  @ApiProperty({ example: 18 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stockQty!: number;

  @ApiPropertyOptional({ example: 5 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  lowStockThreshold?: number;

  @ApiPropertyOptional({ example: 'Compact scanner for checkout operations' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/products/scanner.png',
  })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  image?: string;
}
