import db from '../database.js';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import Together from 'together-ai';
import newsAnalysisService from './newsAnalysisService.js';
import toolRegistryService from './toolRegistryService.js';
import farcasterService from './farcasterService.js';
import TelegramBot from 'node-telegram-bot-api';

dotenv.config();

// Together AI API key
const TOGETHER_API_KEY = process.env.TOGETHER_API_KEY;

// Add your Telegram bot token here
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID; // Channel ID or username

// Initialize the Telegram bot
const telegramBot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: false });

class AgentBrainService {
  constructor() {
    this.runningAgents = new Map(); // Track running agent instances
    this.together = new Together(TOGETHER_API_KEY);
    this.checkInterval = 60000; // 60 seconds
  }

  async initialize() {
    try {
      // Start the check interval
      this.startCheckInterval();
    } catch (error) {
      console.error('Error initializing agent brain service:', error);
    }
  }

  startCheckInterval() {
    this.intervalId = setInterval(async () => {
      try {
        // Check all agents and start/stop them as needed
        const agents = await this.getAllAgents();
        for (const agent of agents) {
          if (agent.is_running && !this.runningAgents.has(agent.id)) {
            this.startAgent(agent.id);
          } else if (!agent.is_running && this.runningAgents.has(agent.id)) {
            this.stopAgent(agent.id);
          }
        }
      } catch (error) {
        console.error('Error in agent check interval:', error);
      }
    }, this.checkInterval);
  }

