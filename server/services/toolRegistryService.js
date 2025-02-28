import db from '../database.js';
import newsAnalysisService from './newsAnalysisService.js';
import twitterTrendService from './twitterTrendService.js';

class ToolRegistryService {
  constructor() {
    this.tools = new Map();
  }

  async initialize() {
    console.log('Initializing tool registry service...');
    await this.registerBuiltInTools();
  }

  async registerBuiltInTools() {
    // Register the NewsAnalysisTool
    await this.registerTool('NewsAnalysisTool', {
      description: 'Fetches recent Web3 news articles from Cointelegraph. No parameters required.',
      parameters: {},
      usage_format: 'ACTION: NewsAnalysisTool\nPARAMETERS: {}\nREASON: To fetch and analyze recent Web3 news'
    });

    // Register the TwitterTrendTool
    await this.registerTool('TwitterTrendTool', {
      description: 'Fetches current Web3 trends from Twitter',
      execute: async (params = {}) => {
        return await twitterTrendService.fetchTwitterTrends();
      }
    });
  }

  registerTool(name, toolConfig) {
    this.tools.set(name, toolConfig);
    
    // Update or insert the tool in the database
    return new Promise((resolve, reject) => {
      db.get('SELECT id FROM agent_tools WHERE tool_name = ?', [name], (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        
        const now = new Date().toISOString();
        
        if (row) {
          // Update existing tool
          db.run(
            'UPDATE agent_tools SET description = ?, parameters = ?, updated_at = ? WHERE tool_name = ?',
            [toolConfig.description, JSON.stringify(toolConfig.parameters || {}), now, name],
            (err) => {
              if (err) {
                reject(err);
                return;
              }
              resolve();
            }
          );
        } else {
          // Insert new tool
          db.run(
            'INSERT INTO agent_tools (tool_name, description, parameters, usage_format, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
            [
              name,
              toolConfig.description,
              JSON.stringify(toolConfig.parameters || {}),
              toolConfig.usage_format || `ACTION: ${name}\nPARAMETERS: {}\nREASON: Explain why you're using this tool`,
              now,
              now
            ],
            (err) => {
              if (err) {
                reject(err);
                return;
              }
              resolve();
            }
          );
        }
      });
    });
  }

  async getRegisteredTools() {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM agent_tools', [], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows || []);
      });
    });
  }

  async executeTool(toolName, parameters = {}) {
    // Record the action start
    const actionId = await this.recordToolAction(toolName, parameters);
    
    try {
      // Get the tool from the registry
      const tool = this.tools.get(toolName);
      
      if (!tool) {
        throw new Error(`Tool not found: ${toolName}`);
      }
      
      // Execute the tool
      const result = await tool.execute(parameters);
      
      // Update the action record with success
      await this.updateToolAction(actionId, 'completed', result);
      
      return result;
    } catch (error) {
      // Update the action record with failure
      await this.updateToolAction(actionId, 'failed', error.message);
      throw error;
    }
  }

  async recordToolAction(toolName, parameters) {
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO agent_actions (action_type, tool_name, parameters, status, created_at) VALUES (?, ?, ?, ?, ?)',
        ['tool_execution', toolName, JSON.stringify(parameters), 'started', new Date().toISOString()],
        function(err) {
          if (err) {
            reject(err);
            return;
          }
          resolve(this.lastID);
        }
      );
    });
  }

  async updateToolAction(actionId, status, result) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE agent_actions SET status = ?, result = ?, completed_at = ? WHERE id = ?',
        [status, JSON.stringify(result), new Date().toISOString(), actionId],
        function(err) {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        }
      );
    });
  }

  async getRecentActions(limit = 7) {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM agent_actions ORDER BY created_at DESC LIMIT ?',
        [limit],
        (err, rows) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(rows || []);
        }
      );
    });
  }
}

// Create and export a singleton instance
const toolRegistryService = new ToolRegistryService();
export default toolRegistryService; 