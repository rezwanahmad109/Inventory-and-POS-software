import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

import { RecordSalePaymentDto } from '../../sales/dto/record-sale-payment.dto';

export class CreateIncomingPaymentDto extends RecordSalePaymentDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Optional wallet to deposit funds into' })
  @IsOptional()
  @IsUUID('4')
  walletId?: string;
}
