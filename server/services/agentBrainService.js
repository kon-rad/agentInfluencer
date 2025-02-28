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
    this.isRunning = false;
    this.intervalId = null;
    this.checkInterval = 10000; // Check every 10 seconds if agent should run
    this.together = new Together(TOGETHER_API_KEY);
  }

  async initialize() {
    try {
      // Check if agent should be running
      const config = await this.getAgentConfig();
      if (config && config.is_running) {
        this.start();
      } else {
        console.log('Agent brain service initialized but not running');
      }
      
      // Start the check interval
      this.startCheckInterval();
    } catch (error) {
      console.error('Error initializing agent brain service:', error);
    }
  }

  startCheckInterval() {
    this.intervalId = setInterval(async () => {
      try {
        const config = await this.getAgentConfig();
        
        // If agent should be running but isn't
        if (config && config.is_running && !this.isRunning) {
          this.start();
        } 
        // If agent should not be running but is
        else if (config && !config.is_running && this.isRunning) {
          this.stop();
        }
      } catch (error) {
        console.error('Error in agent check interval:', error);
      }
    }, this.checkInterval);
  }

  async getAgentConfig() {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM agent_config WHERE id = 1', [], (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(row);
      });
    });
  }

  async start() {
    if (this.isRunning) {
      console.log('Agent already running, skipping start');
      return;
    }
    
    console.log('Starting agent brain service');
    this.isRunning = true;
    
    // Log agent start
    await this.logAgentThought('system', 'Agent brain service started', 'system');
    
    // Reset the last run time to force an immediate run
    try {
      await this.resetLastRunTime();
      console.log('Reset last run time to force immediate run');
    } catch (error) {
      console.error('Error resetting last run time:', error);
    }
    
    // Start the agent loop
    console.log('Initiating agent loop');
    this.runAgentLoop();
  }

  stop() {
    console.log('Stopping agent brain service');
    this.isRunning = false;
    this.logAgentThought('system', 'Agent brain service stopped', 'system');
  }

  async runAgentLoop() {
    if (!this.isRunning) {
      console.log('Agent loop not running because isRunning is false');
      return;
    }
    
    console.log('Agent loop running, checking if it should execute a cycle');
    
    try {
      const config = await this.getAgentConfig();
      
      console.log('Agent config:', JSON.stringify(config, null, 2));
      
      // Check if it's time to run based on frequency
      const now = new Date();
      const lastRun = config.last_run ? new Date(config.last_run) : new Date(0);
      const timeSinceLastRun = now - lastRun;
      
      console.log(`Time since last run: ${timeSinceLastRun}ms, frequency: ${config.frequency}ms`);
      
      if (timeSinceLastRun >= config.frequency) {
        console.log('Running agent brain cycle - time to run!');
        
        // Update last run time FIRST to prevent multiple runs
        await this.updateLastRunTime();
        console.log('Last run time updated successfully');
        
        try {
          // Get latest news and context
          console.log('Getting context for agent...');
          const context = await this.getContext();
          console.log('Context retrieved:', JSON.stringify(context, null, 2));
          
          // Generate the prompt
          console.log('Generating prompt with context and personality...');
          const prompt = await this.generatePrompt(context, config.personality);
          console.log('Prompt generated, length:', prompt.length);
          console.log('Prompt generated:', prompt);
          
          // Log the input
          console.log('Logging agent input thought...');
          await this.logAgentThought('input', prompt, config.model_name);
          
          let response;
          try {
            // Call the LLM
            console.log('Calling Together AI with model:', config.model_name);
            console.log('API Key present:', !!TOGETHER_API_KEY);
            response = await this.callTogetherAI(prompt, config.model_name);
            console.log('LLM response received successfully!');
          } catch (apiError) {
            console.error('API error details:', apiError);
            await this.logAgentThought('error', `API error: ${apiError.message}`, config.model_name);
            
            // Try with fallback model
            console.log('Trying with fallback model: mistralai/Mixtral-8x7B-Instruct-v0.1');
            response = await this.callTogetherAI(prompt, 'mistralai/Mixtral-8x7B-Instruct-v0.1');
          }
          
          // Log the output
          console.log('Logging agent output thought...');
          await this.logAgentThought('output', response, config.model_name);
          
          // Process the response (e.g., create tweets, check bounties)
          console.log('Processing LLM response...');
          await this.processResponse(response);
          
          console.log('Agent brain cycle completed successfully');
        } catch (cycleError) {
          console.error('Error in agent brain cycle:', cycleError);
          console.error('Error stack:', cycleError.stack);
          await this.logAgentThought('error', `Error in agent brain cycle: ${cycleError.message}`, 'system');
        }
      } else {
        console.log(`Not time to run yet. Will run in ${config.frequency - timeSinceLastRun}ms`);
      }
      
      // Schedule next run
      console.log('Scheduling next agent loop check in 60 seconds');
      setTimeout(() => {
        if (this.isRunning) {
          console.log('Running scheduled agent loop check');
          this.runAgentLoop();
        } else {
          console.log('Agent is no longer running, skipping scheduled check');
        }
      }, 60000); // Check again in 1 minute
    } catch (error) {
      console.error('Error in agent loop:', error);
      
      // Log the error
      await this.logAgentThought('error', `Error in agent loop: ${error.message}`, 'system');
      
      // Try again in 5 minutes
      console.log('Scheduling retry in 5 minutes due to error');
      setTimeout(() => {
        if (this.isRunning) {
          this.runAgentLoop();
        }
      }, 300000);
    }
  }

  async updateLastRunTime() {
    return new Promise((resolve, reject) => {
      const now = new Date().toISOString();
      db.run('UPDATE agent_config SET last_run = ?, updated_at = ? WHERE id = 1', 
        [now, now], 
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

  async resetLastRunTime() {
    return new Promise((resolve, reject) => {
      const oldDate = new Date(0).toISOString();
      db.run('UPDATE agent_config SET last_run = ?, updated_at = ? WHERE id = 1', 
        [oldDate, new Date().toISOString()], 
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

  async getContext() {
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
    
    // Get recent agent actions
    const recentActions = await toolRegistryService.getRecentActions(7);
    console.log(`Retrieved ${recentActions.length} recent agent actions`);

    // Fetch and summarize Twitter trends
    const twitterTrends = await toolRegistryService.executeTool('TwitterTrendTool');
    const mindshareContext = this.summarizeMindshare(twitterTrends);
    console.log(`Mindshare context: ${mindshareContext}`);
    
    return {
      recentTweets,
      activeCampaigns,
      recentNews,
      recentActions,
      mindshareContext,
      currentTime: new Date().toISOString()
    };
  }

  summarizeMindshare(trends) {
    // Summarize the trends into a coherent mindshare context
    return trends.map(trend => trend.content).join(' ');
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

  async getLastActions(limit = 7) {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM agent_thoughts ORDER BY timestamp DESC LIMIT ?', [limit], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows || []);
      });
    });
  }

  async getLastOutputThoughts(limit = 6) {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM agent_thoughts WHERE type = "output" ORDER BY timestamp DESC LIMIT ?', [limit], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows || []);
      });
    });
  }

  async generatePrompt(context, personality) {
    const { recentTweets, activeCampaigns, recentNews, recentActions, mindshareContext, currentTime } = context;
    
    // Format recent tweets
    const tweetSection = recentTweets.length > 0 
      ? `Recent tweets:\n${recentTweets.map(t => `- ${t.content} (${t.published_at || 'scheduled'})`).join('\n')}`
      : 'No recent tweets.';
    
    // Format active campaigns
    const campaignSection = activeCampaigns.length > 0
      ? `Active campaigns:\n${activeCampaigns.map(c => `- ${c.title}: ${c.description}`).join('\n')}`
      : 'No active campaigns.';
    
    // Format recent news
    const newsSection = recentNews.length > 0
      ? `Recent Web3 News:\n${recentNews.map(n => `- ${n.title} (${n.source}, ${new Date(n.published_at).toLocaleDateString()})\n  Summary: ${n.content.substring(0, 150)}...`).join('\n\n')}`
      : 'No recent news available.';
    
    // Format recent actions
    const actionsSection = recentActions.length > 0
      ? `Recent actions:\n${recentActions.map(a => {
          const date = new Date(a.created_at).toLocaleString();
          if (a.action_type === 'tool_execution') {
            return `- [${date}] Used tool: ${a.tool_name} with parameters: ${a.parameters}. Status: ${a.status}`;
          } else {
            return `- [${date}] ${a.action_type}: ${a.status}`;
          }
        }).join('\n')}`
      : 'No recent actions.';
    
    // Get available tools
    const tools = toolRegistryService.tools;
    const toolsSection = tools.size > 0
      ? `Available tools:\n${Array.from(tools.entries()).map(([name, config]) => 
          `- ${name}: ${config.description}\n  Usage: ${config.usage_format || `ACTION: ${name}\nPARAMETERS: {}\nREASON: Explain why you're using this tool`}`
        ).join('\n\n')}`
      : 'No tools available.';
    
    // Add precise definitions for createBounty and createTweet
    const customToolsSection = `
|- CreateBounty: Use this tool to create a new bounty for content creators. 
  Usage: ACTION: CreateBounty
  PARAMETERS: {"title": "Bounty Title", "description": "Detailed description of the bounty", "reward": "Reward details"}
  REASON: Explain why this bounty is being created.

|- CreateTweet: Use this tool to generate a tweet about recent developments.
  Usage: ACTION: CreateTweet
  PARAMETERS: {"content": "The content of the tweet"}
  REASON: Explain the purpose of the tweet.
    `;

    // Add last 6 output thoughts to the prompt
    const lastOutputThoughts = await this.getLastOutputThoughts();
    const outputThoughtsSection = lastOutputThoughts.length > 0
      ? `Recent outputs:\n${lastOutputThoughts.map(t => `- ${t.content}`).join('\n')}`
      : 'No recent outputs.';

    // Improved instructions for tool usage
    const toolUsageInstructions = `
If you need to use a tool, ensure you specify the tool name correctly. Use the following format:
ACTION: ToolName
PARAMETERS: {"param1": "value1", "param2": "value2"}
REASON: Brief explanation of why you're using this tool

Ensure that the tool name is one of the available tools listed above. Do not use "ACTION" as a tool name.
`;

    return `${personality || 'You are a helpful DevRel agent.'}\n\n
Current time: ${currentTime}\n\n
Mindshare Context: ${mindshareContext}\n\n
${tweetSection}\n\n
${campaignSection}\n\n
${newsSection}\n\n
${actionsSection}\n\n
${outputThoughtsSection}\n\n
${toolsSection}\n\n
${customToolsSection}\n\n
${toolUsageInstructions}\n\n
Based on the above information, please perform one of the following tasks:
1. Generate a tweet about recent developments in Base L2 network or Web3
2. Create a bounty for content creators to promote Base L2
3. Analyze recent engagement and suggest content strategy
4. Use a tool to gather more information
5. Send funds on chain for fulfilled bounties

Choose the most appropriate task and provide your response.`;
  }

  async callTogetherAI(prompt, modelName) {
    if (!TOGETHER_API_KEY) {
      console.error('Together AI API key not configured or empty');
      throw new Error('Together AI API key not configured');
    }
    
    try {
      // Use serverless models that don't require dedicated endpoints
      // List of recommended serverless models
      const serverlessModels = [
        'meta-llama/Meta-Llama-3-8B-Instruct-Turbo',  // Serverless version
        'meta-llama/Llama-3.3-70B-Instruct-Turbo',    // Serverless version
        'mistralai/Mixtral-8x7B-Instruct-v0.1',       // Serverless version
        'mistralai/Mistral-7B-Instruct-v0.2'          // Serverless version
      ];
      
      // Check if the requested model is in our serverless list, otherwise use default
      let model = serverlessModels.includes(modelName) ? 
                  modelName : 
                  'meta-llama/Meta-Llama-3-8B-Instruct-Turbo';
      
      console.log(`Calling Together AI with serverless model: ${model}`);
      console.log(`Prompt length: ${prompt.length} characters`);
      console.log(`Prompt contents: ${prompt}`);
      console.log('Together SDK instance exists:', !!this.together);
      
      // Debug the Together SDK instance
      if (!this.together) {
        console.log('Recreating Together SDK instance');
        this.together = new Together(TOGETHER_API_KEY);
      }
      
      console.log('Preparing to call Together API...');
      
      // Use the Together SDK instead of fetch
      const response = await this.together.chat.completions.create({
        model: model,
        messages: [
          { role: "system", content: prompt },
          { role: "user", content:  "Make a decision on what to do next." }
        ],
        max_tokens: 1000,
      });
      
      console.log('Together API response received!');
      console.log(`Response status:`, response?.choices ? 'Success' : 'No choices in response');
      console.log(`Response length: ${response?.choices?.[0]?.message?.content?.length || 0} characters`);
      
      if (!response?.choices?.[0]?.message?.content) {
        console.error('Invalid response format from Together API:', JSON.stringify(response, null, 2));
        throw new Error('Invalid response format from Together API');
      }
      
      return response.choices[0].message.content;
    } catch (error) {
      console.error('Error calling Together AI:', error);
      console.error('Error stack:', error.stack);
      
      // If the specified model fails, try with a different fallback model
      if (modelName && modelName !== 'meta-llama/Meta-Llama-3-8B-Instruct-Turbo') {
        console.log('Trying with fallback model: meta-llama/Meta-Llama-3-8B-Instruct-Turbo');
        return this.callTogetherAI(prompt, 'meta-llama/Meta-Llama-3-8B-Instruct-Turbo');
      }
      
      throw error;
    }
  }

  async processResponse(response) {
    console.log('Processing agent response...');
    
    // Check if the response contains a tweet
    if (response.toLowerCase().includes('tweet:')) {
      await this.createTweet(response);
    }
    
    // Check if the response contains a bounty
    if (response.toLowerCase().includes('bounty:')) {
      await this.createBounty(response);
    }
    
    // Check for structured tool usage
    const actionMatch = response.match(/ACTION:\s*(\w+)/i);
    const paramsMatch = response.match(/PARAMETERS:\s*({.*?})/is);
    const reasonMatch = response.match(/REASON:\s*(.*?)(?:\n|$)/is);
    
    if (actionMatch && actionMatch[1]) {
      const toolName = actionMatch[1];
      let params = {};
      
      // Parse parameters if provided
      if (paramsMatch && paramsMatch[1]) {
        try {
          params = JSON.parse(paramsMatch[1]);
        } catch (error) {
          console.error('Error parsing tool parameters:', error);
          await this.logAgentThought('error', `Error parsing tool parameters: ${error.message}`, 'system');
        }
      }
      
      const reason = reasonMatch && reasonMatch[1] ? reasonMatch[1].trim() : 'No reason provided';
      
      // Log the tool usage
      await this.logAgentThought('tool', `Using tool: ${toolName} with params: ${JSON.stringify(params)}. Reason: ${reason}`, 'system');
      
      // Execute the tool
      try {
        const result = await toolRegistryService.executeTool(toolName, params);
        await this.logAgentThought('system', `Tool ${toolName} executed successfully: ${JSON.stringify(result)}`, 'system');
      } catch (error) {
        console.error(`Error executing tool ${toolName}:`, error);
        await this.logAgentThought('error', `Error executing tool ${toolName}: ${error.message}`, 'system');
      }
    }
    
    return true;
  }

  async createTweet(response) {
    // Extract tweet content
    const tweetMatch = response.match(/tweet:[\s\n]*(.*?)(?:\n|$)/i);
    if (tweetMatch && tweetMatch[1]) {
      const tweetContent = tweetMatch[1].trim();
      
      // Insert into tweets table
      return new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO tweets (content, scheduled_for, created_at) VALUES (?, ?, ?)',
          [
            tweetContent, 
            new Date(Date.now() + 3600000).toISOString(),
            new Date().toISOString()
          ],
          async function(err) {
            if (err) {
              reject(err);
              return;
            }
            console.log('Tweet created:', tweetContent);
            
            // Post to Telegram channel
            try {
              await telegramBot.sendMessage(TELEGRAM_CHANNEL_ID, tweetContent);
              console.log('Posted to Telegram channel:', TELEGRAM_CHANNEL_ID);
            } catch (telegramError) {
              console.error('Error posting to Telegram:', telegramError);
            }
            
            resolve();
          }
        );
      });
    }
  }

  async createBounty(response) {
    // Extract bounty details
    const bountyMatch = response.match(/bounty:[\s\n]*(.*?)(?:\n|$)/i);
    if (bountyMatch && bountyMatch[1]) {
      const bountyContent = bountyMatch[1].trim();
      
      // Extract title and description if possible
      let title = bountyContent;
      let description = '';
      
      const titleMatch = bountyContent.match(/(.*?):(.*)/);
      if (titleMatch) {
        title = titleMatch[1].trim();
        description = titleMatch[2].trim();
      }
      
      // Insert into campaigns table without user_id
      return new Promise((resolve, reject) => {
        const now = new Date().toISOString();
        db.run(
          'INSERT INTO campaigns (title, description, status, reward, created_at) VALUES (?, ?, ?, ?, ?)',
          [
            title,
            description,
            'active',
            '100 BASE', // Default reward
            now
          ],
          function(err) {
            if (err) {
              console.error('Error creating bounty:', err);
              reject(err);
              return;
            }
            console.log('Bounty created:', title);
            resolve();
          }
        );
      });
    }
  }

  async logAgentThought(type, content, modelName, campaignId = null) {
    console.log(`Logging agent thought: [${type}] ${content.substring(0, 100)}...`);
    
    return new Promise((resolve, reject) => {
      const timestamp = new Date().toISOString();
      db.run(
        'INSERT INTO agent_thoughts (type, content, model_name, campaign_id, timestamp) VALUES (?, ?, ?, ?, ?)',
        [type, content, modelName, campaignId, timestamp],
        function(err) {
          if (err) {
            console.error('Error logging agent thought:', err);
            reject(err);
            return;
          }
          console.log(`Agent thought logged with ID: ${this.lastID}`);
          resolve(this.lastID);
        }
      );
    });
  }

  async forceRun() {
    console.log('Force running agent brain service');
    
    // Make sure the agent is running
    this.isRunning = true;
    
    try {
      // Get the agent config
      console.log('Getting agent config for force run...');
      const config = await this.getAgentConfig();
      console.log('Agent config retrieved:', JSON.stringify(config, null, 2));
      
      // Get latest news and context
      console.log('Getting context for force run...');
      const context = await this.getContext();
      
      // Generate the prompt
      console.log('Generating prompt for force run...');
      const prompt = await this.generatePrompt(context, config.personality);
      console.log('Prompt generated, length:', prompt.length);
      console.log('Prompt generated:', prompt);
      
      // Log the input
      console.log('Logging agent input thought for force run...');
      await this.logAgentThought('input', prompt, config.model_name);
      
      let response;
      try {
        // Call the LLM
        console.log('Calling Together AI for force run with model:', config.model_name);
        response = await this.callTogetherAI(prompt, config.model_name);
        console.log('LLM response received for force run!');
      } catch (apiError) {
        console.error('API error in force run, trying fallback model:', apiError);
        await this.logAgentThought('error', `API error in force run: ${apiError.message}`, config.model_name);
        
        // Try with fallback model
        console.log('Trying with fallback model for force run');
        response = await this.callTogetherAI(prompt, 'mistralai/Mixtral-8x7B-Instruct-v0.1');
      }
      
      // Log the output
      console.log('Logging agent output thought for force run...');
      await this.logAgentThought('output', response, config.model_name);
      
      // Process the response
      console.log('Processing response for force run...');
      await this.processResponse(response);
      
      // Update last run time
      console.log('Updating last run time for force run...');
      await this.updateLastRunTime();
      
      console.log('Force run completed successfully');
      return true;
    } catch (error) {
      console.error('Error in force run:', error);
      console.error('Error stack:', error.stack);
      await this.logAgentThought('error', `Error in force run: ${error.message}`, 'system');
      return false;
    }
  }
}

// Create and export a singleton instance
const agentBrainService = new AgentBrainService();
export default agentBrainService; 