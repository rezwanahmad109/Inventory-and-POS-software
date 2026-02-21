import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';

import {
  OutboxEvent,
  OutboxEventStatus,
} from '../../database/entities/outbox-event.entity';
import { FinanceAccount } from '../../database/entities/finance-account.entity';
import { getBooleanConfig } from '../../common/utils/config.util';
import { JournalPostingService } from './journal-posting.service';

interface SalesInvoiceIssuedPayload {
  saleId: string;
  invoiceNumber: string;
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  branchId: string | null;
  occurredAt: string;
}

interface SalesDeliveryPostedPayload {
  saleId: string;
  deliveryId?: string;
  deliveryNumber?: string;
  invoiceNumber?: string;
  cogsTotal: number;
  branchId: string | null;
  occurredAt: string;
}

interface SalesPaymentReceivedPayload {
  saleId: string;
  paymentId: string;
  amount: number;
  branchId: string | null;
  occurredAt: string;
}

@Injectable()
export class AccountingOutboxProcessorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AccountingOutboxProcessorService.name);
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly journalPostingService: JournalPostingService,
    @InjectRepository(FinanceAccount)
    private readonly financeAccountRepository: Repository<FinanceAccount>,
  ) {}

  onModuleInit(): void {
    const enabled = getBooleanConfig(
      this.configService.get('OUTBOX_WORKER_ENABLED'),
      true,
    );
    if (!enabled) {
      this.logger.log('Outbox worker disabled by OUTBOX_WORKER_ENABLED=false.');
      return;
    }

    this.timer = setInterval(() => {
      void this.runSafely();
    }, 1000);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async triggerNow(): Promise<void> {
    await this.runSafely();
  }

  private async runSafely(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    try {
      const eventIds = await this.reserveBatch();
      for (const eventId of eventIds) {
        await this.processReservedEvent(eventId);
      }
    } catch (error) {
      this.logger.error(
        `Outbox processing batch failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    } finally {
      this.isRunning = false;
    }
  }

  private async reserveBatch(): Promise<string[]> {
    const batchSize = Number(this.configService.get<string>('OUTBOX_BATCH_SIZE', '50'));

    return this.dataSource.transaction(async (manager) => {
      const rows = await manager
        .createQueryBuilder(OutboxEvent, 'event')
        .setLock('pessimistic_write')
        .setOnLocked('skip_locked')
        .where('event.status IN (:...statuses)', {
          statuses: [OutboxEventStatus.PENDING, OutboxEventStatus.FAILED],
        })
        .andWhere('(event.next_attempt_at IS NULL OR event.next_attempt_at <= NOW())')
        .orderBy('event.created_at', 'ASC')
        .take(Math.max(1, Math.min(batchSize, 500)))
        .getMany();

      for (const row of rows) {
        row.status = OutboxEventStatus.PROCESSING;
        row.attempts += 1;
      }

      if (rows.length > 0) {
        await manager.save(OutboxEvent, rows);
      }

      return rows.map((row) => row.id);
    });
  }

  private async processReservedEvent(eventId: string): Promise<void> {
    try {
      await this.dataSource.transaction(async (manager) => {
        const event = await manager.findOne(OutboxEvent, {
          where: { id: eventId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!event || event.status !== OutboxEventStatus.PROCESSING) {
          return;
        }

        await this.dispatchEvent(event, manager);

        event.status = OutboxEventStatus.PROCESSED;
        event.processedAt = new Date();
        event.nextAttemptAt = null;
        event.lastError = null;
        await manager.save(OutboxEvent, event);
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Outbox event processing failed.';
      await this.markFailed(eventId, message);
    }
  }

  private async markFailed(eventId: string, errorMessage: string): Promise<void> {
    const baseMs = Number(
      this.configService.get<string>('OUTBOX_RETRY_BASE_MS', '5000'),
    );

    await this.dataSource.transaction(async (manager) => {
      const event = await manager.findOne(OutboxEvent, {
        where: { id: eventId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!event) {
        return;
      }

      const exponent = Math.max(event.attempts - 1, 0);
      const delayMs = Math.min(baseMs * 2 ** exponent, 5 * 60 * 1000);
      event.status = OutboxEventStatus.FAILED;
      event.lastError = errorMessage;
      event.nextAttemptAt = new Date(Date.now() + delayMs);
      await manager.save(OutboxEvent, event);
    });

    this.logger.warn(`Outbox event ${eventId} failed: ${errorMessage}`);
  }

  private async dispatchEvent(
    event: OutboxEvent,
    manager: DataSource['manager'],
  ): Promise<void> {
    switch (event.eventType) {
      case 'sales.invoice_issued':
        await this.handleSalesInvoiceIssued(
          event,
          event.payload as unknown as SalesInvoiceIssuedPayload,
          manager,
        );
        return;
      case 'sales.delivery_posted':
        await this.handleSalesDeliveryPosted(
          event,
          event.payload as unknown as SalesDeliveryPostedPayload,
          manager,
        );
        return;
      case 'sales.payment_received':
        await this.handleSalesPaymentReceived(
          event,
          event.payload as unknown as SalesPaymentReceivedPayload,
          manager,
        );
        return;
      default:
        throw new Error(`Unsupported outbox event type: ${event.eventType}`);
    }
  }

  private async handleSalesInvoiceIssued(
    event: OutboxEvent,
    payload: SalesInvoiceIssuedPayload,
    manager: DataSource['manager'],
  ): Promise<void> {
    const accounts = await this.getAccounts();
    const entryDate = new Date(payload.occurredAt);

    await this.journalPostingService.post(
      {
        entryDate,
        sourceType: 'sales_invoice',
        sourceId: event.sourceId ?? payload.saleId,
        idempotencyKey: `sales:invoice:${event.sourceId ?? payload.saleId}`,
        description: `Sales invoice ${payload.invoiceNumber}`,
        lines: [
          {
            accountId: accounts.ar.id,
            debit: Number(payload.grandTotal.toFixed(2)),
            credit: 0,
            branchId: payload.branchId,
          },
          {
            accountId: accounts.sales.id,
            debit: 0,
            credit: Number(payload.subtotal.toFixed(2)),
            branchId: payload.branchId,
          },
          ...(payload.taxTotal > 0
            ? [
                {
                  accountId: accounts.outputTax.id,
                  debit: 0,
                  credit: Number(payload.taxTotal.toFixed(2)),
                  branchId: payload.branchId,
                },
              ]
            : []),
        ],
      },
      manager,
    );
  }

  private async handleSalesDeliveryPosted(
    event: OutboxEvent,
    payload: SalesDeliveryPostedPayload,
    manager: DataSource['manager'],
  ): Promise<void> {
    if (payload.cogsTotal <= 0) {
      return;
    }

    const accounts = await this.getAccounts();
    const entryDate = new Date(payload.occurredAt);
    const deliverySourceId =
      event.sourceId ?? payload.deliveryId ?? payload.saleId;
    const documentNo =
      payload.deliveryNumber ??
      payload.invoiceNumber ??
      deliverySourceId;

    await this.journalPostingService.post(
      {
        entryDate,
        sourceType: 'sales_delivery',
        sourceId: deliverySourceId,
        idempotencyKey: `sales:delivery:${deliverySourceId}`,
        description: `Sales delivery ${documentNo}`,
        lines: [
          {
            accountId: accounts.cogs.id,
            debit: Number(payload.cogsTotal.toFixed(2)),
            credit: 0,
            branchId: payload.branchId,
          },
          {
            accountId: accounts.inventory.id,
            debit: 0,
            credit: Number(payload.cogsTotal.toFixed(2)),
            branchId: payload.branchId,
          },
        ],
      },
      manager,
    );
  }

  private async handleSalesPaymentReceived(
    event: OutboxEvent,
    payload: SalesPaymentReceivedPayload,
    manager: DataSource['manager'],
  ): Promise<void> {
    const accounts = await this.getAccounts();
    const entryDate = new Date(payload.occurredAt);

    await this.journalPostingService.post(
      {
        entryDate,
        sourceType: 'sales_payment',
        sourceId: event.sourceId ?? payload.paymentId,
        idempotencyKey: `sales:payment:${event.sourceId ?? payload.paymentId}`,
        description: `Sales payment ${payload.paymentId}`,
        lines: [
          {
            accountId: accounts.cash.id,
            debit: Number(payload.amount.toFixed(2)),
            credit: 0,
            branchId: payload.branchId,
          },
          {
            accountId: accounts.ar.id,
            debit: 0,
            credit: Number(payload.amount.toFixed(2)),
            branchId: payload.branchId,
          },
        ],
      },
      manager,
    );
  }

  private async getAccounts(): Promise<{
    cash: FinanceAccount;
    ar: FinanceAccount;
    sales: FinanceAccount;
    cogs: FinanceAccount;
    inventory: FinanceAccount;
    outputTax: FinanceAccount;
  }> {
    const codes = [
      '1000-CASH',
      '1100-AR',
      '1200-INVENTORY',
      '2200-OUTPUT-TAX',
      '4000-SALES',
      '5000-COGS',
    ];

    const rows = await this.financeAccountRepository.find({
      where: { code: In(codes) },
    });
    const map = new Map(rows.map((row) => [row.code, row]));

    for (const code of codes) {
      if (!map.has(code)) {
        throw new Error(
          `Outbox posting account "${code}" is missing. Seed chart of accounts first.`,
        );
      }
    }

    return {
      cash: map.get('1000-CASH')!,
      ar: map.get('1100-AR')!,
      inventory: map.get('1200-INVENTORY')!,
      outputTax: map.get('2200-OUTPUT-TAX')!,
      sales: map.get('4000-SALES')!,
      cogs: map.get('5000-COGS')!,
    };
  }
}
