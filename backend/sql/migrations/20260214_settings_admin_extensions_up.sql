ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS business_profile JSONB,
  ADD COLUMN IF NOT EXISTS invoice_template JSONB,
  ADD COLUMN IF NOT EXISTS tax_settings JSONB,
  ADD COLUMN IF NOT EXISTS discount_rules JSONB,
  ADD COLUMN IF NOT EXISTS stock_policy JSONB;

UPDATE settings
SET business_profile = COALESCE(
      business_profile,
      jsonb_build_object(
        'businessName', business_name,
        'address', NULL,
        'contactEmail', NULL,
        'contactPhone', NULL,
        'website', NULL,
        'taxId', NULL
      )
    ),
    invoice_template = COALESCE(
      invoice_template,
      jsonb_build_object(
        'headerText', NULL,
        'footerText', footer_note,
        'logoUrl', logo_url,
        'invoicePrefix', 'INV',
        'nextNumber', 1
      )
    ),
    tax_settings = COALESCE(
      tax_settings,
      jsonb_build_array(
        jsonb_build_object(
          'branchId', NULL,
          'taxName', 'VAT',
          'taxRate', tax_rate,
          'isInclusive', false
        )
      )
    ),
    discount_rules = COALESCE(discount_rules, '[]'::jsonb),
    stock_policy = COALESCE(
      stock_policy,
      jsonb_build_object(
        'defaultLowStockThreshold', 0,
        'allowStockTransfers', true,
        'allowNegativeStock', false,
        'autoReorderEnabled', false
      )
    );
