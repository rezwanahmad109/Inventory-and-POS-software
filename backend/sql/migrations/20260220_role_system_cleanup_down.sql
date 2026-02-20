ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role_id UUID NULL;

DO $$
BEGIN
  IF to_regclass('public.roles') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.table_constraints
      WHERE table_schema = 'public'
        AND table_name = 'users'
        AND constraint_name = 'fk_users_role_id'
    ) THEN
      ALTER TABLE users
        ADD CONSTRAINT fk_users_role_id
        FOREIGN KEY (role_id)
        REFERENCES roles(id)
        ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_role_id
  ON users (role_id);
