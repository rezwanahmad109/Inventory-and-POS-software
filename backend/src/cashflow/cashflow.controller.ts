import {
  Body,
  Controller,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

import { Permissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { CashflowService } from './cashflow.service';
import { CreateIncomingPaymentDto } from './dto/create-incoming-payment.dto';
import { CreateOutgoingPaymentDto } from './dto/create-outgoing-payment.dto';
import { PayExpenseDto } from './dto/pay-expense.dto';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

@ApiTags('Cashflow')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class CashflowController {
  constructor(private readonly cashflowService: CashflowService) {}

  @Post('incoming-payments/sales/:saleId')
  @Permissions('finance_payments.create')
  @ApiOperation({ summary: 'Record customer payment in and optionally deposit to wallet' })
  recordIncomingSalePayment(
    @Param('saleId', new ParseUUIDPipe()) saleId: string,
    @Body() dto: CreateIncomingPaymentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.cashflowService.recordIncomingSalePayment(
      saleId,
      dto,
      request.user,
    );
  }

  @Post('outgoing-payments/purchases/:purchaseId')
  @Permissions('finance_payments.create')
  @ApiOperation({ summary: 'Record supplier payment out and optionally withdraw from wallet' })
  recordOutgoingPurchasePayment(
    @Param('purchaseId', new ParseUUIDPipe()) purchaseId: string,
    @Body() dto: CreateOutgoingPaymentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.cashflowService.recordOutgoingPurchasePayment(
      purchaseId,
      dto,
      request.user,
    );
  }

  @Post('outgoing-payments/expenses/:expenseId')
  @Permissions('finance_payments.create')
  @ApiOperation({ summary: 'Pay expense from wallet/cash account and write ledger transaction' })
  payExpense(
    @Param('expenseId', ParseIntPipe) expenseId: number,
    @Body() dto: PayExpenseDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.cashflowService.payExpense(expenseId, dto, request.user);
  }
}
