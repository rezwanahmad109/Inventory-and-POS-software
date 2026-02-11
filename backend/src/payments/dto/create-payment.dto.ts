import {
  IsInt,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateIf,
} from 'class-validator';
import { PaymentMethodType, PaymentType } from '../../database/entities/payment.entity';

export class CreatePaymentDto {
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  customerId!: number;

  @IsEnum(PaymentType)
  type!: PaymentType;

  @IsEnum(PaymentMethodType)
  method!: PaymentMethodType;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsString()
  note?: string;

  @ValidateIf((dto: CreatePaymentDto) => dto.type === PaymentType.SALE_DUE)
  @IsNotEmpty()
  @IsUUID('4')
  saleId?: string;
}
