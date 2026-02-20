import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { FinanceAccount } from '../../database/entities/finance-account.entity';
import { FinanceInvoice } from '../../database/entities/finance-invoice.entity';
import { FinanceParty } from '../../database/entities/finance-party.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { CreateFinanceInvoiceDto } from '../dto/create-finance-invoice.dto';
import { FinanceInvoiceQueryDto } from '../dto/finance-invoice-query.dto';
import { FinanceDocumentType } from '../finance.enums';
import { JournalPostingService } from './journal-posting.service';
import { PaginatedResponse } from '../../common/interfaces/paginated-response.interface';
import { toPaginatedResponse } from '../../common/utils/pagination.util';

@Injectable()
export class FinanceInvoicesService {
  constructor(
    @InjectRepository(FinanceInvoice)
    private readonly financeInvoiceRepository: Repository<FinanceInvoice>,
    @InjectRepository(FinanceParty)
    private readonly financePartyRepository: Repository<FinanceParty>,
    @InjectRepository(FinanceAccount)
    private readonly financeAccountRepository: Repository<FinanceAccount>,
    private readonly journalPostingService: JournalPostingService,
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateFinanceInvoiceDto, actorId: string): Promise<FinanceInvoice> {
    return this.dataSource.transaction(async (manager) => {
      const party = await manager.findOne(FinanceParty, {
        where: { id: dto.partyId },
      });
      if (!party) {
        throw new NotFoundException(`Finance party "${dto.partyId}" not found.`);
      }

      if (dto.totalAmount < dto.subtotal) {
        throw new BadRequestException('totalAmount cannot be lower than subtotal.');
      }

      const documentNo = await this.generateDocumentNo(manager, dto.documentType);
      const invoice = manager.create(FinanceInvoice, {
        documentNo,
        documentType: dto.documentType,
        partyId: party.id,
        issueDate: new Date(dto.issueDate),
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        subtotal: Number(dto.subtotal.toFixed(2)),
        taxTotal: Number((dto.taxTotal ?? 0).toFixed(2)),
        totalAmount: Number(dto.totalAmount.toFixed(2)),
        balanceDue: Number(dto.totalAmount.toFixed(2)),
        currency: (dto.currency ?? 'USD').toUpperCase(),
        status: 'open',
      });

      const saved = await manager.save(FinanceInvoice, invoice);
      await this.postInvoiceJournal(saved, actorId, dto.idempotencyKey ?? null);

      await manager.save(
        AuditLog,
        manager.create(AuditLog, {
          actorId,
          action: 'finance.invoice.create',
          entity: 'finance_invoices',
          entityId: saved.id,
          before: null,
          after: {
            id: saved.id,
            documentNo: saved.documentNo,
            documentType: saved.documentType,
            totalAmount: saved.totalAmount,
          },
          requestId: null,
          correlationId: dto.idempotencyKey ?? null,
        }),
      );

      return saved;
    });
  }

  async findAll(
    query: FinanceInvoiceQueryDto,
  ): Promise<PaginatedResponse<FinanceInvoice>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.financeInvoiceRepository
      .createQueryBuilder('invoice')
      .orderBy('invoice.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query.partyId) {
      qb.andWhere('invoice.party_id = :partyId', { partyId: query.partyId });
    }
    if (query.documentType) {
      qb.andWhere('invoice.document_type = :documentType', {
        documentType: query.documentType,
      });
    }
    if (query.from) {
      qb.andWhere('invoice.issue_date >= :from', { from: query.from });
    }
    if (query.to) {
      qb.andWhere('invoice.issue_date <= :to', { to: query.to });
    }

