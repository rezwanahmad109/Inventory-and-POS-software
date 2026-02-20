DO $$
DECLARE
  fk_record RECORD;
BEGIN
  FOR fk_record IN
    SELECT tc.constraint_name
    FROM information_schema.table_constraints tc
    INNER JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'users'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'role_id'
  LOOP
    EXECUTE format('ALTER TABLE users DROP CONSTRAINT IF EXISTS %I', fk_record.constraint_name);
  END LOOP;
END $$;

DO $$
DECLARE
  idx_record RECORD;
BEGIN
  FOR idx_record IN
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'users'
      AND indexdef ILIKE '%role_id%'
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS %I', idx_record.indexname);
  END LOOP;
END $$;

ALTER TABLE users
  DROP COLUMN IF EXISTS role_id;
