export class LowStockItemDto {
  productName!: string;
  currentStock!: number;
  minStock!: number;
}

export class InventorySummaryDto {
  productCount!: number;
  totalValue!: number;
  lowStockItems!: LowStockItemDto[];
}