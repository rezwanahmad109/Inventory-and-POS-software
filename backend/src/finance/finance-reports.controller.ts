import {
  Controller,
  Get,
  Query,
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
import { AgingReportQueryDto } from './dto/aging-report-query.dto';
import { FinanceReportsService } from './services/finance-reports.service';

@ApiTags('Finance Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/reports')
export class FinanceReportsController {
  constructor(private readonly financeReportsService: FinanceReportsService) {}

  @Get('ar-aging')
  @Permissions('finance_reports.read')
  @ApiOperation({ summary: 'Accounts receivable aging report' })
  getArAging(@Query() query: AgingReportQueryDto) {
    return this.financeReportsService.getArAging(query.bucketSizeDays);
  }
}
