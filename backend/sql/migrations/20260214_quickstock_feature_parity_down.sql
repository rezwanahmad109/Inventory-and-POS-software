DROP INDEX IF EXISTS idx_pos_orders_created_at;
DROP INDEX IF EXISTS idx_pos_orders_status;
DROP TABLE IF EXISTS pos_orders;

ALTER TABLE settings
  DROP COLUMN IF EXISTS email_notification_settings,
  DROP COLUMN IF EXISTS payment_modes,
  DROP COLUMN IF EXISTS currencies;

ALTER TABLE expenses
  DROP COLUMN IF EXISTS attachments;

DROP TABLE IF EXISTS expense_categories;

ALTER TABLE products
  DROP COLUMN IF EXISTS variation_attributes,
  DROP COLUMN IF EXISTS additional_barcodes,
  DROP COLUMN IF EXISTS brand;

ALTER TABLE suppliers
  DROP COLUMN IF EXISTS total_payable;

DROP INDEX IF EXISTS idx_purchase_payments_purchase_id;
DROP TABLE IF EXISTS purchase_payments;

ALTER TABLE purchases
  DROP COLUMN IF EXISTS updated_at,
  DROP COLUMN IF EXISTS notes,
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS due_total,
  DROP COLUMN IF EXISTS paid_total,
  DROP COLUMN IF EXISTS grand_total,
  DROP COLUMN IF EXISTS tax_total,
  DROP COLUMN IF EXISTS discount_total,
  DROP COLUMN IF EXISTS subtotal,
  DROP COLUMN IF EXISTS converted_to_purchase_id,
  DROP COLUMN IF EXISTS converted_at,
  DROP COLUMN IF EXISTS valid_until,
  DROP COLUMN IF EXISTS quotation_status,
  DROP COLUMN IF EXISTS document_type;

ALTER TABLE sales
  DROP COLUMN IF EXISTS updated_at,
  DROP COLUMN IF EXISTS notes,
  DROP COLUMN IF EXISTS shipping_total,
  DROP COLUMN IF EXISTS converted_to_sale_id,
  DROP COLUMN IF EXISTS converted_at,
  DROP COLUMN IF EXISTS valid_until,
  DROP COLUMN IF EXISTS quotation_status,
  DROP COLUMN IF EXISTS document_type;

DROP TYPE IF EXISTS purchase_status_enum;
DROP TYPE IF EXISTS quotation_status_enum;
DROP TYPE IF EXISTS purchase_document_type_enum;
DROP TYPE IF EXISTS sale_document_type_enum;
