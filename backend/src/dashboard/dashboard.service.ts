import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Sale } from '../database/entities/sale.entity';
import { Purchase } from '../database/entities/purchase.entity';
import { Expense } from '../database/entities/expense.entity';
import { Product } from '../database/entities/product.entity';
import { DashboardSummaryDto } from './dto/dashboard-summary.dto';

/** Low-stock threshold — products with stockQty below this are flagged */
const LOW_STOCK_THRESHOLD = 10;

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Sale)
    private readonly saleRepository: Repository<Sale>,
    @InjectRepository(Purchase)
    private readonly purchaseRepository: Repository<Purchase>,
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  /**
   * Aggregate all dashboard metrics in parallel for optimal performance.
   * Uses COALESCE to guarantee 0 instead of null for empty result sets.
   */
  async getSummary(): Promise<DashboardSummaryDto> {
    // ── Date boundaries (UTC) ──
    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const tomorrowStart = new Date(todayStart.getTime() + 86_400_000);
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

    // ── Run all independent queries in parallel ──
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
    ] = await Promise.all([
      // Sales today
      this.saleRepository
        .createQueryBuilder('sale')
        .select('COALESCE(SUM(sale.total_amount), 0)', 'total')
        .where('sale.created_at >= :start AND sale.created_at < :end', {
          start: todayStart.toISOString(),
          end: tomorrowStart.toISOString(),
        })
        .getRawOne(),

      // Sales this month
      this.saleRepository
        .createQueryBuilder('sale')
        .select('COALESCE(SUM(sale.total_amount), 0)', 'total')
        .where('sale.created_at >= :start AND sale.created_at < :end', {
          start: monthStart.toISOString(),
          end: nextMonthStart.toISOString(),
        })
        .getRawOne(),

      // Purchases today
      this.purchaseRepository
        .createQueryBuilder('purchase')
        .select('COALESCE(SUM(purchase.total_amount), 0)', 'total')
        .where('purchase.created_at >= :start AND purchase.created_at < :end', {
          start: todayStart.toISOString(),
          end: tomorrowStart.toISOString(),
        })
        .getRawOne(),

      // Purchases this month
      this.purchaseRepository
        .createQueryBuilder('purchase')
        .select('COALESCE(SUM(purchase.total_amount), 0)', 'total')
        .where('purchase.created_at >= :start AND purchase.created_at < :end', {
          start: monthStart.toISOString(),
          end: nextMonthStart.toISOString(),
        })
        .getRawOne(),

      // Expenses today (expense.date is a DATE column)
      this.expenseRepository
        .createQueryBuilder('expense')
        .select('COALESCE(SUM(expense.amount), 0)', 'total')
        .where('expense.date >= :start AND expense.date < :end', {
          start: todayStart.toISOString().slice(0, 10),
          end: tomorrowStart.toISOString().slice(0, 10),
        })
        .getRawOne(),

      // Expenses this month
      this.expenseRepository
        .createQueryBuilder('expense')
        .select('COALESCE(SUM(expense.amount), 0)', 'total')
        .where('expense.date >= :start AND expense.date < :end', {
          start: monthStart.toISOString().slice(0, 10),
          end: nextMonthStart.toISOString().slice(0, 10),
        })
        .getRawOne(),

      // Total products count
      this.productRepository
        .createQueryBuilder('product')
        .select('COUNT(product.id)', 'count')
        .getRawOne(),

      // Low stock count
      this.productRepository
        .createQueryBuilder('product')
        .select('COUNT(product.id)', 'count')
        .where('product.stock_qty < :threshold', { threshold: LOW_STOCK_THRESHOLD })
        .getRawOne(),

      // Distinct customer count (customer is a nullable string on Sale)
      this.saleRepository
        .createQueryBuilder('sale')
        .select('COUNT(DISTINCT sale.customer)', 'count')
        .where('sale.customer IS NOT NULL')
        .getRawOne(),
    ]);

    // ── Parse results (PostgreSQL returns strings for aggregates) ──
    const totalSalesToday = parseFloat(salesToday?.total) || 0;
    const totalSalesThisMonth = parseFloat(salesMonth?.total) || 0;
    const totalPurchasesToday = parseFloat(purchasesToday?.total) || 0;
    const totalPurchasesThisMonth = parseFloat(purchasesMonth?.total) || 0;
    const totalExpensesToday = parseFloat(expensesToday?.total) || 0;
    const totalExpensesThisMonth = parseFloat(expensesMonth?.total) || 0;

    const netProfitThisMonth =
      Math.round((totalSalesThisMonth - totalPurchasesThisMonth - totalExpensesThisMonth) * 100) / 100;

    return {
      totalSalesToday: Math.round(totalSalesToday * 100) / 100,
      totalSalesThisMonth: Math.round(totalSalesThisMonth * 100) / 100,
      netProfitThisMonth,
      totalPurchasesToday: Math.round(totalPurchasesToday * 100) / 100,
      totalPurchasesThisMonth: Math.round(totalPurchasesThisMonth * 100) / 100,
      totalExpensesToday: Math.round(totalExpensesToday * 100) / 100,
      totalExpensesThisMonth: Math.round(totalExpensesThisMonth * 100) / 100,
      totalProducts: Number(productStats?.count) || 0,
      lowStockItems: Number(lowStock?.count) || 0,
      totalCustomers: Number(customerCount?.count) || 0,
    };
  }
}
