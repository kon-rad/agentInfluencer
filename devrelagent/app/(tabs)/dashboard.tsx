import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, RefreshControl } from 'react-native';
import { apiClient } from '../../utils/api';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

export default function DashboardScreen() {
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overview, setOverview] = useState({
    agents: { total: 0, active: 0 },
    campaigns: { total: 0, active: 0 }
  });

  const fetchDashboardData = async () => {
    try {
      setError(null);
      setIsLoading(true);
      
      // Fetch overview data
      const overviewData = await apiClient.get('/analytics/overview');
      setOverview(overviewData);
      
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
            <TouchableOpacity 
              style={styles.actionButton} 
              onPress={handleCreateAgent}
            >
              <Ionicons name="add-circle-outline" size={24} color="#1DA1F2" />
              <Text style={styles.actionButtonText}>New Agent</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{overview.agents.active}</Text>
              <Text style={styles.statLabel}>Active Agents</Text>
              <Text style={styles.statSubtext}>of {overview.agents.total} total</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{overview.campaigns.active}</Text>
              <Text style={styles.statLabel}>Active Campaigns</Text>
              <Text style={styles.statSubtext}>of {overview.campaigns.total} total</Text>
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
  statSubtext: {
    color: '#666',
    fontSize: 12,
    marginTop: 4,
  },
});