-- 20260213_finance_trust_layer_up.sql
-- Finance Trust Layer migration (PostgreSQL)
-- NOTE: run inside a controlled deployment window.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

DO $$ BEGIN
  CREATE TYPE tax_method_enum AS ENUM ('exclusive', 'inclusive');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE discount_type_enum AS ENUM ('none', 'percent', 'fixed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE sale_status_enum AS ENUM ('unpaid', 'partial', 'paid', 'refunded', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE sale_payment_method_enum AS ENUM ('cash', 'card', 'mobile');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode VARCHAR(80);
  ALTER TABLE products ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5,2);
  ALTER TABLE products ADD COLUMN IF NOT EXISTS tax_method tax_method_enum DEFAULT 'exclusive';
EXCEPTION WHEN undefined_table THEN RAISE; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_barcode_unique
  ON products ((LOWER(barcode))) WHERE barcode IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_sku_unique
  ON products ((LOWER(sku)));
CREATE INDEX IF NOT EXISTS idx_products_name_trgm
  ON products USING GIN (name gin_trgm_ops);

ALTER TABLE sales ADD COLUMN IF NOT EXISTS legacy_payment_method TEXT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS subtotal NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS discount_total NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS tax_total NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS grand_total NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS invoice_discount_type discount_type_enum NOT NULL DEFAULT 'none';
ALTER TABLE sales ADD COLUMN IF NOT EXISTS invoice_discount_value NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS invoice_tax_rate NUMERIC(5,2);
ALTER TABLE sales ADD COLUMN IF NOT EXISTS invoice_tax_method tax_method_enum;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS paid_total NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS due_total NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS refunded_total NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS status sale_status_enum NOT NULL DEFAULT 'unpaid';

ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS line_discount_type discount_type_enum NOT NULL DEFAULT 'none';
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS line_discount_value NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS line_discount_amount NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS line_tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0;
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS line_tax_amount NUMERIC(14,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS sale_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  method sale_payment_method_enum NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  reference VARCHAR(120),
  meta JSONB,
  created_by UUID,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sale_payments_sale_id ON sale_payments(sale_id);

ALTER TABLE sales_returns ADD COLUMN IF NOT EXISTS credit_note_number VARCHAR(40);
ALTER TABLE sales_returns ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE sales_returns ADD COLUMN IF NOT EXISTS created_by_user_id UUID;
CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_returns_credit_note_number
  ON sales_returns(credit_note_number) WHERE credit_note_number IS NOT NULL;

CREATE TABLE IF NOT EXISTS sales_return_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_return_id UUID NOT NULL REFERENCES sales_returns(id) ON DELETE CASCADE,
  method sale_payment_method_enum NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  reference VARCHAR(120),
  meta JSONB,
  created_by UUID,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE purchase_returns ADD COLUMN IF NOT EXISTS debit_note_number VARCHAR(40);
ALTER TABLE purchase_returns ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE purchase_returns ADD COLUMN IF NOT EXISTS created_by_user_id UUID;
CREATE UNIQUE INDEX IF NOT EXISTS idx_purchase_returns_debit_note_number
  ON purchase_returns(debit_note_number) WHERE debit_note_number IS NOT NULL;

DO $$ BEGIN
  CREATE TYPE stock_ledger_reason_enum AS ENUM (
    'sale','sale_return','purchase','purchase_return','manual_adjustment','stock_transfer_in','stock_transfer_out'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE stock_ledger_ref_type_enum AS ENUM (
    'sale','sale_return','purchase','purchase_return','stock_transfer','product','branch_product'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS stock_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  qty_delta INTEGER NOT NULL,
  reason stock_ledger_reason_enum NOT NULL,
  ref_type stock_ledger_ref_type_enum NOT NULL,
  ref_id UUID NOT NULL,
  created_by UUID,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_stock_ledger_product_id ON stock_ledger(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_ledger_branch_id ON stock_ledger(branch_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID,
  action VARCHAR(120) NOT NULL,
  entity VARCHAR(120) NOT NULL,
  entity_id VARCHAR(120) NOT NULL,
  before JSONB,
  after JSONB,
  request_id VARCHAR(120),
  correlation_id VARCHAR(120),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity);
CREATE INDEX IF NOT EXISTS idx_audit_logs_request_id ON audit_logs(request_id);

CREATE TABLE IF NOT EXISTS invoice_sequences (
  key VARCHAR(32) PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Finance trust layer core tables
CREATE TABLE IF NOT EXISTS finance_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(160) NOT NULL,
  account_type VARCHAR(30) NOT NULL CHECK (account_type IN ('asset','liability','equity','revenue','expense')),
  sub_type VARCHAR(80),
  is_contra BOOLEAN NOT NULL DEFAULT FALSE,
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS finance_parties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_type VARCHAR(20) NOT NULL CHECK (party_type IN ('customer','supplier','both','other')),
  display_name VARCHAR(160) NOT NULL,
  phone VARCHAR(40),
  email VARCHAR(160),
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS finance_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_no VARCHAR(40) NOT NULL UNIQUE,
  document_type VARCHAR(30) NOT NULL CHECK (document_type IN ('sales_invoice','purchase_bill','credit_note','debit_note')),
  party_id UUID NOT NULL REFERENCES finance_parties(id) ON DELETE RESTRICT,
  sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
  purchase_id UUID REFERENCES purchases(id) ON DELETE SET NULL,
  issue_date DATE NOT NULL,
  due_date DATE,
  subtotal NUMERIC(14,2) NOT NULL,
  tax_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(14,2) NOT NULL,
  balance_due NUMERIC(14,2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('draft','open','partial','paid','void')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_finance_invoices_status ON finance_invoices(status);

CREATE TABLE IF NOT EXISTS journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_no VARCHAR(40) NOT NULL UNIQUE,
  entry_date DATE NOT NULL,
  source_type VARCHAR(40) NOT NULL,
  source_id VARCHAR(80),
  description TEXT,
  idempotency_key VARCHAR(120) UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','posted','reversed')),
  posted_at TIMESTAMP,
  posted_by UUID,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS journal_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  line_no INTEGER NOT NULL,
  account_id UUID NOT NULL REFERENCES finance_accounts(id) ON DELETE RESTRICT,
  party_id UUID REFERENCES finance_parties(id) ON DELETE SET NULL,
  debit NUMERIC(14,2) NOT NULL DEFAULT 0,
  credit NUMERIC(14,2) NOT NULL DEFAULT 0,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  memo TEXT,
  CHECK ((debit = 0 AND credit > 0) OR (credit = 0 AND debit > 0))
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_journal_lines_entry_line_no ON journal_lines(journal_entry_id, line_no);

CREATE TABLE IF NOT EXISTS wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('cash','bank','mobile_money')),
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  opening_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  current_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE RESTRICT,
  txn_date DATE NOT NULL,
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('in','out')),
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  reference_type VARCHAR(40),
  reference_id VARCHAR(80),
  description TEXT,
  idempotency_key VARCHAR(120) UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bank_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE RESTRICT,
  statement_ref VARCHAR(80) NOT NULL UNIQUE,
  period_from DATE,
  period_to DATE,
  imported_by UUID,
  imported_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bank_statement_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_id UUID NOT NULL REFERENCES bank_statements(id) ON DELETE CASCADE,
  line_no INTEGER NOT NULL,
  txn_date DATE NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  external_ref VARCHAR(160),
  description TEXT,
  counterparty_name VARCHAR(160),
  match_status VARCHAR(20) NOT NULL DEFAULT 'unmatched' CHECK (match_status IN ('unmatched','partially_matched','matched')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reconciliation_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_line_id UUID NOT NULL REFERENCES bank_statement_lines(id) ON DELETE CASCADE,
  wallet_transaction_id UUID REFERENCES wallet_transactions(id) ON DELETE SET NULL,
  journal_entry_id UUID REFERENCES journal_entries(id) ON DELETE SET NULL,
  matched_amount NUMERIC(14,2) NOT NULL,
  confidence_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  matched_by UUID,
  matched_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS finance_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id UUID REFERENCES finance_parties(id) ON DELETE SET NULL,
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE RESTRICT,
  direction VARCHAR(20) NOT NULL CHECK (direction IN ('receipt','disbursement','refund')),
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('cash','card','mobile','bank_transfer')),
  payment_reference VARCHAR(160),
  processor_token VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','posted','reversed','failed')),
  posted_journal_entry_id UUID REFERENCES journal_entries(id) ON DELETE SET NULL,
  idempotency_key VARCHAR(120) UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payment_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES finance_payments(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES finance_invoices(id) ON DELETE CASCADE,
  allocated_amount NUMERIC(14,2) NOT NULL CHECK (allocated_amount > 0),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope VARCHAR(80) NOT NULL,
  idempotency_key VARCHAR(120) NOT NULL UNIQUE,
  request_hash VARCHAR(120) NOT NULL,
  response_entity_id VARCHAR(120),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

COMMIT;
