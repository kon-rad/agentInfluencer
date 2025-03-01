CREATE TABLE IF NOT EXISTS agents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  is_running BOOLEAN DEFAULT 0,
  model_name TEXT,
  personality TEXT,
  frequency TEXT,
  telegram_bot_token TEXT,
  tools TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_run DATETIME
); 