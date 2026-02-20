import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  Param,
  Post,
  Query,
  Res,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { Response } from 'express';

import { Permissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { ConvertSaleQuotationDto } from './dto/convert-sale-quotation.dto';
import { CreateSaleDto } from './dto/create-sale.dto';
import { RecordSalePaymentDto } from './dto/record-sale-payment.dto';
import { SalesQueryDto } from './dto/sales-query.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
import { SalesPdfService } from './sales-pdf.service';
import { SalesService } from './sales.service';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

@ApiTags('Sales')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('sales')
export class SalesController {
  constructor(
    private readonly salesService: SalesService,
    private readonly salesPdfService: SalesPdfService,
  ) {}

  @Post()
  @Permissions('sales.create')
  @ApiOperation({ summary: 'Create sale invoice and decrement product stock' })
  @ApiResponse({ status: 201, description: 'Sale created' })
  create(
    @Body() createSaleDto: CreateSaleDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.salesService.createInvoice(createSaleDto, request.user);
  }

  @Get()
  @Permissions('sales.view')
  @ApiOperation({ summary: 'List sales invoices' })
  findAll(@Query() query: SalesQueryDto) {
    return this.salesService.findAll(query);
  }

  @Get(':id')
  @Permissions('sales.view')
  @ApiOperation({ summary: 'Get sale invoice by id' })
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.salesService.findOne(id);
  }

  @Put(':id')
  @Permissions('sales.update')
  @ApiOperation({
    summary: 'Update sale invoice or quotation and recalculate stock/payments',
  })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() updateSaleDto: UpdateSaleDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.salesService.updateInvoice(id, updateSaleDto, request.user);
  }

  @Delete(':id')
  @Permissions('sales.delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete sale invoice/quotation and rollback stock' })
  async remove(@Param('id', new ParseUUIDPipe()) id: string) {
    await this.salesService.removeInvoice(id);
    return { message: 'Sale deleted successfully.' };
  }

  @Post(':id/payments')
  @Permissions('sales.update')
  @ApiOperation({ summary: 'Record payment against sale invoice' })
  addPayment(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() paymentDto: RecordSalePaymentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.salesService.addPayment(id, paymentDto, request.user);
  }

  @Post(':id/convert')
  @Permissions('sales.create')
  @ApiOperation({ summary: 'Convert quotation to sale invoice' })
  convertQuotation(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() convertDto: ConvertSaleQuotationDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.salesService.convertQuotationToSale(id, request.user, convertDto);
  }

  @Get(':id/pdf')
  @Permissions('sales.view')
  @ApiOperation({ summary: 'Generate invoice PDF with company branding and barcode/QR payload' })
  async getInvoicePdf(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Res() response: Response,
  ) {
    const { sale, pdf } = await this.salesPdfService.generateInvoicePdf(id);
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${sale.invoiceNumber}.pdf"`,
    );
    response.status(200).send(pdf);
  }
}