    const [invoices, total] = await qb.getManyAndCount();
    return toPaginatedResponse(invoices, total, page, limit);
  }

  private async postInvoiceJournal(
    invoice: FinanceInvoice,
    actorId: string,
    idempotencyKey: string | null,
  ): Promise<void> {
    const arAccount = await this.getAccountByCodeOrFail('1100-AR');
    const apAccount = await this.getAccountByCodeOrFail('2100-AP');
    const salesAccount = await this.getAccountByCodeOrFail('4000-SALES');
    const purchaseAccount = await this.getAccountByCodeOrFail('5000-COGS');
    const taxPayableAccount = await this.getAccountByCodeOrFail('2200-OUTPUT-TAX');
    const taxReceivableAccount = await this.getAccountByCodeOrFail('1300-INPUT-TAX');

    const lines: {
      accountId: string;
      partyId?: string;
      debit: number;
      credit: number;
      memo?: string;
    }[] = [];

    switch (invoice.documentType) {
      case FinanceDocumentType.SALES_INVOICE:
        lines.push({
          accountId: arAccount.id,
          partyId: invoice.partyId,
          debit: invoice.totalAmount,
          credit: 0,
          memo: 'Recognize trade receivable',
        });
        lines.push({
          accountId: salesAccount.id,
          partyId: invoice.partyId,
          debit: 0,
          credit: invoice.subtotal,
          memo: 'Recognize revenue',
        });
        if (invoice.taxTotal > 0) {
          lines.push({
            accountId: taxPayableAccount.id,
            debit: 0,
            credit: invoice.taxTotal,
            memo: 'Output tax payable',
          });
        }
        break;

      case FinanceDocumentType.PURCHASE_BILL:
        lines.push({
          accountId: purchaseAccount.id,
          partyId: invoice.partyId,
          debit: invoice.subtotal,
          credit: 0,
          memo: 'Recognize procurement expense/COGS',
        });
        if (invoice.taxTotal > 0) {
          lines.push({
            accountId: taxReceivableAccount.id,
            debit: invoice.taxTotal,
            credit: 0,
            memo: 'Input tax receivable',
          });
        }
        lines.push({
          accountId: apAccount.id,
          partyId: invoice.partyId,
          debit: 0,
          credit: invoice.totalAmount,
          memo: 'Recognize trade payable',
        });
        break;

      case FinanceDocumentType.CREDIT_NOTE:
        // Credit note against customer: reduce AR and revenue/tax.
        lines.push({
          accountId: salesAccount.id,
          partyId: invoice.partyId,
          debit: invoice.subtotal,
          credit: 0,
          memo: 'Revenue reversal via credit note',
        });
        if (invoice.taxTotal > 0) {
          lines.push({
            accountId: taxPayableAccount.id,
            debit: invoice.taxTotal,
            credit: 0,
            memo: 'Reverse output tax',
          });
        }
        lines.push({
          accountId: arAccount.id,
          partyId: invoice.partyId,
          debit: 0,
          credit: invoice.totalAmount,
          memo: 'Reduce receivable',
        });
        break;

      case FinanceDocumentType.DEBIT_NOTE:
        // Debit note against supplier: reduce AP and prior recognized expense/tax.
        lines.push({
          accountId: apAccount.id,
          partyId: invoice.partyId,
          debit: invoice.totalAmount,
          credit: 0,
          memo: 'Reduce payable via debit note',
        });
        lines.push({
          accountId: purchaseAccount.id,
          partyId: invoice.partyId,
          debit: 0,
          credit: invoice.subtotal,
          memo: 'Reverse procurement expense',
        });
        if (invoice.taxTotal > 0) {
          lines.push({
            accountId: taxReceivableAccount.id,
            debit: 0,
            credit: invoice.taxTotal,
            memo: 'Reverse input tax receivable',
          });
        }
        break;

      default:
        throw new BadRequestException(`Unsupported invoice type: ${invoice.documentType}`);
    }

    await this.journalPostingService.post({
      entryDate: invoice.issueDate,
      sourceType: 'finance_invoice',
      sourceId: invoice.id,
      description: `${invoice.documentType} ${invoice.documentNo}`,
      idempotencyKey: idempotencyKey ? `invoice:${idempotencyKey}` : null,
      postedBy: actorId,
      lines,
    });
  }

  private async generateDocumentNo(
    manager: DataSource['manager'],
    type: FinanceDocumentType,
  ): Promise<string> {
    const code =
      type === FinanceDocumentType.SALES_INVOICE
        ? 'SI'
        : type === FinanceDocumentType.PURCHASE_BILL
          ? 'PB'
          : type === FinanceDocumentType.CREDIT_NOTE
            ? 'CN'
            : 'DN';

    const count = await manager.count(FinanceInvoice, {
      where: { documentType: type },
    });
    return `${code}-${String(count + 1).padStart(6, '0')}`;
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
