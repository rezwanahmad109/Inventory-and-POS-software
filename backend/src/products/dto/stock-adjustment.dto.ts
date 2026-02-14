import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

import { StockAdjustmentReason } from '../../common/enums/stock-adjustment-reason.enum';

export class StockAdjustmentDto {
  @ApiProperty({ example: -3, description: 'Use positive to increase and negative to decrease stock' })
  @Type(() => Number)
  @IsInt()
  qtyDelta!: number;

  @ApiProperty({ enum: StockAdjustmentReason })
  @IsEnum(StockAdjustmentReason)
  reason!: StockAdjustmentReason;

  @ApiPropertyOptional({ format: 'uuid', description: 'Optional branch to scope adjustment' })
  @IsOptional()
  @IsUUID('4')
  branchId?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
