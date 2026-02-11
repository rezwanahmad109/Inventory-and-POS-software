import {
  Body,
  Controller,
  Get,
  ParseUUIDPipe,
  Param,
  Post,
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

import { Permissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { CreateSaleDto } from './dto/create-sale.dto';
import { SalesService } from './sales.service';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

@ApiTags('Sales')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

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
  findAll() {
    return this.salesService.findAll();
  }

  @Get(':id')
  @Permissions('sales.view')
  @ApiOperation({ summary: 'Get sale invoice by id' })
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.salesService.findOne(id);
  }
}
