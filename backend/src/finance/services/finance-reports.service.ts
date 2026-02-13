import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { FinanceInvoice } from '../../database/entities/finance-invoice.entity';

@Injectable()
export class FinanceReportsService {
  constructor(
    @InjectRepository(FinanceInvoice)
    private readonly financeInvoiceRepository: Repository<FinanceInvoice>,
  ) {}

  async getArAging(bucketSizeDays: number): Promise<unknown> {
    const today = new Date();

    const invoices = await this.financeInvoiceRepository
      .createQueryBuilder('invoice')
      .where('invoice.document_type IN (:...types)', {
        types: ['sales_invoice', 'credit_note'],
      })
      .andWhere('invoice.status IN (:...statuses)', {
        statuses: ['open', 'partial'],
      })
      .andWhere('invoice.balance_due > 0')
      .getMany();

    const buckets = {
      current: 0,
      bucket1: 0,
      bucket2: 0,
      bucket3: 0,
      bucket4Plus: 0,
    };

    for (const invoice of invoices) {
      const dueDate = invoice.dueDate ?? invoice.issueDate;
      const overdueDays = Math.floor(
        (today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (overdueDays <= 0) {
        buckets.current += invoice.balanceDue;
        continue;
      }

      if (overdueDays <= bucketSizeDays) {
        buckets.bucket1 += invoice.balanceDue;
      } else if (overdueDays <= bucketSizeDays * 2) {
        buckets.bucket2 += invoice.balanceDue;
      } else if (overdueDays <= bucketSizeDays * 3) {
        buckets.bucket3 += invoice.balanceDue;
      } else {
        buckets.bucket4Plus += invoice.balanceDue;
      }
    }

    return {
      asOf: today.toISOString(),
      bucketSizeDays,
      totals: {
        current: Number(buckets.current.toFixed(2)),
        [`1-${bucketSizeDays}`]: Number(buckets.bucket1.toFixed(2)),
        [`${bucketSizeDays + 1}-${bucketSizeDays * 2}`]: Number(
          buckets.bucket2.toFixed(2),
        ),
        [`${bucketSizeDays * 2 + 1}-${bucketSizeDays * 3}`]: Number(
          buckets.bucket3.toFixed(2),
        ),
        [`>${bucketSizeDays * 3}`]: Number(buckets.bucket4Plus.toFixed(2)),
      },
      invoiceCount: invoices.length,
    };
  }
}
