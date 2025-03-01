{
  name: '010_create_agent_id_tools_table',
  up: async () => {
    return new Promise((resolve, reject) => {
      db.run(`
        CREATE TABLE IF NOT EXISTS agent_id_tools (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          agent_id INTEGER NOT NULL,
          tool_id INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (agent_id) REFERENCES agents(id),
          FOREIGN KEY (tool_id) REFERENCES agent_tools(id),
          UNIQUE(agent_id, tool_id)
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
} 