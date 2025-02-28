import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TextInput, 
  TouchableOpacity, 
  Switch,
  Platform 
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../../utils/api';

const availableModels = [
  { label: 'Meta Llama 3 8B Instruct Turbo', value: 'meta-llama/Meta-Llama-3-8B-Instruct-Turbo' },
  { label: 'Meta Llama 3.3 70B Instruct Turbo', value: 'meta-llama/Llama-3.3-70B-Instruct-Turbo' },
  { label: 'Mixtral 8x7B Instruct', value: 'mistralai/Mixtral-8x7B-Instruct-v0.1' },
  { label: 'Mistral 7B Instruct', value: 'mistralai/Mistral-7B-Instruct-v0.2' }
];

const availableTools = [
  { id: 'twitter', name: 'Twitter Integration', description: 'Post and interact on Twitter' },
  { id: 'telegram', name: 'Telegram Bot', description: 'Run a Telegram bot' },
  { id: 'web_scraping', name: 'Web Scraping', description: 'Scrape web content' },
  { id: 'news_analysis', name: 'News Analysis', description: 'Analyze crypto news' },
  { id: 'content_gen', name: 'Content Generation', description: 'Generate content' },
  { id: 'image_gen', name: 'Image Generation', description: 'Generate images' },
  { id: 'smart_contract', name: 'Smart Contract', description: 'Interact with smart contracts' },
  { id: 'base_l2', name: 'Base L2', description: 'Base L2 integration' }
];

export default function CreateAgentScreen() {
  const [agentName, setAgentName] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState(availableModels[0].value);
  const [frequency, setFrequency] = useState('3600000');
  const [telegramToken, setTelegramToken] = useState('');
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToolToggle = (toolId: string) => {
    setSelectedTools(prev => 
      prev.includes(toolId) 
        ? prev.filter(id => id !== toolId)
        : [...prev, toolId]
    );
  };

  const handleCreateAgent = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const agentData = {
        name: agentName,
        personality: systemPrompt,
        model_name: selectedModel,
        frequency: parseInt(frequency),
        telegram_bot_token: telegramToken,
        tools: selectedTools,
        is_running: false
      };

      const response = await apiClient.post('/agents', agentData);
      router.back();
    } catch (err) {
      console.error('Error creating agent:', err);
      setError('Failed to create agent. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1DA1F2" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create New Agent</Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Agent Name</Text>
        <TextInput
          style={styles.input}
          value={agentName}
          onChangeText={setAgentName}
          placeholder="Enter agent name"
        />

        <Text style={styles.label}>System Prompt</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={systemPrompt}
          onChangeText={setSystemPrompt}
          placeholder="Enter system prompt"
          multiline
          numberOfLines={4}
        />

        <Text style={styles.label}>Model</Text>
        {Platform.OS === 'ios' || Platform.OS === 'android' ? (
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={selectedModel}
              onValueChange={setSelectedModel}
              style={styles.picker}
            >
              {availableModels.map((model) => (
                <Picker.Item 
                  key={model.value} 
                  label={model.label} 
                  value={model.value} 
                />
              ))}
            </Picker>
          </View>
        ) : (
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            style={styles.webSelect as any}
          >
            {availableModels.map((model) => (
              <option key={model.value} value={model.value}>
                {model.label}
              </option>
            ))}
          </select>
        )}

        <Text style={styles.label}>Frequency (ms)</Text>
        <TextInput
          style={styles.input}
          value={frequency}
          onChangeText={setFrequency}
          placeholder="Enter frequency in milliseconds"
          keyboardType="numeric"
        />

        <Text style={styles.label}>Telegram Bot Token</Text>
        <TextInput
          style={styles.input}
          value={telegramToken}
          onChangeText={setTelegramToken}
          placeholder="Enter Telegram bot token"
          secureTextEntry
        />

        <Text style={styles.label}>Tools</Text>
        <View style={styles.toolsContainer}>
          {availableTools.map((tool) => (
            <View key={tool.id} style={styles.toolItem}>
              <View style={styles.toolInfo}>
                <Text style={styles.toolName}>{tool.name}</Text>
                <Text style={styles.toolDescription}>{tool.description}</Text>
              </View>
              <Switch
                value={selectedTools.includes(tool.id)}
                onValueChange={() => handleToolToggle(tool.id)}
                trackColor={{ false: "#767577", true: "#1DA1F2" }}
              />
            </View>
          ))}
        </View>

        {error && (
          <Text style={styles.errorText}>{error}</Text>
        )}

        <TouchableOpacity 
          style={styles.createButton}
          onPress={handleCreateAgent}
          disabled={isLoading}
        >
          <Text style={styles.createButtonText}>
            {isLoading ? 'Creating...' : 'Create Agent'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E1E8ED',
  },
  backButton: {
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  form: {
    padding: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 5,
    marginTop: 15,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E1E8ED',
    borderRadius: 5,
    padding: 10,
    fontSize: 16,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#E1E8ED',
    borderRadius: 5,
    marginBottom: 15,
  },
  picker: {
    width: '100%',
  },
  webSelect: {
    width: '100%',
    padding: 10,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E1E8ED',
    borderRadius: 5,
  },
  toolsContainer: {
    marginTop: 10,
  },
  toolItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E1E8ED',
  },
  toolInfo: {
    flex: 1,
  },
  toolName: {
    fontSize: 16,
    fontWeight: '500',
  },
  toolDescription: {
    fontSize: 14,
    color: '#657786',
  },
  errorText: {
    color: 'red',
    marginTop: 10,
    textAlign: 'center',
  },
  createButton: {
    backgroundColor: '#1DA1F2',
    padding: 15,
    borderRadius: 30,
    alignItems: 'center',
    marginTop: 20,
  },
  createButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
}); 