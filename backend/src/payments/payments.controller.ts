import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { Roles } from '../common/decorators/roles.decorator';
import { RoleName } from '../common/enums/role-name.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PaymentType } from '../database/entities/payment.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentQueryDto } from './dto/payment-query.dto';
import { PaymentsService } from './payments.service';

@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleName.ADMIN, RoleName.MANAGER, RoleName.CASHIER)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  async create(@Body() dto: CreatePaymentDto) {
    switch (dto.type) {
      case PaymentType.DEPOSIT:
        return this.paymentsService.recordDeposit(
          dto.customerId,
          dto.amount,
          dto.method,
          dto.note,
        );
      case PaymentType.SALE_DUE:
        if (!dto.saleId) {
          throw new BadRequestException('saleId is required when type is "sale_due".');
        }
        return this.paymentsService.recordSaleDue(
          dto.customerId,
          dto.saleId,
          dto.amount,
          dto.method,
        );
      case PaymentType.DUE_PAYMENT:
        return this.paymentsService.recordDuePayment(
          dto.customerId,
          dto.amount,
          dto.method,
          dto.note,
        );
      default:
        throw new BadRequestException(`Unsupported payment type "${dto.type}".`);
    }
  }

  @Get()
  async findAll(@Query() query: PaymentQueryDto) {
    return this.paymentsService.findAll(query);
  }

  @Get('customer/:customerId')
  async findByCustomer(
    @Param('customerId', ParseIntPipe) customerId: number,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.paymentsService.findByCustomer(customerId, from, to);
  }
}
