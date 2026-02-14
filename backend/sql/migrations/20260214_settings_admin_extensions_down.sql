ALTER TABLE settings
  DROP COLUMN IF EXISTS stock_policy,
  DROP COLUMN IF EXISTS discount_rules,
  DROP COLUMN IF EXISTS tax_settings,
  DROP COLUMN IF EXISTS invoice_template,
  DROP COLUMN IF EXISTS business_profile;
