import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Expense } from '../database/entities/expense.entity';
import { WalletTransaction } from '../database/entities/wallet-transaction.entity';
import { Wallet } from '../database/entities/wallet.entity';
import { PurchaseModule } from '../purchase/purchase.module';
import { SalesModule } from '../sales/sales.module';
import { CashflowController } from './cashflow.controller';
import { CashflowService } from './cashflow.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Expense, Wallet, WalletTransaction]),
    SalesModule,
    PurchaseModule,
  ],
  controllers: [CashflowController],
  providers: [CashflowService],
})
export class CashflowModule {}
