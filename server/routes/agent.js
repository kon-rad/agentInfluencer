import express from 'express';
import logger from '../utils/logger.js';
import db from '../database.js';
import agentBrainService from '../services/agentBrainService.js';

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
    const agent = await db.get('SELECT * FROM agents WHERE id = ?', [req.params.id]);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    // Format the response to match the Agent interface
    const formattedAgent = {
      ...agent,
      is_running: Boolean(agent.is_running),
      tools: agent.tools ? JSON.parse(agent.tools) : [],
      description: agent.personality || 'No description available',
      image_url: agent.image_url || null,
      created_at: agent.created_at || new Date().toISOString(),
      updated_at: agent.updated_at || new Date().toISOString()
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

    // Simplified insertion approach
    const result = await db.run(`
      INSERT INTO agents (
        name, personality, model_name, frequency,
        telegram_bot_token, tools, is_running,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      name,
      personality || '',
      model_name || 'gpt-4-turbo-preview',
      frequency || 3600000,
      telegram_bot_token || null,
      JSON.stringify(tools || []),
      0,
      now,
      now
    ]);

    console.log('💾 Agent inserted into database, fetching newly created agent');

    // Get the newly created agent
    const agent = await db.get('SELECT * FROM agents WHERE rowid = last_insert_rowid()');
    
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
        tools: agent.tools ? JSON.parse(agent.tools) : []
      }
    });
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
    const agent = await db.get('SELECT * FROM agents WHERE id = ?', [id]);
    
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
    const result = await db.run('DELETE FROM agents WHERE id = ?', [req.params.id]);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting agent:', error);
    res.status(500).json({ error: 'Failed to delete agent' });
  }
});

// Get agent status
router.get('/:agentId/status', async (req, res, next) => {
  try {
    const status = await db.get('SELECT is_running FROM agents WHERE id = ?', [req.params.agentId]);
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

    const thoughts = await db.all(
      `SELECT id, agent_id, type, content, timestamp, model_name 
       FROM agent_thoughts 
       WHERE agent_id = ? 
       ORDER BY timestamp DESC 
       LIMIT 10`,
      [req.params.agentId]
    );

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

    const news = await db.all(`
      SELECT * FROM agent_news 
      WHERE agent_id = ? 
      ORDER BY published_at DESC 
      LIMIT 10
    `, [req.params.agentId]);

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

    const actions = await db.all(`
      SELECT * FROM agent_actions 
      WHERE agent_id = ? 
      ORDER BY created_at DESC 
      LIMIT 10
    `, [agentId]);

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

export default router; 