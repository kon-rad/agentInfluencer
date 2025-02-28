import { apiClient, API_CONFIG } from '../utils/api';

// Define the Tweet type
export type Tweet = {
  id?: number;
  content: string;
  username?: string;
  likes?: number;
  retweets?: number;
  created_at?: string;
};

// Tweet service
export const tweetService = {
  // Create a new tweet
  async createTweet(content: string): Promise<Tweet> {
    try {
      const response = await apiClient.post(API_CONFIG.ENDPOINTS.TWEETS, { content });
      return response;
    } catch (error) {
      console.error('Error creating tweet:', error);
      throw error;
    }
  },

  // Get all tweets
  async getAllTweets(): Promise<Tweet[]> {
    try {
      const response = await apiClient.get(API_CONFIG.ENDPOINTS.TWEETS);
      return response;
    } catch (error) {
      console.error('Error fetching tweets:', error);
      throw error;
    }
  },

  // Get tweets by user
  async getUserTweets(userId: number): Promise<Tweet[]> {
    try {
      const response = await apiClient.get(`${API_CONFIG.ENDPOINTS.TWEETS}/user/${userId}`);
      return response;
    } catch (error) {
      console.error('Error fetching user tweets:', error);
      throw error;
    }
  },

  // Like a tweet
  async likeTweet(tweetId: number): Promise<any> {
    try {
      const response = await apiClient.post(`${API_CONFIG.ENDPOINTS.TWEETS}/${tweetId}/like`, {});
      return response;
    } catch (error) {
      console.error('Error liking tweet:', error);
      throw error;
    }
  },

  // Retweet a tweet
  async retweetTweet(tweetId: number, originalUsername: string): Promise<any> {
    try {
      const response = await apiClient.post(`${API_CONFIG.ENDPOINTS.TWEETS}/${tweetId}/retweet`, {
        originalUsername
      });
      return response;
    } catch (error) {
      console.error('Error retweeting tweet:', error);
      throw error;
    }
  },

  // Delete a tweet
  async deleteTweet(tweetId: number): Promise<any> {
    try {
      const response = await apiClient.delete(`${API_CONFIG.ENDPOINTS.TWEETS}/${tweetId}`);
      return response;
    } catch (error) {
      console.error('Error deleting tweet:', error);
      throw error;
    }
  }
}; 