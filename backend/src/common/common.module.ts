import { Global, Module } from '@nestjs/common';

import { AccountingEventBusService } from './services/accounting-event-bus.service';
import { PartyBalanceService } from './services/party-balance.service';
import { TransactionRunnerService } from './services/transaction-runner.service';

@Global()
@Module({
  providers: [
    TransactionRunnerService,
    PartyBalanceService,
    AccountingEventBusService,
  ],
  exports: [
    TransactionRunnerService,
    PartyBalanceService,
    AccountingEventBusService,
  ],
})
export class CommonModule {}
