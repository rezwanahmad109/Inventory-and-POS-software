import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class CreateSalesReturnItemDto {
  @IsNotEmpty()
  @IsUUID('4')
  productId!: string;

  @IsPositive()
  quantity!: number;

  @IsOptional()
  @IsPositive()
  unitPrice?: number;
}

export class CreateSalesReturnDto {
  @IsNotEmpty()
  @IsUUID('4')
  originalSaleId!: string;

  @IsOptional()
  @Type(() => Date)
  returnDate?: Date;

  @IsNotEmpty()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique((item: CreateSalesReturnItemDto) => item.productId)
  @ValidateNested({ each: true })
  @Type(() => CreateSalesReturnItemDto)
  items!: CreateSalesReturnItemDto[];
}
