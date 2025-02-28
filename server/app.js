const express = require('express');
const app = express();
const agentRoutes = require('./routes/agent');
const analyticsRoutes = require('./routes/analytics');

// ... existing middleware setup ...

app.use('/api/agent', agentRoutes);
app.use('/api/analytics', analyticsRoutes);

// ... rest of the file ... 