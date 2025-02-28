import React, { useState, useEffect } from 'react';
import { StyleSheet, FlatList, RefreshControl, ActivityIndicator, TouchableOpacity, Text, View } from 'react-native';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';

type Tool = {
  id: number;
  tool_name: string;
  description: string;
  parameters: string;
  usage_format: string;
  created_at: string;
  updated_at: string;
};

type ToolAction = {
  id: number;
  action_type: string;
  tool_name: string;
  parameters: string;
  result: string;
  status: string;
  created_at: string;
  completed_at: string;
};

export default function ToolsScreen() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [actions, setActions] = useState<ToolAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState('');

  const fetchTools = async () => {
    try {
      const response = await axios.get('http://localhost:3000/api/tools');
      if (response.data && Array.isArray(response.data)) {
        setTools(response.data);
      }
    } catch (error) {
      console.error('Error fetching tools:', error);
      setMessage('Failed to load tools');
    }
  };

  const fetchActions = async () => {
    try {
      const response = await axios.get('http://localhost:3000/api/tools/actions');
      if (response.data && Array.isArray(response.data)) {
        setActions(response.data);
      }
    } catch (error) {
      console.error('Error fetching tool actions:', error);
      setMessage('Failed to load tool actions');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      await Promise.all([fetchTools(), fetchActions()]);
    };
    loadData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    Promise.all([fetchTools(), fetchActions()]);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
        <Text style={styles.title}>Loading tools...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Agent Tools</Text>
      
      {message ? (
        <View style={styles.messageContainer}>
          <Text style={styles.message}>{message}</Text>
        </View>
      ) : null}
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Available Tools</Text>
        <FlatList
          data={tools}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <View style={styles.toolItem}>
              <Text style={styles.toolName}>{item.tool_name}</Text>
              <Text style={styles.toolDescription}>{item.description}</Text>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No tools available</Text>
            </View>
          }
        />
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Tool Actions</Text>
        <FlatList
          data={actions}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <View style={[styles.actionItem, { 
              backgroundColor: 
                item.status === 'completed' ? '#E8F5E9' : 
                item.status === 'failed' ? '#FFEBEE' : '#FFF9C4'
            }]}>
              <View style={styles.actionHeader}>
                <Text style={styles.actionTool}>{item.tool_name}</Text>
                <Text style={styles.actionStatus}>{item.status}</Text>
              </View>
              <Text style={styles.actionParams}>Parameters: {item.parameters}</Text>
              {item.result && <Text style={styles.actionResult}>Result: {item.result}</Text>}
              <Text style={styles.actionDate}>
                {formatDate(item.created_at)}
                {item.completed_at ? ` - ${formatDate(item.completed_at)}` : ''}
              </Text>
            </View>
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No tool actions recorded</Text>
            </View>
          }
        />
      </View>
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
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  toolItem: {
    padding: 16,
    marginBottom: 12,
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
  },
  toolName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  toolDescription: {
    fontSize: 14,
  },
  actionItem: {
    padding: 16,
    marginBottom: 12,
    borderRadius: 8,
  },
  actionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  actionTool: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  actionStatus: {
    fontSize: 14,
    fontWeight: '500',
  },
  actionParams: {
    fontSize: 14,
    marginBottom: 4,
  },
  actionResult: {
    fontSize: 14,
    marginBottom: 4,
  },
  actionDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
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