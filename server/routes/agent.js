import express from 'express';
import logger from '../utils/logger.js';
import db from '../database.js';
import agentBrainService from '../services/agentBrainService.js';
import agentToolService from '../services/agentToolService.js';
import { ethers } from 'ethers';
import { Coinbase, Wallet } from "@coinbase/coinbase-sdk";

// Configure Coinbase SDK for Mantle network
Coinbase.configure({
  apiKeyName: process.env.COINBASE_API_KEY_NAME,
  privateKey: process.env.COINBASE_API_PRIVATE_KEY,
  // Configure for Mantle testnet
  networkConfig: {
    chainId: 5001,
    chainName: 'Mantle Testnet',
    nativeCurrency: {
      name: 'MNT',
      symbol: 'MNT',
      decimals: 18
    },
    rpcUrls: ['https://rpc.testnet.mantle.xyz'],
    blockExplorerUrls: ['https://explorer.testnet.mantle.xyz']
  }
});

const router = express.Router();

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

// Helper function to create Mantle wallet
const createMantleWallet = async (isTestnet = true) => {
  const provider = getMantleProvider(isTestnet);
  const wallet = ethers.Wallet.createRandom().connect(provider);
  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
    provider: provider
  };
};

// Simplified middleware that skips authentication
const skipAuth = (req, res, next) => next();

// Add at the top of the file
const logError = (error, context) => {
  console.error('Agent Route Error:', {
    timestamp: new Date().toISOString(),
    context,
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name
    }
  });
};

// Get all agents
router.get('/', async (req, res, next) => {
  try {
    logger.debug('Fetching all agents...');
    console.log('hello fetching all agents -----');
    
    // Add error handling for database connection
    if (!db) {
      throw new Error('Database connection not established');
    }

    // Ensure db.all is used to fetch all rows
    const agents = await new Promise((resolve, reject) => {
      db.all(`
        SELECT * FROM agents 
        ORDER BY created_at DESC
      `, (err, rows) => {
        if (err) {
          return reject(err);
        }
        resolve(rows);
      });
    });

    // If no agents exist, return empty array instead of error
    if (!agents || !agents.length) {
      return res.json({ 
        success: true,
        message: 'No agents found',
        data: [] 
      });
    }

    logger.info('Successfully fetched agents', { count: agents.length });
    
    const formattedAgents = agents.map(agent => {
      try {
        return {
          ...agent,
          is_running: Boolean(agent.is_running),
          tools: agent.tools ? JSON.parse(agent.tools) : [],
          created_at: agent.created_at || new Date().toISOString(),
          updated_at: agent.updated_at || new Date().toISOString(),
          description: agent.personality || 'No description available', // Add description for frontend
          image_url: null // Add image_url for frontend
        };
      } catch (parseError) {
        logError(parseError, `Error parsing agent data for agent ${agent.id}`);
        return {
          ...agent,
          is_running: Boolean(agent.is_running),
          tools: [],
          created_at: agent.created_at || new Date().toISOString(),
          updated_at: agent.updated_at || new Date().toISOString(),
          description: agent.personality || 'No description available',
          image_url: null
        };
      }
    });
    
    res.json({
      success: true,
      message: 'Agents fetched successfully',
      data: formattedAgents
    });
  } catch (error) {
    logger.error('Failed to fetch agents', error);
    // Send a more graceful error response
    res.status(500).json({
      success: false,
      message: 'Failed to fetch agents',
      data: [],
      error: error.message
    });
  }
});

