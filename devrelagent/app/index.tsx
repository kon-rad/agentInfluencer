import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import CreateTweet from '../components/CreateTweet';
import TweetList from '../components/TweetList';

export default function HomeScreen() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const router = useRouter();



  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Home</Text>
      </View>
      
      <CreateTweet onTweetCreated={handleTweetCreated} />
      
      <TweetList refreshTrigger={refreshTrigger} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
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
    borderBottomColor: '#e1e8ed',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  logoutText: {
    color: '#1DA1F2',
  }
}); 