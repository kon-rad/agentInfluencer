import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, RefreshControl } from 'react-native';
import { apiClient } from '../../utils/api';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

export default function DashboardScreen() {
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [overview, setOverview] = useState({
    tweets: 0,
    engagements: { total: 0, likes: 0, retweets: 0, replies: 0 },
    campaigns: { active: 0, total: 0 }
  });
  const [agentThoughts, setAgentThoughts] = useState([]);
  const [agentStatus, setAgentStatus] = useState({ status: 'idle' });

  const fetchDashboardData = async () => {
    try {
      setError(null);
      setIsLoading(true);
      
      // Fetch overview analytics
      const overviewData = await apiClient.get('/analytics/overview');
      setOverview(overviewData);
      
      // Fetch agent thoughts
      const thoughtsData = await apiClient.get('/agent/thoughts');
      setAgentThoughts(thoughtsData);
      
      // Fetch agent status
      const statusData = await apiClient.get('/agent/status');
      setAgentStatus({ 
        status: statusData.is_running ? 'active' : 'inactive' 
      });
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchDashboardData();
  };

  const handleCreateAgent = () => {
    router.push('/agents/create');
  };

  const handleToggleAgent = async () => {
    try {
      setIsLoading(true);
      
      // The current status is opposite of what we want to set it to
      const newStatus = agentStatus?.status !== 'active';
      
      // Send the correct payload format to match what the API expects
      const response = await apiClient.post('/agent/toggle', {
        is_running: newStatus
      });
      
      // Update the agent status based on the response
      setAgentStatus({
        status: newStatus ? 'active' : 'inactive'
      });
      
      // Refresh dashboard data
      fetchDashboardData();
    } catch (err) {
      console.error('Error toggling agent status:', err);
      setError('Failed to toggle agent status. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && !isRefreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1DA1F2" />
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
      }
    >
      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchDashboardData}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Dashboard</Text>
            <View style={styles.headerActions}>
              <TouchableOpacity 
                style={styles.actionButton} 
                onPress={handleCreateAgent}
              >
                <Ionicons name="add-circle-outline" size={24} color="#1DA1F2" />
                <Text style={styles.actionButtonText}>New Agent</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[
                  styles.actionButton, 
                  { backgroundColor: agentStatus?.status === 'active' ? '#E0245E' : '#1DA1F2' }
                ]} 
                onPress={handleToggleAgent}
              >
                <Ionicons 
                  name={agentStatus?.status === 'active' ? "pause-circle-outline" : "play-circle-outline"} 
                  size={24} 
                  color="white" 
                />
                <Text style={[styles.actionButtonText, { color: 'white' }]}>
                  {agentStatus?.status === 'active' ? 'Pause Agent' : 'Start Agent'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{overview.tweets}</Text>
              <Text style={styles.statLabel}>Tweets</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{overview.engagements.total}</Text>
              <Text style={styles.statLabel}>Engagements</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{overview.campaigns.active}</Text>
              <Text style={styles.statLabel}>Active Campaigns</Text>
            </View>
          </View>
          
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Engagement Breakdown</Text>
          </View>
          
          <View style={styles.engagementBreakdown}>
            <View style={styles.engagementItem}>
              <View 
                style={[
                  styles.engagementBar, 
                  { 
                    backgroundColor: '#1DA1F2', 
                    width: `${(overview.engagements.likes / overview.engagements.total) * 100}%` 
                  }
                ]} 
              />
              <View style={styles.engagementInfo}>
                <Text style={styles.engagementLabel}>Likes</Text>
                <Text style={styles.engagementValue}>{overview.engagements.likes}</Text>
              </View>
            </View>
            
            <View style={styles.engagementItem}>
              <View 
                style={[
                  styles.engagementBar, 
                  { 
                    backgroundColor: '#17BF63', 
                    width: `${(overview.engagements.retweets / overview.engagements.total) * 100}%` 
                  }
                ]} 
              />
              <View style={styles.engagementInfo}>
                <Text style={styles.engagementLabel}>Retweets</Text>
                <Text style={styles.engagementValue}>{overview.engagements.retweets}</Text>
              </View>
            </View>

            <View style={styles.engagementItem}>
              <View 
                style={[
                  styles.engagementBar, 
                  { 
                    backgroundColor: '#794BC4', 
                    width: `${(overview.engagements.replies / overview.engagements.total) * 100}%` 
                  }
                ]} 
              />
              <View style={styles.engagementInfo}>
                <Text style={styles.engagementLabel}>Replies</Text>
                <Text style={styles.engagementValue}>{overview.engagements.replies}</Text>
              </View>
            </View>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#ff0000',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#1DA1F2',
    padding: 15,
    borderRadius: 5,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginRight: 20,
  },
  headerActions: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: 15,
    borderRadius: 5,
    marginRight: 10,
  },
  actionButtonText: {
    color: '#1DA1F2',
    fontSize: 16,
    fontWeight: 'bold',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
  },
  statCard: {
    flex: 1,
    padding: 15,
    borderRadius: 5,
    backgroundColor: '#f0f0f0',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  statLabel: {
    color: '#666',
  },
  sectionHeader: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  engagementBreakdown: {
    padding: 20,
  },
  engagementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  engagementBar: {
    height: 20,
    borderRadius: 10,
    marginRight: 10,
  },
  engagementInfo: {
    flex: 1,
  },
  engagementLabel: {
    color: '#666',
  },
  engagementValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});