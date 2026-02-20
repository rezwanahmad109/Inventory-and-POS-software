DO $$
BEGIN
  IF to_regclass('public.settings') IS NOT NULL THEN
    UPDATE settings
    SET currencies = NULL
    WHERE currencies = '[
      {"code":"USD","symbol":"$","position":"left","isDefault":true},
      {"code":"EUR","symbol":"EUR","position":"left","isDefault":false}
    ]'::jsonb;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.taxes') IS NOT NULL THEN
    DELETE FROM taxes
    WHERE name IN ('VAT 0%', 'VAT 5%', 'VAT 15%');
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.units') IS NOT NULL THEN
    DELETE FROM units
    WHERE name IN ('Piece', 'Kilogram', 'Liter', 'Box');
  END IF;
END $$;