// Get single agent
router.get('/:id', async (req, res) => {
  try {
    const agent = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM agents WHERE id = ?', [req.params.id], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
    
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    console.log("agent ---- ", agent);
    
    // Get agent tools using agentToolService
    const agentTools = await agentToolService.getAgentTools(req.params.id);
    console.log(`Tools fetched for agent ${agent.id}:`, agentTools);
    
    // Get agent videos
    const videos = await new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          av.*,
          GROUP_CONCAT(
            json_object(
              'id', vs.id,
              'scene_number', vs.scene_number,
              'prompt', vs.prompt,
              'status', vs.status,
              'error', vs.error
            )
          ) as scenes
        FROM agent_videos av
        LEFT JOIN video_scenes vs ON av.id = vs.video_id
        WHERE av.agent_id = ?
        GROUP BY av.id
        ORDER BY av.created_at DESC
      `, [req.params.id], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        
        // Parse the scenes JSON string for each video
        const formattedVideos = rows.map(video => ({
          ...video,
          scenes: video.scenes ? JSON.parse(`[${video.scenes}]`) : []
        }));
        
        resolve(formattedVideos);
      });
    });
    console.log(`Videos fetched for agent ${agent.id}:`, videos);
    
    // Get wallet balance and address if wallet_seed exists
    let walletBalance = '0';
    let walletAddress = agent.wallet_address;
    
    if (agent.wallet_seed && agent.wallet_id) {
      try {
        // Configure Coinbase SDK for Mantle network
        const mantleNetwork = {
          chainId: 5001,
          chainName: 'Mantle Testnet',
          nativeCurrency: {
            name: 'MNT',
            symbol: 'MNT',
            decimals: 18
          },
          rpcUrls: ['https://rpc.testnet.mantle.xyz'],
          blockExplorerUrls: ['https://explorer.testnet.mantle.xyz']
        };

        // Re-instantiate the wallet using the stored data
        const importedWallet = await Wallet.import({
          walletId: agent.wallet_id,
          seed: agent.wallet_seed,
          networkConfig: mantleNetwork
        });
        
        console.log(`Wallet imported for agent ${agent.id} with ID: ${importedWallet.getId()}`);
        
        // Get balance using ethers.js provider
        const provider = new ethers.providers.JsonRpcProvider('https://rpc.testnet.mantle.xyz');
        const wallet = new ethers.Wallet(agent.wallet_seed, provider);
        
        // If we don't have a wallet address stored, get it from the wallet
        if (!agent.wallet_address) {
          agent.wallet_address = wallet.address;
          console.log(`Default wallet address for agent ${agent.id}: ${agent.wallet_address}`);
          
          // Update the agent record with the wallet address
          await new Promise((resolve, reject) => {
            db.run('UPDATE agents SET wallet_address = ? WHERE id = ?', 
              [agent.wallet_address, agent.id], 
              (err) => {
                if (err) reject(err);
                else resolve();
              }
            );
          });
        }
        
        // Fetch the MNT balance using ethers.js provider
        const balance = await provider.getBalance(agent.wallet_address);
        walletBalance = ethers.utils.formatEther(balance);
        console.log(`Wallet balance for agent ${agent.id}: ${walletBalance} MNT`);
        
      } catch (walletError) {
        console.error('Error fetching wallet details:', walletError);
        // Continue without balance if there's an error
      }
    }
    
    console.log("Get single agent agent:", agent);
    
    // Format the response to match the Agent interface
    const formattedAgent = {
      ...agent,
      id: agent.id,
      is_running: Boolean(agent.is_running),
      tools: agentTools,
      videos: videos,
      description: agent.personality || 'No description available',
      image_url: agent.image_url || null,
      created_at: agent.created_at || new Date().toISOString(),
      updated_at: agent.updated_at || new Date().toISOString(),
      wallet_address: walletAddress,
      wallet_balance: walletBalance,
      frequency_seconds: agent.frequency ? Math.floor(agent.frequency / 1000) : 3600
    };
    res.json(formattedAgent);
  } catch (error) {
    console.error('Error fetching agent:', error);
    res.status(500).json({ error: 'Failed to fetch agent' });
  }
});

// Create agent
router.post('/', async (req, res) => {
  try {
    console.log('📝 Starting agent creation:', req.body.name);
    
    const {
      name,
      personality,
      model_name,
      frequency,
      telegram_bot_token,
      tools,
      use_testnet = true
    } = req.body;

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ 
        success: false,
        message: 'Name is required and must be a string' 
      });
    }

    const now = new Date().toISOString();
    
    if (!db) {
      throw new Error('Database connection not established');
    }

    // Create a Mantle wallet for the agent
    let wallet;
    try {
      wallet = await createMantleWallet(use_testnet);
      const network = use_testnet ? MANTLE_NETWORKS.testnet : MANTLE_NETWORKS.mainnet;
      
      // Print wallet details to console for manual funding
      console.log('=== New Agent Wallet Created ===');
      console.log(`Network: ${network.name}`);
      console.log(`Address: ${wallet.address}`);
      console.log(`Explorer URL: ${network.explorer}/address/${wallet.address}`);
      console.log('===============================');
      
      // Simplified insertion approach
      const result = await new Promise((resolve, reject) => {
        db.run(`
          INSERT INTO agents (
            name, personality, model_name, frequency,
            telegram_bot_token, tools, is_running,
            created_at, updated_at, wallet_id, wallet_seed, wallet_address
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          name,
          personality || '',
          model_name || 'gpt-4-turbo-preview',
          frequency || 3600000,
          telegram_bot_token || null,
          JSON.stringify(tools || []),
          0,
          now,
          now,
          wallet.address,
          wallet.privateKey,
          wallet.address
        ], function(err) {
          if (err) {
            reject(err);
          } else {
            resolve(this);
          }
        });
      });

      // Get the newly created agent
      const agent = await new Promise((resolve, reject) => {
        db.get('SELECT * FROM agents WHERE rowid = last_insert_rowid()', (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row);
          }
        });
      });
      
      if (!agent) {
        throw new Error('Agent created but not found on verification query');
      }

      console.log('✅ Agent created successfully:', agent.id);

      // After agent creation, set tools if provided
      if (req.body.toolIds && Array.isArray(req.body.toolIds)) {
        await agentToolService.setAgentTools(result.lastID, req.body.toolIds);
      }

      res.status(201).json({
        success: true,
        message: 'Agent created successfully',
        data: {
          ...agent,
          is_running: Boolean(agent.is_running),
          tools: agent.tools ? JSON.parse(agent.tools) : [],
          wallet_address: wallet.address,
          network: use_testnet ? MANTLE_NETWORKS.testnet : MANTLE_NETWORKS.mainnet
        }
      });
    } catch (error) {
      console.error('Error in wallet creation or agent insertion:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to create agent with wallet',
        error: error.message
      });
    }
  } catch (error) {
    console.error('❌ Error creating agent:', error.message);
    logError(error, 'POST /agents');
    res.status(500).json({ 
      success: false,
      message: 'Failed to create agent',
      error: error.message 
    });
  }
});

