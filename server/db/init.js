import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import logger from '../utils/logger.js';

async function initializeDatabase() {
  try {
    const db = await open({
      filename: './database.db',
      driver: sqlite3.Database
    });

    // Enable foreign key support
    await db.exec('PRAGMA foreign_keys = ON;');

    // Create agents table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS agents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        personality TEXT,
        model_name TEXT,
        frequency INTEGER,
        telegram_bot_token TEXT,
        tools TEXT,
        is_running INTEGER DEFAULT 0,
        created_at DATETIME,
        updated_at DATETIME,
        wallet_id TEXT,  -- Add wallet_id field
        wallet_seed TEXT   -- Add wallet_seed field
      )
    `);

    // Create agent_config table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS agent_config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        personality TEXT,
        frequency INTEGER,
        model_name TEXT,
        is_running INTEGER DEFAULT 0,
        created_at DATETIME,
        updated_at DATETIME
      )
    `);

    // Create agent_thoughts table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS agent_thoughts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id INTEGER,
        type TEXT,
        content TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        model_name TEXT,
        FOREIGN KEY (agent_id) REFERENCES agents(id)
      )
    `);

    // Create agent_actions table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS agent_actions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id INTEGER,
        action_type TEXT,
        description TEXT,
        details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (agent_id) REFERENCES agents(id)
      )
    `);

    // Create agent_news table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS agent_news (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id INTEGER,
        title TEXT,
        content TEXT,
        source TEXT,
        published_at DATETIME,
        FOREIGN KEY (agent_id) REFERENCES agents(id)
      )
    `);

    // Insert default agent configuration if it doesn't exist
    const defaultConfig = await db.get('SELECT COUNT(*) as count FROM agent_config WHERE id = 1');
    if (defaultConfig.count === 0) {
      await db.run(`
        INSERT INTO agent_config (
          id, personality, frequency, model_name, is_running, created_at, updated_at
        ) VALUES (
          1,
          'You are a helpful AI assistant.',
          3600000,
          'gpt-4-turbo-preview',
          0,
          DATETIME('now'),
          DATETIME('now')
        )
      `);
      logger.info('Default agent configuration inserted.');
    }

    logger.info('Database initialized successfully.');
    return db;
  } catch (error) {
    logger.error('Failed to initialize database:', error);
    throw error;
  }
}

export default initializeDatabase; 