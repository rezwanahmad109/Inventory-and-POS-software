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
import { CreateSalesReturnDto } from './dto/create-sales-return.dto';
import { SalesReturnService } from './sales-return.service';

@ApiTags('Sales Returns')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('sales-returns')
export class SalesReturnController {
  constructor(private readonly salesReturnService: SalesReturnService) {}

  @Post()
  @Permissions('sales_returns.create')
  @ApiOperation({ summary: 'Create sales return and increment product stock' })
  @ApiResponse({ status: 201, description: 'Sales return created' })
  create(@Body() createSalesReturnDto: CreateSalesReturnDto) {
    return this.salesReturnService.create(createSalesReturnDto);
  }

  @Get()
  @Permissions('sales_returns.read')
  @ApiOperation({ summary: 'List sales returns' })
  findAll() {
    return this.salesReturnService.findAll();
  }

  @Get(':id')
  @Permissions('sales_returns.read')
  @ApiOperation({ summary: 'Get sales return by id' })
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.salesReturnService.findOne(id);
  }
}
