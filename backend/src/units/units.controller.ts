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
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { UnitsService } from './units.service';

@ApiTags('Units')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('units')
export class UnitsController {
  constructor(private readonly unitsService: UnitsService) {}

  @Get()
  @Permissions('units.read')
  @ApiOperation({ summary: 'List all units' })
  findAll() {
    return this.unitsService.findAll();
  }

  @Post()
  @Permissions('units.create')
  @ApiOperation({ summary: 'Create unit' })
  @ApiResponse({ status: 201, description: 'Unit created' })
  create(@Body() createUnitDto: CreateUnitDto) {
    return this.unitsService.create(createUnitDto);
  }

  @Put(':id')
  @Permissions('units.update')
  @ApiOperation({ summary: 'Update unit' })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() updateUnitDto: UpdateUnitDto,
  ) {
    return this.unitsService.update(id, updateUnitDto);
  }

  @Delete(':id')
  @Permissions('units.delete')
  @ApiOperation({ summary: 'Delete unit' })
  async remove(@Param('id', new ParseUUIDPipe()) id: string) {
    await this.unitsService.remove(id);
    return { message: 'Unit deleted successfully.' };
  }
}
