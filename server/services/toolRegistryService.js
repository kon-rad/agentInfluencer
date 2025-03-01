import db from '../database.js';
import newsAnalysisService from './newsAnalysisService.js';
import twitterTrendService from './twitterTrendService.js';
import twitterService from './twitterService.js';
import telegramService from './telegramService.js';

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

    // Register Twitter-related tools
    await this.registerTool('TwitterPostTool', {
      description: "Posts a tweet to the agent's Twitter account",
      parameters: {
        content: "string - The content of the tweet (max 280 characters)",
        media_urls: "array - Optional array of media URLs to attach to the tweet"
      },
      execute: async (params, agentId) => {
        try {
          const { content, media_urls } = params;
          
          if (!content) {
            throw new Error("Tweet content is required");
          }
          
          // Get the agent to retrieve Twitter credentials
          const agent = await this.getAgentById(agentId);
          if (!agent) {
            throw new Error(`Agent ${agentId} not found`);
          }
          
          // Post the tweet
          const result = await twitterService.postTweet(content, media_urls);
          
          return {
            success: true,
            tweet_id: result.id,
            message: "Tweet posted successfully"
          };
        } catch (error) {
          console.error("Error posting tweet:", error);
          return {
            success: false,
            error: error.message
          };
        }
      }
    });

    await this.registerTool('CreateBountyTool', {
      description: "Creates a new bounty for content creators and posts it to Twitter",
      parameters: {
        title: "string - The title of the bounty",
        description: "string - Detailed description of what the bounty requires",
        reward: "string - The reward amount (e.g., '0.1 ETH')",
        deadline: "string - Deadline in ISO format (e.g., '2023-12-31T23:59:59Z')"
      },
      execute: async (params, agentId) => {
        try {
          const { title, description, reward, deadline } = params;
          
          if (!title || !description || !reward) {
            throw new Error("Title, description, and reward are required for creating a bounty");
          }
          
          // Create the campaign in the database
          const campaignId = await this.createCampaign(title, description, reward, deadline);
          
          // Compose the tweet content
          const tweetContent = `🏆 NEW BOUNTY: ${title}\n\n${description}\n\nReward: ${reward}\nDeadline: ${new Date(deadline).toLocaleDateString()}\n\n#BaseL2 #Web3 #DevRel`;
          
          // Post to Twitter
          const tweetResult = await twitterService.postTweet(tweetContent);
          
          // Update the campaign with the tweet ID
          await this.updateCampaignTweetId(campaignId, tweetResult.id);
          
          // Get the agent to retrieve Telegram credentials
          const agent = await this.getAgentById(agentId);
          if (agent && agent.telegram_bot_token) {
            // Post to Telegram if configured
            await telegramService.sendMessage(
              agent.telegram_bot_token,
              `🏆 NEW BOUNTY: ${title}\n\n${description}\n\nReward: ${reward}\nDeadline: ${new Date(deadline).toLocaleDateString()}\n\nCheck Twitter for more details!`
            );
          }
          
          return {
            success: true,
            campaign_id: campaignId,
            tweet_id: tweetResult.id,
            message: "Bounty created and posted successfully"
          };
        } catch (error) {
          console.error("Error creating bounty:", error);
          return {
            success: false,
            error: error.message
          };
        }
      }
    });

    await this.registerTool('CheckBountySubmissionsTool', {
      description: "Checks Twitter for replies to a bounty tweet and evaluates if they meet the requirements",
      parameters: {
        tweet_id: "string - The ID of the original bounty tweet",
        requirements: "array - List of requirements that submissions must meet"
      },
      execute: async (params, agentId) => {
        try {
          const { tweet_id, requirements } = params;
          
          if (!tweet_id || !requirements || !Array.isArray(requirements)) {
            throw new Error("Tweet ID and requirements array are required");
          }
          
          // Get replies to the tweet
          const replies = await twitterService.getTweetReplies(tweet_id);
          
          // Evaluate each reply against the requirements
          const evaluatedReplies = await Promise.all(replies.map(async (reply) => {
            // For each reply, check if it meets all requirements
            const evaluation = await this.evaluateSubmission(reply, requirements);
            
            return {
              reply_id: reply.id,
              user: reply.user.screen_name,
              content: reply.text,
              meets_requirements: evaluation.meets_all,
              evaluation: evaluation.details
            };
          }));
          
          // Filter for valid submissions
          const validSubmissions = evaluatedReplies.filter(reply => reply.meets_requirements);
          
          return {
            success: true,
            total_replies: replies.length,
            valid_submissions: validSubmissions.length,
            submissions: evaluatedReplies
          };
        } catch (error) {
          console.error("Error checking bounty submissions:", error);
          return {
            success: false,
            error: error.message
          };
        }
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

  // Helper methods for the tools
  async createCampaign(title, description, reward, deadline) {
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO campaigns (title, description, reward, deadline, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [title, description, reward, deadline, 'active', new Date().toISOString(), new Date().toISOString()],
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

  async updateCampaignTweetId(campaignId, tweetId) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE campaigns SET tweet_id = ? WHERE id = ?',
        [tweetId, campaignId],
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

  async getAgentById(agentId) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM agents WHERE id = ?', [agentId], (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(row);
      });
    });
  }

  async evaluateSubmission(reply, requirements) {
    // This would be more sophisticated in a real implementation
    // For now, we'll do a simple check if the reply text contains keywords from requirements
    const details = requirements.map(req => {
      const keywords = req.toLowerCase().split(' ');
      const matches = keywords.some(keyword => 
        reply.text.toLowerCase().includes(keyword) && keyword.length > 3
      );
      
      return {
        requirement: req,
        met: matches,
        reason: matches ? 
          `Reply contains keywords related to this requirement` : 
          `Reply does not address this requirement`
      };
    });
    
    const meetsAll = details.every(d => d.met);
    
    return {
      meets_all: meetsAll,
      details
    };
  }
}

// Create and export a singleton instance
const toolRegistryService = new ToolRegistryService();
export default toolRegistryService; 