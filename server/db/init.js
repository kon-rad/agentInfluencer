import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import logger from '../utils/logger.js';
import defaultTools from '../data/defaultTools.js';

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
        wallet_id TEXT,
        wallet_seed TEXT,
        wallet_address TEXT
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
        tool_name TEXT,
        parameters TEXT,
        status TEXT DEFAULT 'pending',
        result TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
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

    // Create agent_tools table with correct schema
    await db.exec(`
      CREATE TABLE IF NOT EXISTS agent_tools (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id INTEGER,
        tool_name TEXT NOT NULL,
        description TEXT NOT NULL,
        parameters TEXT,
        usage_format TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create campaigns table for bounties
    await db.exec(`
      CREATE TABLE IF NOT EXISTS campaigns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'active',
        reward TEXT,
        deadline TEXT,
        tweet_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create tweets table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS tweets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        campaign_id INTEGER,
        content TEXT NOT NULL,
        media_urls TEXT,
        tweet_id TEXT,
        published_at DATETIME,
        likes INTEGER DEFAULT 0,
        retweets INTEGER DEFAULT 0,
        replies INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (campaign_id) REFERENCES campaigns (id)
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

    // Seed default tools if they don't exist
    for (const tool of defaultTools) {
      const existingTool = await db.get('SELECT id FROM agent_tools WHERE tool_name = ?', [tool.tool_name]);
      
      if (!existingTool) {
        await db.run(`
          INSERT INTO agent_tools (
            tool_name, description, parameters, usage_format, created_at, updated_at
          ) VALUES (?, ?, ?, ?, DATETIME('now'), DATETIME('now'))
        `, [
          tool.tool_name,
          tool.description,
          tool.parameters,
          tool.usage_format
        ]);
        logger.info(`Default tool inserted: ${tool.tool_name}`);
      }
    }

    logger.info('Database initialized successfully.');
    return db;
  } catch (error) {
    logger.error('Failed to initialize database:', error);
    throw error;
  }
}

export default initializeDatabase; 