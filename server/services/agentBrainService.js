import db from '../database.js';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import Together from 'together-ai';
import newsAnalysisService from './newsAnalysisService.js';
import toolRegistryService from './toolRegistryService.js';
import farcasterService from './farcasterService.js';
import TelegramBot from 'node-telegram-bot-api';
import { Coinbase, Wallet } from "@coinbase/coinbase-sdk";
import agentToolService from './agentToolService.js';
import agentTable from '../db/tables/AgentTable.js';

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
    this.checkInterval = 30000; // 30 seconds
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
    return agentTable.updateAgentStatus(agentId, isRunning);
  }

  async getAgentTools(agentId) {
    return agentToolService.getAgentTools(agentId);
  }

  async getAgentById(agentId) {
    return agentTable.getAgentById(agentId);
  }

  async getContext(agentId) {
    console.log('Gathering context for agent...');
    
    const activeCampaigns = await this.getActiveCampaigns();
    console.log(`Retrieved ${activeCampaigns.length} active campaigns`);
    
    const recentActions = await this.getRecentActions(agentId, 7);
    console.log(`Retrieved ${recentActions.length} recent agent actions`);

    const mindshareContext = '';
    
    return {
      activeCampaigns,
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

  async generatePrompt(context, personality, tools, agentId) {
    // Build the tool descriptions with exact parameter specifications
    const toolDescriptions = tools.map(tool => {
        let description = `${tool.tool_name}: ${tool.description}\n`;
        try {
            const params = JSON.parse(tool.parameters);
            description += 'Parameters:\n';
            for (const [param, desc] of Object.entries(params)) {
                description += `  - ${param}: ${desc}\n`;
            }
        } catch (e) {
            description += 'Parameters: None\n';
        }
        return description;
    }).join('\n');

    // Get wallet information
    let walletInfo = 'Wallet: Not configured';
    const agent = await this.getAgentById(agentId);
    console.log("agent: ", agent)
    
    console.log('Agent wallet details:', {
      hasWalletSeed: !!agent?.wallet_seed,
      hasWalletId: !!agent?.wallet_id,
      hasWalletAddress: !!agent?.wallet_address
    });

    if (agent && agent.wallet_seed && agent.wallet_id) {
        try {
            console.log('Importing wallet for agent:', agent.id);
            const importedWallet = await Wallet.import({
                walletId: agent.wallet_id,
                seed: agent.wallet_seed,
                networkId: Coinbase.networks.BaseSepolia
            });

            console.log('Wallet imported successfully:', importedWallet.getId());

            const balance = await importedWallet.getBalance(Coinbase.assets.Eth);
            console.log('Wallet balance retrieved:', balance.toString());
            
            // If wallet address is not stored, get it from the wallet
            if (!agent.wallet_address) {
                const addressObj = await importedWallet.getDefaultAddress();
                agent.wallet_address = addressObj.addressId;
                console.log('Retrieved default wallet address:', agent.wallet_address);
                
                // Update the agent record with the wallet address
                await new Promise((resolve, reject) => {
                    db.run('UPDATE agents SET wallet_address = ? WHERE id = ?', 
                    [agent.wallet_address, agent.id], 
                    (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
            }

            walletInfo = `Wallet Address: ${agent.wallet_address}\nWallet Balance: ${balance.toString()} ETH`;
        } catch (error) {
            console.error('Error fetching wallet details:', error);
            walletInfo = 'Wallet: Error fetching details';
        }
    } else {
        console.log('Wallet not configured for agent:', {
            id: agent?.id,
            hasWalletSeed: !!agent?.wallet_seed,
            hasWalletId: !!agent?.wallet_id
        });
    }

    // Format the current time in human-readable format
    const now = new Date();
    const formattedTime = now.toLocaleString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: true
    });

    // Format the context with clear sections
    const formattedContext = `
    Active Campaigns:
    ${context.activeCampaigns.length > 0 ? 
      context.activeCampaigns.map(c => `- ${c.name}: ${c.description}`).join('\n') 
      : 'No active campaigns'}

    Recent Actions:
    ${context.recentActions.length > 0 ? 
      context.recentActions.map(a => `- ${a.action_type}: ${a.tool_name} (${a.status})`).join('\n') 
      : 'No recent actions'}

    ${walletInfo}

    Mindshare Context:
    ${context.mindshareContext || 'No specific mindshare context available'}
    `;

    // Get the agent's name
    const agentName = agent ? agent.name : 'Base DevRel Agent';

    // Construct the prompt with enhanced tool descriptions
    let prompt = `
    You are: ${agentName}.
    
    Your personality:
    ${personality}
    Here is your current context:
    ${formattedContext}
    
    Current time: ${formattedTime}
    
    Here are the tools available to you. You MUST use the exact tool names and parameter formats:
    ${toolDescriptions}
    
    Compose your next action. Structure your response like this:
    
    ACTION: The exact name of the tool you want to use.
    PARAMETERS: A JSON object containing the exact parameters for the tool.
    REASON: Explain why you are using this tool.

    IMPORTANT: You can ONLY use the tools listed above. You MUST follow the exact format provided.
    `;
    
    return prompt;
  }

  async callTogetherAI(prompt, modelName) {
    try {
      const response = await this.together.chat.completions.create({
        model: modelName,
        messages: [{ role: "user", "content": prompt }],
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
      
      // Handle Sleep tool specially
      if (toolName === 'SleepTool') {
        await this.handleSleepTool(agentId, parameters);
        return;
      }
      
      // Record the action
      const actionId = await this.recordToolAction(agentId, toolName, parameters);
      
      try {
        // Execute the tool through the tool registry
        console.log(`Calling toolRegistryService.executeTool with toolName: "${toolName}", agentId: ${agentId}`);
        const result = await toolRegistryService.executeTool(toolName, parameters, agentId);
        
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
      // Clean the response string
      const cleanedResponse = response
        .replace(/['']/g, "'") // Replace smart quotes
        .replace(/[""]/g, '"') // Replace smart double quotes
        .replace(/–/g, '-')   // Replace en dash with regular dash
        .trim();

      // First, try to extract using the standard format with newlines
      const actionRegex = /ACTION:\s*([a-zA-Z0-9_]+)/;
      const parametersRegex = /PARAMETERS:\s*({[\s\S]*?})/m;
      const reasonRegex = /REASON:\s*([\s\S]*?)(?:$|ACTION:)/;
      
      const actionMatch = cleanedResponse.match(actionRegex);
      const parametersMatch = cleanedResponse.match(parametersRegex);
      const reasonMatch = cleanedResponse.match(reasonRegex);
      
      let action = actionMatch ? actionMatch[1].trim() : null;
      let parameters = parametersMatch ? JSON.parse(parametersMatch[1]) : {};
      let reason = reasonMatch ? reasonMatch[1].trim() : null;
      
      // If no action found, try alternative format where tool name might be concatenated with PARAMETERS
      if (!action) {
        const alternativeActionRegex = /([a-zA-Z0-9_]+)PARAMETERS:/;
        const altActionMatch = cleanedResponse.match(alternativeActionRegex);
        if (altActionMatch) {
          action = altActionMatch[1].trim();
        }
      }
      
      // Validate and transform parameters for CreateBountyTool
      if (action === 'CreateBountyTool') {
        if (parameters.duration) {
          // Convert duration to ISO deadline
          const duration = parseInt(parameters.duration);
          if (!isNaN(duration)) {
            const deadline = new Date(Date.now() + duration * 24 * 60 * 60 * 1000);
            parameters.deadline = deadline.toISOString();
          }
          delete parameters.duration;
        }
        
        // Validate required fields
        if (!parameters.title || !parameters.description || !parameters.reward) {
          throw new Error('Missing required fields for CreateBountyTool');
        }
      }
      
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

  async handleSleepTool(agentId, parameters) {
    try {
      const sleepDuration = parseInt(parameters.milliseconds) || 60000; // Default to 1 minute if invalid
      console.log(`Agent ${agentId} requested to sleep for ${sleepDuration}ms`);
      
      // Record the sleep action
      const actionId = await this.recordToolAction(agentId, 'SleepTool', parameters);
      
      // Calculate wake time
      const wakeTime = new Date(Date.now() + sleepDuration);
      
      // Update the agent's next_wake_time in the database
      await this.updateAgentSleepTime(agentId, wakeTime);
      
      // Update the action as completed
      await this.updateToolAction(actionId, 'completed', { 
        message: `Agent will sleep until ${wakeTime.toISOString()}`,
        wake_time: wakeTime.toISOString()
      });
      
      console.log(`Agent ${agentId} sleep scheduled until ${wakeTime.toISOString()}`);
      
      // Log the sleep action as a thought
      await this.logAgentThought(
        agentId, 
        'system', 
        `Agent sleeping until ${wakeTime.toISOString()}`, 
        'system'
      );
      
    } catch (error) {
      console.error('Error handling sleep tool:', error);
    }
  }

  async updateAgentSleepTime(agentId, wakeTime) {
    return agentTable.updateAgentSleepTime(agentId, wakeTime);
  }

  async runAgentLoop(agentId) {
    console.log(`Starting agent loop for agent ID: ${agentId}`);
    
    const agent = await this.getAgentById(agentId);
    console.log("run agent loop agent: ", agent)
    if (!agent || !agent.is_running) {
      console.log(`Agent ${agentId} is not running or not found`);
      return;
    }

    // Check if the agent is sleeping
    if (agent.next_wake_time) {
      const wakeTime = new Date(agent.next_wake_time);
      const now = new Date();
      
      if (wakeTime > now) {
        console.log(`Agent ${agentId} is sleeping until ${wakeTime.toISOString()}`);
        return; // Skip this run as the agent is still sleeping
      } else {
        console.log(`Agent ${agentId} wake time has passed, continuing execution`);
        // Clear the wake time as we're now running
        await this.clearAgentSleepTime(agentId);
      }
    }

    try {
      console.log(`Fetching tools for agent ID: ${agentId}`);
      const tools = await this.getAgentTools(agentId);
      console.log(`Tools fetched for agent ID: ${agentId}:`, tools);

      console.log(`Gathering context for agent ID: ${agentId}`);
      const context = await this.getContext(agentId);
      console.log(`Context gathered for agent ID: ${agentId}:`, context);

      console.log(`Generating prompt for agent ID: ${agentId}`);
      const prompt = await this.generatePrompt(context, agent.personality, tools, agentId);
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
    return agentTable.updateLastRunTime(agentId);
  }

  async clearAgentSleepTime(agentId) {
    return agentTable.clearAgentSleepTime(agentId);
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