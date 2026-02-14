import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { BranchProductEntity } from '../database/entities/branch-product.entity';
import { Expense } from '../database/entities/expense.entity';
import { Product } from '../database/entities/product.entity';
import { Purchase } from '../database/entities/purchase.entity';
import { Sale } from '../database/entities/sale.entity';
import { DashboardSummaryDto } from './dto/dashboard-summary.dto';

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
    @InjectRepository(BranchProductEntity)
    private readonly branchProductsRepository: Repository<BranchProductEntity>,
  ) {}

  async getSummary(): Promise<DashboardSummaryDto> {
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
    ] = await Promise.all([
      this.saleRepository
        .createQueryBuilder('sale')
        .select('COALESCE(SUM(sale.total_amount), 0)', 'total')
        .where('sale.created_at >= :start AND sale.created_at < :end', {
          start: todayStart.toISOString(),
          end: tomorrowStart.toISOString(),
        })
        .getRawOne(),

      this.saleRepository
        .createQueryBuilder('sale')
        .select('COALESCE(SUM(sale.total_amount), 0)', 'total')
        .where('sale.created_at >= :start AND sale.created_at < :end', {
          start: monthStart.toISOString(),
          end: nextMonthStart.toISOString(),
        })
        .getRawOne(),

      this.purchaseRepository
        .createQueryBuilder('purchase')
        .select('COALESCE(SUM(purchase.total_amount), 0)', 'total')
        .where('purchase.created_at >= :start AND purchase.created_at < :end', {
          start: todayStart.toISOString(),
          end: tomorrowStart.toISOString(),
        })
        .getRawOne(),

      this.purchaseRepository
        .createQueryBuilder('purchase')
        .select('COALESCE(SUM(purchase.total_amount), 0)', 'total')
        .where('purchase.created_at >= :start AND purchase.created_at < :end', {
          start: monthStart.toISOString(),
          end: nextMonthStart.toISOString(),
        })
        .getRawOne(),

      this.expenseRepository
        .createQueryBuilder('expense')
        .select('COALESCE(SUM(expense.amount), 0)', 'total')
        .where('expense.date >= :start AND expense.date < :end', {
          start: todayStart.toISOString().slice(0, 10),
          end: tomorrowStart.toISOString().slice(0, 10),
        })
        .getRawOne(),

      this.expenseRepository
        .createQueryBuilder('expense')
        .select('COALESCE(SUM(expense.amount), 0)', 'total')
        .where('expense.date >= :start AND expense.date < :end', {
          start: monthStart.toISOString().slice(0, 10),
          end: nextMonthStart.toISOString().slice(0, 10),
        })
        .getRawOne(),

      this.productRepository
        .createQueryBuilder('product')
        .select('COUNT(product.id)', 'count')
        .getRawOne(),

      this.branchProductsRepository
        .createQueryBuilder('branchProduct')
        .select('COUNT(branchProduct.id)', 'count')
        .leftJoin('branchProduct.branch', 'branch')
        .where('branchProduct.low_stock_threshold > 0')
        .andWhere('branchProduct.stock_quantity <= branchProduct.low_stock_threshold')
        .andWhere('branch.is_active = true')
        .getRawOne(),

      this.saleRepository
        .createQueryBuilder('sale')
        .select('COUNT(DISTINCT sale.customer)', 'count')
        .where('sale.customer IS NOT NULL')
        .getRawOne(),
    ]);

    const totalSalesToday = parseFloat(salesToday?.total) || 0;
    const totalSalesThisMonth = parseFloat(salesMonth?.total) || 0;
    const totalPurchasesToday = parseFloat(purchasesToday?.total) || 0;
    const totalPurchasesThisMonth = parseFloat(purchasesMonth?.total) || 0;
    const totalExpensesToday = parseFloat(expensesToday?.total) || 0;
    const totalExpensesThisMonth = parseFloat(expensesMonth?.total) || 0;

    const netProfitThisMonth =
      Math.round(
        (totalSalesThisMonth - totalPurchasesThisMonth - totalExpensesThisMonth) *
          100,
      ) / 100;

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
