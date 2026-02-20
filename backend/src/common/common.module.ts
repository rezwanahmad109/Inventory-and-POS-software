import { Global, Module } from '@nestjs/common';

import { AccountingEventBusService } from './services/accounting-event-bus.service';
import { AppLoggerService } from './services/logger.service';
import { PartyBalanceService } from './services/party-balance.service';
import { TransactionRunnerService } from './services/transaction-runner.service';

@Global()
@Module({
  providers: [
    TransactionRunnerService,
    PartyBalanceService,
    AccountingEventBusService,
    AppLoggerService,
  ],
  exports: [
    TransactionRunnerService,
    PartyBalanceService,
    AccountingEventBusService,
    AppLoggerService,
  ],
})
export class CommonModule {}
