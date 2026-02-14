import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class WalletBalanceAdjustmentDto {
  @ApiProperty({ example: 120 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @ApiPropertyOptional({ example: '2026-02-14' })
  @IsOptional()
  @IsDateString()
  txnDate?: string;

  @ApiPropertyOptional({ example: 'manual_adjustment' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  referenceType?: string;

  @ApiPropertyOptional({ example: 'ADJ-1002' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  referenceId?: string;

  @ApiPropertyOptional({ example: 'Cash drawer refill' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ example: 'wallet-topup-0001' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  idempotencyKey?: string;
}
