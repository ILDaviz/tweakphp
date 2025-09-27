CREATE TABLE snippets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    tab_id INTEGER,
    tab_name TEXT,
    tags TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_snippets_name ON snippets(name);
CREATE INDEX IF NOT EXISTS idx_snippets_tab_name ON snippets(tab_name);
CREATE INDEX IF NOT EXISTS idx_snippets_code ON snippets(code);