import db from '../database.js';
import toolRegistryService from './toolRegistryService.js';
import videoGenerationService from './videoGenerationService.js';

class AgentToolService {
  constructor() {
    this.db = db;
  }

  async getAgentTools(agentId) {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT at.* 
        FROM agent_tools at
        JOIN agent_id_tools ait ON at.id = ait.tool_id
        WHERE ait.agent_id = ?
      `, [agentId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  async setAgentTools(agentId, toolIds) {
    return new Promise(async (resolve, reject) => {
      try {
        // Begin transaction
        await new Promise((res, rej) => {
          db.run('BEGIN TRANSACTION', (err) => {
            if (err) rej(err);
            else res();
          });
        });

        // Clear existing tools
        await new Promise((res, rej) => {
          db.run('DELETE FROM agent_id_tools WHERE agent_id = ?', [agentId], (err) => {
            if (err) rej(err);
            else res();
          });
        });

        // Insert new tools
        for (const toolId of toolIds) {
          await new Promise((res, rej) => {
            db.run(
              'INSERT INTO agent_id_tools (agent_id, tool_id) VALUES (?, ?)',
              [agentId, toolId],
              (err) => {
                if (err) rej(err);
                else res();
              }
            );
          });
        }

        // Commit transaction
        await new Promise((res, rej) => {
          db.run('COMMIT', (err) => {
            if (err) rej(err);
            else res();
          });
        });

        resolve();
      } catch (error) {
        // Rollback on error
        await new Promise((res, rej) => {
          db.run('ROLLBACK', (err) => {
            if (err) rej(err);
            else res();
          });
        });
        reject(error);
      }
    });
  }
}

// Create and export a singleton instance
const agentToolService = new AgentToolService();
export default agentToolService;

// Add this to your available tools array
const availableTools = [
  // ... existing tools ...
  {
    tool_name: 'create_short_form_video',
    description: 'Creates a short-form video for social media marketing campaigns',
    usage_format: 'Provide a prompt describing the video content you want to create',
    parameters: JSON.stringify({
      prompt: 'string - Description of the video content to generate'
    }),
    handler: async (agentId, params) => {
      const { prompt } = params;
      return await videoGenerationService.createVideo(agentId, prompt);
    }
  }
]; 