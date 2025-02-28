import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { tweetService, Tweet } from '../services/tweetService';
import { Ionicons } from '@expo/vector-icons';

type TweetListProps = {
  refreshTrigger?: number; // Optional: to trigger refresh from parent
};

export default function TweetList({ refreshTrigger }: TweetListProps) {
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTweets = async () => {
    try {
      setError(null);
      const fetchedTweets = await tweetService.getAllTweets();
      setTweets(fetchedTweets);
    } catch (error) {
      console.error('Error fetching tweets:', error);
      setError('Failed to load tweets. Please try again.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTweets();
  }, [refreshTrigger]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchTweets();
  };

  const handleLike = async (tweetId: number) => {
    try {
      await tweetService.likeTweet(tweetId);
      // Update the tweet in the list
      setTweets(tweets.map(tweet => 
        tweet.id === tweetId 
          ? { ...tweet, likes: (tweet.likes || 0) + 1 } 
          : tweet
      ));
    } catch (error) {
      console.error('Error liking tweet:', error);
    }
  };

  const handleRetweet = async (tweetId: number, username: string) => {
    try {
      await tweetService.retweetTweet(tweetId, username);
      // Update the tweet in the list
      setTweets(tweets.map(tweet => 
        tweet.id === tweetId 
          ? { ...tweet, retweets: (tweet.retweets || 0) + 1 } 
          : tweet
      ));
      // Refresh the list to show the new retweet
      fetchTweets();
    } catch (error) {
      console.error('Error retweeting:', error);
    }
  };

  const handleDelete = async (tweetId: number) => {
    try {
      await tweetService.deleteTweet(tweetId);
      // Remove the tweet from the list
      setTweets(tweets.filter(tweet => tweet.id !== tweetId));
    } catch (error) {
      console.error('Error deleting tweet:', error);
    }
  };

  const renderTweet = ({ item }: { item: Tweet }) => {
    // All tweets can be deleted in the simplified version
    const canDelete = true;
    
    return (
      <View style={styles.tweetContainer}>
        <View style={styles.tweetHeader}>
          <Text style={styles.username}>@devrelagent</Text>
          <Text style={styles.date}>
            {new Date(item.created_at || '').toLocaleDateString()}
          </Text>
        </View>
        
        <Text style={styles.content}>{item.content}</Text>
        
        <View style={styles.tweetActions}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => handleLike(item.id!)}
          >
            <Ionicons name="heart-outline" size={18} color="#657786" />
            <Text style={styles.actionText}>{item.likes || 0}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => handleRetweet(item.id!, item.username || 'devrelagent')}
          >
            <Ionicons name="repeat-outline" size={18} color="#657786" />
            <Text style={styles.actionText}>{item.retweets || 0}</Text>
          </TouchableOpacity>
          
          {canDelete && (
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => handleDelete(item.id!)}
            >
              <Ionicons name="trash-outline" size={18} color="#657786" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1DA1F2" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchTweets}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (tweets.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>No tweets found</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchTweets}>
          <Text style={styles.retryButtonText}>Refresh</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <FlatList
      data={tweets}
      renderItem={renderTweet}
      keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          colors={['#1DA1F2']}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  tweetContainer: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e8ed',
  },
  tweetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  username: {
    fontWeight: 'bold',
    fontSize: 15,
  },
  date: {
    color: '#657786',
    fontSize: 13,
  },
  content: {
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 10,
  },
  tweetActions: {
    flexDirection: 'row',
    marginTop: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  actionText: {
    marginLeft: 5,
    color: '#657786',
  },
  errorText: {
    color: 'red',
    marginBottom: 15,
    textAlign: 'center',
  },
  emptyText: {
    color: '#657786',
    marginBottom: 15,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#1DA1F2',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: 'bold',
  }
}); 