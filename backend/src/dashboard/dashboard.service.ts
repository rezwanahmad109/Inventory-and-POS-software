import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cache } from 'cache-manager';
import { Repository } from 'typeorm';

import { BranchProductEntity } from '../database/entities/branch-product.entity';
import { Expense } from '../database/entities/expense.entity';
import { Product } from '../database/entities/product.entity';
import { PurchasePayment } from '../database/entities/purchase-payment.entity';
import { Purchase } from '../database/entities/purchase.entity';
import { SaleItem } from '../database/entities/sale-item.entity';
import { SalePayment } from '../database/entities/sale-payment.entity';
import { Sale } from '../database/entities/sale.entity';
import {
  DashboardChartPointDto,
  DashboardSummaryDto,
  DashboardTopSellingProductDto,
} from './dto/dashboard-summary.dto';

@Injectable()
export class DashboardService {
  private readonly summaryCacheKey = 'dashboard:summary:v1';

  constructor(
    @InjectRepository(Sale)
    private readonly saleRepository: Repository<Sale>,
    @InjectRepository(SaleItem)
    private readonly saleItemRepository: Repository<SaleItem>,
    @InjectRepository(SalePayment)
    private readonly salePaymentRepository: Repository<SalePayment>,
    @InjectRepository(Purchase)
    private readonly purchaseRepository: Repository<Purchase>,
    @InjectRepository(PurchasePayment)
    private readonly purchasePaymentRepository: Repository<PurchasePayment>,
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(BranchProductEntity)
    private readonly branchProductsRepository: Repository<BranchProductEntity>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  async getSummary(): Promise<DashboardSummaryDto> {
    const cached = await this.cacheManager.get<DashboardSummaryDto>(
      this.summaryCacheKey,
    );
    if (cached) {
      return cached;
    }

    const now = new Date();
    const todayStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const tomorrowStart = new Date(todayStart.getTime() + 86_400_000);
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const nextMonthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
    );

    const [
      salesToday,
      salesMonth,
      purchasesToday,
      purchasesMonth,
      expensesToday,
      expensesMonth,
      productStats,
      lowStock,
      customerCount,
      saleDueTotals,
      paymentsReceived,
      paymentsSent,
      topSellingProducts,
      salesChart,
      paymentsChart,
    ] = await Promise.all([
      this.saleRepository
        .createQueryBuilder('sale')
        .select('COALESCE(SUM(sale.total_amount), 0)', 'total')
        .where('sale.created_at >= :start AND sale.created_at < :end', {
          start: todayStart.toISOString(),
          end: tomorrowStart.toISOString(),
        })
        .getRawOne<{ total: string }>(),

      this.saleRepository
        .createQueryBuilder('sale')
        .select('COALESCE(SUM(sale.total_amount), 0)', 'total')
        .where('sale.created_at >= :start AND sale.created_at < :end', {
          start: monthStart.toISOString(),
          end: nextMonthStart.toISOString(),
        })
        .getRawOne<{ total: string }>(),

      this.purchaseRepository
        .createQueryBuilder('purchase')
        .select('COALESCE(SUM(purchase.total_amount), 0)', 'total')
        .where('purchase.created_at >= :start AND purchase.created_at < :end', {
          start: todayStart.toISOString(),
          end: tomorrowStart.toISOString(),
        })
        .getRawOne<{ total: string }>(),

      this.purchaseRepository
        .createQueryBuilder('purchase')
        .select('COALESCE(SUM(purchase.total_amount), 0)', 'total')
        .where('purchase.created_at >= :start AND purchase.created_at < :end', {
          start: monthStart.toISOString(),
          end: nextMonthStart.toISOString(),
        })
        .getRawOne<{ total: string }>(),

      this.expenseRepository
        .createQueryBuilder('expense')
        .select('COALESCE(SUM(expense.amount), 0)', 'total')
        .where('expense.date >= :start AND expense.date < :end', {
          start: todayStart.toISOString().slice(0, 10),
          end: tomorrowStart.toISOString().slice(0, 10),
        })
        .getRawOne<{ total: string }>(),

      this.expenseRepository
        .createQueryBuilder('expense')
        .select('COALESCE(SUM(expense.amount), 0)', 'total')
        .where('expense.date >= :start AND expense.date < :end', {
          start: monthStart.toISOString().slice(0, 10),
          end: nextMonthStart.toISOString().slice(0, 10),
        })
        .getRawOne<{ total: string }>(),

      this.productRepository
        .createQueryBuilder('product')
        .select('COUNT(product.id)', 'count')
        .getRawOne<{ count: string }>(),

      this.branchProductsRepository
        .createQueryBuilder('branchProduct')
        .select('COUNT(branchProduct.id)', 'count')
        .leftJoin('branchProduct.branch', 'branch')
        .where('branchProduct.low_stock_threshold > 0')
        .andWhere('branchProduct.stock_quantity <= branchProduct.low_stock_threshold')
        .andWhere('branch.is_active = true')
        .getRawOne<{ count: string }>(),

      this.saleRepository
        .createQueryBuilder('sale')
        .select('COUNT(DISTINCT sale.customer_id)', 'count')
        .where('sale.customer_id IS NOT NULL')
        .getRawOne<{ count: string }>(),

      this.saleRepository
        .createQueryBuilder('sale')
        .select('COALESCE(SUM(sale.due_total), 0)', 'total')
        .where('sale.document_type = :docType', { docType: 'invoice' })
        .getRawOne<{ total: string }>(),

      this.salePaymentRepository
        .createQueryBuilder('payment')
        .select('COALESCE(SUM(payment.amount), 0)', 'total')
        .where('payment.created_at >= :start AND payment.created_at < :end', {
          start: monthStart.toISOString(),
          end: nextMonthStart.toISOString(),
        })
        .getRawOne<{ total: string }>(),

      this.purchasePaymentRepository
        .createQueryBuilder('payment')
        .select('COALESCE(SUM(payment.amount), 0)', 'total')
        .where('payment.created_at >= :start AND payment.created_at < :end', {
          start: monthStart.toISOString(),
          end: nextMonthStart.toISOString(),
        })
        .getRawOne<{ total: string }>(),

      this.getTopSellingProducts(monthStart, nextMonthStart),
      this.getSalesChartPoints(14),
      this.getPaymentsChartPoints(14),
    ]);

    const totalSalesToday = this.toMoney(salesToday?.total);
    const totalSalesThisMonth = this.toMoney(salesMonth?.total);
    const totalPurchasesToday = this.toMoney(purchasesToday?.total);
    const totalPurchasesThisMonth = this.toMoney(purchasesMonth?.total);
    const totalExpensesToday = this.toMoney(expensesToday?.total);
    const totalExpensesThisMonth = this.toMoney(expensesMonth?.total);
    const totalDue = this.toMoney(saleDueTotals?.total);
    const totalPaymentsReceived = this.toMoney(paymentsReceived?.total);
    const totalPaymentsSent = this.toMoney(paymentsSent?.total);

    const summary: DashboardSummaryDto = {
      totalSalesToday,
      totalSalesThisMonth,
      totalDue,
      totalPaymentsReceived,
      totalPaymentsSent,
      netProfitThisMonth: this.toMoney(
        totalSalesThisMonth - totalPurchasesThisMonth - totalExpensesThisMonth,
      ),
      totalPurchasesToday,
      totalPurchasesThisMonth,
      totalExpensesToday,
      totalExpensesThisMonth,
      totalProducts: Number(productStats?.count ?? 0),
      lowStockItems: Number(lowStock?.count ?? 0),
      totalCustomers: Number(customerCount?.count ?? 0),
      topSellingProducts,
      salesChart,
      paymentsChart,
    };

    await this.cacheManager.set(this.summaryCacheKey, summary);
    return summary;
  }

