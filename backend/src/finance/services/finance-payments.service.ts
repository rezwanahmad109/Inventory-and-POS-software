import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { AuditLog } from '../../database/entities/audit-log.entity';
import { FinanceAccount } from '../../database/entities/finance-account.entity';
import { FinanceInvoice } from '../../database/entities/finance-invoice.entity';
import { FinancePayment } from '../../database/entities/finance-payment.entity';
import { PaymentAllocation } from '../../database/entities/payment-allocation.entity';
import { WalletTransaction } from '../../database/entities/wallet-transaction.entity';
import { Wallet } from '../../database/entities/wallet.entity';
import { CreateFinancePaymentDto } from '../dto/create-finance-payment.dto';
import { FinancePaymentQueryDto } from '../dto/finance-payment-query.dto';
import { FinancePaymentDirection } from '../finance.enums';
import { JournalPostingService } from './journal-posting.service';
import { PaginatedResponse } from '../../common/interfaces/paginated-response.interface';
import { toPaginatedResponse } from '../../common/utils/pagination.util';

@Injectable()
export class FinancePaymentsService {
  constructor(
    @InjectRepository(FinancePayment)
    private readonly financePaymentRepository: Repository<FinancePayment>,
    @InjectRepository(FinanceInvoice)
    private readonly financeInvoiceRepository: Repository<FinanceInvoice>,
    @InjectRepository(PaymentAllocation)
    private readonly paymentAllocationRepository: Repository<PaymentAllocation>,
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
    @InjectRepository(FinanceAccount)
    private readonly financeAccountRepository: Repository<FinanceAccount>,
    private readonly journalPostingService: JournalPostingService,
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateFinancePaymentDto, actorId: string): Promise<FinancePayment> {
    return this.dataSource.transaction(async (manager) => {
      const wallet = await manager.findOne(Wallet, {
        where: { id: dto.walletId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!wallet) {
        throw new NotFoundException(`Wallet "${dto.walletId}" not found.`);
      }

      if (dto.idempotencyKey) {
        const existing = await manager.findOne(FinancePayment, {
          where: { idempotencyKey: dto.idempotencyKey },
        });
        if (existing) {
          return existing;
        }
      }

      const payment = manager.create(FinancePayment, {
        partyId: dto.partyId ?? null,
        walletId: dto.walletId,
        direction: dto.direction,
        amount: Number(dto.amount.toFixed(2)),
        currency: (dto.currency ?? wallet.currency ?? 'USD').toUpperCase(),
        paymentMethod: dto.paymentMethod,
        paymentReference: dto.paymentReference ?? null,
        processorToken: dto.processorToken ?? null,
        status: 'pending',
        idempotencyKey: dto.idempotencyKey ?? null,
      });

      const saved = await manager.save(FinancePayment, payment);

      const allocationTotal = Number(
        (dto.allocations ?? [])
          .reduce((sum, allocation) => sum + allocation.allocatedAmount, 0)
          .toFixed(2),
      );
      if (allocationTotal > saved.amount) {
        throw new BadRequestException('Allocation total cannot exceed payment amount.');
      }

      if (dto.allocations && dto.allocations.length > 0) {
        for (const allocationInput of dto.allocations) {
          const invoice = await manager.findOne(FinanceInvoice, {
            where: { id: allocationInput.invoiceId },
            lock: { mode: 'pessimistic_write' },
          });
          if (!invoice) {
            throw new NotFoundException(`Invoice "${allocationInput.invoiceId}" not found.`);
          }

          if (allocationInput.allocatedAmount > invoice.balanceDue) {
            throw new BadRequestException(
              `Allocation exceeds invoice balance for ${invoice.documentNo}.`,
            );
          }

          invoice.balanceDue = Number(
            (invoice.balanceDue - allocationInput.allocatedAmount).toFixed(2),
          );
          invoice.status = invoice.balanceDue <= 0 ? 'paid' : 'partial';
          await manager.save(FinanceInvoice, invoice);

          const allocation = manager.create(PaymentAllocation, {
            paymentId: saved.id,
            invoiceId: invoice.id,
            allocatedAmount: Number(allocationInput.allocatedAmount.toFixed(2)),
          });
          await manager.save(PaymentAllocation, allocation);
        }
      }

      const postedJournalEntry = await this.postPaymentJournal(saved, actorId);
      saved.postedJournalEntryId = postedJournalEntry.id;
      saved.status = 'posted';
      await manager.save(FinancePayment, saved);

      await this.applyWalletEffect(manager, wallet, saved);

      await manager.save(
        AuditLog,
        manager.create(AuditLog, {
          actorId,
          action: 'finance.payment.create',
          entity: 'finance_payments',
          entityId: saved.id,
          before: null,
          after: {
            id: saved.id,
            amount: saved.amount,
            direction: saved.direction,
            walletId: saved.walletId,
            status: saved.status,
          },
          requestId: null,
          correlationId: saved.idempotencyKey,
        }),
      );

      return saved;
    });
  }

  async findAll(
    query: FinancePaymentQueryDto,
  ): Promise<PaginatedResponse<FinancePayment>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.financePaymentRepository
      .createQueryBuilder('payment')
      .orderBy('payment.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query.partyId) {
      qb.andWhere('payment.party_id = :partyId', { partyId: query.partyId });
    }
    if (query.walletId) {
      qb.andWhere('payment.wallet_id = :walletId', { walletId: query.walletId });
    }
    if (query.direction) {
      qb.andWhere('payment.direction = :direction', { direction: query.direction });
    }
    if (query.from) {
      qb.andWhere('payment.created_at >= :from', { from: query.from });
    }
    if (query.to) {
      qb.andWhere('payment.created_at <= :to', { to: query.to });
    }

    const [payments, total] = await qb.getManyAndCount();
    return toPaginatedResponse(payments, total, page, limit);
  }

  private async postPaymentJournal(
    payment: FinancePayment,
    actorId: string,
  ) {
    const cashAccount = await this.getAccountByCodeOrFail('1000-CASH');
    const arAccount = await this.getAccountByCodeOrFail('1100-AR');
    const apAccount = await this.getAccountByCodeOrFail('2100-AP');

    if (payment.direction === FinancePaymentDirection.RECEIPT) {
      return this.journalPostingService.post({
        entryDate: new Date(),
        sourceType: 'finance_payment',
        sourceId: payment.id,
        description: `Payment receipt ${payment.id}`,
        idempotencyKey: payment.idempotencyKey ? `payment:${payment.idempotencyKey}` : null,
        postedBy: actorId,
        lines: [
          { accountId: cashAccount.id, debit: payment.amount, credit: 0 },
          {
            accountId: arAccount.id,
            partyId: payment.partyId,
            debit: 0,
            credit: payment.amount,
          },
        ],
      });
    }

    return this.journalPostingService.post({
      entryDate: new Date(),
      sourceType: 'finance_payment',
      sourceId: payment.id,
      description: `Payment disbursement ${payment.id}`,
      idempotencyKey: payment.idempotencyKey ? `payment:${payment.idempotencyKey}` : null,
      postedBy: actorId,
      lines: [
        {
          accountId: apAccount.id,
          partyId: payment.partyId,
          debit: payment.amount,
          credit: 0,
        },
        { accountId: cashAccount.id, debit: 0, credit: payment.amount },
      ],
    });
  }

  private async applyWalletEffect(
    manager: DataSource['manager'],
    wallet: Wallet,
    payment: FinancePayment,
  ): Promise<void> {
    const delta =
      payment.direction === FinancePaymentDirection.RECEIPT ? payment.amount : -payment.amount;

    const nextBalance = Number((wallet.currentBalance + delta).toFixed(2));
    if (nextBalance < 0) {
      throw new BadRequestException(`Wallet ${wallet.code} cannot go negative.`);
    }

    wallet.currentBalance = nextBalance;
    await manager.save(Wallet, wallet);

    await manager.save(
      WalletTransaction,
      manager.create(WalletTransaction, {
        walletId: wallet.id,
        txnDate: new Date(),
        direction: delta >= 0 ? 'in' : 'out',
        amount: Number(Math.abs(delta).toFixed(2)),
        referenceType: 'finance_payment',
        referenceId: payment.id,
        description: `Auto-posted from payment ${payment.id}`,
        idempotencyKey: payment.idempotencyKey
          ? `wallet:${payment.idempotencyKey}`
          : `wallet:${payment.id}`,
      }),
    );
  }

  private async getAccountByCodeOrFail(code: string): Promise<FinanceAccount> {
    const account = await this.financeAccountRepository.findOne({ where: { code } });
    if (!account) {
      throw new NotFoundException(
        `Required finance account "${code}" is missing. Seed chart of accounts first.`,
      );
    }
    return account;
  }
}
