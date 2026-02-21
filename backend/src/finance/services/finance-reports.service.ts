import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { FinanceInvoice } from '../../database/entities/finance-invoice.entity';
import { Sale } from '../../database/entities/sale.entity';

@Injectable()
export class FinanceReportsService {
  constructor(
    @InjectRepository(FinanceInvoice)
    private readonly financeInvoiceRepository: Repository<FinanceInvoice>,
    @InjectRepository(Sale)
    private readonly saleRepository: Repository<Sale>,
  ) {}

  async getArAging(_bucketSizeDays: number): Promise<unknown> {
    const today = new Date();

    const invoices = await this.financeInvoiceRepository
      .createQueryBuilder('invoice')
      .where('invoice.document_type = :documentType', {
        documentType: 'sales_invoice',
      })
      .andWhere('invoice.status IN (:...statuses)', {
        statuses: ['open', 'partial'],
      })
      .andWhere('(invoice.invoice_balance > 0 OR invoice.balance_due > 0)')
      .getMany();
    const salesInvoices = await this.saleRepository
      .createQueryBuilder('sale')
      .leftJoinAndSelect('sale.customerEntity', 'customer')
      .where('sale.document_type = :documentType', {
        documentType: 'invoice',
      })
      .andWhere('sale.due_total > 0')
      .getMany();

    const buckets = {
      zeroTo30: 0,
      thirtyOneTo60: 0,
      sixtyOneTo90: 0,
      above90: 0,
    };

    const rows: Array<{
      invoiceId: string;
      documentNo: string;
      issueDate: string;
      dueDate: string | null;
      balance: number;
      source: 'finance_invoice' | 'sales_invoice';
      overdueDays: number;
      isOverdue: boolean;
      bucket: '0-30' | '31-60' | '61-90' | '90+';
    }> = [];

    for (const invoice of invoices) {
      const dueDate = invoice.dueDate ?? invoice.issueDate;
      const overdueDays = Math.max(
        Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)),
        0,
      );
      const balance = Number((invoice.invoiceBalance ?? invoice.balanceDue).toFixed(2));

      let bucket: '0-30' | '31-60' | '61-90' | '90+' = '0-30';
      if (overdueDays <= 30) {
        bucket = '0-30';
        buckets.zeroTo30 += balance;
      } else if (overdueDays <= 60) {
        bucket = '31-60';
        buckets.thirtyOneTo60 += balance;
      } else if (overdueDays <= 90) {
        bucket = '61-90';
        buckets.sixtyOneTo90 += balance;
      } else {
        bucket = '90+';
        buckets.above90 += balance;
      }

      rows.push({
        invoiceId: invoice.id,
        documentNo: invoice.documentNo,
        issueDate: invoice.issueDate.toISOString().slice(0, 10),
        dueDate: invoice.dueDate ? invoice.dueDate.toISOString().slice(0, 10) : null,
        balance,
        source: 'finance_invoice',
        overdueDays,
        isOverdue: overdueDays > 0,
        bucket,
      });
    }

    for (const sale of salesInvoices) {
      const creditTermsDays = sale.customerEntity?.creditTermsDays ?? 0;
      const dueDate = new Date(sale.createdAt);
      dueDate.setDate(dueDate.getDate() + Math.max(creditTermsDays, 0));

      const overdueDays = Math.max(
        Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)),
        0,
      );
      const balance = Number(sale.dueTotal.toFixed(2));

      let bucket: '0-30' | '31-60' | '61-90' | '90+' = '0-30';
      if (overdueDays <= 30) {
        bucket = '0-30';
        buckets.zeroTo30 += balance;
      } else if (overdueDays <= 60) {
        bucket = '31-60';
        buckets.thirtyOneTo60 += balance;
      } else if (overdueDays <= 90) {
        bucket = '61-90';
        buckets.sixtyOneTo90 += balance;
      } else {
        bucket = '90+';
        buckets.above90 += balance;
      }

      rows.push({
        invoiceId: sale.id,
        documentNo: sale.invoiceNumber,
        issueDate: sale.createdAt.toISOString().slice(0, 10),
        dueDate: dueDate.toISOString().slice(0, 10),
        balance,
        source: 'sales_invoice',
        overdueDays,
        isOverdue: overdueDays > 0,
        bucket,
      });
    }

    return {
      asOf: today.toISOString(),
      totals: {
        '0-30': Number(buckets.zeroTo30.toFixed(2)),
        '31-60': Number(buckets.thirtyOneTo60.toFixed(2)),
        '61-90': Number(buckets.sixtyOneTo90.toFixed(2)),
        '90+': Number(buckets.above90.toFixed(2)),
      },
      invoiceCount: invoices.length + salesInvoices.length,
      invoices: rows,
    };
  }
}
