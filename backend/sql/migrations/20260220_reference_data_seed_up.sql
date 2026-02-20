DO $$
BEGIN
  IF to_regclass('public.roles') IS NOT NULL THEN
    INSERT INTO roles (name, description, is_system, created_at, updated_at)
    SELECT 'super_admin', 'super admin role', true, NOW(), NOW()
    WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'super_admin');

    INSERT INTO roles (name, description, is_system, created_at, updated_at)
    SELECT 'admin', 'admin role', true, NOW(), NOW()
    WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'admin');

    INSERT INTO roles (name, description, is_system, created_at, updated_at)
    SELECT 'manager', 'manager role', true, NOW(), NOW()
    WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'manager');

    INSERT INTO roles (name, description, is_system, created_at, updated_at)
    SELECT 'branch_manager', 'branch manager role', true, NOW(), NOW()
    WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'branch_manager');

    INSERT INTO roles (name, description, is_system, created_at, updated_at)
    SELECT 'stock_admin', 'stock admin role', true, NOW(), NOW()
    WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'stock_admin');

    INSERT INTO roles (name, description, is_system, created_at, updated_at)
    SELECT 'cashier', 'cashier role', true, NOW(), NOW()
    WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'cashier');

    INSERT INTO roles (name, description, is_system, created_at, updated_at)
    SELECT 'viewer', 'viewer role', true, NOW(), NOW()
    WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'viewer');
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.units') IS NOT NULL THEN
    INSERT INTO units (name, symbol, conversion_factor, description, created_at, updated_at)
    SELECT 'Piece', 'pc', 1, 'Single piece unit', NOW(), NOW()
    WHERE NOT EXISTS (SELECT 1 FROM units WHERE LOWER(name) = 'piece');

    INSERT INTO units (name, symbol, conversion_factor, description, created_at, updated_at)
    SELECT 'Kilogram', 'kg', 1, 'Weight unit in kilograms', NOW(), NOW()
    WHERE NOT EXISTS (SELECT 1 FROM units WHERE LOWER(name) = 'kilogram');

    INSERT INTO units (name, symbol, conversion_factor, description, created_at, updated_at)
    SELECT 'Liter', 'l', 1, 'Volume unit in liters', NOW(), NOW()
    WHERE NOT EXISTS (SELECT 1 FROM units WHERE LOWER(name) = 'liter');

    INSERT INTO units (name, symbol, conversion_factor, description, created_at, updated_at)
    SELECT 'Box', 'box', 1, 'Box pack unit', NOW(), NOW()
    WHERE NOT EXISTS (SELECT 1 FROM units WHERE LOWER(name) = 'box');
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.taxes') IS NOT NULL THEN
    INSERT INTO taxes (name, rate, is_inclusive, is_default, is_active, created_at, updated_at)
    SELECT 'VAT 0%', 0, false, true, true, NOW(), NOW()
    WHERE NOT EXISTS (SELECT 1 FROM taxes WHERE LOWER(name) = 'vat 0%');

    INSERT INTO taxes (name, rate, is_inclusive, is_default, is_active, created_at, updated_at)
    SELECT 'VAT 5%', 0.05, false, false, true, NOW(), NOW()
    WHERE NOT EXISTS (SELECT 1 FROM taxes WHERE LOWER(name) = 'vat 5%');

    INSERT INTO taxes (name, rate, is_inclusive, is_default, is_active, created_at, updated_at)
    SELECT 'VAT 15%', 0.15, false, false, true, NOW(), NOW()
    WHERE NOT EXISTS (SELECT 1 FROM taxes WHERE LOWER(name) = 'vat 15%');
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.settings') IS NOT NULL THEN
    UPDATE settings
    SET currencies = '[
      {"code":"USD","symbol":"$","position":"left","isDefault":true},
      {"code":"EUR","symbol":"EUR","position":"left","isDefault":false}
    ]'::jsonb
    WHERE currencies IS NULL;
  END IF;
END $$;
