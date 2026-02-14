export interface DashboardChartPointDto {
  label: string;
  value: number;
}

export interface DashboardTopSellingProductDto {
  productId: string;
  productName: string;
  sku: string;
  quantitySold: number;
  revenue: number;
}

export class DashboardSummaryDto {
  totalSalesToday!: number;
  totalSalesThisMonth!: number;
  totalDue!: number;
  totalPaymentsReceived!: number;
  totalPaymentsSent!: number;
  netProfitThisMonth!: number;

  totalPurchasesToday!: number;
  totalPurchasesThisMonth!: number;
  totalExpensesToday!: number;
  totalExpensesThisMonth!: number;

  totalProducts!: number;
  lowStockItems!: number;
  totalCustomers!: number;

  topSellingProducts!: DashboardTopSellingProductDto[];
  salesChart!: DashboardChartPointDto[];
  paymentsChart!: DashboardChartPointDto[];
}
