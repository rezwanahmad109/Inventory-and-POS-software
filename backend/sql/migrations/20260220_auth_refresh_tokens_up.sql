ALTER TABLE users
  ADD COLUMN IF NOT EXISTS refresh_token_hash TEXT NULL,
  ADD COLUMN IF NOT EXISTS refresh_token_issued_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_users_refresh_token_issued_at
  ON users (refresh_token_issued_at);
