import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { RequestUser } from '../common/interfaces/request-user.interface';
import { TransactionRunnerService } from '../common/services/transaction-runner.service';
import { Expense } from '../database/entities/expense.entity';
import { WalletTransaction } from '../database/entities/wallet-transaction.entity';
import { Wallet } from '../database/entities/wallet.entity';
import { PurchaseService } from '../purchase/purchase.service';
import { SalesService } from '../sales/sales.service';
import { CreateIncomingPaymentDto } from './dto/create-incoming-payment.dto';
import { CreateOutgoingPaymentDto } from './dto/create-outgoing-payment.dto';
import { PayExpenseDto } from './dto/pay-expense.dto';

@Injectable()
export class CashflowService {
  constructor(
    private readonly salesService: SalesService,
    private readonly purchaseService: PurchaseService,
    @InjectRepository(Expense)
    private readonly expensesRepository: Repository<Expense>,
    private readonly transactionRunner: TransactionRunnerService,
  ) {}

  async recordIncomingSalePayment(
    saleId: string,
    dto: CreateIncomingPaymentDto,
    user: RequestUser,
  ) {
    const sale = await this.salesService.addPayment(saleId, dto, user);

    const walletTransaction = dto.walletId
      ? await this.applyWalletDelta(
          dto.walletId,
          dto.amount,
          'in',
          'sale_payment',
          saleId,
          dto.reference,
          user.userId,
        )
      : null;

    return {
      sale,
      walletTransaction,
    };
  }

  async recordOutgoingPurchasePayment(
    purchaseId: string,
    dto: CreateOutgoingPaymentDto,
    user: RequestUser,
  ) {
    const purchase = await this.purchaseService.addPayment(purchaseId, dto, user);

    const walletTransaction = dto.walletId
      ? await this.applyWalletDelta(
          dto.walletId,
          dto.amount,
          'out',
          'purchase_payment',
          purchaseId,
          dto.reference,
          user.userId,
        )
      : null;

    return {
      purchase,
      walletTransaction,
    };
  }

  async payExpense(expenseId: number, dto: PayExpenseDto, user: RequestUser) {
    const expense = await this.expensesRepository.findOne({ where: { id: expenseId } });
    if (!expense) {
      throw new NotFoundException(`Expense #${expenseId} not found.`);
    }

    const walletTransaction = dto.walletId
      ? await this.applyWalletDelta(
          dto.walletId,
          dto.amount,
          'out',
          'expense_payment',
          String(expenseId),
          dto.note,
          user.userId,
        )
      : null;

    if (dto.note !== undefined) {
      const noteSuffix = dto.note.trim();
      expense.note = noteSuffix
        ? `${expense.note ? `${expense.note} | ` : ''}${noteSuffix}`
        : expense.note;
      await this.expensesRepository.save(expense);
    }

    return {
      expense,
      walletTransaction,
    };
  }

  private async applyWalletDelta(
    walletId: string,
    amountInput: number,
    direction: 'in' | 'out',
    referenceType: string,
    referenceId: string,
    description: string | undefined,
    actorId: string,
  ): Promise<WalletTransaction> {
    const amount = Number(amountInput.toFixed(2));
    if (amount <= 0) {
      throw new BadRequestException('Amount must be greater than zero.');
    }

    return this.transactionRunner.runInTransaction(async (manager) => {
      const wallet = await manager.findOne(Wallet, {
        where: { id: walletId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!wallet) {
        throw new NotFoundException(`Wallet "${walletId}" not found.`);
      }

      const nextBalance =
        direction === 'in'
          ? Number((wallet.currentBalance + amount).toFixed(2))
          : Number((wallet.currentBalance - amount).toFixed(2));

      if (nextBalance < 0) {
        throw new BadRequestException(`Wallet ${wallet.code} cannot go negative.`);
      }

      wallet.currentBalance = nextBalance;
      await manager.save(Wallet, wallet);

      const transaction = manager.create(WalletTransaction, {
        walletId: wallet.id,
        txnDate: new Date(),
        direction,
        amount,
        referenceType,
        referenceId,
        description: description?.trim() || `auto:${referenceType}:${actorId}`,
      });

      return manager.save(WalletTransaction, transaction);
    });
  }
}
