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
                personality TEXT DEFAULT 'You are a friendly and knowledgeable Web3 DevRel agent focused on Base L2 network.',
                frequency INTEGER DEFAULT 3600000,
                last_run DATETIME,
                model_name TEXT DEFAULT 'gpt-4-turbo-preview',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
              )`);

              // Create agent_tools table with all needed columns from the start
              db.run(`CREATE TABLE IF NOT EXISTS agent_tools (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tool_name TEXT NOT NULL,
                parameters TEXT,
                description TEXT NOT NULL,
                usage_format TEXT,
                example TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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

              // Create agent_actions table
              db.run(`CREATE TABLE IF NOT EXISTS agent_actions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                action_type TEXT NOT NULL,
                tool_name TEXT,
                parameters TEXT,
                status TEXT DEFAULT 'pending',
                result TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
              )`);

              // Consolidate into a single agents table
              db.run(`CREATE TABLE IF NOT EXISTS agents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT,
                image_url TEXT,
                personality TEXT DEFAULT 'You are a friendly and knowledgeable Web3 DevRel agent focused on Base L2 network.',
                model_name TEXT DEFAULT 'gpt-4-turbo-preview',
                frequency INTEGER DEFAULT 3600000,
                telegram_bot_token TEXT,
                tools JSON,
                is_running BOOLEAN DEFAULT 0,
                last_run DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
              )`);
            });
            resolve();
          });
        }
      },
      {
        name: '002_insert_default_tools',
        up: async () => {
          return new Promise((resolve, reject) => {
            db.serialize(() => {
              // Insert default tools
              db.run(`INSERT INTO agent_tools (
                tool_name, 
                parameters, 
                description, 
                usage_format,
                created_at, 
                updated_at
              ) VALUES (?, ?, ?, ?, ?, ?)`,
              [
                'NewsAnalysisTool',
                '{}',
                'Fetches recent Web3 news articles from Cointelegraph. No parameters required.',
                'ACTION: NewsAnalysisTool\nPARAMETERS: {}\nREASON: To fetch and analyze recent Web3 news',
                new Date().toISOString(),
                new Date().toISOString()
              ]);

              // Insert default agent configuration
              db.run(`INSERT INTO agent_config (
                is_running,
                personality,
                frequency,
                model_name,
                created_at,
                updated_at
              ) VALUES (?, ?, ?, ?, ?, ?)`,
              [
                0,
                'You are a friendly and knowledgeable Web3 DevRel agent focused on Base L2 network.',
                3600000,
                'gpt-4-turbo-preview',
                new Date().toISOString(),
                new Date().toISOString()
              ]);
            });
            resolve();
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