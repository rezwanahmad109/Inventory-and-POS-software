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

export class CreatePurchaseReturnItemDto {
  @IsNotEmpty()
  @IsUUID('4')
  productId!: string;

  @IsPositive()
  quantity!: number;

  @IsOptional()
  @IsPositive()
  unitPrice?: number;
}

export class CreatePurchaseReturnDto {
  @IsNotEmpty()
  @IsUUID('4')
  originalPurchaseId!: string;

  @IsOptional()
  @Type(() => Date)
  returnDate?: Date;

  @IsNotEmpty()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique((item: CreatePurchaseReturnItemDto) => item.productId)
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseReturnItemDto)
  items!: CreatePurchaseReturnItemDto[];
}
