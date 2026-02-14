import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { Repository } from 'typeorm';

import { BranchProductEntity } from '../database/entities/branch-product.entity';
import { Expense } from '../database/entities/expense.entity';
import { Product } from '../database/entities/product.entity';
import { Purchase } from '../database/entities/purchase.entity';
import { Sale } from '../database/entities/sale.entity';
import { User } from '../database/entities/user.entity';
import { ReportQueryDto } from './dto/report-query.dto';

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
    @InjectRepository(BranchProductEntity)
    private readonly branchProductsRepository: Repository<BranchProductEntity>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async salesSummary(query: ReportQueryDto): Promise<unknown> {
    this.ensureValidRange(query.from, query.to);

    const qb = this.saleRepository
      .createQueryBuilder('sale')
      .leftJoin('sale.items', 'si')
      .select('SUM(sale.grandTotal)', 'totalSales')
      .addSelect('SUM(sale.paidTotal)', 'totalPaid')
      .addSelect('SUM(sale.dueTotal)', 'totalDue')
      .addSelect('COUNT(DISTINCT sale.id)', 'totalInvoices')
      .addSelect('SUM(si.quantity)', 'totalItemsSold')
      .where('sale.createdAt BETWEEN :from AND :to', {
        from: query.from,
        to: query.to,
      })
      .andWhere('sale.documentType = :docType', { docType: 'invoice' });

    if (query.branchId) {
      qb.andWhere('sale.branchId = :branchId', { branchId: query.branchId });
    }
    if (query.userId) {
      qb.andWhere('sale.createdByUserId = :userId', { userId: query.userId });
    }

    const salesData = await qb.getRawOne();

    const paymentQuery = this.saleRepository
      .createQueryBuilder('sale')
      .leftJoin('sale.payments', 'payment')
      .select('payment.method', 'paymentMethod')
      .addSelect('SUM(payment.amount)', 'amount')
      .where('sale.createdAt BETWEEN :from AND :to', {
        from: query.from,
        to: query.to,
      })
      .andWhere('sale.documentType = :docType', { docType: 'invoice' })
      .groupBy('payment.method');

    if (query.branchId) {
      paymentQuery.andWhere('sale.branchId = :branchId', { branchId: query.branchId });
    }
    if (query.userId) {
      paymentQuery.andWhere('sale.createdByUserId = :userId', { userId: query.userId });
    }

    const paymentData = await paymentQuery.getRawMany();
    const paymentMethodBreakdown: Record<string, number> = {};
    paymentData.forEach((item: any) => {
      paymentMethodBreakdown[item.paymentMethod || 'unknown'] = parseFloat(item.amount || 0);
    });

    const result = {
      range: { from: query.from, to: query.to },
      branchId: query.branchId ?? null,
      userId: query.userId ?? null,
      totalSales: parseFloat(salesData.totalSales || 0),
      totalPaid: parseFloat(salesData.totalPaid || 0),
      totalDue: parseFloat(salesData.totalDue || 0),
      itemsSold: parseInt(salesData.totalItemsSold || 0, 10),
      invoiceCount: parseInt(salesData.totalInvoices || 0, 10),
      paymentMethodBreakdown,
    };

    return this.maybeExport('sales_summary', result, query.format);
  }

  async purchaseSummary(query: ReportQueryDto): Promise<unknown> {
    this.ensureValidRange(query.from, query.to);

    const qb = this.purchaseRepository
      .createQueryBuilder('purchase')
      .leftJoin('purchase.items', 'pi')
      .select('SUM(purchase.grandTotal)', 'totalPurchases')
      .addSelect('SUM(purchase.paidTotal)', 'totalPaid')
      .addSelect('SUM(purchase.dueTotal)', 'totalDue')
      .addSelect('COUNT(DISTINCT purchase.id)', 'totalInvoices')
      .addSelect('SUM(pi.quantity)', 'totalQtyPurchased')
      .where('purchase.createdAt BETWEEN :from AND :to', {
        from: query.from,
        to: query.to,
      })
      .andWhere('purchase.documentType = :docType', { docType: 'bill' });

    if (query.branchId) {
      qb.andWhere('purchase.branchId = :branchId', { branchId: query.branchId });
    }

    const data = await qb.getRawOne();

    const result = {
      range: { from: query.from, to: query.to },
      branchId: query.branchId ?? null,
      totalPurchases: parseFloat(data.totalPurchases || 0),
      totalPaid: parseFloat(data.totalPaid || 0),
      totalDue: parseFloat(data.totalDue || 0),
      totalQty: parseInt(data.totalQtyPurchased || 0, 10),
      invoiceCount: parseInt(data.totalInvoices || 0, 10),
    };

    return this.maybeExport('purchase_summary', result, query.format);
  }

  async expenseSummary(query: ReportQueryDto): Promise<unknown> {
    this.ensureValidRange(query.from, query.to);

    const expenseQuery = this.expenseRepository
      .createQueryBuilder('expense')
      .select('SUM(expense.amount)', 'totalExpenses')
      .addSelect('expense.category', 'category')
      .where('expense.date BETWEEN :from AND :to', {
        from: query.from,
        to: query.to,
      })
      .groupBy('expense.category');

    if (query.userId) {
      expenseQuery.andWhere('expense.createdById = :userId', { userId: query.userId });
    }

    const data = await expenseQuery.getRawMany();

    const byCategory: Record<string, number> = {};
    let totalExpenses = 0;
    data.forEach((item: any) => {
      const amount = parseFloat(item.totalExpenses || 0);
      byCategory[item.category || 'Uncategorized'] = amount;
      totalExpenses += amount;
    });

    const result = {
      range: { from: query.from, to: query.to },
      userId: query.userId ?? null,
      totalExpenses,
      byCategory,
    };

    return this.maybeExport('expense_summary', result, query.format);
  }

  async profitLoss(query: ReportQueryDto): Promise<unknown> {
    this.ensureValidRange(query.from, query.to);

    const salesSummary = (await this.salesSummary({ ...query, format: 'json' })) as {
      totalSales: number;
    };
    const purchaseSummary = (await this.purchaseSummary({ ...query, format: 'json' })) as {
      totalPurchases: number;
    };
    const expenseSummary = (await this.expenseSummary({ ...query, format: 'json' })) as {
      totalExpenses: number;
    };

    const totalSales = Number(salesSummary.totalSales || 0);
    const totalPurchases = Number(purchaseSummary.totalPurchases || 0);
    const totalExpenses = Number(expenseSummary.totalExpenses || 0);
    const grossProfit = totalSales - totalPurchases;
    const netProfit = grossProfit - totalExpenses;

    const result = {
      range: { from: query.from, to: query.to },
      branchId: query.branchId ?? null,
      userId: query.userId ?? null,
      totalSales,
      totalPurchases,
      totalExpenses,
      grossProfit,
      netProfit,
    };

    return this.maybeExport('profit_loss', result, query.format);
  }

  async stockSummary(query: ReportQueryDto): Promise<unknown> {
    this.ensureValidRange(query.from, query.to);

    const totals = await this.productRepository
      .createQueryBuilder('product')
      .select('COUNT(product.id)', 'totalProducts')
      .addSelect('SUM(product.stockQty)', 'totalStockQty')
      .addSelect('SUM(product.stockQty * product.price)', 'totalValue')
      .getRawOne();

    const lowStockRows = await this.branchProductsRepository
      .createQueryBuilder('branchProduct')
      .leftJoin('branchProduct.product', 'product')
      .leftJoin('branchProduct.branch', 'branch')
      .select('product.name', 'productName')
      .addSelect('product.sku', 'sku')
      .addSelect('branch.name', 'branchName')
      .addSelect('branchProduct.stock_quantity', 'currentStock')
      .addSelect('branchProduct.low_stock_threshold', 'lowStockThreshold')
      .where('branchProduct.low_stock_threshold > 0')
      .andWhere('branchProduct.stock_quantity <= branchProduct.low_stock_threshold')
      .andWhere('branch.is_active = true')
      .orderBy('branchProduct.stock_quantity', 'ASC')
      .getRawMany();

    const result = {
      productCount: parseInt(totals.totalProducts || 0, 10),
      totalStockQty: parseInt(totals.totalStockQty || 0, 10),
      totalValue: parseFloat(totals.totalValue || 0),
      lowStockItems: lowStockRows.map((row: any) => ({
        productName: row.productName,
        sku: row.sku,
        branchName: row.branchName,
        currentStock: parseInt(row.currentStock || 0, 10),
        lowStockThreshold: parseInt(row.lowStockThreshold || 0, 10),
      })),
    };

    return this.maybeExport('stock_summary', result, query.format);
  }

  async rateList(query: ReportQueryDto): Promise<unknown> {
    this.ensureValidRange(query.from, query.to);

    const rows = await this.productRepository.find({
      relations: {
        category: true,
        unit: true,
        productPriceTiers: {
          priceTier: true,
        },
      },
      order: { name: 'ASC' },
    });

    const result = rows.map((product) => ({
      productId: product.id,
      name: product.name,
      sku: product.sku,
      brand: product.brand,
      price: Number(product.price),
      taxRate: product.taxRate,
      unit: product.unit?.symbol ?? null,
      category: product.category?.name ?? null,
      rateList: (product.productPriceTiers ?? []).map((row) => ({
        priceTierId: row.priceTierId,
        code: row.priceTier?.code ?? null,
        name: row.priceTier?.name ?? null,
        price: Number(row.price),
      })),
    }));

    return this.maybeExport('rate_list', result, query.format);
  }

  async productSalesSummary(query: ReportQueryDto): Promise<unknown> {
    this.ensureValidRange(query.from, query.to);

    const qb = this.saleRepository
      .createQueryBuilder('sale')
      .leftJoin('sale.items', 'item')
      .leftJoin('item.product', 'product')
      .select('item.productId', 'productId')
      .addSelect('product.name', 'productName')
      .addSelect('product.sku', 'sku')
      .addSelect('SUM(item.quantity)', 'quantitySold')
      .addSelect('SUM(item.lineTotal)', 'totalSales')
      .where('sale.createdAt BETWEEN :from AND :to', {
        from: query.from,
        to: query.to,
      })
      .andWhere('sale.documentType = :docType', { docType: 'invoice' })
      .groupBy('item.productId')
      .addGroupBy('product.name')
      .addGroupBy('product.sku')
      .orderBy('SUM(item.lineTotal)', 'DESC');

    if (query.branchId) {
      qb.andWhere('sale.branchId = :branchId', { branchId: query.branchId });
    }

    const rows = await qb.getRawMany();
    const result = rows.map((row: any) => ({
      productId: row.productId,
      productName: row.productName,
      sku: row.sku,
      quantitySold: parseInt(row.quantitySold || 0, 10),
      totalSales: parseFloat(row.totalSales || 0),
    }));

    return this.maybeExport('product_sales_summary', result, query.format);
  }

  async usersReport(query: ReportQueryDto): Promise<unknown> {
    this.ensureValidRange(query.from, query.to);

    const users = await this.usersRepository.find({ order: { createdAt: 'ASC' } });
    const result: Array<Record<string, unknown>> = [];

    for (const user of users) {
      if (query.userId && query.userId !== user.id) {
        continue;
      }

      const salesMetrics = await this.saleRepository
        .createQueryBuilder('sale')
        .select('COUNT(sale.id)', 'invoiceCount')
        .addSelect('SUM(sale.grandTotal)', 'salesAmount')
        .where('sale.createdAt BETWEEN :from AND :to', {
          from: query.from,
          to: query.to,
        })
        .andWhere('sale.createdByUserId = :userId', { userId: user.id })
        .andWhere('sale.documentType = :docType', { docType: 'invoice' })
        .getRawOne();

      const expenseMetrics = await this.expenseRepository
        .createQueryBuilder('expense')
        .select('COUNT(expense.id)', 'expenseCount')
        .addSelect('SUM(expense.amount)', 'expenseAmount')
        .where('expense.date BETWEEN :from AND :to', {
          from: query.from,
          to: query.to,
        })
        .andWhere('expense.createdById = :userId', { userId: user.id })
        .getRawOne();

      result.push({
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        salesInvoiceCount: parseInt(salesMetrics.invoiceCount || 0, 10),
        salesAmount: parseFloat(salesMetrics.salesAmount || 0),
        expenseCount: parseInt(expenseMetrics.expenseCount || 0, 10),
        expenseAmount: parseFloat(expenseMetrics.expenseAmount || 0),
      });
    }

    return this.maybeExport('users_report', result, query.format);
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

  private maybeExport(
    reportName: string,
    data: unknown,
    format: ReportQueryDto['format'],
  ): unknown {
    if (!format || format === 'json') {
      return data;
    }

    const exportDir = join(process.cwd(), 'exports', 'reports');
    mkdirSync(exportDir, { recursive: true });

    const timestamp = Date.now();
    const extension = format === 'csv' ? 'csv' : 'pdf';
    const fileName = `${reportName}_${timestamp}.${extension}`;
    const filePath = join(exportDir, fileName);

    if (format === 'csv') {
      const csv = this.toCsv(data);
      writeFileSync(filePath, csv, 'utf8');
    } else {
      const pdfBuffer = this.toSimplePdf(
        `${reportName}\n\n${JSON.stringify(data, null, 2)}`,
      );
      writeFileSync(filePath, pdfBuffer);
    }

    return {
      reportName,
      format,
      fileName,
      downloadUrl: `/downloads/reports/${fileName}`,
    };
  }

  private toCsv(input: unknown): string {
    const rows = Array.isArray(input) ? input : [input];
    const normalizedRows = rows.map((row) =>
      row && typeof row === 'object'
        ? (row as Record<string, unknown>)
        : { value: row },
    );

    const headers = Array.from(
      normalizedRows.reduce((set, row) => {
        Object.keys(row).forEach((key) => set.add(key));
        return set;
      }, new Set<string>()),
    );

    const csvRows = [headers.join(',')];
    for (const row of normalizedRows) {
      const rowRecord = row as Record<string, unknown>;
      const values = headers.map((header) =>
        this.escapeCsvValue(this.serializeCsvValue(rowRecord[header])),
      );
      csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
  }

  private serializeCsvValue(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }

    if (typeof value === 'object') {
      return JSON.stringify(value);
    }

    return String(value);
  }

  private escapeCsvValue(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  // Minimal single-page PDF generator suitable for report download payloads.
  private toSimplePdf(text: string): Buffer {
    const safeText = text
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)');

    const content = `BT /F1 10 Tf 50 780 Td (${safeText.replace(/\n/g, ') Tj T* (')}) Tj ET`;

    const objects = [
      '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
      '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
      '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj',
      '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
      `5 0 obj << /Length ${content.length} >> stream\n${content}\nendstream endobj`,
    ];

    let pdf = '%PDF-1.4\n';
    const offsets: number[] = [0];
    for (const object of objects) {
      offsets.push(pdf.length);
      pdf += `${object}\n`;
    }

    const xrefOffset = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += '0000000000 65535 f \n';
    for (let index = 1; index < offsets.length; index += 1) {
      pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
    }

    pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return Buffer.from(pdf, 'utf8');
  }
}
