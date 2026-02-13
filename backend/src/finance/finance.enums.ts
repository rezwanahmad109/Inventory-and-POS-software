export enum FinanceDocumentType {
  SALES_INVOICE = 'sales_invoice',
  PURCHASE_BILL = 'purchase_bill',
  CREDIT_NOTE = 'credit_note',
  DEBIT_NOTE = 'debit_note',
}

export enum FinancePaymentDirection {
  RECEIPT = 'receipt',
  DISBURSEMENT = 'disbursement',
  REFUND = 'refund',
}

export enum FinancePaymentMethod {
  CASH = 'cash',
  CARD = 'card',
  MOBILE = 'mobile',
  BANK_TRANSFER = 'bank_transfer',
}

export enum WalletType {
  CASH = 'cash',
  BANK = 'bank',
  MOBILE_MONEY = 'mobile_money',
}
