import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class StockTransferDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  fromBranchId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  toBranchId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  productId!: string;

  @ApiProperty({ example: 5 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
