DROP INDEX IF EXISTS idx_users_refresh_token_issued_at;

ALTER TABLE users
  DROP COLUMN IF EXISTS refresh_token_issued_at,
  DROP COLUMN IF EXISTS refresh_token_hash;