  private async getTopSellingProducts(
    from: Date,
    to: Date,
  ): Promise<DashboardTopSellingProductDto[]> {
    const rows = await this.saleItemRepository
      .createQueryBuilder('item')
      .innerJoin('item.sale', 'sale')
      .innerJoin('item.product', 'product')
      .select('item.product_id', 'productId')
      .addSelect('product.name', 'productName')
      .addSelect('product.sku', 'sku')
      .addSelect('COALESCE(SUM(item.quantity), 0)', 'quantitySold')
      .addSelect('COALESCE(SUM(item.line_total), 0)', 'revenue')
      .where('sale.document_type = :docType', { docType: 'invoice' })
      .andWhere('sale.created_at >= :start AND sale.created_at < :end', {
        start: from.toISOString(),
        end: to.toISOString(),
      })
      .groupBy('item.product_id')
      .addGroupBy('product.name')
      .addGroupBy('product.sku')
      .orderBy('SUM(item.quantity)', 'DESC')
      .addOrderBy('SUM(item.line_total)', 'DESC')
      .limit(5)
      .getRawMany<{
        productId: string;
        productName: string;
        sku: string;
        quantitySold: string;
        revenue: string;
      }>();

    return rows.map((row) => ({
      productId: row.productId,
      productName: row.productName,
      sku: row.sku,
      quantitySold: Number(row.quantitySold ?? 0),
      revenue: this.toMoney(row.revenue),
    }));
  }

