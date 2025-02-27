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

              // Create campaigns table
              db.run(`CREATE TABLE IF NOT EXISTS campaigns (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT,
                status TEXT DEFAULT 'draft',
                start_date DATETIME,
                end_date DATETIME,
                auto_generated BOOLEAN DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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

              // Create agent_thoughts table
              db.run(`CREATE TABLE IF NOT EXISTS agent_thoughts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT NOT NULL,
                content TEXT NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                model_name TEXT,
                campaign_id INTEGER,
                FOREIGN KEY (campaign_id) REFERENCES campaigns (id)
              )`);

              // Create agent_config table
              db.run(`CREATE TABLE IF NOT EXISTS agent_config (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                is_running BOOLEAN DEFAULT 0,
                personality TEXT,
                frequency INTEGER DEFAULT 3600000,
                last_run DATETIME,
                model_name TEXT DEFAULT 'meta-llama/Meta-Llama-3-8B-Instruct',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
              )`);
            });
            resolve();
          });
        }
      },
      {
        name: '002_add_reward_to_campaigns',
        up: async () => {
          return new Promise((resolve, reject) => {
            db.run(`ALTER TABLE campaigns ADD COLUMN reward TEXT;`, (err) => {
              if (err && !err.message.includes('duplicate column name')) {
                reject(err);
              } else {
                resolve();
              }
            });
          });
        }
      },
      {
        name: '003_add_updated_at_to_campaigns',
        up: async () => {
          return new Promise((resolve, reject) => {
            db.serialize(() => {
              // Drop existing campaigns table
              db.run(`DROP TABLE IF EXISTS campaigns`);
              
              // Create fresh campaigns table with all needed columns
              db.run(`
                CREATE TABLE campaigns (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  title TEXT NOT NULL,
                  description TEXT,
                  status TEXT DEFAULT 'draft',
                  reward TEXT,
                  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
              `, (err) => {
                if (err) {
                  reject(err);
                } else {
                  resolve();
                }
              });
            });
          });
        }
      },
      {
        name: '003_add_news_articles_and_agent_tools',
        up: async () => {
          return new Promise((resolve, reject) => {
            db.serialize(() => {
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

              // Create agent_tools table
              db.run(`CREATE TABLE IF NOT EXISTS agent_tools (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tool_name TEXT NOT NULL,
                parameters TEXT,
                description TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
              )`);

              // Insert the news analysis tool into agent_tools
              db.run(`INSERT INTO agent_tools (tool_name, parameters, description, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?)`,
                [
                  'NewsAnalysisTool',
                  '{}',
                  'Fetches recent Web3 news articles from Cointelegraph. No parameters required.',
                  new Date().toISOString(),
                  new Date().toISOString()
                ],
                (err) => {
                  if (err) {
                    console.error('Error inserting news analysis tool:', err);
                  }
                }
              );
            });
            resolve();
          });
        }
      },
      {
        name: '004_add_agent_actions_and_update_tools',
        up: async () => {
          return new Promise((resolve, reject) => {
            db.serialize(() => {
              // Create agent_actions table
              db.run(`CREATE TABLE IF NOT EXISTS agent_actions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                action_type TEXT NOT NULL,
                tool_name TEXT,
                parameters TEXT,
                result TEXT,
                status TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                completed_at DATETIME
              )`);

              // Add usage_format column to agent_tools if it doesn't exist
              db.get("PRAGMA table_info(agent_tools)", [], (err, rows) => {
                if (err) {
                  console.error('Error checking agent_tools table:', err);
                  reject(err);
                  return;
                }
                
                // Check if usage_format column exists
                const hasUsageFormat = rows.some(row => row.name === 'usage_format');
                
                if (!hasUsageFormat) {
                  db.run(`ALTER TABLE agent_tools ADD COLUMN usage_format TEXT DEFAULT ''`, (err) => {
                    if (err) {
                      console.error('Error adding usage_format column:', err);
                      reject(err);
                      return;
                    }
                    
                    // Update existing tools with usage format
                    db.run(`UPDATE agent_tools SET 
                      usage_format = 'ACTION: NewsAnalysisTool\nPARAMETERS: {}\nREASON: Need to fetch the latest Web3 news'
                      WHERE tool_name = 'NewsAnalysisTool'`);
                  });
                }
              });
            });
            resolve();
          });
        }
      }
      // Add new migrations here
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