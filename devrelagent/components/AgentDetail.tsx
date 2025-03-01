import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, ActivityIndicator, RefreshControl, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useRouter } from 'expo-router';

interface AgentThought {
  id: number;
  agent_id: number;
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
  personality: string;
  last_run?: string;
  tools?: { id: number; tool_name: string; description: string }[] | string[];
  wallet_address?: string;
  wallet_balance?: string;
  wallet_id?: string;
  wallet_seed?: string;
  frequency_seconds?: number;
}

interface News {
  id: number;
  title: string;
  content: string;
  source: string;
  published_at: string;
}

interface AgentDetailProps {
  agentId: number;
}

interface ThoughtState {
  [key: number]: boolean; // Tracks expanded state for each thought
}

export default function AgentDetail({ agentId }: AgentDetailProps) {
  const router = useRouter();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [thoughts, setThoughts] = useState<AgentThought[]>([]);
  const [news, setNews] = useState<News[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [thoughtStates, setThoughtStates] = useState<ThoughtState>({});

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

  const fetchNews = async () => {
    if (!agent?.tools?.some(tool => tool?.tool_name?.toLowerCase().includes('news'))) {
      return;
    }

    try {
      const response = await axios.get(`http://localhost:3000/api/agents/${agentId}/news`);
      if (response.data && Array.isArray(response.data)) {
        setNews(response.data);
      }
    } catch (error) {
      console.error('Error fetching news:', error);
      setError('Failed to load news');
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

  const toggleThought = (id: number) => {
    setThoughtStates(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleRefreshThoughts = async () => {
    setRefreshing(true);
    await fetchAgentThoughts();
    setRefreshing(false);
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchAgentDetails(), fetchAgentThoughts(), fetchNews()]);
      setLoading(false);
    };
    
    loadData();
  }, [agentId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchAgentDetails(), fetchAgentThoughts(), fetchNews()]);
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
            style={styles.profileImage}
            source={
              agent.image_url 
                ? { uri: agent.image_url }
                : require('../assets/images/agent-placeholder.png')
            }
            defaultSource={require('../assets/images/agent-placeholder.png')}
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
              {agent.is_running ? 'Stop Agent' : 'Start Agent'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>System Prompt</Text>
        <View style={styles.promptContainer}>
          <Text style={styles.promptText}>{agent.personality}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Agent Information</Text>
        <View style={styles.infoContainer}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Agent ID:</Text>
            <Text style={styles.infoValue}>{agent.id}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Model:</Text>
            <Text style={styles.infoValue}>{agent.model_name || 'Not specified'}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Run Frequency:</Text>
            <Text style={styles.infoValue}>
              {agent.frequency_seconds ? `Every ${agent.frequency_seconds} seconds` : 'Not specified'}
            </Text>
          </View>
          
          {agent.last_run && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Last Run:</Text>
              <Text style={styles.infoValue}>
                {new Date(agent.last_run).toLocaleString()}
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Agent Tools</Text>
        {Array.isArray(agent.tools) && agent.tools.length > 0 ? (
          agent.tools.map((tool, index) => {
            if (typeof tool === 'string') {
              return (
                <View key={index} style={styles.toolItem}>
                  <Text style={styles.toolName}>{tool}</Text>
                </View>
              );
            } else if (typeof tool === 'object' && tool !== null) {
              return (
                <View key={tool.id || index} style={styles.toolItem}>
                  <Text style={styles.toolName}>{tool.tool_name}</Text>
                  {tool.description && <Text style={styles.toolDescription}>{tool.description}</Text>}
                </View>
              );
            }
            return null;
          })
        ) : (
          <View style={styles.toolItem}>
            <Text style={styles.toolName}>No tools configured</Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Wallet Information</Text>
        <View style={styles.walletContainer}>
          <View style={styles.walletAddressContainer}>
            <Text style={styles.walletLabel}>Wallet Address:</Text>
            <Text style={styles.walletAddress} selectable={true}>
              {agent.wallet_address || agent.wallet_id || 'Not configured'}
            </Text>
          </View>
          <View style={styles.walletBalanceContainer}>
            <Text style={styles.walletLabel}>ETH Balance:</Text>
            <Text style={styles.walletBalance}>
              {agent.wallet_balance || '0'} ETH
            </Text>
          </View>
          {agent.wallet_seed && (
            <View style={styles.walletSeedContainer}>
              <Text style={styles.walletLabel}>Wallet Seed:</Text>
              <Text style={styles.walletSeed} selectable={true} numberOfLines={1} ellipsizeMode="middle">
                {agent.wallet_seed}
              </Text>
            </View>
          )}
        </View>
      </View>

      {news.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent News</Text>
          {news.map((item) => (
            <View key={item.id} style={styles.newsItem}>
              <Text style={styles.newsTitle}>{item.title}</Text>
              <Text style={styles.newsSource}>
                {item.source} • {new Date(item.published_at).toLocaleDateString()}
              </Text>
              <Text style={styles.newsContent} numberOfLines={3}>
                {item.content}
              </Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Thoughts</Text>
          <TouchableOpacity onPress={handleRefreshThoughts}>
            <Ionicons name="refresh" size={20} color="#1DA1F2" />
          </TouchableOpacity>
        </View>
        {thoughts.map((thought) => (
          <View key={thought.id} style={styles.thoughtBubble}>
            <TouchableOpacity 
              style={styles.thoughtHeader}
              onPress={() => toggleThought(thought.id)}
            >
              <Text style={styles.thoughtType}>{thought.type}</Text>
              <View style={styles.thoughtHeaderRight}>
                <Text style={styles.thoughtTimestamp}>
                  {new Date(thought.timestamp).toLocaleString()}
                </Text>
                <Ionicons 
                  name={thoughtStates[thought.id] ? 'chevron-up' : 'chevron-down'} 
                  size={16} 
                  color="#657786" 
                />
              </View>
            </TouchableOpacity>
            <Text 
              style={styles.thoughtContent}
              numberOfLines={thoughtStates[thought.id] ? undefined : 1}
            >
              {thought.content}
            </Text>
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
  thoughtHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  toolItem: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
  },
  toolName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  toolDescription: {
    fontSize: 14,
    color: '#657786',
  },
  promptContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
  },
  promptText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#1A1B1F',
  },
  newsItem: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
  },
  newsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#1A1B1F',
  },
  newsSource: {
    fontSize: 12,
    color: '#657786',
    marginBottom: 8,
  },
  newsContent: {
    fontSize: 14,
    lineHeight: 20,
    color: '#14171A',
  },
  infoContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    width: 120,
  },
  infoValue: {
    fontSize: 14,
    flex: 1,
    color: '#1A1B1F',
  },
  walletContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
  },
  walletAddressContainer: {
    marginBottom: 10,
  },
  walletBalanceContainer: {
    marginBottom: 10,
  },
  walletSeedContainer: {
    marginBottom: 4,
  },
  walletLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  walletAddress: {
    fontSize: 14,
    color: '#1DA1F2',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  walletBalance: {
    fontSize: 16,
    fontWeight: '500',
    color: '#17BF63',
  },
  walletSeed: {
    fontSize: 12,
    color: '#657786',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
}); 