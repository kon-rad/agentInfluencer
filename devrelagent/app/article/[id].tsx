import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import axios from 'axios';

interface Article {
  id: number;
  title: string;
  url: string;
  content: string;
  summary: string;
  source: string;
  published_at: string;
  fetched_at: string;
  tags: string;
}

export default function ArticleDetailScreen() {
  const { id } = useLocalSearchParams();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchArticle();
  }, [id]);

  const fetchArticle = async () => {
    try {
      const response = await axios.get(`http://localhost:3000/api/news/${id}`);
      setArticle(response.data);
    } catch (error) {
      console.error('Error fetching article:', error);
      setError('Failed to load article');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error || !article) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error || 'Article not found'}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>{article.title}</Text>
      
      <View style={styles.metadata}>
        <Text style={styles.source}>{article.source}</Text>
        <Text style={styles.date}>
          Published: {formatDate(article.published_at)}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Summary</Text>
        <Text style={styles.summary}>{article.summary}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Full Article</Text>
        <Text style={styles.content}>{article.content}</Text>
      </View>

      <View style={styles.tagsContainer}>
        {article.tags.split(',').map((tag, index) => (
          <Text key={index} style={styles.tag}>#{tag.trim()}</Text>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  metadata: {
    marginBottom: 20,
  },
  source: {
    fontSize: 16,
    color: '#1DA1F2',
    marginBottom: 4,
  },
  date: {
    fontSize: 14,
    color: '#657786',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#14171A',
  },
  summary: {
    fontSize: 16,
    lineHeight: 24,
    color: '#14171A',
    backgroundColor: '#F5F8FA',
    padding: 16,
    borderRadius: 8,
  },
  content: {
    fontSize: 16,
    lineHeight: 24,
    color: '#14171A',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 16,
    marginBottom: 24,
  },
  tag: {
    fontSize: 14,
    color: '#1DA1F2',
    backgroundColor: '#E8F5FE',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: '#E0245E',
    textAlign: 'center',
  },
}); 