import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsUUID, Min } from 'class-validator';

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
}
