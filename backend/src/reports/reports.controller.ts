import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { Permissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { DateRangeDto } from './dto/date-range.dto';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('sales-summary')
  @Permissions('reports.view')
  async getSalesSummary(@Query() query: DateRangeDto) {
    const { from, to } = query;
    return this.reportsService.salesSummary(from, to);
  }

  @Get('purchase-summary')
  @Permissions('reports.view')
  async getPurchaseSummary(@Query() query: DateRangeDto) {
    const { from, to } = query;
    return this.reportsService.purchaseSummary(from, to);
  }

  @Get('expense-summary')
  @Permissions('reports.view')
  async getExpenseSummary(@Query() query: DateRangeDto) {
    const { from, to } = query;
    return this.reportsService.expenseSummary(from, to);
  }

  @Get('profit-loss')
  @Permissions('reports.view')
  async getProfitLoss(@Query() query: DateRangeDto) {
    const { from, to } = query;
    return this.reportsService.profitLoss(from, to);
  }

  @Get('inventory-summary')
  @Permissions('reports.view')
  async getInventorySummary() {
    return this.reportsService.inventorySummary();
  }
}
