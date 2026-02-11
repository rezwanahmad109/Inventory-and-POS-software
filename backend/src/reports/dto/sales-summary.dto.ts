export class SalesSummaryDto {
  totalSales!: number;
  itemsSold!: number;
  invoiceCount!: number;
  paymentMethodBreakdown!: Record<string, number>;
}