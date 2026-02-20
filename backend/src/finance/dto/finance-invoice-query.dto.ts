import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';

import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { FinanceDocumentType } from '../finance.enums';

export class FinanceInvoiceQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  partyId?: string;

  @ApiPropertyOptional({ enum: FinanceDocumentType })
  @IsOptional()
  @IsEnum(FinanceDocumentType)
  documentType?: FinanceDocumentType;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  to?: string;
}
