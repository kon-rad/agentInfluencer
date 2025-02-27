import express from 'express';
import path from 'path';
import cors from 'cors';
import morgan from 'morgan';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import db from './database.js';
import { runMigrations } from './database/migrations.js';
import toolRegistryService from './services/toolRegistryService.js';

// Get current file path (ES Modules equivalent of __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev')); // Logging

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => {
  res.send('Twitter DevRel Agent API is running');
});

// Import route modules
import tweetRoutes from './routes/tweets.js';
import analyticsRoutes from './routes/analytics.js';
import campaignRoutes from './routes/campaigns.js';
import agentRoutes from './routes/agent.js';
import newsRoutes from './routes/news.js';
import toolRoutes from './routes/tools.js';

// Use routes
app.use('/api/tweets', tweetRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/tools', toolRoutes);

// Initialize agent brain service
console.log('Initializing agent brain service...');
// The service will self-initialize when imported

// Initialize tool registry service
console.log('Initializing tool registry service...');
// The service will self-initialize when imported

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// After database initialization
runMigrations().then(() => {
  // Start the server
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Error running migrations:', err);
  process.exit(1);
});

// Export the database connection for use in other files
export default db; 