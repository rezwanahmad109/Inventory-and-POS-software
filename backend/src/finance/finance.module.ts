import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditLog } from '../database/entities/audit-log.entity';
import { BankStatement } from '../database/entities/bank-statement.entity';
import { BankStatementLine } from '../database/entities/bank-statement-line.entity';
import { FinanceAccount } from '../database/entities/finance-account.entity';
import { FinanceInvoice } from '../database/entities/finance-invoice.entity';
import { FinanceParty } from '../database/entities/finance-party.entity';
import { FinancePayment } from '../database/entities/finance-payment.entity';
import { JournalEntry, JournalLine } from '../database/entities/journal-entry.entity';
import { PaymentAllocation } from '../database/entities/payment-allocation.entity';
import { ReconciliationMatch } from '../database/entities/reconciliation-match.entity';
import { WalletTransaction } from '../database/entities/wallet-transaction.entity';
import { Wallet } from '../database/entities/wallet.entity';
import { ChartOfAccountsController } from './chart-of-accounts.controller';
import { FinanceInvoicesController } from './finance-invoices.controller';
import { FinancePaymentsController } from './finance-payments.controller';
import { FinanceReportsController } from './finance-reports.controller';
import { ReconcileController } from './reconcile.controller';
import { WalletsController } from './wallets.controller';
import { ChartOfAccountsService } from './services/chart-of-accounts.service';
import { FinanceInvoicesService } from './services/finance-invoices.service';
import { FinancePaymentsService } from './services/finance-payments.service';
import { FinanceReportsService } from './services/finance-reports.service';
import { JournalPostingService } from './services/journal-posting.service';
import { OperationalLedgerListener } from './services/operational-ledger.listener';
import { ReconcileService } from './services/reconcile.service';
import { WalletsService } from './services/wallets.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AuditLog,
      FinanceAccount,
      FinanceParty,
      FinanceInvoice,
      JournalEntry,
      JournalLine,
      Wallet,
      WalletTransaction,
      BankStatement,
      BankStatementLine,
      ReconciliationMatch,
      FinancePayment,
      PaymentAllocation,
    ]),
  ],
  controllers: [
    ChartOfAccountsController,
    FinanceInvoicesController,
    FinancePaymentsController,
    WalletsController,
    ReconcileController,
    FinanceReportsController,
  ],
  providers: [
    ChartOfAccountsService,
    JournalPostingService,
    FinanceInvoicesService,
    FinancePaymentsService,
    WalletsService,
    ReconcileService,
    FinanceReportsService,
    OperationalLedgerListener,
  ],
})
export class FinanceModule {}
