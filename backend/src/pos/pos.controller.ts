import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

import { Permissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { CheckoutPosOrderDto } from './dto/checkout-pos-order.dto';
import { CreatePosOrderDto } from './dto/create-pos-order.dto';
import { PosSearchQueryDto } from './dto/pos-search-query.dto';
import { UpdatePosOrderDto } from './dto/update-pos-order.dto';
import { PosService } from './pos.service';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

@ApiTags('POS')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('pos')
export class PosController {
  constructor(private readonly posService: PosService) {}

  @Get('products/search')
  @Permissions('pos.access')
  @ApiOperation({ summary: 'Search products by name/SKU/barcode for POS cart' })
  searchProducts(@Query() query: PosSearchQueryDto) {
    return this.posService.searchProducts(query);
  }

  @Get('orders')
  @Permissions('pos.access')
  @ApiOperation({ summary: 'List POS orders by status (cart|held|completed)' })
  listOrders(@Query('status') status?: 'cart' | 'held' | 'completed' | 'cancelled') {
    return this.posService.listOrders(status);
  }

  @Post('orders')
  @Permissions('pos.access')
  @ApiOperation({ summary: 'Create POS cart' })
  createCart(
    @Body() dto: CreatePosOrderDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.posService.createCart(dto, request.user);
  }

  @Put('orders/:id')
  @Permissions('pos.access')
  @ApiOperation({ summary: 'Update POS cart items and totals' })
  updateCart(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdatePosOrderDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.posService.updateCart(id, dto, request.user);
  }

  @Post('orders/:id/hold')
  @Permissions('pos.access')
  @ApiOperation({ summary: 'Hold POS order for later resume' })
  holdOrder(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.posService.holdOrder(id);
  }

  @Post('orders/:id/resume')
  @Permissions('pos.access')
  @ApiOperation({ summary: 'Resume held POS order' })
  resumeOrder(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.posService.resumeOrder(id);
  }

  @Post('orders/:id/checkout')
  @Permissions('pos.access')
  @ApiOperation({ summary: 'Checkout POS order and generate sale invoice' })
  checkoutOrder(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CheckoutPosOrderDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.posService.checkoutOrder(id, dto, request.user);
  }

  @Get('orders/:id/receipt')
  @Permissions('pos.access')
  @ApiOperation({ summary: 'Generate receipt payload for print' })
  getReceipt(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.posService.getReceipt(id);
  }
}
