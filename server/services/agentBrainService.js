import db from '../database.js';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import Together from 'together-ai';

dotenv.config();

// Together AI API key
const TOGETHER_API_KEY = process.env.TOGETHER_API_KEY;

class AgentBrainService {
  constructor() {
    this.isRunning = false;
    this.intervalId = null;
    this.checkInterval = 10000; // Check every 10 seconds if agent should run
    this.together = new Together(TOGETHER_API_KEY);
    this.init();
  }

  async init() {
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
          const prompt = this.generatePrompt(context, config.personality);
          console.log('Prompt generated, length:', prompt.length);
          
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
    
    return {
      recentTweets,
      activeCampaigns,
      currentTime: new Date().toISOString()
    };
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

  generatePrompt(context, personality) {
    const { recentTweets, activeCampaigns, currentTime } = context;
    
    // Format recent tweets
    const tweetSection = recentTweets.length > 0 
      ? `Recent tweets:\n${recentTweets.map(t => `- ${t.content} (${t.published_at || 'scheduled'})`).join('\n')}`
      : 'No recent tweets.';
    
    // Format active campaigns
    const campaignSection = activeCampaigns.length > 0
      ? `Active campaigns:\n${activeCampaigns.map(c => `- ${c.title}: ${c.description}`).join('\n')}`
      : 'No active campaigns.';
    
    return `${personality || 'You are a helpful DevRel agent.'}\n\n
Current time: ${currentTime}\n\n
${tweetSection}\n\n
${campaignSection}\n\n
Based on the above information, please perform one of the following tasks:
1. Generate a tweet about recent developments in Base L2 network or Web3
2. Create a bounty for content creators to promote Base L2
3. Analyze recent engagement and suggest content strategy

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
          { role: "system", content: "You are a helpful DevRel agent for Base L2 network." },
          { role: "user", content: prompt }
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
          'INSERT INTO tweets (content, scheduled_for) VALUES (?, ?)',
          [tweetContent, new Date(Date.now() + 3600000).toISOString()], // Schedule for 1 hour later
          function(err) {
            if (err) {
              reject(err);
              return;
            }
            console.log('Tweet created:', tweetContent);
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
        db.run(
          'INSERT INTO campaigns (title, description, status, reward, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
          [
            title,
            description,
            'active',
            '100 BASE', // Default reward
            new Date().toISOString(),
            new Date().toISOString()
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
      const prompt = this.generatePrompt(context, config.personality);
      console.log('Prompt generated, length:', prompt.length);
      
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