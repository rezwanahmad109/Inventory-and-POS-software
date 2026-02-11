import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class ProductsQueryDto {
  @ApiPropertyOptional({ example: '0f8fad5b-d9cb-469f-a165-70867728950e' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ example: '1d7f4f0f-cc09-4dd4-9582-c8ce7f2188ad' })
  @IsOptional()
  @IsUUID()
  unitId?: string;
}
