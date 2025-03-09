import express from 'express';
import path from 'path';
import cors from 'cors';
import morgan from 'morgan';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import db from './database.js';
import { runMigrations } from './database/migrations.js';
import toolRegistryService from './services/toolRegistryService.js';
import agentBrainService from './services/agentBrainService.js';
import { Coinbase } from "@coinbase/coinbase-sdk";
import * as dotenv from 'dotenv' // see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
dotenv.config()

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
app.use('/api/agents', agentRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/tools', toolRoutes);

// Initialize the application
async function initializeApp() {
  try {
    console.log('Running migrations...');
    await runMigrations();
    
    console.log('Initializing services...');
    try {
      await toolRegistryService.initialize();
      console.log('Tool registry service initialized successfully');
    } catch (error) {
      console.error('Tool registry service initialization failed:', error);
      throw error;
    }

    try {
      await agentBrainService.initialize();
      console.log('Agent brain service initialized successfully');
    } catch (error) {
      console.error('Agent brain service initialization failed:', error);
      throw error;
    }

    // Initialize Coinbase SDK
    try {
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
      console.log('Coinbase SDK initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Coinbase SDK', error);
    }
    
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to initialize application:', error.stack);
    process.exit(1);
  }
}

initializeApp();

// Enhance error handling middleware
app.use((err, req, res, next) => {
  console.error('Error details:', {
    message: err.message,
    stack: err.stack,
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method,
    body: req.body,
    query: req.query
  });

  res.status(500).json({
    success: false,
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? {
      message: err.message,
      stack: err.stack
    } : undefined
  });
});

// Export the database connection for use in other files
export default db;