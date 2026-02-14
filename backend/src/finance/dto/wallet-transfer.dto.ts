import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class WalletTransferDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  fromWalletId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  toWalletId!: string;

  @ApiProperty({ example: 50 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @ApiPropertyOptional({ example: '2026-02-14' })
  @IsOptional()
  @IsDateString()
  txnDate?: string;

  @ApiPropertyOptional({ example: 'Shift close transfer' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ example: 'wallet-transfer-001' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  idempotencyKey?: string;
}
