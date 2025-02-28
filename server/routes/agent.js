import express from 'express';
import db from '../database.js';
import agentBrainService from '../services/agentBrainService.js';

const router = express.Router();

// Simplified middleware that skips authentication
const skipAuth = (req, res, next) => {
  next();
};

// Get agent status
router.get('/:agentId/status', async (req, res) => {
  try {
    const status = await db.get('SELECT is_running FROM agents WHERE id = ?', [req.params.agentId]);
    res.json({ is_running: status ? status.is_running : false });
  } catch (error) {
    console.error('Error getting agent status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Toggle agent status
router.post('/:agentId/toggle', async (req, res) => {
  try {
    const { is_running } = req.body;
    await db.run(
      'UPDATE agents SET is_running = ? WHERE id = ?',
      [is_running, req.params.agentId]
    );
    res.json({ success: true, is_running });
  } catch (error) {
    console.error('Error toggling agent status:', error);
    res.status(500).json({ error: 'Internal server error' });
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
    const thoughts = await db.all(
      'SELECT * FROM agent_thoughts WHERE agent_id = ? ORDER BY created_at DESC LIMIT 10',
      [req.params.agentId]
    );
    res.json(thoughts);
  } catch (error) {
    console.error('Error getting agent thoughts:', error);
    res.status(500).json({ error: 'Internal server error' });
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

// Get all agents
router.get('/agents', (req, res) => {
  db.all('SELECT * FROM agents', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Create new agent
router.post('/', async (req, res) => {
  const {
    name,
    personality,
    model_name,
    frequency,
    telegram_bot_token,
    tools
  } = req.body;

  try {
    // Insert the new agent into the database
    const sql = `
      INSERT INTO agents (
        name,
        personality,
        model_name,
        frequency,
        telegram_bot_token,
        tools,
        is_running,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const now = new Date().toISOString();
    
    db.run(sql, [
      name,
      personality,
      model_name,
      frequency,
      telegram_bot_token,
      JSON.stringify(tools),
      false, // is_running default false
      now,   // created_at
      now    // updated_at
    ], function(err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to create agent' });
      }

      // Get the created agent
      db.get('SELECT * FROM agents WHERE id = ?', [this.lastID], (err, agent) => {
        if (err) {
          console.error('Error fetching created agent:', err);
          return res.status(500).json({ error: 'Failed to fetch created agent' });
        }
        res.status(201).json(agent);
      });
    });
  } catch (error) {
    console.error('Error creating agent:', error);
    res.status(500).json({ error: 'Failed to create agent' });
  }
});

// Get specific agent
router.get('/agent/:id', (req, res) => {
  const agentId = req.params.id;
  
  db.get('SELECT * FROM agents WHERE id = ?', [agentId], (err, agent) => {
    if (err) {
      console.error('Error fetching agent:', err);
      return res.status(500).json({ error: 'Failed to fetch agent' });
    }
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    res.json(agent);
  });
});

// Update agent
router.put('/agents/:id', async (req, res) => {
  try {
    const [agent] = await db('agents')
      .where({ id: req.params.id })
      .update(req.body)
      .returning('*');
    
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
router.delete('/agents/:id', async (req, res) => {
  try {
    const deleted = await db('agents').where({ id: req.params.id }).delete();
    if (!deleted) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting agent:', error);
    res.status(500).json({ error: 'Failed to delete agent' });
  }
});

// Modify your existing routes to include agentId
router.get('/agent/:id/thoughts', (req, res) => {
  const agentId = req.params.id;
  
  db.all(
    'SELECT * FROM agent_thoughts WHERE agent_id = ? ORDER BY timestamp DESC LIMIT 50',
    [agentId],
    (err, thoughts) => {
      if (err) {
        console.error('Error fetching agent thoughts:', err);
        return res.status(500).json({ error: 'Failed to fetch agent thoughts' });
      }
      res.json(thoughts || []);
    }
  );
});

export default router; 