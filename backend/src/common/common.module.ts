import { Global, Module } from '@nestjs/common';

import { AccountingEventBusService } from './services/accounting-event-bus.service';
import { InventoryCostingService } from './services/inventory-costing.service';
import { AppLoggerService } from './services/logger.service';
import { OutboxService } from './services/outbox.service';
import { PartyBalanceService } from './services/party-balance.service';
import { TransactionRunnerService } from './services/transaction-runner.service';

@Global()
@Module({
  providers: [
    TransactionRunnerService,
    PartyBalanceService,
    AccountingEventBusService,
    InventoryCostingService,
    OutboxService,
    AppLoggerService,
  ],
  exports: [
    TransactionRunnerService,
    PartyBalanceService,
    AccountingEventBusService,
    InventoryCostingService,
    OutboxService,
    AppLoggerService,
  ],
})
export class CommonModule {}
