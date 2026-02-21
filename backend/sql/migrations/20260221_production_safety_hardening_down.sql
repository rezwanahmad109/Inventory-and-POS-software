-- 20260221_production_safety_hardening_down.sql

BEGIN;

DROP TRIGGER IF EXISTS trg_inventory_movements_append_only ON inventory_movements;
DROP FUNCTION IF EXISTS fn_inventory_movements_append_only;

DROP TRIGGER IF EXISTS trg_block_locked_period_posting ON journal_entries;
DROP FUNCTION IF EXISTS fn_block_locked_period_posting;

DROP TRIGGER IF EXISTS trg_journal_balance_entry ON journal_entries;
DROP TRIGGER IF EXISTS trg_journal_balance_line ON journal_lines;
DROP FUNCTION IF EXISTS fn_journal_balance_entry_trigger;
DROP FUNCTION IF EXISTS fn_journal_balance_line_trigger;
DROP FUNCTION IF EXISTS fn_validate_journal_balance;

DROP TRIGGER IF EXISTS trg_journal_line_immutable ON journal_lines;
DROP FUNCTION IF EXISTS fn_journal_line_immutable;

DROP TRIGGER IF EXISTS trg_journal_entry_immutable ON journal_entries;
DROP FUNCTION IF EXISTS fn_journal_entry_immutable;

DROP TRIGGER IF EXISTS trg_journal_validate_reversal ON journal_entries;
DROP FUNCTION IF EXISTS fn_journal_validate_reversal;

DROP INDEX IF EXISTS ux_journal_entries_reversal_of_id;
ALTER TABLE journal_entries DROP COLUMN IF EXISTS reversal_of_id;

ALTER TABLE finance_invoices DROP CONSTRAINT IF EXISTS chk_finance_invoices_invoice_balance_non_negative;
ALTER TABLE finance_invoices DROP COLUMN IF EXISTS invoice_balance;

ALTER TABLE customers DROP COLUMN IF EXISTS credit_limit;
ALTER TABLE customers DROP COLUMN IF EXISTS credit_terms_days;

ALTER TABLE stock_transfers DROP COLUMN IF EXISTS cost_snapshot;

ALTER TABLE purchase_return_items DROP CONSTRAINT IF EXISTS chk_purchase_return_items_warehouse_required;
ALTER TABLE sales_return_items DROP CONSTRAINT IF EXISTS chk_sales_return_items_warehouse_required;
ALTER TABLE sale_items DROP CONSTRAINT IF EXISTS chk_sale_items_invoiced_not_exceed_delivered;
ALTER TABLE sale_items DROP CONSTRAINT IF EXISTS chk_sale_items_delivered_not_exceed_quantity;
ALTER TABLE sale_items DROP CONSTRAINT IF EXISTS chk_sale_items_warehouse_required;
ALTER TABLE purchase_items DROP CONSTRAINT IF EXISTS chk_purchase_items_warehouse_required;

ALTER TABLE purchase_return_items DROP CONSTRAINT IF EXISTS fk_purchase_return_items_warehouse;
ALTER TABLE sales_return_items DROP CONSTRAINT IF EXISTS fk_sales_return_items_warehouse;
ALTER TABLE sale_items DROP CONSTRAINT IF EXISTS fk_sale_items_warehouse;
ALTER TABLE purchase_items DROP CONSTRAINT IF EXISTS fk_purchase_items_warehouse;

DROP INDEX IF EXISTS idx_purchase_return_items_warehouse_id;
DROP INDEX IF EXISTS idx_sales_return_items_warehouse_id;
DROP INDEX IF EXISTS idx_sale_items_warehouse_id;
DROP INDEX IF EXISTS idx_purchase_items_warehouse_id;

DROP TABLE IF EXISTS sale_delivery_items;
DROP TABLE IF EXISTS sale_deliveries;

ALTER TABLE sale_items DROP COLUMN IF EXISTS invoiced_quantity;
ALTER TABLE sale_items DROP COLUMN IF EXISTS delivered_quantity;

ALTER TABLE purchase_return_items DROP COLUMN IF EXISTS warehouse_id;
ALTER TABLE sales_return_items DROP COLUMN IF EXISTS warehouse_id;
ALTER TABLE sale_items DROP COLUMN IF EXISTS warehouse_id;
ALTER TABLE purchase_items DROP COLUMN IF EXISTS warehouse_id;

DROP TABLE IF EXISTS inventory_movements;
DROP TABLE IF EXISTS inventory_cost_layers;
DROP TABLE IF EXISTS outbox_events;
DROP TABLE IF EXISTS period_locks;

DROP TYPE IF EXISTS inventory_movement_direction_enum;
DROP TYPE IF EXISTS outbox_event_status_enum;

COMMIT;
