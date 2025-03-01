CREATE TABLE IF NOT EXISTS agents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  is_running BOOLEAN DEFAULT 0,
  model_name TEXT DEFAULT 'gpt-4-turbo-preview',
  personality TEXT,
  frequency INTEGER DEFAULT 3600000,
  telegram_bot_token TEXT,
  tools TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_run DATETIME
);

CREATE TABLE IF NOT EXISTS agent_thoughts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  model_name TEXT,
  FOREIGN KEY (agent_id) REFERENCES agents (id)
);

CREATE TABLE IF NOT EXISTS agent_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id INTEGER NOT NULL,
  action_type TEXT NOT NULL,
  tool_name TEXT,
  parameters TEXT,
  status TEXT,
  result TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  FOREIGN KEY (agent_id) REFERENCES agents (id)
);

CREATE TABLE IF NOT EXISTS agent_tools (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id INTEGER NOT NULL,
  tool_name TEXT NOT NULL,
  parameters TEXT,
  description TEXT NOT NULL,
  usage_format TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agent_id) REFERENCES agents (id)
); 