import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Permissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { OutboxService } from '../common/services/outbox.service';
import { AccountingOutboxProcessorService } from './services/accounting-outbox-processor.service';

@ApiTags('Accounting Outbox')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/outbox')
export class OutboxController {
  constructor(
    private readonly outboxService: OutboxService,
    private readonly accountingOutboxProcessorService: AccountingOutboxProcessorService,
  ) {}

  @Get('failed')
  @Permissions('outbox.read')
  @ApiOperation({ summary: 'List failed outbox events for admin recovery' })
  listFailed(@Query('limit', new ParseIntPipe({ optional: true })) limit?: number) {
    return this.outboxService.listFailed(limit ?? 100);
  }

  @Post(':id/retry')
  @Permissions('outbox.retry')
  @ApiOperation({ summary: 'Retry a failed outbox event' })
  async retryOne(@Param('id') id: string) {
    const row = await this.outboxService.retryFailedEvent(id);
    await this.accountingOutboxProcessorService.triggerNow();
    return row;
  }

  @Post('retry-failed')
  @Permissions('outbox.retry')
  @ApiOperation({ summary: 'Retry all failed outbox events' })
  async retryAll() {
    const affected = await this.outboxService.retryAllFailedEvents();
    await this.accountingOutboxProcessorService.triggerNow();
    return { affected };
  }
}
