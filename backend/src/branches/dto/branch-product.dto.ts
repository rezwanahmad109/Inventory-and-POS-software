import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class BranchProductDto {
  @ApiPropertyOptional({
    example: 75,
    description: 'Absolute stock quantity for the branch-product row',
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  stockQuantity?: number;

  @ApiPropertyOptional({
    example: -2,
    description:
      'Increment/decrement stock by a delta value. Applied after stockQuantity if both are provided.',
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  adjustBy?: number;

  @ApiPropertyOptional({
    example: 10,
    description: 'Branch-specific threshold for low-stock checks',
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  lowStockThreshold?: number;
}
