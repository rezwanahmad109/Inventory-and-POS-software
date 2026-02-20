DO $$
BEGIN
  IF to_regclass('public.products') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_products_category_id ON products (category_id);
    CREATE INDEX IF NOT EXISTS idx_products_unit_id ON products (unit_id);
    CREATE INDEX IF NOT EXISTS idx_products_default_warehouse_id ON products (default_warehouse_id);
    CREATE INDEX IF NOT EXISTS idx_products_created_at ON products (created_at);
    CREATE INDEX IF NOT EXISTS idx_products_updated_at ON products (updated_at);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.branch_products') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_branch_products_branch_id ON branch_products (branch_id);
    CREATE INDEX IF NOT EXISTS idx_branch_products_product_id ON branch_products (product_id);
    CREATE INDEX IF NOT EXISTS idx_branch_products_updated_at ON branch_products (updated_at);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.sales') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_sales_branch_id ON sales (branch_id);
    CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON sales (customer_id);
    CREATE INDEX IF NOT EXISTS idx_sales_created_by_user_id ON sales (created_by_user_id);
    CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales (created_at);
    CREATE INDEX IF NOT EXISTS idx_sales_valid_until ON sales (valid_until);
    CREATE INDEX IF NOT EXISTS idx_sales_converted_at ON sales (converted_at);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.sale_items') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items (sale_id);
    CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON sale_items (product_id);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.purchases') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_purchases_supplier_id ON purchases (supplier_id);
    CREATE INDEX IF NOT EXISTS idx_purchases_branch_id ON purchases (branch_id);
    CREATE INDEX IF NOT EXISTS idx_purchases_created_at ON purchases (created_at);
    CREATE INDEX IF NOT EXISTS idx_purchases_valid_until ON purchases (valid_until);
    CREATE INDEX IF NOT EXISTS idx_purchases_converted_at ON purchases (converted_at);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.purchase_items') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase_id ON purchase_items (purchase_id);
    CREATE INDEX IF NOT EXISTS idx_purchase_items_product_id ON purchase_items (product_id);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.sales_returns') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_sales_returns_original_sale_id ON sales_returns (original_sale_id);
    CREATE INDEX IF NOT EXISTS idx_sales_returns_created_at ON sales_returns (created_at);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.sales_return_items') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_sales_return_items_sales_return_id ON sales_return_items (sales_return_id);
    CREATE INDEX IF NOT EXISTS idx_sales_return_items_product_id ON sales_return_items (product_id);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.purchase_returns') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_purchase_returns_original_purchase_id ON purchase_returns (original_purchase_id);
    CREATE INDEX IF NOT EXISTS idx_purchase_returns_created_at ON purchase_returns (created_at);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.purchase_return_items') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_purchase_return_items_purchase_return_id ON purchase_return_items (purchase_return_id);
    CREATE INDEX IF NOT EXISTS idx_purchase_return_items_product_id ON purchase_return_items (product_id);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.wallets') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_wallets_is_active ON wallets (is_active);
    CREATE INDEX IF NOT EXISTS idx_wallets_created_at ON wallets (created_at);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.wallet_transactions') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_id ON wallet_transactions (wallet_id);
    CREATE INDEX IF NOT EXISTS idx_wallet_transactions_txn_date ON wallet_transactions (txn_date);
    CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created_at ON wallet_transactions (created_at);
    CREATE INDEX IF NOT EXISTS idx_wallet_transactions_reference_id ON wallet_transactions (reference_id);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.file_attachments') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_file_attachments_resource ON file_attachments (resource_type, resource_id);
    CREATE INDEX IF NOT EXISTS idx_file_attachments_uploaded_by ON file_attachments (uploaded_by);
    CREATE INDEX IF NOT EXISTS idx_file_attachments_created_at ON file_attachments (created_at);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.email_templates') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_email_templates_created_at ON email_templates (created_at);
    CREATE INDEX IF NOT EXISTS idx_email_templates_updated_at ON email_templates (updated_at);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.taxes') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_taxes_is_default ON taxes (is_default);
    CREATE INDEX IF NOT EXISTS idx_taxes_is_active ON taxes (is_active);
    CREATE INDEX IF NOT EXISTS idx_taxes_updated_at ON taxes (updated_at);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.units') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_units_name ON units (name);
    CREATE INDEX IF NOT EXISTS idx_units_symbol ON units (symbol);
  END IF;
END $$;
