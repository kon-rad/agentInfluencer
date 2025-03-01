import db from '../database.js';

// Function to create migrations table
const createMigrationsTable = () => {
  return new Promise((resolve, reject) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        migration_name TEXT NOT NULL,
        executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};

// Function to check if a migration has been executed
const hasMigrationRun = async (migrationName) => {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT id FROM migrations WHERE migration_name = ?',
      [migrationName],
      (err, row) => {
        if (err) reject(err);
        else resolve(!!row);
      }
    );
  });
};

// Function to record a migration
const recordMigration = async (migrationName) => {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO migrations (migration_name) VALUES (?)',
      [migrationName],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
};

// Main migration runner
export const runMigrations = async () => {
  console.log('Running migrations...');
  
  try {
    await createMigrationsTable();
    
    // List all migrations in order
    const migrations = [
      {
        name: '001_initial_schema',
        up: async () => {
          return new Promise((resolve, reject) => {
            db.serialize(() => {
              // Create agents table
              db.run(`CREATE TABLE IF NOT EXISTS agents (
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
              )`);

              // Create agent_thoughts table with agent_id
              db.run(`CREATE TABLE IF NOT EXISTS agent_thoughts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                agent_id INTEGER NOT NULL,
                type TEXT NOT NULL,
                content TEXT NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                model_name TEXT,
                FOREIGN KEY (agent_id) REFERENCES agents (id)
              )`);

              // Create agent_actions table
              db.run(`CREATE TABLE IF NOT EXISTS agent_actions (
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
              )`);

              // Create agent_tools table
              db.run(`CREATE TABLE IF NOT EXISTS agent_tools (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                agent_id INTEGER NOT NULL,
                tool_name TEXT NOT NULL,
                parameters TEXT,
                description TEXT NOT NULL,
                usage_format TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (agent_id) REFERENCES agents (id)
              )`);

              // Create tweets table
              db.run(`CREATE TABLE IF NOT EXISTS tweets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                campaign_id INTEGER,
                content TEXT NOT NULL,
                media_urls TEXT,
                scheduled_for DATETIME,
                published_at DATETIME,
                likes INTEGER DEFAULT 0,
                retweets INTEGER DEFAULT 0,
                replies INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (campaign_id) REFERENCES campaigns (id)
              )`);

              // Create campaigns table with all needed columns from the start
              db.run(`CREATE TABLE IF NOT EXISTS campaigns (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT,
                status TEXT DEFAULT 'draft',
                reward TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
              )`);

              // Create agent_logs table
              db.run(`CREATE TABLE IF NOT EXISTS agent_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                campaign_id INTEGER,
                action_type TEXT NOT NULL,
                thought_process TEXT,
                result TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (campaign_id) REFERENCES campaigns (id)
              )`);

              // Create news_articles table
              db.run(`CREATE TABLE IF NOT EXISTS news_articles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                url TEXT NOT NULL,
                content TEXT,
                summary TEXT,
                source TEXT,
                published_at TEXT,
                fetched_at TEXT NOT NULL,
                tags TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
              )`);

              // Create twitter_trends table
              db.run(`CREATE TABLE IF NOT EXISTS twitter_trends (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                content TEXT NOT NULL,
                author TEXT,
                created_at DATETIME,
                stored_at DATETIME DEFAULT CURRENT_TIMESTAMP
              )`);

              resolve();
            });
          });
        }
      },
      {
        name: '002_add_agent_id_to_thoughts',
        up: async () => {
          return new Promise((resolve, reject) => {
            db.serialize(() => {
              // Drop existing agent_thoughts table if it exists
              db.run(`DROP TABLE IF EXISTS agent_thoughts`);

              // Recreate agent_thoughts table with correct schema
              db.run(`CREATE TABLE agent_thoughts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                agent_id INTEGER NOT NULL,
                type TEXT NOT NULL,
                content TEXT NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                model_name TEXT,
                FOREIGN KEY (agent_id) REFERENCES agents (id)
              )`);

              resolve();
            });
          });
        }
      },
      {
        name: '003_agents_table',
        up: async () => {
          return new Promise((resolve, reject) => {
            db.run(`
              CREATE TABLE IF NOT EXISTS agents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                personality TEXT NOT NULL,
                model_name TEXT NOT NULL,
                frequency INTEGER NOT NULL,
                telegram_bot_token TEXT,
                tools JSON,
                is_running BOOLEAN DEFAULT 0,
                last_run DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
              )
            `, (err) => {
              if (err) reject(err);
              else resolve();
            });
          });
        },
        down: async () => {
          return new Promise((resolve, reject) => {
            db.run(`DROP TABLE IF EXISTS agents`, (err) => {
              if (err) reject(err);
              else resolve();
            });
          });
        }
      },
      {
        name: '004_add_new_column_to_agent_thoughts',
        up: async () => {
          return new Promise((resolve, reject) => {
            db.run(`ALTER TABLE agent_thoughts ADD COLUMN new_column_name TEXT`, (err) => {
              if (err) reject(err);
              else resolve();
            });
          });
        },
        down: async () => {
          // SQLite does not support dropping columns directly, so this is a placeholder
          // You would need to recreate the table without the column if you need to rollback
        }
      },
      {
        name: '007_add_agent_id_to_multiple_tables',
        up: async () => {
          return new Promise((resolve, reject) => {
            db.serialize(() => {
              // Add agent_id to agent_tools
              db.run(`ALTER TABLE agent_tools ADD COLUMN agent_id INTEGER REFERENCES agents(id)`, (err) => {
                if (err) {
                  console.error('Error adding agent_id to agent_tools:', err);
                  reject(err);
                  return;
                }
              });

              // Add agent_id to agent_config
              db.run(`ALTER TABLE agent_config ADD COLUMN agent_id INTEGER REFERENCES agents(id)`, (err) => {
                if (err) {
                  console.error('Error adding agent_id to agent_config:', err);
                  reject(err);
                  return;
                }
              });

              // Add agent_id to agent_logs
              db.run(`ALTER TABLE agent_logs ADD COLUMN agent_id INTEGER REFERENCES agents(id)`, (err) => {
                if (err) {
                  console.error('Error adding agent_id to agent_logs:', err);
                  reject(err);
                  return;
                }
              });

              // Add agent_id to campaigns
              db.run(`ALTER TABLE campaigns ADD COLUMN agent_id INTEGER REFERENCES agents(id)`, (err) => {
                if (err) {
                  console.error('Error adding agent_id to campaigns:', err);
                  reject(err);
                  return;
                }
              });

              // Add agent_id to news_articles
              db.run(`ALTER TABLE news_articles ADD COLUMN agent_id INTEGER REFERENCES agents(id)`, (err) => {
                if (err) {
                  console.error('Error adding agent_id to news_articles:', err);
                  reject(err);
                  return;
                }
              });

              // Add agent_id to twitter_trends
              db.run(`ALTER TABLE twitter_trends ADD COLUMN agent_id INTEGER REFERENCES agents(id)`, (err) => {
                if (err) {
                  console.error('Error adding agent_id to twitter_trends:', err);
                  reject(err);
                  return;
                }
              });

              resolve();
            });
          });
        },
        down: async () => {
          // SQLite does not support dropping columns directly, so this is a placeholder
          // You would need to recreate the table without the column if you need to rollback
        }
      },
      {
        name: '008_create_agent_news_table',
        up: async () => {
          return new Promise((resolve, reject) => {
            db.run(`
              CREATE TABLE IF NOT EXISTS agent_news (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                agent_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                source TEXT NOT NULL,
                published_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (agent_id) REFERENCES agents (id)
              )
            `, (err) => {
              if (err) reject(err);
              else resolve();
            });
          });
        }
      },
      {
        name: '009_create_agent_actions_table',
        up: async () => {
          return new Promise((resolve, reject) => {
            db.run(`
              CREATE TABLE IF NOT EXISTS agent_actions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                agent_id INTEGER NOT NULL,
                action_type TEXT NOT NULL,
                tool_name TEXT,
                parameters TEXT,
                status TEXT DEFAULT 'pending',
                result TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                completed_at DATETIME,
                FOREIGN KEY (agent_id) REFERENCES agents (id)
              )
            `, (err) => {
              if (err) reject(err);
              else resolve();
            });
          });
        }
      },
      {
        name: '010_add_wallet_id_and_seed_to_agents',
        up: async () => {
          return new Promise((resolve, reject) => {
            db.serialize(() => {
              db.run(`
                ALTER TABLE agents
                ADD COLUMN wallet_id TEXT
              `, (err) => {
                if (err) {
                  console.error('Error adding wallet_id to agents:', err);
                  reject(err);
                  return;
                }

                db.run(`
                  ALTER TABLE agents
                  ADD COLUMN wallet_seed TEXT
                `, (err) => {
                  if (err) {
                    console.error('Error adding wallet_seed to agents:', err);
                    reject(err);
                    return;
                  }
                  resolve();
                });
              });
            });
          });
        },
        down: async () => {
          return new Promise((resolve, reject) => {
            db.serialize(() => {
              db.run(`
                ALTER TABLE agents
                DROP COLUMN wallet_id
              `, (err) => {
                if (err) {
                  console.error('Error dropping wallet_id from agents:', err);
                  reject(err);
                  return;
                }

                db.run(`
                  ALTER TABLE agents
                  DROP COLUMN wallet_seed
                `, (err) => {
                  if (err) {
                    console.error('Error dropping wallet_seed from agents:', err);
                    reject(err);
                    return;
                  }
                  resolve();
                });
              });
            });
          });
        }
      },
      {
        name: '011_add_wallet_address_to_agents',
        up: async () => {
          return new Promise((resolve, reject) => {
            db.run(`
              ALTER TABLE agents
              ADD COLUMN wallet_address TEXT
            `, (err) => {
              if (err) {
                console.error('Error adding wallet_address to agents:', err);
                reject(err);
                return;
              }
              resolve();
            });
          });
        },
        down: async () => {
          return new Promise((resolve, reject) => {
            db.run(`
              ALTER TABLE agents
              DROP COLUMN wallet_address
            `, (err) => {
              if (err) {
                console.error('Error dropping wallet_address from agents:', err);
                reject(err);
                return;
              }
              resolve();
            });
          });
        }
      },
      {
        name: '012_create_agent_id_tools_table',
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
        },
        down: async () => {
          return new Promise((resolve, reject) => {
            db.run('DROP TABLE IF EXISTS agent_id_tools', (err) => {
              if (err) reject(err);
              else resolve();
            });
          });
        }
      }
    ];

    // Run each migration if it hasn't been run yet
    for (const migration of migrations) {
      const hasRun = await hasMigrationRun(migration.name);
      if (!hasRun) {
        console.log(`Running migration: ${migration.name}`);
        await migration.up();
        await recordMigration(migration.name);
        console.log(`Completed migration: ${migration.name}`);
      } else {
        console.log(`Skipping migration: ${migration.name} (already executed)`);
      }
    }

    console.log('All migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}; 