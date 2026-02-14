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

import { Permissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateTaxDto } from './dto/create-tax.dto';
import { UpdateTaxDto } from './dto/update-tax.dto';
import { TaxesService } from './taxes.service';

@Controller('taxes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TaxesController {
  constructor(private readonly taxesService: TaxesService) {}

  @Get()
  @Permissions('taxes.read')
  findAll() {
    return this.taxesService.findAll();
  }

  @Post()
  @Permissions('taxes.create')
  create(@Body() dto: CreateTaxDto) {
    return this.taxesService.create(dto);
  }

  @Get(':id')
  @Permissions('taxes.read')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.taxesService.findOne(id);
  }

  @Put(':id')
  @Permissions('taxes.update')
  update(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UpdateTaxDto) {
    return this.taxesService.update(id, dto);
  }

  @Delete(':id')
  @Permissions('taxes.delete')
  async remove(@Param('id', new ParseUUIDPipe()) id: string) {
    await this.taxesService.remove(id);
    return { message: 'Tax deleted successfully.' };
  }
}
