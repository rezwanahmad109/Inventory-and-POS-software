ALTER TABLE users
  ADD COLUMN IF NOT EXISTS refresh_token_jti_hash TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_users_refresh_token_jti_hash
  ON users (refresh_token_jti_hash);
