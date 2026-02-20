import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Put,
  Req,
  UsePipes,
  ValidationPipe,
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
import { ConvertPurchaseEstimateDto } from './dto/convert-purchase-estimate.dto';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { PurchaseQueryDto } from './dto/purchase-query.dto';
import { RecordPurchasePaymentDto } from './dto/record-purchase-payment.dto';
import { UpdatePurchaseDto } from './dto/update-purchase.dto';
import { PurchaseService } from './purchase.service';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

@ApiTags('Purchases')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('purchases')
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class PurchaseController {
  constructor(private readonly purchaseService: PurchaseService) {}

  @Get()
  @Permissions('purchases.read')
  @ApiOperation({ summary: 'Get all purchases' })
  findAll(@Query() query: PurchaseQueryDto) {
    return this.purchaseService.findAll(query);
  }

  @Get(':id')
  @Permissions('purchases.read')
  @ApiOperation({ summary: 'Get purchase by id' })
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.purchaseService.findOne(id);
  }

  @Post()
  @Permissions('purchases.create')
  @ApiOperation({ summary: 'Create purchase and increase stock quantities' })
  @ApiResponse({ status: 201, description: 'Purchase created' })
  create(
    @Body() createPurchaseDto: CreatePurchaseDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.purchaseService.create(createPurchaseDto, request.user);
  }

  @Put(':id')
  @Permissions('purchases.update')
  @ApiOperation({
    summary: 'Update purchase bill/estimate and recalculate stock/payments',
  })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() updatePurchaseDto: UpdatePurchaseDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.purchaseService.update(id, updatePurchaseDto, request.user);
  }

  @Post(':id/payments')
  @Permissions('purchases.update')
  @ApiOperation({ summary: 'Record payment against purchase bill' })
  addPayment(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() paymentDto: RecordPurchasePaymentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.purchaseService.addPayment(id, paymentDto, request.user);
  }

  @Post(':id/convert')
  @Permissions('purchases.create')
  @ApiOperation({ summary: 'Convert estimate to purchase bill' })
  convert(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() convertDto: ConvertPurchaseEstimateDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.purchaseService.convertEstimateToPurchase(
      id,
      request.user,
      convertDto,
    );
  }

  @Delete(':id')
  @Permissions('purchases.delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete purchase and rollback stock quantities' })
  async remove(@Param('id', new ParseUUIDPipe()) id: string) {
    await this.purchaseService.remove(id);
    return { message: 'Purchase deleted successfully.' };
  }
}
