import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
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
import { CreatePurchaseReturnDto } from './dto/create-purchase-return.dto';
import { PurchaseReturnService } from './purchase-return.service';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

@ApiTags('Purchase Returns')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('purchase-returns')
export class PurchaseReturnController {
  constructor(private readonly purchaseReturnService: PurchaseReturnService) {}

  @Post()
  @Permissions('purchase_returns.create')
  @ApiOperation({ summary: 'Create purchase return and decrement product stock' })
  @ApiResponse({ status: 201, description: 'Purchase return created' })
  create(
    @Body() createPurchaseReturnDto: CreatePurchaseReturnDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.purchaseReturnService.create(
      createPurchaseReturnDto,
      request.user.userId,
    );
  }

  @Get()
  @Permissions('purchase_returns.read')
  @ApiOperation({ summary: 'List purchase returns' })
  findAll() {
    return this.purchaseReturnService.findAll();
  }

  @Get(':id')
  @Permissions('purchase_returns.read')
  @ApiOperation({ summary: 'Get purchase return by id' })
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.purchaseReturnService.findOne(id);
  }
}
