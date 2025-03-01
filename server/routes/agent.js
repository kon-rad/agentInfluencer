import express from 'express';
import logger from '../utils/logger.js';
import db from '../database.js';
import agentBrainService from '../services/agentBrainService.js';
import { Coinbase, Wallet } from "@coinbase/coinbase-sdk";

const router = express.Router();

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
    
    
    // Get wallet balance and address if wallet_seed exists
    let walletBalance = '0';
    let walletAddress = agent.wallet_address;
    
    if (agent.wallet_seed && agent.wallet_id) {
      try {
        // Re-instantiate the wallet using the stored data
        const importedWallet = await Wallet.import({
          walletId: agent.wallet_id,
          seed: agent.wallet_seed,
          networkId: Coinbase.networks.BaseSepolia
        });
        
        console.log(`Wallet imported for agent ${agent.id} with ID: ${importedWallet.getId()}`);
        
        // If we don't have a wallet address stored, get the default address
        if (!walletAddress) {
          const addressObj = await importedWallet.getDefaultAddress();
          walletAddress = addressObj.addressId; // Extract the address string
          console.log(`Default wallet address for agent ${agent.id}: ${walletAddress}`);
          
          // Update the agent record with the wallet address
          await new Promise((resolve, reject) => {
            db.run('UPDATE agents SET wallet_address = ? WHERE id = ?', 
              [walletAddress, agent.id], 
              (err) => {
                if (err) reject(err);
                else resolve();
              }
            );
          });
        }
        
        // Fetch the ETH balance
        const balance = await importedWallet.getBalance(Coinbase.assets.Eth);
        walletBalance = balance.toString();
        console.log(`Wallet balance for agent ${agent.id}: ${walletBalance} ETH`);
        
        // Also fetch all balances to see if there are other tokens
        const allBalances = await importedWallet.listBalances();
        console.log(`All wallet balances for agent ${agent.id}:`, JSON.stringify(allBalances));
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
      tools: agent.tools ? JSON.parse(agent.tools) : [],
      description: agent.personality || 'No description available',
      image_url: agent.image_url || null,
      created_at: agent.created_at || new Date().toISOString(),
      updated_at: agent.updated_at || new Date().toISOString(),
      wallet_address: walletAddress,
      wallet_balance: walletBalance,
      // Format frequency in seconds for display
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
      tools
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

    // Create a wallet for the agent
    let wallet;
    try {
      wallet = await Wallet.create({ networkId: Coinbase.networks.BaseSepolia });
      console.log(`Wallet created for agent ${name} with ID: ${wallet.getId()}`);
      
      // Get the default address
      const defaultAddressObj = await wallet.getDefaultAddress();
      console.log(`Default wallet address for agent ${name}: ${defaultAddressObj}`);
      
      // Extract the actual address string from the address object
      console.log("defaultAddressObj: --- ", defaultAddressObj, JSON.stringify(defaultAddressObj))
      
      // Export wallet data (contains seed and ID)
      const walletData = await wallet.export();
      const walletId = walletData.walletId;

      console.log(`Wallet data exported for agent ${name}`);
      console.log(`Wallet data walletDatat ${walletData}`, JSON.stringify(walletData));
      console.log(`Wallet ID: ${walletId}`);
      console.log(`Wallet seed: ${walletData.seed}`);

      // Fund the wallet with ETH from the faucet
      console.log(`Requesting ETH from faucet for agent ${name}...`);
      try {
        // Create a faucet request that returns a Faucet transaction
        let faucetTransaction = await wallet.faucet();
        
        // Wait for the faucet transaction to land on-chain
        await faucetTransaction.wait();
        
        console.log(`Faucet transaction completed: ${faucetTransaction}`);
        console.log(`Faucet transaction details: ${JSON.stringify(faucetTransaction)}`);
        
        // Get the updated balance after faucet funding
        const ethBalance = await wallet.getBalance(Coinbase.assets.Eth);
        console.log(`Wallet funded with ${ethBalance} ETH for agent ${name}`);
      } catch (faucetError) {
        console.error(`Error funding wallet from faucet: ${faucetError.message}`);
        // Continue with wallet creation even if faucet fails
      }
      
      const defaultAddress = defaultAddressObj.id;
      console.log("defaultAddress ---ffff ", defaultAddress)
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
          walletId, // Store wallet ID directly from wallet object
          walletData.seed, // Store wallet seed from export data
          defaultAddress // Store the address string, not the object
        ], function(err) {
          if (err) {
            reject(err);
          } else {
            resolve(this);
          }
        });
      });

      console.log('💾 Agent inserted into database, fetching newly created agent');

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

      res.status(201).json({
        success: true,
        message: 'Agent created successfully',
        data: {
          ...agent,
          is_running: Boolean(agent.is_running),
          tools: agent.tools ? JSON.parse(agent.tools) : [],
          wallet_id: walletId, // Include wallet ID in response
          wallet_address: defaultAddress, // Include wallet address in response
          wallet_seed: walletData.seed // Include wallet seed in response
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
  try {
    const { id } = req.params;
    const updates = req.body;
    const fields = Object.keys(updates)
      .filter(key => ['name', 'personality', 'model_name', 'frequency', 'telegram_bot_token', 'tools', 'is_running'].includes(key));
    
    if (fields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const sql = `
      UPDATE agents 
      SET ${fields.map(f => `${f} = ?`).join(', ')}, updated_at = ?
      WHERE id = ?
    `;
    
    const values = [...fields.map(f => f === 'tools' ? JSON.stringify(updates[f]) : updates[f]), new Date().toISOString(), id];
    
    await db.run(sql, values);
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
    
    res.json(agent);
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
router.post('/:agentId/config', skipAuth, (req, res) => {
  const { personality, model_name, frequency } = req.body;
  const agentId = req.params.agentId;
  
  // Build the update query dynamically based on provided fields
  let updateFields = [];
  let params = [];
  
  if (personality) {
    updateFields.push('personality = ?');
    params.push(personality);
  }
  
  if (model_name) {
    updateFields.push('model_name = ?');
    params.push(model_name);
  }
  
  if (frequency) {
    updateFields.push('frequency = ?');
    params.push(frequency);
  }
  
  // Add updated_at timestamp
  updateFields.push('updated_at = ?');
  params.push(new Date().toISOString());
  
  // Add the WHERE clause parameter
  params.push(agentId);
  
  const sql = `UPDATE agents SET ${updateFields.join(', ')} WHERE id = ?`;
  
  db.run(sql, params, function(err) {
    if (err) return res.status(500).json({ message: err.message });
    
    // Get the updated configuration
    db.get('SELECT * FROM agents WHERE id = ?', [agentId], (err, row) => {
      if (err) return res.status(500).json({ message: err.message });
      
      res.json({
        message: 'Agent configuration updated successfully',
        config: row
      });
    });
  });
});

// Get agent news
router.get('/:agentId/news', async (req, res) => {
  try {
    const agent = await db.get('SELECT tools FROM agents WHERE id = ?', [req.params.agentId]);
    
    if (!agent || !agent.tools) {
      return res.json([]);
    }

    const tools = JSON.parse(agent.tools);
    if (!tools.some(tool => tool.tool_name.toLowerCase().includes('news'))) {
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

// Add this new route after the other routes
// Fund agent wallet from faucet
router.post('/:id/fund', async (req, res) => {
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
    
    if (!agent.wallet_seed || !agent.wallet_id) {
      return res.status(400).json({ 
        success: false,
        message: 'Agent does not have a wallet configured' 
      });
    }
    
    // Re-instantiate the wallet using the stored data
    const importedWallet = await Wallet.import({
      walletId: agent.wallet_id,
      seed: agent.wallet_seed,
      networkId: Coinbase.networks.BaseSepolia
    });
    
    console.log(`Wallet imported for agent ${agent.id} with ID: ${importedWallet.getId()}`);
    
    // Get initial balance for comparison
    const initialBalance = await importedWallet.getBalance(Coinbase.assets.Eth);
    console.log(`Initial wallet balance for agent ${agent.id}: ${initialBalance} ETH`);
    
    // Request ETH from the faucet
    console.log(`Requesting ETH from faucet for agent ${agent.id}...`);
    
    // Create a faucet request that returns a Faucet transaction
    let faucetTransaction = await importedWallet.faucet();
    
    // Wait for the faucet transaction to land on-chain
    await faucetTransaction.wait();
    
    console.log(`Faucet transaction completed: ${faucetTransaction}`);
    
    // Get the updated balance after faucet funding
    const newBalance = await importedWallet.getBalance(Coinbase.assets.Eth);
    console.log(`Wallet funded with ${newBalance} ETH for agent ${agent.id}`);
    
    res.json({
      success: true,
      message: 'Agent wallet funded successfully',
      data: {
        agent_id: agent.id,
        wallet_address: agent.wallet_address,
        previous_balance: initialBalance.toString(),
        new_balance: newBalance.toString(),
        transaction: faucetTransaction
      }
    });
  } catch (error) {
    console.error('Error funding agent wallet:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fund agent wallet',
      error: error.message 
    });
  }
});

export default router; 