// Update agent
router.patch('/:id', async (req, res) => {
  console.log("patch line 351 ")
  try {
    const { id } = req.params;
    const updates = req.body;
    const fields = Object.keys(updates)
      .filter(key => ['name', 'personality', 'model_name', 'frequency', 'telegram_bot_token', 'is_running'].includes(key));
    
    if (fields.length === 0 && !updates.tools) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    // Only update the agent record if there are fields to update
    if (fields.length > 0) {
      const sql = `
        UPDATE agents 
        SET ${fields.map(f => `${f} = ?`).join(', ')}, updated_at = ?
        WHERE id = ?
      `;
      
      const values = [...fields.map(f => updates[f]), new Date().toISOString(), id];
      
      await db.run(sql, values);
    }
    
    // If tools are provided in the update, use agentToolService to update them
    if (updates.tools && Array.isArray(updates.tools)) {
      console.log(`Updating tools for agent ${id}:`, updates.tools);
      await agentToolService.setAgentTools(id, updates.tools);
    }
    
    // Get the updated agent
    const agent = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM agents WHERE id = ?', [id], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
    
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    
    // Get the updated tools
    const agentTools = await agentToolService.getAgentTools(id);
    
    // Format the response
    const formattedAgent = {
      ...agent,
      is_running: Boolean(agent.is_running),
      tools: agentTools,
      created_at: agent.created_at || new Date().toISOString(),
      updated_at: agent.updated_at || new Date().toISOString()
    };
    
    res.json(formattedAgent);
  } catch (error) {
    console.error('Error updating agent:', error);
    res.status(500).json({ error: 'Failed to update agent' });
  }
});

