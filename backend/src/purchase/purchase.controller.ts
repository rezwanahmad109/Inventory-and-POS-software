import {
  Body,
  Controller,
  Delete,
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
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { PurchaseService } from './purchase.service';

@ApiTags('Purchases')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('purchases')
export class PurchaseController {
  constructor(private readonly purchaseService: PurchaseService) {}

  @Get()
  @Permissions('purchases.read')
  @ApiOperation({ summary: 'Get all purchases' })
  findAll() {
    return this.purchaseService.findAll();
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
  create(@Body() createPurchaseDto: CreatePurchaseDto) {
    return this.purchaseService.create(createPurchaseDto);
  }

  @Delete(':id')
  @Permissions('purchases.delete')
  @ApiOperation({ summary: 'Delete purchase and rollback stock quantities' })
  async remove(@Param('id', new ParseUUIDPipe()) id: string) {
    await this.purchaseService.remove(id);
    return { message: 'Purchase deleted successfully.' };
  }
}
