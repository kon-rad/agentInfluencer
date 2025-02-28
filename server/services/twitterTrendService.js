import { ApifyClient } from 'apify-client';
import db from '../database.js';
import dotenv from 'dotenv';

dotenv.config();

// Apify API key
const APIFY_API_KEY = process.env.APIFY_API_KEY;

class TwitterTrendService {
  constructor() {
    this.client = new ApifyClient({
      token: APIFY_API_KEY,
    });
    this.trendKeywords = ['web3', 'crypto', 'blockchain'];
  }

  async fetchTwitterTrends() {
    console.log('Fetching Twitter trends for Web3 keywords...');
    
    try {
      const input = {
        searchTerms: this.trendKeywords,
        maxItems: 100,
        sort: 'Latest',
      };

      const run = await this.client.actor('apify/tweet-scraper').call(input);
      const { items } = await this.client.dataset(run.defaultDatasetId).listItems();

      console.log(`Received ${items.length} tweets from Apify`);

      const trends = items.map(item => ({
        content: item.text,
        author: item.user.username,
        created_at: item.created_at,
      }));

      await this.storeTrends(trends);
      return trends;
    } catch (error) {
      console.error('Error fetching Twitter trends:', error);
      throw error;
    }
  }

  async storeTrends(trends) {
    console.log(`Storing ${trends.length} trends in the database...`);

    const promises = trends.map(trend => {
      return new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO twitter_trends (content, author, created_at) VALUES (?, ?, ?)',
          [trend.content, trend.author, trend.created_at],
          function(err) {
            if (err) {
              console.error('Error storing trend:', err);
              reject(err);
              return;
            }
            console.log(`Stored trend: ${trend.content.substring(0, 50)}...`);
            resolve(this.lastID);
          }
        );
      });
    });

    return Promise.all(promises);
  }
}

const twitterTrendService = new TwitterTrendService();
export default twitterTrendService; 