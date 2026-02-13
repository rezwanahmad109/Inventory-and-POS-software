import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsString, Max, Min } from 'class-validator';

export class SearchProductsDto {
  @ApiProperty({ example: 'wireless scanner' })
  @IsString()
  q!: string;

  @ApiProperty({ example: 20, minimum: 1, maximum: 50, required: false })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;
}
