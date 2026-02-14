import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { Permissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateFinanceAccountDto } from './dto/create-finance-account.dto';
import { UpdateFinanceAccountDto } from './dto/update-finance-account.dto';
import { ChartOfAccountsService } from './services/chart-of-accounts.service';

@ApiTags('Chart of Accounts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/accounts')
export class ChartOfAccountsController {
  constructor(private readonly chartOfAccountsService: ChartOfAccountsService) {}

  @Post('seed-default')
  @Permissions('finance_accounts.seed')
  @ApiOperation({ summary: 'Seed baseline IFRS/GAAP-oriented chart of accounts' })
  seedDefault() {
    return this.chartOfAccountsService.seedDefault();
  }

  @Get()
  @Permissions('finance_accounts.read')
  @ApiOperation({ summary: 'List finance accounts' })
  findAll() {
    return this.chartOfAccountsService.findAll();
  }

  @Post()
  @Permissions('finance_accounts.seed')
  @ApiOperation({ summary: 'Create chart of account record' })
  create(@Body() dto: CreateFinanceAccountDto) {
    return this.chartOfAccountsService.create(dto);
  }

  @Patch(':id')
  @Permissions('finance_accounts.seed')
  @ApiOperation({ summary: 'Update chart of account record' })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateFinanceAccountDto,
  ) {
    return this.chartOfAccountsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Permissions('finance_accounts.seed')
  @ApiOperation({ summary: 'Deactivate chart of account record' })
  async remove(@Param('id', new ParseUUIDPipe()) id: string) {
    await this.chartOfAccountsService.remove(id);
    return { message: 'Finance account deactivated successfully.' };
  }
}
