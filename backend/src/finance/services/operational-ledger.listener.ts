import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  AccountingEventBusService,
  PurchaseBilledEvent,
  PurchasePaymentSentEvent,
  PurchaseReturnEvent,
  SaleInvoicedEvent,
  SalePaymentReceivedEvent,
  SalesReturnEvent,
} from '../../common/services/accounting-event-bus.service';
import { FinanceAccount } from '../../database/entities/finance-account.entity';
import { JournalPostingService } from './journal-posting.service';

@Injectable()
export class OperationalLedgerListener implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OperationalLedgerListener.name);
  private readonly unsubscribeCallbacks: Array<() => void> = [];

  constructor(
    private readonly eventBus: AccountingEventBusService,
    private readonly journalPostingService: JournalPostingService,
    @InjectRepository(FinanceAccount)
    private readonly financeAccountRepository: Repository<FinanceAccount>,
  ) {}

  onModuleInit(): void {
    this.unsubscribeCallbacks.push(
      this.eventBus.subscribe('sale.invoiced', (payload) => {
        void this.handleSaleInvoiced(payload);
      }),
    );
    this.unsubscribeCallbacks.push(
      this.eventBus.subscribe('sale.payment_received', (payload) => {
        void this.handleSalePaymentReceived(payload);
      }),
    );
    this.unsubscribeCallbacks.push(
      this.eventBus.subscribe('purchase.billed', (payload) => {
        void this.handlePurchaseBilled(payload);
      }),
    );
    this.unsubscribeCallbacks.push(
      this.eventBus.subscribe('purchase.payment_sent', (payload) => {
        void this.handlePurchasePaymentSent(payload);
      }),
    );
    this.unsubscribeCallbacks.push(
      this.eventBus.subscribe('sales_return.created', (payload) => {
        void this.handleSalesReturn(payload);
      }),
    );
    this.unsubscribeCallbacks.push(
      this.eventBus.subscribe('purchase_return.created', (payload) => {
        void this.handlePurchaseReturn(payload);
      }),
    );
  }

  onModuleDestroy(): void {
    this.unsubscribeCallbacks.forEach((unsubscribe) => unsubscribe());
    this.unsubscribeCallbacks.length = 0;
  }

  private async handleSaleInvoiced(payload: SaleInvoicedEvent): Promise<void> {
    try {
      const accounts = await this.getAccountCodes();
      await this.journalPostingService.post({
        entryDate: payload.occurredAt,
        sourceType: 'sale',
        sourceId: payload.saleId,
        idempotencyKey: `sale:invoice:${payload.saleId}`,
        description: `Sale invoice ${payload.invoiceNumber}`,
        lines: [
          {
            accountId: accounts.ar.id,
            debit: payload.grandTotal,
            credit: 0,
            branchId: payload.branchId,
          },
          {
            accountId: accounts.sales.id,
            debit: 0,
            credit: payload.subtotal,
            branchId: payload.branchId,
          },
          ...(payload.taxTotal > 0
            ? [
                {
                  accountId: accounts.outputTax.id,
                  debit: 0,
                  credit: payload.taxTotal,
                  branchId: payload.branchId,
                },
              ]
            : []),
        ],
      });
    } catch (error) {
      this.logger.warn(
        `Failed to post sale invoice ledger for ${payload.saleId}: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }

  private async handleSalePaymentReceived(
    payload: SalePaymentReceivedEvent,
  ): Promise<void> {
    try {
      const accounts = await this.getAccountCodes();
      await this.journalPostingService.post({
        entryDate: payload.occurredAt,
        sourceType: 'sale_payment',
        sourceId: payload.saleId,
        idempotencyKey: `sale:payment:${payload.saleId}:${payload.occurredAt.toISOString()}`,
        description: `Sale payment ${payload.saleId}`,
        lines: [
          {
            accountId: accounts.cash.id,
            debit: payload.amount,
            credit: 0,
            branchId: payload.branchId,
          },
          {
            accountId: accounts.ar.id,
            debit: 0,
            credit: payload.amount,
            branchId: payload.branchId,
          },
        ],
      });
    } catch (error) {
      this.logger.warn(
        `Failed to post sale payment ledger for ${payload.saleId}: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }

  private async handlePurchaseBilled(
    payload: PurchaseBilledEvent,
  ): Promise<void> {
    try {
      const accounts = await this.getAccountCodes();
      await this.journalPostingService.post({
        entryDate: payload.occurredAt,
        sourceType: 'purchase',
        sourceId: payload.purchaseId,
        idempotencyKey: `purchase:bill:${payload.purchaseId}`,
        description: `Purchase bill ${payload.invoiceNumber}`,
        lines: [
          {
            accountId: accounts.cogs.id,
            debit: payload.subtotal,
            credit: 0,
            branchId: payload.branchId,
          },
          ...(payload.taxTotal > 0
            ? [
                {
                  accountId: accounts.inputTax.id,
                  debit: payload.taxTotal,
                  credit: 0,
                  branchId: payload.branchId,
                },
              ]
            : []),
          {
            accountId: accounts.ap.id,
            debit: 0,
            credit: payload.grandTotal,
            branchId: payload.branchId,
          },
        ],
      });
    } catch (error) {
      this.logger.warn(
        `Failed to post purchase bill ledger for ${payload.purchaseId}: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }

  private async handlePurchasePaymentSent(
    payload: PurchasePaymentSentEvent,
  ): Promise<void> {
    try {
      const accounts = await this.getAccountCodes();
      await this.journalPostingService.post({
        entryDate: payload.occurredAt,
        sourceType: 'purchase_payment',
        sourceId: payload.purchaseId,
        idempotencyKey: `purchase:payment:${payload.purchaseId}:${payload.occurredAt.toISOString()}`,
        description: `Purchase payment ${payload.purchaseId}`,
        lines: [
          {
            accountId: accounts.ap.id,
            debit: payload.amount,
            credit: 0,
            branchId: payload.branchId,
          },
          {
            accountId: accounts.cash.id,
            debit: 0,
            credit: payload.amount,
            branchId: payload.branchId,
          },
        ],
      });
    } catch (error) {
      this.logger.warn(
        `Failed to post purchase payment ledger for ${payload.purchaseId}: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }

  private async handleSalesReturn(payload: SalesReturnEvent): Promise<void> {
    try {
      const accounts = await this.getAccountCodes();
      await this.journalPostingService.post({
        entryDate: payload.occurredAt,
        sourceType: 'sales_return',
        sourceId: payload.salesReturnId,
        idempotencyKey: `sales:return:${payload.salesReturnId}`,
        description: `Sales return ${payload.salesReturnId}`,
        lines: [
          {
            accountId: accounts.sales.id,
            debit: payload.totalRefund,
            credit: 0,
            branchId: payload.branchId,
          },
          {
            accountId: accounts.ar.id,
            debit: 0,
            credit: payload.totalRefund,
            branchId: payload.branchId,
          },
        ],
      });
    } catch (error) {
      this.logger.warn(
        `Failed to post sales return ledger for ${payload.salesReturnId}: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }

  private async handlePurchaseReturn(payload: PurchaseReturnEvent): Promise<void> {
    try {
      const accounts = await this.getAccountCodes();
      await this.journalPostingService.post({
        entryDate: payload.occurredAt,
        sourceType: 'purchase_return',
        sourceId: payload.purchaseReturnId,
        idempotencyKey: `purchase:return:${payload.purchaseReturnId}`,
        description: `Purchase return ${payload.purchaseReturnId}`,
        lines: [
          {
            accountId: accounts.ap.id,
            debit: payload.totalRefund,
            credit: 0,
            branchId: payload.branchId,
          },
          {
            accountId: accounts.cogs.id,
            debit: 0,
            credit: payload.totalRefund,
            branchId: payload.branchId,
          },
        ],
      });
    } catch (error) {
      this.logger.warn(
        `Failed to post purchase return ledger for ${payload.purchaseReturnId}: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }

  private async getAccountCodes(): Promise<{
    cash: FinanceAccount;
    ar: FinanceAccount;
    ap: FinanceAccount;
    sales: FinanceAccount;
    cogs: FinanceAccount;
    outputTax: FinanceAccount;
    inputTax: FinanceAccount;
  }> {
    const codes = [
      '1000-CASH',
      '1100-AR',
      '2100-AP',
      '4000-SALES',
      '5000-COGS',
      '2200-OUTPUT-TAX',
      '1300-INPUT-TAX',
    ];
    const rows = await this.financeAccountRepository.find({
      where: codes.map((code) => ({ code })),
    });
    const map = new Map(rows.map((row) => [row.code, row]));

    for (const code of codes) {
      if (!map.has(code)) {
        throw new NotFoundException(
          `Operational ledger account "${code}" is missing.`,
        );
      }
    }

    return {
      cash: map.get('1000-CASH')!,
      ar: map.get('1100-AR')!,
      ap: map.get('2100-AP')!,
      sales: map.get('4000-SALES')!,
      cogs: map.get('5000-COGS')!,
      outputTax: map.get('2200-OUTPUT-TAX')!,
      inputTax: map.get('1300-INPUT-TAX')!,
    };
  }
}
