-- 20260221_production_safety_hardening_up.sql
-- Production safety hardening for finance, inventory, and reliability.

BEGIN;

DO $$ BEGIN
  CREATE TYPE outbox_event_status_enum AS ENUM ('pending', 'processing', 'processed', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE inventory_movement_direction_enum AS ENUM ('in', 'out');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS period_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_locked BOOLEAN NOT NULL DEFAULT TRUE,
  reason TEXT,
  locked_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_period_locks_date_range CHECK (start_date <= end_date)
);
CREATE INDEX IF NOT EXISTS idx_period_locks_start_date ON period_locks(start_date);
CREATE INDEX IF NOT EXISTS idx_period_locks_end_date ON period_locks(end_date);

CREATE TABLE IF NOT EXISTS outbox_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(80) NOT NULL,
  payload JSONB NOT NULL,
  idempotency_key VARCHAR(160),
  source_type VARCHAR(80),
  source_id VARCHAR(120),
  status outbox_event_status_enum NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  next_attempt_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_outbox_events_idempotency_key
  ON outbox_events(idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_outbox_events_status ON outbox_events(status);
CREATE INDEX IF NOT EXISTS idx_outbox_events_next_attempt_at ON outbox_events(next_attempt_at);

CREATE TABLE IF NOT EXISTS inventory_cost_layers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  warehouse_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  original_quantity INTEGER NOT NULL,
  remaining_quantity INTEGER NOT NULL,
  unit_cost NUMERIC(14,4) NOT NULL CHECK (unit_cost >= 0),
  source_type VARCHAR(40) NOT NULL,
  source_id VARCHAR(120) NOT NULL,
  source_line_id UUID,
  parent_layer_id UUID REFERENCES inventory_cost_layers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_inventory_cost_layers_quantities
    CHECK (
      original_quantity > 0
      AND remaining_quantity >= 0
      AND remaining_quantity <= original_quantity
    )
);
CREATE INDEX IF NOT EXISTS idx_inventory_cost_layers_product_id
  ON inventory_cost_layers(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_cost_layers_warehouse_id
  ON inventory_cost_layers(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inventory_cost_layers_fifo
  ON inventory_cost_layers(product_id, warehouse_id, created_at);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  warehouse_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  direction inventory_movement_direction_enum NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_cost NUMERIC(14,4) NOT NULL CHECK (unit_cost >= 0),
  total_cost NUMERIC(14,2) NOT NULL CHECK (total_cost >= 0),
  reference_type VARCHAR(40) NOT NULL,
  reference_id VARCHAR(120) NOT NULL,
  reference_line_id UUID,
  source_cost_layer_id UUID REFERENCES inventory_cost_layers(id) ON DELETE SET NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_product_id
  ON inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_warehouse_id
  ON inventory_movements(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_reference
  ON inventory_movements(reference_type, reference_id);

ALTER TABLE journal_entries
  ADD COLUMN IF NOT EXISTS reversal_of_id UUID REFERENCES journal_entries(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS ux_journal_entries_reversal_of_id
  ON journal_entries(reversal_of_id)
  WHERE reversal_of_id IS NOT NULL;

ALTER TABLE finance_invoices
  ADD COLUMN IF NOT EXISTS invoice_balance NUMERIC(14,2);
UPDATE finance_invoices
SET invoice_balance = COALESCE(invoice_balance, balance_due);
ALTER TABLE finance_invoices
  ALTER COLUMN invoice_balance SET DEFAULT 0;
ALTER TABLE finance_invoices
  ALTER COLUMN invoice_balance SET NOT NULL;
DO $$ BEGIN
  ALTER TABLE finance_invoices
    ADD CONSTRAINT chk_finance_invoices_invoice_balance_non_negative
      CHECK (invoice_balance >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(12,2);
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS credit_terms_days INTEGER;

ALTER TABLE stock_transfers
  ADD COLUMN IF NOT EXISTS cost_snapshot JSONB;

ALTER TABLE purchase_items
  ADD COLUMN IF NOT EXISTS warehouse_id UUID;
ALTER TABLE sale_items
  ADD COLUMN IF NOT EXISTS warehouse_id UUID;
ALTER TABLE sales_return_items
  ADD COLUMN IF NOT EXISTS warehouse_id UUID;
ALTER TABLE purchase_return_items
  ADD COLUMN IF NOT EXISTS warehouse_id UUID;

ALTER TABLE sale_items
  ADD COLUMN IF NOT EXISTS delivered_quantity INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sale_items
  ADD COLUMN IF NOT EXISTS invoiced_quantity INTEGER NOT NULL DEFAULT 0;

UPDATE sale_items
SET delivered_quantity = GREATEST(delivered_quantity, 0),
    invoiced_quantity = GREATEST(invoiced_quantity, 0);

UPDATE sale_items si
SET delivered_quantity = si.quantity,
    invoiced_quantity = si.quantity
FROM sales s
WHERE s.id = si.sale_id
  AND s.document_type::text = 'invoice'
  AND si.delivered_quantity = 0
  AND si.invoiced_quantity = 0;

UPDATE purchase_items pi
SET warehouse_id = p.branch_id
FROM purchases p
WHERE p.id = pi.purchase_id
  AND pi.warehouse_id IS NULL
  AND p.branch_id IS NOT NULL;

UPDATE purchase_items pi
SET warehouse_id = pr.default_warehouse_id
FROM products pr
WHERE pr.id = pi.product_id
  AND pi.warehouse_id IS NULL
  AND pr.default_warehouse_id IS NOT NULL;

UPDATE sale_items si
SET warehouse_id = s.branch_id
FROM sales s
WHERE s.id = si.sale_id
  AND si.warehouse_id IS NULL
  AND s.branch_id IS NOT NULL;

UPDATE sale_items si
SET warehouse_id = pr.default_warehouse_id
FROM products pr
WHERE pr.id = si.product_id
  AND si.warehouse_id IS NULL
  AND pr.default_warehouse_id IS NOT NULL;

UPDATE sales_return_items sri
SET warehouse_id = s.branch_id
FROM sales_returns sr
INNER JOIN sales s ON s.id = sr.original_sale_id
WHERE sr.id = sri.sales_return_id
  AND sri.warehouse_id IS NULL
  AND s.branch_id IS NOT NULL;

UPDATE sales_return_items sri
SET warehouse_id = pr.default_warehouse_id
FROM products pr
WHERE pr.id = sri.product_id
  AND sri.warehouse_id IS NULL
  AND pr.default_warehouse_id IS NOT NULL;

UPDATE purchase_return_items pri
SET warehouse_id = p.branch_id
FROM purchase_returns prt
INNER JOIN purchases p ON p.id = prt.original_purchase_id
WHERE prt.id = pri.purchase_return_id
  AND pri.warehouse_id IS NULL
  AND p.branch_id IS NOT NULL;

UPDATE purchase_return_items pri
SET warehouse_id = pr.default_warehouse_id
FROM products pr
WHERE pr.id = pri.product_id
  AND pri.warehouse_id IS NULL
  AND pr.default_warehouse_id IS NOT NULL;

DO $$ BEGIN
  ALTER TABLE purchase_items
    ADD CONSTRAINT fk_purchase_items_warehouse
      FOREIGN KEY (warehouse_id) REFERENCES branches(id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE sale_items
    ADD CONSTRAINT fk_sale_items_warehouse
      FOREIGN KEY (warehouse_id) REFERENCES branches(id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE sales_return_items
    ADD CONSTRAINT fk_sales_return_items_warehouse
      FOREIGN KEY (warehouse_id) REFERENCES branches(id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE purchase_return_items
    ADD CONSTRAINT fk_purchase_return_items_warehouse
      FOREIGN KEY (warehouse_id) REFERENCES branches(id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE purchase_items
    ADD CONSTRAINT chk_purchase_items_warehouse_required
      CHECK (warehouse_id IS NOT NULL) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE sale_items
    ADD CONSTRAINT chk_sale_items_warehouse_required
      CHECK (warehouse_id IS NOT NULL) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE sale_items
    ADD CONSTRAINT chk_sale_items_delivered_not_exceed_quantity
      CHECK (
        delivered_quantity >= 0
        AND delivered_quantity <= quantity
      ) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE sale_items
    ADD CONSTRAINT chk_sale_items_invoiced_not_exceed_delivered
      CHECK (
        invoiced_quantity >= 0
        AND invoiced_quantity <= delivered_quantity
      ) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE sales_return_items
    ADD CONSTRAINT chk_sales_return_items_warehouse_required
      CHECK (warehouse_id IS NOT NULL) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE purchase_return_items
    ADD CONSTRAINT chk_purchase_return_items_warehouse_required
      CHECK (warehouse_id IS NOT NULL) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_purchase_items_warehouse_id ON purchase_items(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_warehouse_id ON sale_items(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_sales_return_items_warehouse_id ON sales_return_items(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_purchase_return_items_warehouse_id ON purchase_return_items(warehouse_id);

CREATE TABLE IF NOT EXISTS sale_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_number VARCHAR(40) NOT NULL UNIQUE,
  order_sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  total_cogs NUMERIC(14,2) NOT NULL DEFAULT 0,
  note TEXT,
  created_by_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sale_deliveries_delivery_number
  ON sale_deliveries(delivery_number);
CREATE INDEX IF NOT EXISTS idx_sale_deliveries_order_sale_id
  ON sale_deliveries(order_sale_id);

CREATE TABLE IF NOT EXISTS sale_delivery_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID NOT NULL REFERENCES sale_deliveries(id) ON DELETE CASCADE,
  order_item_id UUID NOT NULL REFERENCES sale_items(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  warehouse_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_cost NUMERIC(14,4) NOT NULL CHECK (unit_cost >= 0),
  total_cost NUMERIC(14,2) NOT NULL CHECK (total_cost >= 0)
);
CREATE INDEX IF NOT EXISTS idx_sale_delivery_items_delivery_id
  ON sale_delivery_items(delivery_id);
CREATE INDEX IF NOT EXISTS idx_sale_delivery_items_order_item_id
  ON sale_delivery_items(order_item_id);

CREATE OR REPLACE FUNCTION fn_journal_validate_reversal()
RETURNS trigger AS $$
DECLARE
  original_status TEXT;
BEGIN
  IF NEW.reversal_of_id IS NULL THEN
    IF NEW.source_type = 'journal_reversal' THEN
      RAISE EXCEPTION 'journal_reversal entries must include reversal_of_id';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.reversal_of_id = NEW.id THEN
    RAISE EXCEPTION 'A journal entry cannot reverse itself';
  END IF;

  SELECT status
    INTO original_status
  FROM journal_entries
  WHERE id = NEW.reversal_of_id;

  IF original_status IS NULL THEN
    RAISE EXCEPTION 'Referenced reversal_of_id % does not exist', NEW.reversal_of_id;
  END IF;

  IF original_status <> 'posted' THEN
    RAISE EXCEPTION 'Only posted entries can be reversed';
  END IF;

  IF NEW.source_type <> 'journal_reversal' THEN
    RAISE EXCEPTION 'Entries with reversal_of_id must use source_type journal_reversal';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_journal_validate_reversal ON journal_entries;
CREATE TRIGGER trg_journal_validate_reversal
BEFORE INSERT OR UPDATE OF reversal_of_id, source_type
ON journal_entries
FOR EACH ROW
EXECUTE FUNCTION fn_journal_validate_reversal();

CREATE OR REPLACE FUNCTION fn_journal_entry_immutable()
RETURNS trigger AS $$
BEGIN
  IF OLD.status = 'posted' THEN
    RAISE EXCEPTION 'Posted journal entries are immutable. Use reversal entries.';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_journal_entry_immutable ON journal_entries;
CREATE TRIGGER trg_journal_entry_immutable
BEFORE UPDATE OR DELETE
ON journal_entries
FOR EACH ROW
EXECUTE FUNCTION fn_journal_entry_immutable();

CREATE OR REPLACE FUNCTION fn_journal_line_immutable()
RETURNS trigger AS $$
DECLARE
  target_entry_id UUID;
  target_status TEXT;
BEGIN
  target_entry_id = COALESCE(NEW.journal_entry_id, OLD.journal_entry_id);

  SELECT status
    INTO target_status
  FROM journal_entries
  WHERE id = target_entry_id;

  IF target_status = 'posted' THEN
    RAISE EXCEPTION 'Posted journal lines are immutable. Use reversal entries.';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_journal_line_immutable ON journal_lines;
CREATE TRIGGER trg_journal_line_immutable
BEFORE UPDATE OR DELETE
ON journal_lines
FOR EACH ROW
EXECUTE FUNCTION fn_journal_line_immutable();

CREATE OR REPLACE FUNCTION fn_validate_journal_balance(entry_id UUID)
RETURNS void AS $$
DECLARE
  entry_status TEXT;
  debit_total NUMERIC(14,2);
  credit_total NUMERIC(14,2);
BEGIN
  SELECT status
    INTO entry_status
  FROM journal_entries
  WHERE id = entry_id;

  IF entry_status IS NULL OR entry_status <> 'posted' THEN
    RETURN;
  END IF;

  SELECT
    COALESCE(SUM(debit), 0),
    COALESCE(SUM(credit), 0)
  INTO debit_total, credit_total
  FROM journal_lines
  WHERE journal_entry_id = entry_id;

  IF debit_total <= 0 OR credit_total <= 0 OR debit_total <> credit_total THEN
    RAISE EXCEPTION
      'Journal entry % is unbalanced. debit=% credit=%',
      entry_id,
      debit_total,
      credit_total;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_journal_balance_line_trigger()
RETURNS trigger AS $$
BEGIN
  PERFORM fn_validate_journal_balance(COALESCE(NEW.journal_entry_id, OLD.journal_entry_id));
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_journal_balance_entry_trigger()
RETURNS trigger AS $$
BEGIN
  PERFORM fn_validate_journal_balance(COALESCE(NEW.id, OLD.id));
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_journal_balance_line ON journal_lines;
CREATE CONSTRAINT TRIGGER trg_journal_balance_line
AFTER INSERT OR UPDATE OR DELETE
ON journal_lines
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION fn_journal_balance_line_trigger();

DROP TRIGGER IF EXISTS trg_journal_balance_entry ON journal_entries;
CREATE CONSTRAINT TRIGGER trg_journal_balance_entry
AFTER INSERT OR UPDATE OF status
ON journal_entries
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION fn_journal_balance_entry_trigger();

CREATE OR REPLACE FUNCTION fn_block_locked_period_posting()
RETURNS trigger AS $$
DECLARE
  has_lock BOOLEAN;
BEGIN
  IF NEW.status <> 'posted' THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM period_locks lock_row
    WHERE lock_row.is_locked = TRUE
      AND NEW.entry_date BETWEEN lock_row.start_date AND lock_row.end_date
  ) INTO has_lock;

  IF has_lock THEN
    RAISE EXCEPTION 'Posting date % belongs to a locked period', NEW.entry_date;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_block_locked_period_posting ON journal_entries;
CREATE TRIGGER trg_block_locked_period_posting
BEFORE INSERT OR UPDATE OF status, entry_date
ON journal_entries
FOR EACH ROW
EXECUTE FUNCTION fn_block_locked_period_posting();

CREATE OR REPLACE FUNCTION fn_inventory_movements_append_only()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'inventory_movements is append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_inventory_movements_append_only ON inventory_movements;
CREATE TRIGGER trg_inventory_movements_append_only
BEFORE UPDATE OR DELETE
ON inventory_movements
FOR EACH ROW
EXECUTE FUNCTION fn_inventory_movements_append_only();

INSERT INTO finance_accounts (code, name, account_type, sub_type, is_contra, currency, is_active)
VALUES
  ('1000-CASH', 'Cash and Cash Equivalents', 'asset', 'cash', FALSE, 'USD', TRUE),
  ('1100-AR', 'Trade Receivables', 'asset', 'accounts_receivable', FALSE, 'USD', TRUE),
  ('1200-INVENTORY', 'Inventory', 'asset', 'inventory', FALSE, 'USD', TRUE),
  ('1300-INPUT-TAX', 'Input Tax Receivable', 'asset', 'tax_receivable', FALSE, 'USD', TRUE),
  ('2100-AP', 'Trade Payables', 'liability', 'accounts_payable', FALSE, 'USD', TRUE),
  ('2200-OUTPUT-TAX', 'Output Tax Payable', 'liability', 'tax_payable', FALSE, 'USD', TRUE),
  ('3000-EQUITY', 'Owner Equity', 'equity', 'capital', FALSE, 'USD', TRUE),
  ('4000-SALES', 'Sales Revenue', 'revenue', 'operating_revenue', FALSE, 'USD', TRUE),
  ('5000-COGS', 'Cost of Goods Sold', 'expense', 'cogs', FALSE, 'USD', TRUE),
  ('6100-EXPENSE', 'Operating Expense', 'expense', 'operating_expense', FALSE, 'USD', TRUE)
ON CONFLICT (code) DO NOTHING;

COMMIT;
