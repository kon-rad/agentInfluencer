import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { tweetService } from '../services/tweetService';

type CreateTweetProps = {
  onTweetCreated?: () => void;
};

export default function CreateTweet({ onTweetCreated }: CreateTweetProps) {
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateTweet = async () => {
    if (!content.trim()) {
      setError('Tweet cannot be empty');
      return;
    }

    if (content.length > 280) {
      setError('Tweet cannot exceed 280 characters');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      await tweetService.createTweet(content);
      setContent('');
      if (onTweetCreated) {
        onTweetCreated();
      }
    } catch (error) {
      setError('Failed to create tweet. Please try again.');
      console.error('Create tweet error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="What's happening?"
        value={content}
        onChangeText={setContent}
        multiline
        maxLength={280}
      />
      
      <View style={styles.footer}>
        <Text style={styles.counter}>
          {content.length}/280
        </Text>
        
        <TouchableOpacity
          style={[
            styles.button,
            (!content.trim() || isLoading) && styles.buttonDisabled
          ]}
          onPress={handleCreateTweet}
          disabled={!content.trim() || isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.buttonText}>Tweet</Text>
          )}
        </TouchableOpacity>
      </View>
      
      {error && (
        <Text style={styles.errorText}>{error}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e8ed',
  },
  input: {
    minHeight: 80,
    textAlignVertical: 'top',
    fontSize: 16,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  counter: {
    color: '#657786',
  },
  button: {
    backgroundColor: '#1DA1F2',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  buttonDisabled: {
    backgroundColor: '#AAB8C2',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  errorText: {
    color: 'red',
    marginTop: 10,
  },
}); 