import express from 'express';
import db from '../database.js';
import agentBrainService from '../services/agentBrainService.js';

const router = express.Router();

// Simplified middleware that skips authentication
const skipAuth = (req, res, next) => {
  next();
};

// Get agent status
router.get('/status', (req, res) => {
  db.get('SELECT is_running FROM agent_config WHERE id = 1', [], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(row || { is_running: false });
  });
});

// Toggle agent status
router.post('/toggle', (req, res) => {
  const { is_running } = req.body;
  
  db.run(
    'UPDATE agent_config SET is_running = ?, updated_at = ? WHERE id = 1',
    [is_running ? 1 : 0, new Date().toISOString()],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      // Start or stop the agent service
      if (is_running) {
        agentBrainService.start();
      } else {
        agentBrainService.stop();
      }
      
      res.json({ 
        success: true, 
        is_running: is_running 
      });
    }
  );
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
router.get('/thoughts', (req, res) => {
  const limit = req.query.limit || 20;
  
  db.all(
    'SELECT * FROM agent_thoughts ORDER BY timestamp DESC LIMIT ?',
    [limit],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(rows || []);
    }
  );
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
router.get('/config', skipAuth, (req, res) => {
  db.get('SELECT * FROM agent_config WHERE id = 1', [], (err, row) => {
    if (err) return res.status(500).json({ message: err.message });
    if (!row) return res.status(404).json({ message: 'Agent configuration not found' });
    
    res.json(row);
  });
});

// Update agent configuration
router.post('/config', skipAuth, (req, res) => {
  const { personality, model_name } = req.body;
  
  // Validate inputs
  if (!personality && !model_name) {
    return res.status(400).json({ message: 'No configuration changes provided' });
  }
  
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
  
  // Add updated_at timestamp
  updateFields.push('updated_at = ?');
  params.push(new Date().toISOString());
  
  // Add the WHERE clause parameter
  params.push(1); // id = 1
  
  const sql = `UPDATE agent_config SET ${updateFields.join(', ')} WHERE id = ?`;
  
  db.run(sql, params, function(err) {
    if (err) return res.status(500).json({ message: err.message });
    
    // Get the updated configuration
    db.get('SELECT * FROM agent_config WHERE id = 1', [], (err, row) => {
      if (err) return res.status(500).json({ message: err.message });
      
      res.json({
        message: 'Agent configuration updated successfully',
        config: row
      });
    });
  });
});

export default router; 