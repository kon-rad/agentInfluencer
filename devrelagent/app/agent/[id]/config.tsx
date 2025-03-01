import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Picker } from '@react-native-picker/picker';
import axios from 'axios';

export default function AgentConfigScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [name, setName] = useState('');
  const [personality, setPersonality] = useState('');
  const [modelName, setModelName] = useState('');
  const [frequency, setFrequency] = useState('3600000');
  
  const availableModels = [
    { label: 'Meta Llama 3 8B Instruct Turbo', value: 'meta-llama/Meta-Llama-3-8B-Instruct-Turbo' },
    { label: 'Meta Llama 3.3 70B Instruct Turbo', value: 'meta-llama/Llama-3.3-70B-Instruct-Turbo' },
    { label: 'Mixtral 8x7B Instruct', value: 'mistralai/Mixtral-8x7B-Instruct-v0.1' },
    { label: 'Mistral 7B Instruct', value: 'mistralai/Mistral-7B-Instruct-v0.2' }
  ];

  useEffect(() => {
    fetchAgentConfig();
  }, [id]);

  const fetchAgentConfig = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`http://localhost:3000/api/agents/${id}/config`);
      const config = response.data;
      
      setName(config.name || '');
      setPersonality(config.personality || '');
      setModelName(config.model_name || availableModels[0].value);
      setFrequency(config.frequency?.toString() || '3600000');
    } catch (err) {
      console.error('Error fetching agent config:', err);
      setError('Failed to load configuration');
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    try {
      setLoading(true);
      await axios.post(`http://localhost:3000/api/agents/${id}/config`, {
        name,
        personality,
        model_name: modelName,
        frequency: parseInt(frequency),
      });
      router.back();
    } catch (err) {
      console.error('Error saving config:', err);
      setError('Failed to save configuration');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1DA1F2" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.cancelButton}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Agent Configuration</Text>
        <TouchableOpacity onPress={saveConfig}>
          <Text style={styles.saveButton}>Save</Text>
        </TouchableOpacity>
      </View>

      {error && (
        <Text style={styles.errorText}>{error}</Text>
      )}

      <View style={styles.form}>
        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Agent name"
        />

        <Text style={styles.label}>Personality</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={personality}
          onChangeText={setPersonality}
          placeholder="Define the agent's personality..."
          multiline
          numberOfLines={4}
        />

        <Text style={styles.label}>Model</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={modelName}
            onValueChange={setModelName}
            style={styles.picker}
          >
            {availableModels.map(model => (
              <Picker.Item 
                key={model.value} 
                label={model.label} 
                value={model.value} 
              />
            ))}
          </Picker>
        </View>

        <Text style={styles.label}>Frequency (ms)</Text>
        <TextInput
          style={styles.input}
          value={frequency}
          onChangeText={setFrequency}
          keyboardType="numeric"
          placeholder="Update frequency in milliseconds"
        />
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E1E8ED',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  cancelButton: {
    color: '#657786',
    fontSize: 16,
  },
  saveButton: {
    color: '#1DA1F2',
    fontSize: 16,
    fontWeight: 'bold',
  },
  form: {
    padding: 15,
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
  },
  picker: {
    width: '100%',
  },
  errorText: {
    color: '#E0245E',
    textAlign: 'center',
    marginTop: 10,
  },
}); 