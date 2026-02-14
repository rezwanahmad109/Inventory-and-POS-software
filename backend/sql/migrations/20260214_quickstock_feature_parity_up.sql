DO $$ BEGIN
  CREATE TYPE sale_document_type_enum AS ENUM ('invoice', 'quotation');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE purchase_document_type_enum AS ENUM ('bill', 'estimate');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE quotation_status_enum AS ENUM ('draft', 'active', 'expired', 'converted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE purchase_status_enum AS ENUM ('unpaid', 'partial', 'paid', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS document_type sale_document_type_enum NOT NULL DEFAULT 'invoice',
  ADD COLUMN IF NOT EXISTS quotation_status quotation_status_enum,
  ADD COLUMN IF NOT EXISTS valid_until DATE,
  ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS converted_to_sale_id UUID,
  ADD COLUMN IF NOT EXISTS shipping_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS document_type purchase_document_type_enum NOT NULL DEFAULT 'bill',
  ADD COLUMN IF NOT EXISTS quotation_status quotation_status_enum,
  ADD COLUMN IF NOT EXISTS valid_until DATE,
  ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS converted_to_purchase_id UUID,
  ADD COLUMN IF NOT EXISTS subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS grand_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS due_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status purchase_status_enum NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS purchase_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  method VARCHAR(20) NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  reference VARCHAR(120),
  meta JSONB,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchase_payments_purchase_id
  ON purchase_payments(purchase_id);

ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS total_payable NUMERIC(14,2) NOT NULL DEFAULT 0;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS brand VARCHAR(120),
  ADD COLUMN IF NOT EXISTS additional_barcodes JSONB,
  ADD COLUMN IF NOT EXISTS variation_attributes JSONB;

CREATE TABLE IF NOT EXISTS expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS attachments JSONB;

ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS currencies JSONB,
  ADD COLUMN IF NOT EXISTS payment_modes JSONB,
  ADD COLUMN IF NOT EXISTS email_notification_settings JSONB;

CREATE TABLE IF NOT EXISTS pos_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number VARCHAR(40) NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'cart',
  branch_id UUID,
  customer_name VARCHAR(160),
  customer_id INTEGER,
  items JSONB NOT NULL,
  invoice_discount_type VARCHAR(20) NOT NULL DEFAULT 'none',
  invoice_discount_value NUMERIC(14,2) NOT NULL DEFAULT 0,
  invoice_tax_rate NUMERIC(5,2),
  invoice_tax_method VARCHAR(20),
  shipping_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  grand_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  invoice_id UUID,
  note TEXT,
  created_by_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pos_orders_status ON pos_orders(status);
CREATE INDEX IF NOT EXISTS idx_pos_orders_created_at ON pos_orders(created_at DESC);
