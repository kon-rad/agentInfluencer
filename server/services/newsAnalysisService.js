import db from '../database.js';
import dotenv from 'dotenv';
import { ApifyClient } from 'apify-client';

dotenv.config();

// Apify API key
const APIFY_API_KEY = process.env.APIFY_API_KEY;

class NewsAnalysisService {
  constructor() {
    this.client = new ApifyClient({
      token: APIFY_API_KEY,
    });
    this.newsSource = 'https://cointelegraph.com/tags/web3';
    this.maxArticles = 5; // Updated to fetch 5 articles
  }

  async fetchNewsArticles() {
    console.log('Fetching news articles from Cointelegraph Web3 section...');
    
    try {
      // Configure the Website Content Crawler with optimal settings for Cointelegraph
      const input = {
        "startUrls": [{ "url": this.newsSource }],
        "maxCrawlPages": 10,
        "maxResults": this.maxArticles,
        "crawlerType": "cheerio", // Using Cheerio for better performance
        "additionalMimeTypes": ["text/html"],
        "linkSelector": "article a.post-card-inline__title-link", // Target article links
        "keepUrlFragments": false,
        "maxCrawlDepth": 1,
        "maxPagesPerCrawl": 6, // Main page + 5 articles
        "maxRequestRetries": 3,
        "requestTimeoutSecs": 30,
        "maxRequestsPerCrawl": 6,
        "minConcurrency": 1,
        "maxConcurrency": 5,
        "removeElementsCssSelector": `
          nav, footer, header, 
          .post-actions, .post-sidebar,
          .related-posts, .advertisement,
          script, style, iframe,
          .social-share-buttons
        `,
        "saveSnapshot": false,
        "saveHtml": false,
        "saveMarkdown": true,
        "htmlTransformer": "readableText",
        "includeUrlGlobs": ["https://cointelegraph.com/news/*"],
        "excludeUrlGlobs": [
          "*/authors/*",
          "*/tags/*",
          "*/explained/*",
          "*/magazine/*"
        ]
      };

      // Run the Actor and wait for it to finish
      console.log('Starting Apify Website Content Crawler...');
      const run = await this.client.actor("apify/website-content-crawler").call(input);
      
      // Fetch results from the dataset
      console.log(`Run finished, fetching results from dataset: ${run.defaultDatasetId}`);
      const { items } = await this.client.dataset(run.defaultDatasetId).listItems();
      
      console.log(`Received ${items.length} items from Apify`);
      
      // Process and store the articles
      if (items && Array.isArray(items)) {
        const articles = items
          .filter(item => item.url && item.url.includes('/news/')) // Only process news articles
          .map(item => {
            // Extract and clean the article content
            let content = item.markdown || item.text || '';
            
            // Clean up the content
            content = content
              .replace(/Share this article/gi, '')
              .replace(/Follow us on social media/gi, '')
              .replace(/Subscribe to our newsletter/gi, '')
              .replace(/Related:\s*/g, '')
              .trim();

            return {
              title: item.metadata?.title || item.title || 'Untitled Article',
              url: item.url,
              content: content,
              source: 'Cointelegraph',
              published_at: item.metadata?.datePublished || new Date().toISOString(),
              fetched_at: new Date().toISOString(),
              tags: 'web3,blockchain,crypto'
            };
          })
          .filter(article => 
            article.content && 
            article.content.length > 100 && 
            article.title !== 'Untitled Article'
          )
          .slice(0, this.maxArticles); // Ensure we only keep the top 5 articles

        console.log(`Found ${articles.length} valid articles to store`);

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

  async getNewsCount() {
    return new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM news_articles', [], (err, row) => {
        if (err) {
          console.error('Error getting news count:', err);
          reject(err);
          return;
        }
        resolve(row?.count || 0);
      });
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

  async getArticleById(id) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM news_articles WHERE id = ?',
        [id],
        (err, row) => {
          if (err) {
            console.error('Error getting article:', err);
            reject(err);
            return;
          }
          resolve(row || null);
        }
      );
    });
  }
}

// Create and export a singleton instance
const newsAnalysisService = new NewsAnalysisService();
export default newsAnalysisService; 