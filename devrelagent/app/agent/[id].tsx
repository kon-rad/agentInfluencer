import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import AgentDetail from '../../components/AgentDetail';

export default function AgentDetailScreen() {
  const { id } = useLocalSearchParams();
  
  return (
    <View style={styles.container}>
      <AgentDetail agentId={Number(id)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
}); 