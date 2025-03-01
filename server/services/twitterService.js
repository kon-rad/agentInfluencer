import fetch from 'node-fetch';
import db from '../database.js';
import dotenv from 'dotenv';

dotenv.config();

// Twitter API credentials from environment variables
const TWITTER_API_KEY = process.env.TWITTER_API_KEY;
const TWITTER_API_SECRET = process.env.TWITTER_API_SECRET;
const TWITTER_ACCESS_TOKEN = process.env.TWITTER_ACCESS_TOKEN;
const TWITTER_ACCESS_SECRET = process.env.TWITTER_ACCESS_SECRET;

class TwitterService {
  constructor() {
    this.baseUrl = 'https://api.twitter.com/2';
    this.bearerToken = null;
  }

  async initialize() {
    try {
      // Get bearer token for API access
      await this.getBearerToken();
      console.log('Twitter service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Twitter service:', error);
    }
  }

  async getBearerToken() {
    try {
      const credentials = Buffer.from(`${TWITTER_API_KEY}:${TWITTER_API_SECRET}`).toString('base64');
      
      const response = await fetch('https://api.twitter.com/oauth2/token', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials'
      });
      
      const data = await response.json();
      
      if (data.access_token) {
        this.bearerToken = data.access_token;
        return this.bearerToken;
      } else {
        throw new Error('Failed to get Twitter bearer token');
      }
    } catch (error) {
      console.error('Error getting Twitter bearer token:', error);
      throw error;
    }
  }

  async postTweet(content, mediaUrls = []) {
    try {
      // In a real implementation, this would use the Twitter API
      // For now, we'll simulate posting a tweet and store it in our database
      
      console.log(`Posting tweet: ${content}`);
      
      // Store the tweet in our database
      const tweetId = await this.storeTweet(content, mediaUrls);
      
      return {
        id: tweetId,
        text: content,
        created_at: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error posting tweet:', error);
      throw error;
    }
  }

  async getTweetReplies(tweetId) {
    try {
      // In a real implementation, this would fetch replies from the Twitter API
      // For now, we'll return a simulated set of replies
      
      console.log(`Getting replies for tweet ID: ${tweetId}`);
      
      // Simulate some replies
      return [
        {
          id: `reply_${Date.now()}_1`,
          text: "I've created a tutorial about Base L2! Check it out: https://example.com/tutorial",
          user: {
            screen_name: "web3developer1"
          },
          created_at: new Date().toISOString()
        },
        {
          id: `reply_${Date.now()}_2`,
          text: "Here's my submission for the bounty. I made a video explaining how to deploy contracts on Base.",
          user: {
            screen_name: "cryptobuilder"
          },
          created_at: new Date().toISOString()
        }
      ];
    } catch (error) {
      console.error('Error getting tweet replies:', error);
      throw error;
    }
  }

  async storeTweet(content, mediaUrls = []) {
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO tweets (content, media_urls, published_at, created_at) VALUES (?, ?, ?, ?)',
        [
          content, 
          JSON.stringify(mediaUrls), 
          new Date().toISOString(), 
          new Date().toISOString()
        ],
        function(err) {
          if (err) {
            reject(err);
            return;
          }
          resolve(this.lastID);
        }
      );
    });
  }
}

const twitterService = new TwitterService();
export default twitterService; 