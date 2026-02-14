import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class ConvertSaleQuotationDto {
  @ApiPropertyOptional({ example: '2026-02-14', description: 'Override conversion date' })
  @IsOptional()
  @IsDateString()
  conversionDate?: string;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
