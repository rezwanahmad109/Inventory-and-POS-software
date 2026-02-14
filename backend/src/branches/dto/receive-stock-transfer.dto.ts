import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReceiveStockTransferDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
