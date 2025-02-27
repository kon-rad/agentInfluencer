import express from 'express';
import db from '../database.js';
import newsAnalysisService from '../services/newsAnalysisService.js';

const router = express.Router();

// Simplified middleware that skips authentication
const skipAuth = (req, res, next) => {
  next();
};

// Get recent news articles
router.get('/', skipAuth, async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : 10;
    const news = await newsAnalysisService.getRecentNews(limit);
    res.json(news);
  } catch (error) {
    console.error('Error fetching news:', error);
    res.status(500).json({ message: error.message });
  }
});

// Force fetch new articles
router.post('/fetch', skipAuth, async (req, res) => {
  try {
    console.log('Manually triggering news fetch...');
    const articles = await newsAnalysisService.fetchNewsArticles();
    res.json({ 
      message: `Successfully fetched ${articles.length} news articles`,
      articles: articles
    });
  } catch (error) {
    console.error('Error fetching news:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get available agent tools
router.get('/tools', skipAuth, (req, res) => {
  db.all('SELECT * FROM agent_tools', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ message: err.message });
    }
    res.json(rows || []);
  });
});

// Get count of news articles
router.get('/count', skipAuth, (req, res) => {
  db.get('SELECT COUNT(*) as count FROM news_articles', [], (err, row) => {
    if (err) {
      return res.status(500).json({ message: err.message });
    }
    res.json({ count: row ? row.count : 0 });
  });
});

export default router; 