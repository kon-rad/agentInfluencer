import express from 'express';
import db from '../server.js';

const router = express.Router();

// Simplified middleware that skips authentication
const skipAuth = (req, res, next) => {
  // Set a default user ID for all requests
  req.user = { id: 1 };
  next();
};

// Get overview analytics
router.get('/overview', skipAuth, (req, res) => {
  // Get total tweets
  db.get('SELECT COUNT(*) as total_tweets FROM tweets', [], (err, tweetData) => {
    if (err) return res.status(500).json({ message: err.message });
    
    // Get total engagements
    db.get(
      `SELECT 
        SUM(likes) as total_likes, 
        SUM(retweets) as total_retweets,
        SUM(replies) as total_replies
       FROM tweets`,
      [],
      (err, engagementData) => {
        if (err) return res.status(500).json({ message: err.message });
        
        // Get campaign stats
        db.get(
          `SELECT 
            COUNT(*) as total_campaigns,
            SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_campaigns
           FROM campaigns`,
          [],
          (err, campaignData) => {
            if (err) return res.status(500).json({ message: err.message });
            
            res.json({
              tweets: tweetData.total_tweets,
              engagements: {
                likes: engagementData.total_likes || 0,
                retweets: engagementData.total_retweets || 0,
                replies: engagementData.total_replies || 0,
                total: (engagementData.total_likes || 0) + 
                       (engagementData.total_retweets || 0) + 
                       (engagementData.total_replies || 0)
              },
              campaigns: {
                total: campaignData.total_campaigns,
                active: campaignData.active_campaigns
              }
            });
          }
        );
      }
    );
  });
});

// Get campaign analytics
router.get('/campaigns/:id', skipAuth, (req, res) => {
  const campaignId = req.params.id;
  
  // First check if the campaign exists
  db.get('SELECT * FROM campaigns WHERE id = ?', [campaignId], (err, campaign) => {
    if (err) return res.status(500).json({ message: err.message });
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
    
    // Get tweet stats for the campaign
    db.get(
      `SELECT 
        COUNT(*) as total_tweets,
        SUM(likes) as total_likes,
        SUM(retweets) as total_retweets,
        SUM(replies) as total_replies
       FROM tweets 
       WHERE campaign_id = ?`,
      [campaignId],
      (err, tweetStats) => {
        if (err) return res.status(500).json({ message: err.message });
        
        // Get engagement over time
        db.all(
          `SELECT 
            strftime('%Y-%m-%d', created_at) as date,
            SUM(likes) as likes,
            SUM(retweets) as retweets,
            SUM(replies) as replies
           FROM tweets 
           WHERE campaign_id = ?
           GROUP BY date
           ORDER BY date`,
          [campaignId],
          (err, engagementTrend) => {
            if (err) return res.status(500).json({ message: err.message });
            
            res.json({
              campaign: campaign,
              stats: {
                tweets: tweetStats.total_tweets,
                likes: tweetStats.total_likes || 0,
                retweets: tweetStats.total_retweets || 0,
                replies: tweetStats.total_replies || 0,
                total_engagement: (tweetStats.total_likes || 0) + 
                                 (tweetStats.total_retweets || 0) + 
                                 (tweetStats.total_replies || 0)
              },
              engagement_trend: engagementTrend
            });
          }
        );
      }
    );
  });
});

// Get tweet analytics
router.get('/tweets/:id', skipAuth, (req, res) => {
  const tweetId = req.params.id;
  
  db.get('SELECT * FROM tweets WHERE id = ?', [tweetId], (err, tweet) => {
    if (err) return res.status(500).json({ message: err.message });
    if (!tweet) return res.status(404).json({ message: 'Tweet not found' });
    
    res.json({
      tweet: tweet,
      stats: {
        likes: tweet.likes,
        retweets: tweet.retweets,
        replies: tweet.replies,
        total: tweet.likes + tweet.retweets + tweet.replies
      }
    });
  });
});

// Get growth analytics
router.get('/growth', skipAuth, (req, res) => {
  const userId = req.user.id;
  
  // Get follower growth over time
  db.all(
    `SELECT 
      strftime('%Y-%m', created_at) as month,
      COUNT(*) as new_followers
     FROM followers
     WHERE following_id = ?
     GROUP BY month
     ORDER BY month`,
    [userId],
    (err, followerGrowth) => {
      if (err) return res.status(500).json({ message: err.message });
      
      // Get tweet growth over time
      db.all(
        `SELECT 
          strftime('%Y-%m', created_at) as month,
          COUNT(*) as new_tweets
         FROM tweets
         WHERE user_id = ?
         GROUP BY month
         ORDER BY month`,
        [userId],
        (err, tweetGrowth) => {
          if (err) return res.status(500).json({ message: err.message });
          
          // Get engagement growth over time
          db.all(
            `SELECT 
              strftime('%Y-%m', created_at) as month,
              SUM(likes) as likes,
              SUM(retweets) as retweets,
              SUM(replies) as replies
             FROM tweets
             WHERE user_id = ?
             GROUP BY month
             ORDER BY month`,
            [userId],
            (err, engagementGrowth) => {
              if (err) return res.status(500).json({ message: err.message });
              
              res.json({
                follower_growth: followerGrowth,
                tweet_growth: tweetGrowth,
                engagement_growth: engagementGrowth
              });
            }
          );
        }
      );
    }
  );
});

// Get engagement analytics
router.get('/engagement', skipAuth, (req, res) => {
  db.all(
    `SELECT 
      t.*,
      (t.likes + t.retweets + t.replies) as total_engagement
     FROM tweets t
     ORDER BY total_engagement DESC
     LIMIT 10`,
    [],
    (err, topTweets) => {
      if (err) return res.status(500).json({ message: err.message });
      
      db.get(
        `SELECT 
          SUM(likes) as total_likes,
          SUM(retweets) as total_retweets,
          SUM(replies) as total_replies
         FROM tweets`,
        [],
        (err, engagementByType) => {
          if (err) return res.status(500).json({ message: err.message });
          
          res.json({
            top_tweets: topTweets,
            engagement_by_type: {
              likes: engagementByType.total_likes || 0,
              retweets: engagementByType.total_retweets || 0,
              replies: engagementByType.total_replies || 0
            }
          });
        }
      );
    }
  );
});

export default router; 