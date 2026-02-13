import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';

import { Permissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { CreateFinancePaymentDto } from './dto/create-finance-payment.dto';
import { FinancePaymentsService } from './services/finance-payments.service';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

@ApiTags('Finance Payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/payments')
export class FinancePaymentsController {
  constructor(private readonly financePaymentsService: FinancePaymentsService) {}

  // Example request payload:
  // {
  //   "partyId": "uuid",
  //   "walletId": "uuid",
  //   "direction": "receipt",
  //   "amount": 100,
  //   "paymentMethod": "bank_transfer",
  //   "processorToken": "tok_...",
  //   "idempotencyKey": "pay-001",
  //   "allocations": [{ "invoiceId": "uuid", "allocatedAmount": 100 }]
  // }
  @Post()
  @Permissions('finance_payments.create')
  @ApiOperation({ summary: 'Create payment, allocate, and post journal' })
  create(
    @Body() dto: CreateFinancePaymentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.financePaymentsService.create(dto, request.user.userId);
  }

  @Get()
  @Permissions('finance_payments.read')
  @ApiOperation({ summary: 'List finance payments' })
  findAll() {
    return this.financePaymentsService.findAll();
  }
}
