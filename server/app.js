import express from 'express';
import agentRoutes from './routes/agent.js';

const app = express();

// Add CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Parse JSON bodies
app.use(express.json());

// Mount routes - change the mount path to include /agents
app.use('/api/agents', agentRoutes);

export default app; 