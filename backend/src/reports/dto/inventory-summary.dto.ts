export class LowStockItemDto {
  productName!: string;
  branchName!: string | null;
  currentStock!: number;
  minStock!: number;
  lowStockThreshold!: number;
}

export class InventorySummaryDto {
  productCount!: number;
  totalValue!: number;
  lowStockItems!: LowStockItemDto[];
}