  private async getSalesChartPoints(days: number): Promise<DashboardChartPointDto[]> {
    const labels = this.buildUtcDayLabels(days);
    const start = new Date(`${labels[0]}T00:00:00.000Z`);

    const rows = await this.saleRepository
      .createQueryBuilder('sale')
      .select(
        `TO_CHAR(DATE_TRUNC('day', sale.created_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD')`,
        'day',
      )
      .addSelect('COALESCE(SUM(sale.total_amount), 0)', 'total')
      .where('sale.created_at >= :start', { start: start.toISOString() })
      .andWhere('sale.document_type = :docType', { docType: 'invoice' })
      .groupBy(`DATE_TRUNC('day', sale.created_at AT TIME ZONE 'UTC')`)
      .orderBy(`DATE_TRUNC('day', sale.created_at AT TIME ZONE 'UTC')`, 'ASC')
      .getRawMany<{ day: string; total: string }>();

    const map = new Map(rows.map((row) => [row.day, this.toMoney(row.total)]));
    return labels.map((label) => ({
      label,
      value: map.get(label) ?? 0,
    }));
  }

  private async getPaymentsChartPoints(
    days: number,
  ): Promise<DashboardChartPointDto[]> {
    const labels = this.buildUtcDayLabels(days);
    const start = new Date(`${labels[0]}T00:00:00.000Z`);

    const receivedRows = await this.salePaymentRepository
      .createQueryBuilder('payment')
      .select(
        `TO_CHAR(DATE_TRUNC('day', payment.created_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD')`,
        'day',
      )
      .addSelect('COALESCE(SUM(payment.amount), 0)', 'total')
      .where('payment.created_at >= :start', { start: start.toISOString() })
      .groupBy(`DATE_TRUNC('day', payment.created_at AT TIME ZONE 'UTC')`)
      .getRawMany<{ day: string; total: string }>();

    const sentRows = await this.purchasePaymentRepository
      .createQueryBuilder('payment')
      .select(
        `TO_CHAR(DATE_TRUNC('day', payment.created_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD')`,
        'day',
      )
      .addSelect('COALESCE(SUM(payment.amount), 0)', 'total')
      .where('payment.created_at >= :start', { start: start.toISOString() })
      .groupBy(`DATE_TRUNC('day', payment.created_at AT TIME ZONE 'UTC')`)
      .getRawMany<{ day: string; total: string }>();

    const receivedMap = new Map(
      receivedRows.map((row) => [row.day, this.toMoney(row.total)]),
    );
    const sentMap = new Map(sentRows.map((row) => [row.day, this.toMoney(row.total)]));

    return labels.map((label) => ({
      label,
      value: this.toMoney((receivedMap.get(label) ?? 0) - (sentMap.get(label) ?? 0)),
    }));
  }

  private buildUtcDayLabels(days: number): string[] {
    const labels: string[] = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i -= 1) {
      const date = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i),
      );
      labels.push(date.toISOString().slice(0, 10));
    }

    return labels;
  }

  private toMoney(value: string | number | null | undefined): number {
    const numeric = Number(value ?? 0);
    if (Number.isNaN(numeric)) {
      return 0;
    }
    return Number(numeric.toFixed(2));
  }
}
