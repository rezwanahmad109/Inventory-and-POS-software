import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
} from 'class-validator';

import { WalletType } from '../finance.enums';

export class CreateWalletDto {
  @ApiProperty({ example: 'CASH_MAIN' })
  @IsString()
  @MaxLength(30)
  code!: string;

  @ApiProperty({ example: 'Main Cash Drawer' })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiProperty({ enum: WalletType })
  @IsEnum(WalletType)
  type!: WalletType;

  @ApiPropertyOptional({ default: 'USD' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  openingBalance?: number;
}
