import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

import { CreateSaleDeliveryItemDto } from './create-sale-delivery-item.dto';

export class CreateSaleDeliveryDto {
  @ApiProperty({
    type: [CreateSaleDeliveryItemDto],
    example: [{ orderItemId: '550e8400-e29b-41d4-a716-446655440000', quantity: 5 }],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateSaleDeliveryItemDto)
  items!: CreateSaleDeliveryItemDto[];

  @ApiPropertyOptional({ example: '2026-02-21', description: 'Optional posting date' })
  @IsOptional()
  @IsDateString()
  deliveryDate?: string;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
