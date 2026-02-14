import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { Permissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ReportQueryDto } from './dto/report-query.dto';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('sales-summary')
  @Permissions('reports.view')
  async getSalesSummary(@Query() query: ReportQueryDto) {
    return this.reportsService.salesSummary(query);
  }

  @Get('purchase-summary')
  @Permissions('reports.view')
  async getPurchaseSummary(@Query() query: ReportQueryDto) {
    return this.reportsService.purchaseSummary(query);
  }

  @Get('expense-summary')
  @Permissions('reports.view')
  async getExpenseSummary(@Query() query: ReportQueryDto) {
    return this.reportsService.expenseSummary(query);
  }

  @Get('profit-loss')
  @Permissions('reports.view')
  async getProfitLoss(@Query() query: ReportQueryDto) {
    return this.reportsService.profitLoss(query);
  }

  @Get('stock-summary')
  @Permissions('reports.view')
  async getStockSummary(@Query() query: ReportQueryDto) {
    return this.reportsService.stockSummary(query);
  }

  @Get('inventory-summary')
  @Permissions('reports.view')
  async getInventorySummary(@Query() query: ReportQueryDto) {
    return this.reportsService.stockSummary(query);
  }

  @Get('rate-list')
  @Permissions('reports.view')
  async getRateList(@Query() query: ReportQueryDto) {
    return this.reportsService.rateList(query);
  }

  @Get('product-sales-summary')
  @Permissions('reports.view')
  async getProductSalesSummary(@Query() query: ReportQueryDto) {
    return this.reportsService.productSalesSummary(query);
  }

  @Get('users-report')
  @Permissions('reports.view')
  async getUsersReport(@Query() query: ReportQueryDto) {
    return this.reportsService.usersReport(query);
  }
}
