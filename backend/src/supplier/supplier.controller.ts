import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
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
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { SupplierService } from './supplier.service';

@ApiTags('Suppliers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('suppliers')
export class SupplierController {
  constructor(private readonly supplierService: SupplierService) {}

  @Get()
  @Permissions('suppliers.read')
  @ApiOperation({ summary: 'Get all suppliers' })
  findAll() {
    return this.supplierService.findAll();
  }

  @Post()
  @Permissions('suppliers.create')
  @ApiOperation({ summary: 'Create supplier' })
  @ApiResponse({ status: 201, description: 'Supplier created' })
  create(@Body() createSupplierDto: CreateSupplierDto) {
    return this.supplierService.create(createSupplierDto);
  }

  @Put(':id')
  @Permissions('suppliers.update')
  @ApiOperation({ summary: 'Update supplier' })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() updateSupplierDto: UpdateSupplierDto,
  ) {
    return this.supplierService.update(id, updateSupplierDto);
  }

  @Delete(':id')
  @Permissions('suppliers.delete')
  @ApiOperation({ summary: 'Delete supplier' })
  async remove(@Param('id', new ParseUUIDPipe()) id: string) {
    await this.supplierService.remove(id);
    return { message: 'Supplier deleted successfully.' };
  }
}
