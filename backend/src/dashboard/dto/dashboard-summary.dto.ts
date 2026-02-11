export class DashboardSummaryDto {
  // ─── SALES & PROFITS ───
  /** Sum of all sale amounts where sale date = today */
  totalSalesToday!: number;

  /** Sum of all sale amounts in the current calendar month */
  totalSalesThisMonth!: number;

  /** totalSalesThisMonth - (totalPurchasesThisMonth + totalExpensesThisMonth) */
  netProfitThisMonth!: number;

  // ─── PURCHASES ───
  /** Sum of all purchase amounts where purchase date = today */
  totalPurchasesToday!: number;

  /** Sum of all purchase amounts in the current calendar month */
  totalPurchasesThisMonth!: number;

  // ─── EXPENSES ───
  /** Sum of all expense amounts where expense date = today */
  totalExpensesToday!: number;

  /** Sum of all expense amounts in the current calendar month */
  totalExpensesThisMonth!: number;

  // ─── PRODUCTS & INVENTORY ───
  /** Total count of all products in the system */
  totalProducts!: number;

  /** Count of products where stockQty < low stock threshold (10) */
  lowStockItems!: number;

  // ─── CUSTOMERS ───
  /** Total count of distinct customers from sales records */
  totalCustomers!: number;
}
