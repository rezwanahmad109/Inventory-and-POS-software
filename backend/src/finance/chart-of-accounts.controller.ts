import {
  Controller,
  Get,
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
}
