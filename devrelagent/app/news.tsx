import React, { useState, useEffect } from 'react';
import { StyleSheet, FlatList, RefreshControl, ActivityIndicator, Text, View, TouchableOpacity } from 'react-native';
import axios from 'axios';
import { useRouter } from 'expo-router';

type NewsArticle = {
  id: number;
  title: string;
  url: string;
  content: string;
  source: string;
  published_at: string;
  fetched_at: string;
  tags: string;
};

export default function NewsScreen() {
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState('');
  const router = useRouter();

  const fetchNews = async () => {
    try {
      const response = await axios.get('http://localhost:3000/api/news');
      if (response.data && Array.isArray(response.data)) {
        setNews(response.data);
      }
    } catch (error) {
      console.error('Error fetching news:', error);
      setMessage('Failed to load news articles');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchFreshNews = async () => {
    try {
      setMessage('Fetching fresh news articles...');
      await axios.post('http://localhost:3000/api/news/fetch');
      setMessage('Successfully fetched new articles!');
      fetchNews();
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Error fetching fresh news:', error);
      setMessage('Failed to fetch fresh news');
      setTimeout(() => setMessage(''), 5000);
    }
  };

  useEffect(() => {
    fetchNews();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchNews();
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
        <Text style={styles.title}>Loading news...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Web3 News</Text>
      
      {message ? (
        <View style={styles.messageContainer}>
          <Text style={styles.message}>{message}</Text>
        </View>
      ) : null}
      
      <View style={styles.buttonContainer}>
        <Text style={styles.button} onPress={fetchFreshNews}>
          Fetch Fresh News
        </Text>
      </View>
      
      <FlatList
        data={news}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.newsItem}
            onPress={() => router.push(`/article/${item.id}`)}
          >
            <Text style={styles.newsTitle}>{item.title}</Text>
            <Text style={styles.newsSource}>
              {item.source} • {new Date(item.published_at).toLocaleDateString()}
            </Text>
            <Text style={styles.newsContent} numberOfLines={3}>
              {item.content.substring(0, 200)}...
            </Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No news articles available</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  messageContainer: {
    padding: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    marginBottom: 16,
  },
  message: {
    textAlign: 'center',
  },
  buttonContainer: {
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#2196F3',
    color: 'white',
    padding: 12,
    borderRadius: 4,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  newsItem: {
    padding: 16,
    marginBottom: 16,
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
  },
  newsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  newsSource: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  newsContent: {
    fontSize: 16,
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
  },
}); 