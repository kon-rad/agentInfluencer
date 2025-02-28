import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useRouter } from 'expo-router';

interface Agent {
  id: number;
  name: string;
  description: string;
  image_url: string;
  is_running: boolean;
  model_name: string;
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
      const response = await axios.get('http://localhost:3000/api/agents');
      if (response.data && Array.isArray(response.data)) {
        setAgents(response.data);
      }
    } catch (error) {
      console.error('Error fetching agents:', error);
      setError('Failed to load agents');
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
            {item.description}
          </Text>
          <View style={styles.agentMeta}>
            <View style={[
              styles.statusIndicator, 
              { backgroundColor: item.is_running ? '#17BF63' : '#AAB8C2' }
            ]} />
            <Text style={styles.statusText}>
              {item.is_running ? 'Active' : 'Inactive'}
            </Text>
            <Text style={styles.modelName}>{item.model_name}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
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
          onPress={() => router.push('/agent/create')}
        >
          <Ionicons name="add-circle-outline" size={24} color="#1DA1F2" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={agents}
        renderItem={renderAgentItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No agents available</Text>
          </View>
        }
      />
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
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    color: '#657786',
    fontSize: 16,
  },
}); 