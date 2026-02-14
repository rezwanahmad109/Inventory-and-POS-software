import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { CreateBranchDto } from '../branches/dto/create-branch.dto';
import { UpdateBranchDto } from '../branches/dto/update-branch.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { WarehousesService } from './warehouses.service';

@Controller('warehouses')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WarehousesController {
  constructor(private readonly warehousesService: WarehousesService) {}

  @Get()
  @Permissions('warehouses.read')
  findAll() {
    return this.warehousesService.findAll();
  }

  @Post()
  @Permissions('warehouses.create')
  create(@Body() dto: CreateBranchDto) {
    return this.warehousesService.create(dto);
  }

  @Put(':id')
  @Permissions('warehouses.update')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateBranchDto,
  ) {
    return this.warehousesService.update(id, dto);
  }

  @Delete(':id')
  @Permissions('warehouses.delete')
  async remove(@Param('id', new ParseUUIDPipe()) id: string) {
    const result = await this.warehousesService.remove(id);
    return {
      mode: result.mode,
    };
  }

  @Get('stock-levels')
  @Permissions('warehouses.read')
  getStockLevels(@Query('warehouseId') warehouseId?: string) {
    return this.warehousesService.getStockLevels(warehouseId);
  }

  @Get('low-stock')
  @Permissions('warehouses.read')
  getLowStock() {
    return this.warehousesService.getLowStock();
  }
}
