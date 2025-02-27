import express from 'express';
import toolRegistryService from '../services/toolRegistryService.js';

const router = express.Router();

// Simplified middleware that skips authentication
const skipAuth = (req, res, next) => {
  next();
};

// Get all registered tools
router.get('/', skipAuth, async (req, res) => {
  try {
    const tools = await toolRegistryService.getRegisteredTools();
    res.json(tools);
  } catch (error) {
    console.error('Error fetching tools:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get recent tool actions
router.get('/actions', skipAuth, async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : 10;
    const actions = await toolRegistryService.getRecentActions(limit);
    res.json(actions);
  } catch (error) {
    console.error('Error fetching tool actions:', error);
    res.status(500).json({ message: error.message });
  }
});

// Execute a tool manually
router.post('/execute', skipAuth, async (req, res) => {
  try {
    const { toolName, parameters } = req.body;
    
    if (!toolName) {
      return res.status(400).json({ message: 'Tool name is required' });
    }
    
    const result = await toolRegistryService.executeTool(toolName, parameters || {});
    res.json({ 
      message: `Successfully executed ${toolName}`,
      result: result
    });
  } catch (error) {
    console.error('Error executing tool:', error);
    res.status(500).json({ message: error.message });
  }
});

export default router; 