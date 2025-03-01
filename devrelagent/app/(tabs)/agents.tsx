import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../../utils/api';
import { useRouter } from 'expo-router';

interface Agent {
  id: number;
  name: string;
  description: string;
  image_url: string | null;
  is_running: boolean;
  model_name: string;
  personality: string;
  frequency: string;
  created_at: string;
  updated_at: string;
  last_run?: string;
}

export default function AgentScreen() {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAgents = async () => {
    try {
      setError(null);
      const response = await apiClient.get('/agents');
      
      if (!response || !response.data) {
        throw new Error('No data received from server');
      }
      const { data } = response;
      if (!response.success) {
        throw new Error(response.message || 'Failed to load agents');
      }
      
      setAgents(data);
      
    } catch (error) {
      console.error('Error fetching agents:', error);
      setError('Failed to load agents. Please try again. zzz');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAgents();
  };

  const renderAgentItem = ({ item }: { item: Agent }) => (
    <TouchableOpacity 
      style={styles.agentCard}
      onPress={() => router.push(`/agent/${item.id}`)}
    >
      <View style={styles.agentCardContent}>
        <Image 
          source={
            item.image_url 
              ? { uri: item.image_url }
              : require('../../assets/images/agent-placeholder.png')
          }
          style={styles.agentImage}
          defaultSource={require('../../assets/images/agent-placeholder.png')}
        />
        <View style={styles.agentInfo}>
          <Text style={styles.agentName}>{item.name}</Text>
          <Text style={styles.agentDescription} numberOfLines={2}>
            {item.description || 'No description available'}
          </Text>
          <View style={styles.agentMeta}>
            <View style={[
              styles.statusIndicator, 
              { backgroundColor: item.is_running ? '#17BF63' : '#AAB8C2' }
            ]} />
            <Text style={styles.statusText}>
              {item.is_running ? 'Active' : 'Inactive'}
            </Text>
            <Text style={styles.modelName}>{item.model_name || 'No model'}</Text>
          </View>
          {item.last_run && (
            <Text style={styles.lastRun}>
              Last run: {new Date(item.last_run).toLocaleDateString()}
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  const EmptyListComponent = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>No agents available</Text>
      <Text style={styles.emptySubtext}>Create your first agent to get started</Text>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1DA1F2" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>AI Agents</Text>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => router.push('/agents/create')}
        >
          <Ionicons name="add-circle-outline" size={24} color="#1DA1F2" />
        </TouchableOpacity>
      </View>

      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchAgents}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={agents}
          renderItem={renderAgentItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={!loading && EmptyListComponent}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E1E8ED',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  addButton: {
    padding: 8,
  },
  listContainer: {
    padding: 15,
  },
  agentCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 15,
    padding: 15,
    borderWidth: 1,
    borderColor: '#E1E8ED',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  agentCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  agentImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 15,
  },
  agentInfo: {
    flex: 1,
  },
  agentName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  agentDescription: {
    fontSize: 14,
    color: '#657786',
    marginBottom: 8,
  },
  agentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    color: '#657786',
    marginRight: 12,
  },
  modelName: {
    fontSize: 12,
    color: '#1DA1F2',
    fontStyle: 'italic',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    color: '#657786',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#AAB8C2',
    textAlign: 'center',
  },
  lastRun: {
    fontSize: 12,
    color: '#657786',
    marginTop: 4,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#E0245E',
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#1DA1F2',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  }
}); 