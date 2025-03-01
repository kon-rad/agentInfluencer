import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useRouter } from 'expo-router';

interface AgentThought {
  id: number;
  type: string;
  content: string;
  timestamp: string;
  model_name: string;
}

interface Agent {
  id: number;
  name: string;
  description: string;
  image_url: string;
  is_running: boolean;
  model_name: string;
  last_run?: string;
}

interface AgentDetailProps {
  agentId: number;
}

export default function AgentDetail({ agentId }: AgentDetailProps) {
  const router = useRouter();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [thoughts, setThoughts] = useState<AgentThought[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAgentDetails = async () => {
    try {
      const response = await axios.get(`http://localhost:3000/api/agents/${agentId}`);
      if (response.data) {
        setAgent(response.data);
      }
    } catch (error) {
      console.error('Error fetching agent details:', error);
      setError('Failed to load agent details');
    }
  };

  const fetchAgentThoughts = async () => {
    try {
      const response = await axios.get(`http://localhost:3000/api/agents/${agentId}/thoughts`);
      if (response.data && Array.isArray(response.data)) {
        setThoughts(response.data);
      }
    } catch (error) {
      console.error('Error fetching agent thoughts:', error);
      setError('Failed to load agent thoughts');
    }
  };

  const toggleAgentStatus = async () => {
    if (!agent) return;
    
    try {
      const response = await axios.post(`http://localhost:3000/api/agents/${agentId}/toggle`, {
        is_running: !agent.is_running
      });
      
      if (response.data) {
        setAgent({ ...agent, is_running: !agent.is_running });
      }
    } catch (error) {
      console.error('Error toggling agent status:', error);
      setError('Failed to toggle agent status');
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchAgentDetails(), fetchAgentThoughts()]);
      setLoading(false);
    };
    
    loadData();
  }, [agentId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchAgentDetails(), fetchAgentThoughts()]);
    setRefreshing(false);
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1DA1F2" />
      </View>
    );
  }

  if (!agent) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Agent not found</Text>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1DA1F2" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Agent Details</Text>
        <TouchableOpacity onPress={() => router.push(`/agent/${agentId}/config`)}>
          <Ionicons name="settings-outline" size={24} color="#1DA1F2" />
        </TouchableOpacity>
      </View>

      <View style={styles.profileSection}>
        <View style={styles.profileImageContainer}>
          <Image 
            source={{ uri: agent.image_url || 'https://via.placeholder.com/200' }}
            style={styles.profileImage}
          />
        </View>
        
        <View style={styles.profileInfo}>
          <Text style={styles.agentName}>{agent.name}</Text>
          <Text style={styles.agentDescription}>{agent.description}</Text>
          
          <TouchableOpacity 
            style={[styles.statusButton, { backgroundColor: agent.is_running ? '#17BF63' : '#AAB8C2' }]}
            onPress={toggleAgentStatus}
          >
            <View style={styles.statusIndicator} />
            <Text style={styles.statusText}>
              {agent.is_running ? 'Active' : 'Inactive'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Thoughts</Text>
        {thoughts.map((thought) => (
          <View key={thought.id} style={styles.thoughtBubble}>
            <View style={styles.thoughtHeader}>
              <Text style={styles.thoughtType}>{thought.type}</Text>
              <Text style={styles.thoughtTimestamp}>
                {new Date(thought.timestamp).toLocaleString()}
              </Text>
            </View>
            <Text style={styles.thoughtContent}>{thought.content}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
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
  errorContainer: {
    padding: 15,
    backgroundColor: '#FFE8E6',
    marginHorizontal: 15,
    marginTop: 15,
    borderRadius: 8,
  },
  errorText: {
    color: '#D63301',
    textAlign: 'center',
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
  profileSection: {
    padding: 20,
    alignItems: 'center',
  },
  profileImageContainer: {
    marginBottom: 15,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  profileInfo: {
    alignItems: 'center',
  },
  agentName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  agentDescription: {
    fontSize: 16,
    color: '#657786',
    textAlign: 'center',
    marginBottom: 15,
  },
  statusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
    marginRight: 6,
  },
  statusText: {
    color: '#fff',
    fontWeight: '500',
  },
  section: {
    padding: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  thoughtBubble: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
  },
  thoughtHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  thoughtType: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1DA1F2',
  },
  thoughtTimestamp: {
    fontSize: 12,
    color: '#657786',
  },
  thoughtContent: {
    fontSize: 14,
    lineHeight: 20,
  },
}); 