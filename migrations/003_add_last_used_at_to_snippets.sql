ALTER TABLE snippets ADD COLUMN last_used_at TIMESTAMP NULL;

CREATE INDEX IF NOT EXISTS idx_snippets_last_used_at ON snippets(last_used_at);
