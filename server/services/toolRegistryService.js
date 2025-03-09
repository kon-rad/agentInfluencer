import db from '../database.js';
import newsAnalysisService from './newsAnalysisService.js';
import twitterTrendService from './twitterTrendService.js';
import twitterService from './twitterService.js';
import telegramService from './telegramService.js';
import { ethers } from 'ethers';
import videoGenerationService from './videoGenerationService.js';

// Mantle Network Configuration
const MANTLE_NETWORKS = {
  mainnet: {
    chainId: 5000,
    rpcUrl: 'https://rpc.mantle.xyz',
    name: 'Mantle Mainnet',
    symbol: 'MNT',
    explorer: 'https://explorer.mantle.xyz'
  },
  testnet: {
    chainId: 5001,
    rpcUrl: 'https://rpc.testnet.mantle.xyz',
    name: 'Mantle Testnet',
    symbol: 'MNT',
    explorer: 'https://explorer.testnet.mantle.xyz'
  }
};

// Helper function to create Mantle provider
const getMantleProvider = (isTestnet = true) => {
  const network = isTestnet ? MANTLE_NETWORKS.testnet : MANTLE_NETWORKS.mainnet;
  return new ethers.providers.JsonRpcProvider(network.rpcUrl);
};

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
      usage_format: 'ACTION: NewsAnalysisTool\nPARAMETERS: {}\nREASON: To fetch and analyze recent Web3 news',
      execute: async (params = {}) => {
        return await newsAnalysisService.fetchLatestNews();
      }
    });

    // Register create_short_form_video tool
    await this.registerTool('create_short_form_video', {
      description: 'Creates a short-form video for social media marketing campaigns',
      parameters: {
        prompt: 'string - Description of the video content to generate'
      },
      usage_format: 'ACTION: create_short_form_video\nPARAMETERS: {"prompt": "Description of desired video content"}\nREASON: To generate engaging social media content',
      execute: async (params, agentId) => {
        const { prompt } = params;
        return await videoGenerationService.createVideo(agentId, prompt);
      }
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
          if (agent && agent.telegram_bot_token && agent.telegram_channel_id) {
            // Compose Telegram message
            const telegramMessage = `🚨 *New Bounty Alert!* 🚨\n\n` +
              `*Title:* ${title}\n` +
              `*Description:* ${description}\n` +
              `*Reward:* ${reward}\n` +
              `*Deadline:* ${new Date(deadline).toLocaleDateString()}\n\n` +
              `Check out the tweet for more details!`;
            
            // Post to Telegram
            await telegramService.sendMessage(
              agent.telegram_bot_token,
              agent.telegram_channel_id,
              telegramMessage,
              {
                parse_mode: 'Markdown',
                disable_web_page_preview: true
              }
            );
          }
          
          return {
            success: true,
            campaign_id: campaignId,
            tweet_id: tweetResult.id,
            message: "Bounty created and posted successfully to Twitter and Telegram"
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

    // Register the CryptoTransferTool
    await this.registerTool('CryptoTransferTool', {
      description: "Sends a small amount of MNT (0.0000001) to a specified address on Mantle network",
      parameters: {
        recipient_address: "string - Optional recipient address (defaults to 0xa01dD443827F88Ba34FefFA8949144BaB122D736 if not provided)",
        network_id: "string - Optional network ID (defaults to 'mantle-testnet')"
      },
      execute: async (params, agentId) => {
        try {
          // Extract parameters with defaults
          const recipientAddress = params.recipient_address || "0xa01dD443827F88Ba34FefFA8949144BaB122D736";
          const networkId = params.network_id || 'mantle-testnet';
          
          console.log(`Initiating crypto transfer of 0.0000001 MNT to ${recipientAddress} on ${networkId}`);
          
          // Get the agent to retrieve wallet information
          const agent = await this.getAgentById(agentId);
          if (!agent) {
            throw new Error(`Agent ${agentId} not found`);
          }
          
          if (!agent.wallet_seed || !agent.wallet_address) {
            throw new Error(`Agent ${agentId} does not have a wallet configured`);
          }
          
          // Determine if we're using testnet
          const isTestnet = networkId === 'mantle-testnet';
          const provider = getMantleProvider(isTestnet);
          
          // Create wallet instance from private key
          const wallet = new ethers.Wallet(agent.wallet_seed, provider);
          
          // Get the wallet address
          const walletAddress = wallet.address;
          console.log(`Sending from wallet address: ${walletAddress}`);
          
          // Check the wallet balance before attempting the transfer
          const balance = await provider.getBalance(walletAddress);
          console.log(`Current wallet balance: ${ethers.utils.formatEther(balance)} MNT`);
          
          const transferAmount = ethers.utils.parseEther('0.0000001');
          if (balance.lt(transferAmount)) {
            throw new Error(`Insufficient funds: ${ethers.utils.formatEther(balance)} MNT available, but 0.0000001 MNT required`);
          }
          
          // Create and send the transaction
          const tx = await wallet.sendTransaction({
            to: recipientAddress,
            value: transferAmount
          });
          
          console.log(`Transaction sent with hash: ${tx.hash}`);
          
          // Wait for the transaction to be mined
          const receipt = await tx.wait();
          console.log(`Transaction confirmed in block ${receipt.blockNumber}`);
          
          // Get the updated balance after transfer
          const balanceAfter = await provider.getBalance(walletAddress);
          console.log(`Wallet balance after transfer: ${ethers.utils.formatEther(balanceAfter)} MNT`);
          
          // Log the transaction in the agent_actions table
          await new Promise((resolve, reject) => {
            db.run(
              `INSERT INTO agent_actions (agent_id, action_type, tool_name, parameters, status, result, created_at, completed_at) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                agentId, 
                'crypto_transfer', 
                'CryptoTransferTool', 
                JSON.stringify({
                  recipient_address: recipientAddress,
                  network_id: networkId,
                  amount: '0.0000001',
                  asset: 'MNT'
                }),
                'complete',
                JSON.stringify({
                  transaction_hash: tx.hash,
                  from_address: walletAddress,
                  to_address: recipientAddress,
                  network: networkId,
                  block_number: receipt.blockNumber,
                  balance_before: ethers.utils.formatEther(balance),
                  balance_after: ethers.utils.formatEther(balanceAfter)
                }),
                new Date().toISOString(),
                new Date().toISOString()
              ],
              function(err) {
                if (err) {
                  console.error("Error logging crypto transfer action:", err);
                  reject(err);
                } else {
                  resolve(this.lastID);
                }
              }
            );
          });
          
          return {
            success: true,
            transaction_hash: tx.hash,
            status: 'complete',
            from_address: walletAddress,
            to_address: recipientAddress,
            amount: '0.0000001',
            asset: "MNT",
            network: networkId,
            block_number: receipt.blockNumber,
            balance_before: ethers.utils.formatEther(balance),
            balance_after: ethers.utils.formatEther(balanceAfter),
            message: "Transfer completed successfully"
          };
        } catch (error) {
          console.error("Error sending crypto transfer:", error);
          
          // Log the failed attempt
          try {
            // Get agent information for better error logging
            let agentInfo = {};
            try {
              const agent = await this.getAgentById(agentId);
              if (agent) {
                agentInfo = {
                  agent_id: agent.id,
                  wallet_address: agent.wallet_address,
                  has_wallet_seed: !!agent.wallet_seed
                };
              }
            } catch (agentError) {
              console.error("Error getting agent info for error logging:", agentError);
            }
            
            await new Promise((resolve, reject) => {
              db.run(
                `INSERT INTO agent_actions (agent_id, action_type, tool_name, parameters, status, result, created_at, completed_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  agentId, 
                  'crypto_transfer', 
                  'CryptoTransferTool', 
                  JSON.stringify({
                    recipient_address: params.recipient_address || "0xa01dD443827F88Ba34FefFA8949144BaB122D736",
                    network_id: params.network_id || 'mantle-testnet',
                    amount: '0.0000001',
                    asset: 'MNT'
                  }),
                  'failed',
                  JSON.stringify({
                    error: error.message,
                    stack: error.stack,
                    agent_info: agentInfo
                  }),
                  new Date().toISOString(),
                  new Date().toISOString()
                ],
                function(err) {
                  if (err) {
                    console.error("Error logging failed crypto transfer action:", err);
                    reject(err);
                  } else {
                    resolve(this.lastID);
                  }
                }
              );
            });
          } catch (logError) {
            console.error("Error logging failed transfer:", logError);
          }
          
          return {
            success: false,
            error: error.message,
            details: error.stack
          };
        }
      }
    });
  }

  registerTool(name, toolConfig) {
    console.log(`Registering tool: ${name}`);
    this.tools.set(name, toolConfig);
    console.log(`Tool ${name} registered. Current tools:`, Array.from(this.tools.keys()));
    
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
    console.log('Getting registered tools from database and memory...');
    console.log('Tools in memory:', Array.from(this.tools.keys()));
    
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM agent_tools', [], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        
        // Enhance the database tools with the in-memory tools data
        const enhancedTools = (rows || []).map(dbTool => {
          const memoryTool = this.tools.get(dbTool.tool_name);
          return {
            ...dbTool,
            has_execute_method: !!memoryTool?.execute
          };
        });
        
        console.log(`Retrieved ${enhancedTools.length} tools from database`);
        resolve(enhancedTools);
      });
    });
  }

  async executeTool(toolName, parameters, agentId) {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`Tool ${toolName} not found`);
    }
    if (typeof tool.execute === 'function') {
      return await tool.execute(parameters, agentId);
    } else {
      throw new Error(`Tool ${toolName} does not have an execute method`);
    }
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