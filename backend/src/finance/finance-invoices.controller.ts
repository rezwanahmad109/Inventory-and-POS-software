import {
  Body,
  Controller,
  Get,
  Post,
  Query,
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
import { CreateFinanceInvoiceDto } from './dto/create-finance-invoice.dto';
import { FinanceInvoiceQueryDto } from './dto/finance-invoice-query.dto';
import { FinanceInvoicesService } from './services/finance-invoices.service';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

@ApiTags('Finance Invoices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/invoices')
export class FinanceInvoicesController {
  constructor(private readonly financeInvoicesService: FinanceInvoicesService) {}

  // Example request payload:
  // {
  //   "documentType": "sales_invoice",
  //   "partyId": "uuid",
  //   "issueDate": "2026-02-13",
  //   "dueDate": "2026-03-15",
  //   "subtotal": 100,
  //   "taxTotal": 10,
  //   "totalAmount": 110,
  //   "idempotencyKey": "sale-INV-1022"
  // }
  @Post()
  @Permissions('finance_invoices.create')
  @ApiOperation({
    summary: 'Create invoice and auto-post balanced journal entry',
  })
  create(
    @Body() dto: CreateFinanceInvoiceDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.financeInvoicesService.create(dto, request.user.userId);
  }

  // Example response:
  // { "id": "uuid", "documentNo": "SI-000001", "status": "open", ... }
  @Get()
  @Permissions('finance_invoices.read')
  @ApiOperation({ summary: 'List finance invoices' })
  findAll(@Query() query: FinanceInvoiceQueryDto) {
    return this.financeInvoicesService.findAll(query);
  }
}
