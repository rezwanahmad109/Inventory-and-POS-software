import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

import { RecordPurchasePaymentDto } from '../../purchase/dto/record-purchase-payment.dto';

export class CreateOutgoingPaymentDto extends RecordPurchasePaymentDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Optional wallet to withdraw funds from' })
  @IsOptional()
  @IsUUID('4')
  walletId?: string;
}
