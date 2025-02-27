import db from '../database.js';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

// Apify API key
const APIFY_API_KEY = process.env.APIFY_API_KEY;

class NewsAnalysisService {
  constructor() {
    this.apifyUrl = 'https://api.apify.com/v2/acts/apify/website-content-crawler/run-sync-get-dataset-items';
    this.newsSource = 'https://cointelegraph.com/tags/web3';
    this.maxArticles = 3; // Default number of articles to fetch
  }

  async fetchNewsArticles() {
    console.log('Fetching news articles from Cointelegraph...');
    
    try {
      // Call Apify API to crawl the website
      const response = await axios.post(
        this.apifyUrl,
        {
          startUrls: [{ url: this.newsSource }],
          maxCrawlPages: 10,
          maxCrawlDepth: 1,
          maxResults: this.maxArticles,
          pageLoadTimeoutSecs: 60
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${APIFY_API_KEY}`
          }
        }
      );

      console.log(`Received ${response.data.length} articles from Apify`);
      
      // Process and store the articles
      if (response.data && Array.isArray(response.data)) {
        const articles = response.data.map(item => {
          // Extract relevant information from the crawled data
          return {
            title: item.metadata?.title || 'Untitled Article',
            url: item.url,
            content: item.text || '',
            source: 'Cointelegraph',
            published_at: item.metadata?.datePublished || new Date().toISOString(),
            fetched_at: new Date().toISOString(),
            tags: 'web3,blockchain,crypto'
          };
        });

        // Store articles in the database
        await this.storeArticles(articles);
        return articles;
      }
      
      return [];
    } catch (error) {
      console.error('Error fetching news articles:', error);
      console.error('Error details:', error.response?.data || error.message);
      throw error;
    }
  }

  async storeArticles(articles) {
    console.log(`Storing ${articles.length} articles in the database...`);
    
    const promises = articles.map(article => {
      return new Promise((resolve, reject) => {
        // Check if article already exists to avoid duplicates
        db.get('SELECT id FROM news_articles WHERE url = ?', [article.url], (err, row) => {
          if (err) {
            console.error('Error checking for existing article:', err);
            reject(err);
            return;
          }
          
          if (row) {
            console.log(`Article already exists: ${article.title}`);
            resolve(row.id);
            return;
          }
          
          // Insert new article
          db.run(
            `INSERT INTO news_articles 
            (title, url, content, source, published_at, fetched_at, tags) 
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              article.title,
              article.url,
              article.content,
              article.source,
              article.published_at,
              article.fetched_at,
              article.tags
            ],
            function(err) {
              if (err) {
                console.error('Error storing article:', err);
                reject(err);
                return;
              }
              console.log(`Stored article: ${article.title} with ID: ${this.lastID}`);
              resolve(this.lastID);
            }
          );
        });
      });
    });
    
    return Promise.all(promises);
  }

  async getRecentNews(limit = 3) {
    console.log(`Getting ${limit} recent news articles...`);
    
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM news_articles ORDER BY fetched_at DESC LIMIT ?',
        [limit],
        (err, rows) => {
          if (err) {
            console.error('Error getting recent news:', err);
            reject(err);
            return;
          }
          
          console.log(`Retrieved ${rows?.length || 0} recent news articles`);
          resolve(rows || []);
        }
      );
    });
  }

  // Method to check if we have recent news, and fetch if not
  async ensureFreshNews() {
    // Get the most recent article
    const recentArticle = await new Promise((resolve, reject) => {
      db.get(
        'SELECT fetched_at FROM news_articles ORDER BY fetched_at DESC LIMIT 1',
        [],
        (err, row) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(row);
        }
      );
    });
    
    // If no articles or the most recent is older than 6 hours, fetch new ones
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    
    if (!recentArticle || recentArticle.fetched_at < sixHoursAgo) {
      console.log('News is stale or missing, fetching fresh articles...');
      await this.fetchNewsArticles();
    } else {
      console.log('Recent news is available, skipping fetch');
    }
  }
}

// Create and export a singleton instance
const newsAnalysisService = new NewsAnalysisService();
export default newsAnalysisService; 