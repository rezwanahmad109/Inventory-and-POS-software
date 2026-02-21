import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { SalePaymentMethod } from '../../common/enums/sale-payment-method.enum';

export class CreateSalesReturnItemDto {
  @IsNotEmpty()
  @IsUUID('4')
  productId!: string;

  @IsOptional()
  @IsUUID('4')
  warehouseId?: string;

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
  @ArrayUnique(
    (item: CreateSalesReturnItemDto) => `${item.productId}:${item.warehouseId ?? ''}`,
  )
  @ValidateNested({ each: true })
  @Type(() => CreateSalesReturnItemDto)
  items!: CreateSalesReturnItemDto[];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSalesReturnPaymentDto)
  refundPayments?: CreateSalesReturnPaymentDto[];
}

export class CreateSalesReturnPaymentDto {
  @IsEnum(SalePaymentMethod)
  method!: SalePaymentMethod;

  @IsPositive()
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;

  @IsOptional()
  @IsObject()
  meta?: Record<string, unknown>;
}
