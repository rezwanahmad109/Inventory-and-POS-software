import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Sale } from '../database/entities/sale.entity';
import { Purchase } from '../database/entities/purchase.entity';
import { Expense } from '../database/entities/expense.entity';
import { Product } from '../database/entities/product.entity';
import { SalesSummaryDto } from './dto/sales-summary.dto';
import { PurchaseSummaryDto } from './dto/purchase-summary.dto';
import { ExpenseSummaryDto } from './dto/expense-summary.dto';
import { ProfitLossDto } from './dto/profit-loss.dto';
import { InventorySummaryDto } from './dto/inventory-summary.dto';

@Injectable()
export class ReportsService {
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
   * Get sales summary report
   */
  async salesSummary(from: string, to: string): Promise<SalesSummaryDto> {
    this.ensureValidRange(from, to);

    // Base query for sales
    const query = this.saleRepository
      .createQueryBuilder('sale')
      .select('SUM(sale.totalAmount)', 'totalSales')
      .addSelect('COUNT(DISTINCT sale.id)', 'totalInvoices')
      .addSelect('SUM(si.quantity)', 'totalItemsSold')
      .leftJoin('sale.items', 'si')
      .where('sale.createdAt BETWEEN :from AND :to', { from, to });

    const salesData = await query.getRawOne();

    // Payment method breakdown
    const paymentQuery = this.saleRepository
      .createQueryBuilder('sale')
      .select('sale.paymentMethod', 'paymentMethod')
      .addSelect('SUM(sale.totalAmount)', 'amount')
      .where('sale.createdAt BETWEEN :from AND :to', { from, to })
      .groupBy('sale.paymentMethod');

    const paymentData = await paymentQuery.getRawMany();

    const paymentMethodBreakdown: Record<string, number> = {};
    paymentData.forEach((item: any) => {
      paymentMethodBreakdown[item.paymentMethod] = parseFloat(item.amount);
    });

    return {
      totalSales: parseFloat(salesData.totalSales || 0),
      itemsSold: parseInt(salesData.totalItemsSold || 0),
      invoiceCount: parseInt(salesData.totalInvoices || 0),
      paymentMethodBreakdown,
    };
  }

  /**
   * Get purchase summary report
   */
  async purchaseSummary(from: string, to: string): Promise<PurchaseSummaryDto> {
    this.ensureValidRange(from, to);

    const query = this.purchaseRepository
      .createQueryBuilder('purchase')
      .select('SUM(purchase.totalAmount)', 'totalPurchases')
      .addSelect('COUNT(DISTINCT purchase.id)', 'totalInvoices')
      .addSelect('SUM(pi.quantity)', 'totalQtyPurchased')
      .leftJoin('purchase.items', 'pi')
      .where('purchase.createdAt BETWEEN :from AND :to', { from, to });

    const data = await query.getRawOne();

    return {
      totalPurchases: parseFloat(data.totalPurchases || 0),
      totalQty: parseInt(data.totalQtyPurchased || 0),
      invoiceCount: parseInt(data.totalInvoices || 0),
    };
  }

  /**
   * Get expense summary report
   */
  async expenseSummary(from: string, to: string): Promise<ExpenseSummaryDto> {
    this.ensureValidRange(from, to);

    const query = this.expenseRepository
      .createQueryBuilder('expense')
      .select('SUM(expense.amount)', 'totalExpenses')
      .addSelect('expense.category', 'category')
      .where('expense.date BETWEEN :from AND :to', { from, to })
      .groupBy('expense.category');

    const data = await query.getRawMany();

    const byCategory: Record<string, number> = {};
    let totalExpenses = 0;
    data.forEach((item: any) => {
      const amount = parseFloat(item.totalExpenses);
      byCategory[item.category] = amount;
      totalExpenses += amount;
    });

    return {
      totalExpenses,
      byCategory,
    };
  }

  /**
   * Get profit-loss report
   */
  async profitLoss(from: string, to: string): Promise<ProfitLossDto> {
    this.ensureValidRange(from, to);

    const sales = await this.saleRepository
      .createQueryBuilder('sale')
      .select('SUM(sale.totalAmount)', 'total')
      .where('sale.createdAt BETWEEN :from AND :to', { from, to })
      .getRawOne();

    const purchases = await this.purchaseRepository
      .createQueryBuilder('purchase')
      .select('SUM(purchase.totalAmount)', 'total')
      .where('purchase.createdAt BETWEEN :from AND :to', { from, to })
      .getRawOne();

    const expenses = await this.expenseRepository
      .createQueryBuilder('expense')
      .select('SUM(expense.amount)', 'total')
      .where('expense.date BETWEEN :from AND :to', { from, to })
      .getRawOne();

    const totalSales = parseFloat(sales?.total || 0);
    const totalPurchases = parseFloat(purchases?.total || 0);
    const totalExpenses = parseFloat(expenses?.total || 0);
    const netProfit = totalSales - (totalPurchases + totalExpenses);

    return {
      totalSales,
      totalPurchases,
      totalExpenses,
      netProfit,
    };
  }

  /**
   * Get inventory summary report
   */
  async inventorySummary(): Promise<InventorySummaryDto> {
    const query = this.productRepository
      .createQueryBuilder('product')
      .select('COUNT(product.id)', 'totalProducts')
      .addSelect('SUM(product.stockQty * product.price)', 'totalValue');

    const data = await query.getRawOne();

    // Low stock items: stockQty < 10 (threshold)
    const lowStockQuery = this.productRepository
      .createQueryBuilder('product')
      .select('product.name', 'productName')
      .addSelect('product.stockQty', 'currentStock')
      .where('product.stockQty < 10');

    const lowStockItems = await lowStockQuery.getRawMany();

    return {
      productCount: parseInt(data.totalProducts || 0),
      totalValue: parseFloat(data.totalValue || 0),
      lowStockItems: lowStockItems.map((item: any) => ({
        productName: item.productName,
        currentStock: parseInt(item.currentStock),
        minStock: 10, // Threshold
      })),
    };
  }

  private ensureValidRange(from: string, to: string): void {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      throw new BadRequestException('Invalid date range.');
    }
    if (fromDate > toDate) {
      throw new BadRequestException('"from" must be less than or equal to "to".');
    }
  }
}
