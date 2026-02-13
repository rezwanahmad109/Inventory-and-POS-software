import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

import { SalePaymentMethod } from '../../common/enums/sale-payment-method.enum';

export class CreateSalePaymentDto {
  @ApiProperty({ enum: SalePaymentMethod })
  @IsEnum(SalePaymentMethod)
  method!: SalePaymentMethod;

  @ApiProperty({ example: 100 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @ApiPropertyOptional({ example: 'TXN-1033' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;

  @ApiPropertyOptional({ type: 'object' })
  @IsOptional()
  @IsObject()
  meta?: Record<string, unknown>;
}
