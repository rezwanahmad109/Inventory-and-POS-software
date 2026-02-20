DROP INDEX IF EXISTS idx_users_refresh_token_jti_hash;

ALTER TABLE users
  DROP COLUMN IF EXISTS refresh_token_jti_hash;
