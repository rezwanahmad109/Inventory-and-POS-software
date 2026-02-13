-- 20260213_finance_trust_layer_down.sql
-- WARNING: destructive rollback for Finance Trust Layer.

BEGIN;

DROP TABLE IF EXISTS idempotency_keys;
DROP TABLE IF EXISTS payment_allocations;
DROP TABLE IF EXISTS finance_payments;
DROP TABLE IF EXISTS reconciliation_matches;
DROP TABLE IF EXISTS bank_statement_lines;
DROP TABLE IF EXISTS bank_statements;
DROP TABLE IF EXISTS wallet_transactions;
DROP TABLE IF EXISTS wallets;
DROP TABLE IF EXISTS journal_lines;
DROP TABLE IF EXISTS journal_entries;
DROP TABLE IF EXISTS finance_invoices;
DROP TABLE IF EXISTS finance_parties;
DROP TABLE IF EXISTS finance_accounts;

DROP TABLE IF EXISTS sales_return_payments;
DROP TABLE IF EXISTS sale_payments;
DROP TABLE IF EXISTS invoice_sequences;
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS stock_ledger;

ALTER TABLE IF EXISTS purchase_returns
  DROP COLUMN IF EXISTS created_by_user_id,
  DROP COLUMN IF EXISTS note,
  DROP COLUMN IF EXISTS debit_note_number;

ALTER TABLE IF EXISTS sales_returns
  DROP COLUMN IF EXISTS created_by_user_id,
  DROP COLUMN IF EXISTS note,
  DROP COLUMN IF EXISTS credit_note_number;

ALTER TABLE IF EXISTS sale_items
  DROP COLUMN IF EXISTS line_tax_amount,
  DROP COLUMN IF EXISTS line_tax_rate,
  DROP COLUMN IF EXISTS line_discount_amount,
  DROP COLUMN IF EXISTS line_discount_value,
  DROP COLUMN IF EXISTS line_discount_type;

ALTER TABLE IF EXISTS sales
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS refunded_total,
  DROP COLUMN IF EXISTS due_total,
  DROP COLUMN IF EXISTS paid_total,
  DROP COLUMN IF EXISTS invoice_tax_method,
  DROP COLUMN IF EXISTS invoice_tax_rate,
  DROP COLUMN IF EXISTS invoice_discount_value,
  DROP COLUMN IF EXISTS invoice_discount_type,
  DROP COLUMN IF EXISTS grand_total,
  DROP COLUMN IF EXISTS tax_total,
  DROP COLUMN IF EXISTS discount_total,
  DROP COLUMN IF EXISTS subtotal,
  DROP COLUMN IF EXISTS legacy_payment_method;

DROP INDEX IF EXISTS idx_products_name_trgm;
DROP INDEX IF EXISTS idx_products_barcode_unique;
DROP INDEX IF EXISTS idx_products_sku_unique;

ALTER TABLE IF EXISTS products
  DROP COLUMN IF EXISTS tax_method,
  DROP COLUMN IF EXISTS tax_rate,
  DROP COLUMN IF EXISTS barcode;

DROP TYPE IF EXISTS stock_ledger_ref_type_enum;
DROP TYPE IF EXISTS stock_ledger_reason_enum;
DROP TYPE IF EXISTS sale_payment_method_enum;
DROP TYPE IF EXISTS sale_status_enum;
DROP TYPE IF EXISTS discount_type_enum;
DROP TYPE IF EXISTS tax_method_enum;

COMMIT;
