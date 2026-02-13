export enum StockLedgerReason {
  SALE = 'sale',
  SALE_RETURN = 'sale_return',
  PURCHASE = 'purchase',
  PURCHASE_RETURN = 'purchase_return',
  MANUAL_ADJUSTMENT = 'manual_adjustment',
  STOCK_TRANSFER_IN = 'stock_transfer_in',
  STOCK_TRANSFER_OUT = 'stock_transfer_out',
}

export enum StockLedgerRefType {
  SALE = 'sale',
  SALE_RETURN = 'sale_return',
  PURCHASE = 'purchase',
  PURCHASE_RETURN = 'purchase_return',
  STOCK_TRANSFER = 'stock_transfer',
  PRODUCT = 'product',
  BRANCH_PRODUCT = 'branch_product',
}