// Delete agent
router.delete('/:id', async (req, res) => {
  try {
    const agentId = req.params.id;
    
    // First delete related records
    await new Promise((resolve, reject) => {
      db.run('DELETE FROM agent_thoughts WHERE agent_id = ?', [agentId], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    await new Promise((resolve, reject) => {
      db.run('DELETE FROM agent_actions WHERE agent_id = ?', [agentId], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Then delete the agent
    const result = await new Promise((resolve, reject) => {
      db.run('DELETE FROM agents WHERE id = ?', [agentId], function(err) {
        if (err) reject(err);
        else resolve(this);
      });
    });

    if (result.changes === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Agent not found' 
      });
    }

    res.json({
      success: true,
      message: 'Agent and all related data deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting agent:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to delete agent',
      error: error.message 
    });
  }
});

// Get agent status
router.get('/:agentId/status', async (req, res, next) => {
  try {
    const status = await new Promise((resolve, reject) => {
      db.get('SELECT is_running FROM agents WHERE id = ?', [req.params.agentId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
    res.json({ is_running: status ? Boolean(status.is_running) : false });
  } catch (error) {
    next(error);
  }
});

// Toggle agent status
router.post('/:agentId/toggle', async (req, res) => {
  try {
    const agentId = parseInt(req.params.agentId);
    const { is_running } = req.body;

    // Get current agent state
    const agent = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM agents WHERE id = ?', [agentId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found'
      });
    }

    // Update agent status in database
    await new Promise((resolve, reject) => {
      db.run(
        'UPDATE agents SET is_running = ?, updated_at = ? WHERE id = ?',
        [is_running ? 1 : 0, new Date().toISOString(), agentId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    // Start or stop the agent brain service
    try {
      if (is_running) {
        await agentBrainService.startAgent(agentId);
      } else {
        await agentBrainService.stopAgent(agentId);
      }
    } catch (error) {
      console.error('Error in agent brain service:', error);
      // Continue with the response even if the brain service has an error
    }

    res.json({
      success: true,
      message: `Agent ${is_running ? 'started' : 'stopped'} successfully`,
      data: {
        id: agentId,
        is_running: is_running
      }
    });
  } catch (error) {
    console.error('Error toggling agent:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle agent status',
      error: error.message
    });
  }
});

// Configure agent
router.post('/configure', skipAuth, (req, res) => {
  const { personality, frequency, modelName } = req.body;
  
  // Update agent configuration
  db.run(
    `UPDATE agent_config 
     SET personality = ?, frequency = ?, model_name = ?, updated_at = ? 
     WHERE id = 1`,
    [
      personality, 
      frequency, 
      modelName,
      new Date().toISOString()
    ],
    function(err) {
      if (err) return res.status(500).json({ message: err.message });
      
      // Log the configuration
      db.run(
        'INSERT INTO agent_thoughts (type, content, model_name) VALUES (?, ?, ?)',
        [
          'system', 
          `Agent configuration updated: ${JSON.stringify({ personality, frequency, modelName })}`,
          'system'
        ],
        function(err) {
          if (err) console.error('Error logging agent configuration:', err.message);
          
          res.json({
            message: 'Agent configured successfully',
            configuration: {
              personality,
              frequency,
              modelName
            }
          });
        }
      );
    }
  );
});

// Get agent thoughts
router.get('/:agentId/thoughts', async (req, res) => {
  try {
    // First verify the agent exists
    const agent = await db.get('SELECT id FROM agents WHERE id = ?', [req.params.agentId]);
    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found'
      });
    }

    const thoughts = await new Promise((resolve, reject) => {
      db.all(
        `SELECT id, agent_id, type, content, timestamp, model_name 
         FROM agent_thoughts 
         WHERE agent_id = ? 
         ORDER BY timestamp DESC 
         `,
        [req.params.agentId],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
        }
      );
    });
    // console.log("thoughts: ", thoughts)

    res.json(thoughts || []);

  } catch (error) {
    console.error('Error getting agent thoughts:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch agent thoughts',
      error: error.message 
    });
  }
});

// Force agent to run now
router.post('/run-now', skipAuth, async (req, res) => {
  try {
    console.log('Forcing agent to run immediately');
    
    // Make sure the agent is running
    db.run('UPDATE agent_config SET is_running = 1 WHERE id = 1');
    
    // Force the agent to run immediately
    const success = await agentBrainService.forceRun();
    
    res.json({
      message: success ? 'Agent run completed successfully' : 'Agent run triggered but encountered an error',
      success: success
    });
  } catch (error) {
    console.error('Error forcing agent run:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get agent configuration
router.get('/:agentId/config', skipAuth, (req, res) => {
  db.get('SELECT * FROM agents WHERE id = ?', [req.params.agentId], (err, row) => {
    if (err) return res.status(500).json({ message: err.message });
    if (!row) return res.status(404).json({ message: 'Agent not found' });
    
    res.json(row);
  });
});

// Update agent configuration
router.post('/:id/config', async (req, res) => {
  const agentId = req.params.id;
  console.log('Updating agent configuration for agent ID:', agentId);
  console.log('Request body:', req.body);
  
  try {
    // Validate the agent exists
    const agent = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM agents WHERE id = ?', [agentId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    if (!agent) {
      return res.status(404).json({ 
        success: false, 
        message: 'Agent not found' 
      });
    }
    
    // Extract fields from request body
    const { name, personality, model_name, frequency, tools, telegram_bot_token } = req.body;
    
    // Update agent record
    await new Promise((resolve, reject) => {
      db.run(
        'UPDATE agents SET name = ?, personality = ?, model_name = ?, frequency = ?, telegram_bot_token = ?, updated_at = ? WHERE id = ?',
        [
          name || agent.name,
          personality || agent.personality,
          model_name || agent.model_name,
          frequency || agent.frequency,
          telegram_bot_token || agent.telegram_bot_token,
          new Date().toISOString(),
          agentId
        ],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
    
    // If tools array is provided, update the agent's tools
    if (tools && Array.isArray(tools)) {
      console.log('Updating tools for agent:', agentId, 'with tools:', tools);
      await agentToolService.setAgentTools(agentId, tools);
    }
    
    // Get the updated configuration
    const updatedAgent = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM agents WHERE id = ?', [agentId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    // Get the updated tools
    const updatedTools = await agentToolService.getAgentTools(agentId);
    
    res.json({
      success: true,
      message: 'Agent configuration updated successfully',
      config: {
        ...updatedAgent,
        tools: updatedTools
      }
    });
  } catch (error) {
    console.error('Error updating agent configuration:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update agent configuration',
      error: error.message 
    });
  }
});

// Get agent news
router.get('/:agentId/news', async (req, res) => {
  try {
    // First check if the agent exists
    const agent = await db.get('SELECT id FROM agents WHERE id = ?', [req.params.agentId]);
    
    if (!agent) {
      return res.status(404).json({ 
        success: false,
        message: 'Agent not found' 
      });
    }
    
    // Get the agent's tools using agentToolService
    const agentTools = await agentToolService.getAgentTools(req.params.agentId);
    
    // Check if the agent has a news tool
    if (!agentTools.some(tool => tool.tool_name.toLowerCase().includes('news'))) {
      return res.json([]);
    }

    const news = await new Promise((resolve, reject) => {
      db.all(`
        SELECT * FROM agent_news 
        WHERE agent_id = ? 
        ORDER BY published_at DESC 
        LIMIT 10
      `, [req.params.agentId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });

    // Format the news items to match the News interface
    const formattedNews = news.map(item => ({
      id: item.id,
      title: item.title,
      content: item.content,
      source: item.source,
      published_at: item.published_at
    }));

    res.json(formattedNews || []);
  } catch (error) {
    console.error('Error fetching agent news:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch agent news',
      error: error.message 
    });
  }
});

// Add this new route to get agent actions
router.get('/:agentId/actions', async (req, res) => {
  try {
    const agentId = parseInt(req.params.agentId);
    console.log('agentId: ', agentId);
    
    
    // First verify the agent exists
    const agent = await db.get('SELECT id FROM agents WHERE id = ?', [agentId]);
    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found'
      });
    }

    const actions = await new Promise((resolve, reject) => {
      db.all(`
        SELECT * FROM agent_actions 
        WHERE agent_id = ? 
        ORDER BY created_at DESC 
        LIMIT 10
      `, [agentId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });

    res.json({
      success: true,
      data: actions || []
    });

  } catch (error) {
    console.error('Error getting agent actions:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch agent actions',
      error: error.message 
    });
  }
});

// Get agent balance
router.get('/:id/balance', async (req, res) => {
  try {
    const agent = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM agents WHERE id = ?', [req.params.id], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
    
    if (!agent) {
      return res.status(404).json({ 
        success: false,
        message: 'Agent not found' 
      });
    }
    
    if (!agent.wallet_address) {
      return res.status(400).json({ 
        success: false,
        message: 'Agent does not have a wallet configured' 
      });
    }
    
    const provider = getMantleProvider(true); // Always use testnet for now
    const balance = await provider.getBalance(agent.wallet_address);
    
    res.json({
      success: true,
      data: {
        agent_id: agent.id,
        wallet_address: agent.wallet_address,
        balance: ethers.utils.formatEther(balance),
        network: MANTLE_NETWORKS.testnet.name
      }
    });
  } catch (error) {
    console.error('Error getting agent balance:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to get agent balance',
      error: error.message 
    });
  }
});

export default router; 