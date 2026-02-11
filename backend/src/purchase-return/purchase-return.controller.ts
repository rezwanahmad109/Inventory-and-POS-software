import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { Permissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreatePurchaseReturnDto } from './dto/create-purchase-return.dto';
import { PurchaseReturnService } from './purchase-return.service';

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
  create(@Body() createPurchaseReturnDto: CreatePurchaseReturnDto) {
    return this.purchaseReturnService.create(createPurchaseReturnDto);
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
