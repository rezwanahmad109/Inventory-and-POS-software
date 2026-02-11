import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateUnitDto {
  @ApiProperty({ example: 'Kilogram' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name!: string;

  @ApiProperty({ example: 'kg' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  symbol!: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'Base conversion factor used for bulk-to-retail conversion',
  })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  conversionFactor?: number;

  @ApiPropertyOptional({ example: 'Standard weight unit' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;
}