  async getAllAgents() {
    return new Promise((resolve, reject) => {
      db.all('SELECT id, is_running FROM agents', [], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows || []);
      });
    });
  }

  async startAgent(agentId) {
    if (this.runningAgents.has(agentId)) {
      console.log(`Agent ${agentId} already running`);
      return;
    }

    const agent = await this.getAgentById(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    console.log(`Starting agent ${agentId}`);
    
    // Create interval for this specific agent
    const intervalId = setInterval(() => this.runAgentLoop(agentId), agent.frequency || 60000);
    this.runningAgents.set(agentId, intervalId);

    // Update agent status in database
    await this.updateAgentStatus(agentId, true);
    await this.logAgentThought(agentId, 'system', 'Agent started', 'system');

    // Force immediate first run
    this.runAgentLoop(agentId);
  }

  async stopAgent(agentId) {
    const intervalId = this.runningAgents.get(agentId);
    if (intervalId) {
      clearInterval(intervalId);
      this.runningAgents.delete(agentId);
      await this.updateAgentStatus(agentId, false);
      await this.logAgentThought(agentId, 'system', 'Agent stopped', 'system');
    }
  }

  async updateAgentStatus(agentId, isRunning) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE agents SET is_running = ?, updated_at = ? WHERE id = ?',
        [isRunning ? 1 : 0, new Date().toISOString(), agentId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  async getAgentTools(agentId) {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM agent_tools WHERE agent_id = ?', [agentId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  async getAgentById(agentId) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM agents WHERE id = ?', [agentId], (err, row) => {
        if (err) {
          console.error('Error getting agent:', err);
          reject(err);
          return;
        }
        if (row) {
          resolve({
            ...row,
            is_running: Boolean(row.is_running),
            tools: row.tools ? JSON.parse(row.tools) : []
          });
        } else {
          resolve(null);
        }
      });
    });
  }

  async getContext(agentId) {
    console.log('Gathering context for agent...');
    
    // Get recent tweets, campaigns, and other relevant data
    const recentTweets = await this.getRecentTweets();
    console.log(`Retrieved ${recentTweets.length} recent tweets`);
    
    const activeCampaigns = await this.getActiveCampaigns();
    console.log(`Retrieved ${activeCampaigns.length} active campaigns`);
    
    // Ensure we have fresh news and get recent articles
    await newsAnalysisService.ensureFreshNews();
    const recentNews = await newsAnalysisService.getRecentNews(3);
    console.log(`Retrieved ${recentNews.length} recent news articles`);
    
    const recentActions = await this.getRecentActions(agentId, 7);
    console.log(`Retrieved ${recentActions.length} recent agent actions`);

    const mindshareContext = '';
    
    return {
      recentTweets,
      activeCampaigns,
      recentNews,
      recentActions,
      mindshareContext,
      currentTime: new Date().toISOString()
    };
  }

  async getRecentActions(agentId, limit = 7) {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM agent_actions WHERE agent_id = ? ORDER BY created_at DESC LIMIT ?',
        [agentId, limit],
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

  async generatePrompt(context, personality, tools) {
    // Build the tool descriptions
    const toolDescriptions = tools.map(tool => `${tool.tool_name}: ${tool.description}`).join('\n');

    // Construct the prompt
    let prompt = `
    You are an AI DevRel agent for the Base L2 network. Your goal is to create engaging and valuable content for web3 developers, and to promote the DevRel protocol by incentivizing content creation through bounties.
    
    Here are the tools available to you:
    ${toolDescriptions}
    
    Here is some context to help you:
    ${JSON.stringify(context, null, 2)}
    
    Your personality:
    ${personality}
    
    Compose your next action. Structure your response like this:
    
    ACTION: The name of the tool you want to use.
    PARAMETERS: A JSON object containing the parameters for the tool.
    REASON: Explain why you are using this tool.
    `;
    
    return prompt;
  }

  async callTogetherAI(prompt, modelName) {
    try {
      const response = await this.together.chat.completions.create({
        model: modelName,
        messages: [{ role: "user", "content": prompt }],
        max_tokens: 512,
        temperature: 0.7,
        top_p: 0.7,
        repetition_penalty: 1,
      });
      
      return response.choices[0].message.content;
    } catch (error) {
      console.error('Error calling Together AI:', error);
      throw error;
    }
  }

  async logAgentThought(agentId, type, content, modelName) {
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO agent_thoughts (agent_id, type, content, model_name) VALUES (?, ?, ?, ?)',
        [agentId, type, content, modelName],
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

  async processResponse(agentId, response) {
    try {
      const action = this.parseAction(response);
      console.log('Parsed action:', action);
      
      if (!action || !action.ACTION) {
        console.log('No action found in response, skipping tool execution.');
        return;
      }
      
      const toolName = action.ACTION;
      const parameters = action.PARAMETERS || {};
      
      console.log(`Executing tool: ${toolName} with parameters:`, parameters);
      
      // Record the action
      const actionId = await this.recordToolAction(agentId, toolName, parameters);
      
      try {
        // Execute the tool
        const result = await toolRegistryService.executeTool(toolName, parameters);
        
        // Update the action with the result
        await this.updateToolAction(actionId, 'completed', result);
        
        console.log(`Tool ${toolName} executed successfully. Result:`, result);
      } catch (error) {
        console.error(`Error executing tool ${toolName}:`, error);
        await this.updateToolAction(actionId, 'failed', error.message);
      }
    } catch (error) {
      console.error('Error processing response:', error);
    }
  }

  parseAction(response) {
    try {
      const actionRegex = /ACTION:\s*(.+)/;
      const parametersRegex = /PARAMETERS:\s*({[\s\S]*?})/m;
      const reasonRegex = /REASON:\s*(.+)/;
      
      const actionMatch = response.match(actionRegex);
      const parametersMatch = response.match(parametersRegex);
      const reasonMatch = response.match(reasonRegex);
      
      const action = actionMatch ? actionMatch[1].trim() : null;
      const parameters = parametersMatch ? JSON.parse(parametersMatch[1]) : {};
      const reason = reasonMatch ? reasonMatch[1].trim() : null;
      
      return {
        ACTION: action,
        PARAMETERS: parameters,
        REASON: reason
      };
    } catch (error) {
      console.error('Error parsing action:', error);
      return null;
    }
  }

  async recordToolAction(agentId, toolName, parameters) {
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO agent_actions (agent_id, action_type, tool_name, parameters, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [agentId, 'tool_execution', toolName, JSON.stringify(parameters), 'started', new Date().toISOString()],
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

  async runAgentLoop(agentId) {
    console.log(`Starting agent loop for agent ID: ${agentId}`);
    
    const agent = await this.getAgentById(agentId);
    if (!agent || !agent.is_running) {
      console.log(`Agent ${agentId} is not running or not found`);
      return;
    }

    try {
      console.log(`Fetching tools for agent ID: ${agentId}`);
      const tools = await this.getAgentTools(agentId);
      console.log(`Tools fetched for agent ID: ${agentId}:`, tools);

      console.log(`Gathering context for agent ID: ${agentId}`);
      const context = await this.getContext(agentId);
      console.log(`Context gathered for agent ID: ${agentId}:`, context);

      console.log(`Generating prompt for agent ID: ${agentId}`);
      const prompt = await this.generatePrompt(context, agent.personality, tools);
      console.log(`Prompt generated for agent ID: ${agentId}:`, prompt);

      console.log(`Logging input thought for agent ID: ${agentId}`);
      await this.logAgentThought(agentId, 'input', prompt, agent.model_name);

      console.log(`Calling Together AI for agent ID: ${agentId}`);
      const response = await this.callTogetherAI(prompt, agent.model_name);
      console.log(`Response received for agent ID: ${agentId}:`, response);

      console.log(`Logging output thought for agent ID: ${agentId}`);
      await this.logAgentThought(agentId, 'output', response, agent.model_name);

      console.log(`Processing response for agent ID: ${agentId}`);
      await this.processResponse(agentId, response);

      console.log(`Updating last run time for agent ID: ${agentId}`);
      await this.updateLastRunTime(agentId);

    } catch (error) {
      console.error(`Error in agent ${agentId} loop:`, error);
      await this.logAgentThought(agentId, 'error', error.message, 'system');
    }
  }

  async updateLastRunTime(agentId) {
    return new Promise((resolve, reject) => {
      const now = new Date().toISOString();
      db.run('UPDATE agents SET last_run = ?, updated_at = ? WHERE id = ?', 
        [now, now, agentId], 
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

  async getRecentTweets() {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM tweets ORDER BY created_at DESC LIMIT 5', [], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows || []);
      });
    });
  }

  async getActiveCampaigns() {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM campaigns WHERE status = "active"', [], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows || []);
      });
    });
  }

}

// Create and export a singleton instance
const agentBrainService = new AgentBrainService();
export default agentBrainService; 