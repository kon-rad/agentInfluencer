import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Switch, TextInput, TouchableOpacity, ScrollView, Modal, ActivityIndicator, Platform, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { apiClient } from '../../utils/api';
import * as ImagePicker from 'expo-image-picker';

// Define the agent config type
interface AgentConfig {
  id: number;
  is_running: boolean;
  personality: string;
  frequency: number;
  model_name: string;
  last_run?: string;
}

export default function ConfigScreen() {
  const [twitterEnabled, setTwitterEnabled] = useState(true);
  const [postFrequency, setPostFrequency] = useState('4');
  const [apiKey, setApiKey] = useState('••••••••••••••••');
  const [showApiKey, setShowApiKey] = useState(false);
  
  // Agent config state
  const [agentConfig, setAgentConfig] = useState<AgentConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [agentName, setAgentName] = useState('DevRel Agent');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [primaryGoals, setPrimaryGoals] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  
  // Add state for the selected image
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  
  // Add state for frequency and last run
  const [frequency, setFrequency] = useState<number>(3600000); // Default to 1 hour
  const [lastRun, setLastRun] = useState<string>('');
  
  // Available models
  const availableModels = [
    { label: 'Meta Llama 3 8B Instruct Turbo', value: 'meta-llama/Meta-Llama-3-8B-Instruct-Turbo' },
    { label: 'Meta Llama 3.3 70B Instruct Turbo', value: 'meta-llama/Llama-3.3-70B-Instruct-Turbo' },
    { label: 'Mixtral 8x7B Instruct', value: 'mistralai/Mixtral-8x7B-Instruct-v0.1' },
    { label: 'Mistral 7B Instruct', value: 'mistralai/Mistral-7B-Instruct-v0.2' }
  ];
  
  // Fetch agent config on component mount
  useEffect(() => {
    fetchAgentConfig();
  }, []);
  
  const fetchAgentConfig = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await apiClient.get('/agent/config');
      setAgentConfig(response);
      
      // Set form values from config
      if (response) {
        setAgentName('DevRel Agent'); // Default name
        setSystemPrompt(response.personality || '');
        setPrimaryGoals(extractGoalsFromPersonality(response.personality || ''));
        setSelectedModel(response.model_name || availableModels[0].value);
        setFrequency(response.frequency || 3600000);
        setLastRun(response.last_run || '');
      }
    } catch (err) {
      console.error('Error fetching agent config:', err);
      setError('Failed to load agent configuration');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Extract goals from personality string
  const extractGoalsFromPersonality = (personality: string): string => {
    const goalsMatch = personality.match(/Your goal is to (.*?)\./) || 
                      personality.match(/Your goals are to (.*?)\./) ||
                      personality.match(/Goals: (.*?)\./) ||
                      ['', ''];
    return goalsMatch[1] || '';
  };
  
  // Combine system prompt and goals
  const combinePersonality = (): string => {
    let personality = systemPrompt;
    
    // If system prompt doesn't already mention goals, add them
    if (primaryGoals && !personality.includes('goal')) {
      personality += ` Your goal is to ${primaryGoals}.`;
    }
    
    return personality;
  };
  
  // Save agent config
  const saveAgentConfig = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const updatedConfig = {
        personality: combinePersonality(),
        model_name: selectedModel,
        frequency,
        last_run: lastRun
      };
      
      await apiClient.post('/agent/config', updatedConfig);
      
      // Refresh config data
      await fetchAgentConfig();
      
      // Close modal
      setModalVisible(false);
    } catch (err) {
      console.error('Error saving agent config:', err);
      setError('Failed to save agent configuration');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Function to handle image selection
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      setSelectedImage(result.uri);
    }
  };
  
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Configuration</Text>
      </View>
      
      {/* Agent Configuration Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Agent Configuration</Text>
        
        <View style={styles.agentConfigCard}>
          <Text style={styles.agentName}>DevRel Agent</Text>
          
          <View style={styles.configRow}>
            <Text style={styles.configLabel}>Model:</Text>
            <Text style={styles.configValue}>
              {agentConfig?.model_name ? 
                agentConfig.model_name.split('/').pop() : 
                'Loading...'}
            </Text>
          </View>
          
          <View style={styles.configRow}>
            <Text style={styles.configLabel}>Status:</Text>
            <View style={[
              styles.statusBadge, 
              { backgroundColor: agentConfig?.is_running ? '#17BF63' : '#AAB8C2' }
            ]}>
              <Text style={styles.statusText}>
                {agentConfig?.is_running ? 'Active' : 'Inactive'}
              </Text>
            </View>
          </View>
          
          <TouchableOpacity 
            style={styles.editButton}
            onPress={() => setModalVisible(true)}
          >
            <Text style={styles.editButtonText}>Edit Agent</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Twitter Integration</Text>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Enable Twitter Posting</Text>
          <Switch
            value={twitterEnabled}
            onValueChange={setTwitterEnabled}
            trackColor={{ false: "#AAB8C2", true: "#1DA1F2" }}
          />
        </View>
        
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Posts per day</Text>
          <TextInput
            style={styles.input}
            value={postFrequency}
            onChangeText={setPostFrequency}
            keyboardType="numeric"
          />
        </View>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>API Configuration</Text>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Twitter API Key</Text>
          <View style={styles.apiKeyContainer}>
            <TextInput
              style={styles.apiKeyInput}
              value={apiKey}
              onChangeText={setApiKey}
              secureTextEntry={!showApiKey}
            />
            <TouchableOpacity 
              style={styles.eyeButton}
              onPress={() => setShowApiKey(!showApiKey)}
            >
              <Ionicons 
                name={showApiKey ? "eye-off-outline" : "eye-outline"} 
                size={20} 
                color="#657786" 
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Content Preferences</Text>
        <View style={styles.contentPreferences}>
          <TouchableOpacity style={[styles.tagButton, styles.tagSelected]}>
            <Text style={styles.tagSelectedText}>Base L2</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tagButton, styles.tagSelected]}>
            <Text style={styles.tagSelectedText}>Web3</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tagButton, styles.tagSelected]}>
            <Text style={styles.tagSelectedText}>DeFi</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tagButton}>
            <Text style={styles.tagText}>NFTs</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tagButton}>
            <Text style={styles.tagText}>Gaming</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tagButton}>
            <Text style={styles.tagText}>DAOs</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      <TouchableOpacity style={styles.saveButton}>
        <Text style={styles.saveButtonText}>Save Configuration</Text>
      </TouchableOpacity>
      
      {/* Agent Config Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Agent Configuration</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#657786" />
              </TouchableOpacity>
            </View>
            
            {isLoading ? (
              <ActivityIndicator size="large" color="#1DA1F2" />
            ) : (
              <>
                <ScrollView style={styles.modalForm}>
                  <Text style={styles.inputLabel}>Agent Name</Text>
                  <TextInput
                    style={styles.textInput}
                    value={agentName}
                    onChangeText={setAgentName}
                    placeholder="Enter agent name"
                  />
                  
                  <Text style={styles.inputLabel}>System Prompt</Text>
                  <TextInput
                    style={[styles.textInput, styles.textArea]}
                    value={systemPrompt}
                    onChangeText={setSystemPrompt}
                    placeholder="Enter system prompt for the agent"
                    multiline
                    numberOfLines={4}
                  />
                  
                  <Text style={styles.inputLabel}>Primary Goals</Text>
                  <TextInput
                    style={[styles.textInput, styles.textArea]}
                    value={primaryGoals}
                    onChangeText={setPrimaryGoals}
                    placeholder="Enter the agent's primary goals"
                    multiline
                    numberOfLines={3}
                  />
                  
                  <Text style={styles.inputLabel}>Model</Text>
                  {Platform.OS === 'ios' || Platform.OS === 'android' ? (
                    <View style={styles.pickerContainer}>
                      <Picker
                        selectedValue={selectedModel}
                        onValueChange={(itemValue) => setSelectedModel(itemValue)}
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
                    // Web fallback
                    <View style={styles.pickerContainer}>
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
                    </View>
                  )}
                  
                  {/* Add image upload section */}
                  <Text style={styles.inputLabel}>Profile Image</Text>
                  <TouchableOpacity onPress={pickImage} style={styles.imagePicker}>
                    {selectedImage ? (
                      <Image source={{ uri: selectedImage }} style={styles.profileImage} />
                    ) : (
                      <Text style={styles.imagePickerText}>Select an Image</Text>
                    )}
                  </TouchableOpacity>
                  {/* End of image upload section */}
                  
                  <Text style={styles.inputLabel}>Frequency (ms)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={frequency.toString()}
                    onChangeText={(text) => setFrequency(Number(text))}
                    placeholder="Enter frequency in milliseconds"
                    keyboardType="numeric"
                  />
                  
                  <Text style={styles.inputLabel}>Last Run</Text>
                  <TextInput
                    style={styles.textInput}
                    value={lastRun}
                    onChangeText={setLastRun}
                    placeholder="Enter last run timestamp"
                  />
                </ScrollView>
                
                {error && (
                  <Text style={styles.errorText}>{error}</Text>
                )}
                
                <View style={styles.modalActions}>
                  <TouchableOpacity 
                    style={styles.cancelButton}
                    onPress={() => setModalVisible(false)}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.saveModalButton}
                    onPress={saveAgentConfig}
                  >
                    <Text style={styles.saveModalButtonText}>Save Changes</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E1E8ED',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E1E8ED',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  settingLabel: {
    fontSize: 16,
    color: '#14171A',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E1E8ED',
    borderRadius: 5,
    padding: 8,
    width: 60,
    textAlign: 'center',
  },
  apiKeyContainer: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#E1E8ED',
    borderRadius: 5,
    width: '60%',
  },
  apiKeyInput: {
    padding: 8,
    flex: 1,
  },
  eyeButton: {
    padding: 8,
    justifyContent: 'center',
  },
  contentPreferences: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
  },
  tagButton: {
    borderWidth: 1,
    borderColor: '#1DA1F2',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 15,
    margin: 5,
  },
  tagSelected: {
    backgroundColor: '#1DA1F2',
  },
  tagText: {
    color: '#1DA1F2',
  },
  tagSelectedText: {
    color: 'white',
  },
  saveButton: {
    backgroundColor: '#1DA1F2',
    margin: 20,
    padding: 15,
    borderRadius: 30,
    alignItems: 'center',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Agent config card styles
  agentConfigCard: {
    backgroundColor: '#F5F8FA',
    borderRadius: 10,
    padding: 15,
    marginTop: 10,
  },
  agentName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  configRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  configLabel: {
    fontSize: 16,
    color: '#657786',
  },
  configValue: {
    fontSize: 16,
    color: '#14171A',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  statusText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  editButton: {
    backgroundColor: '#1DA1F2',
    padding: 10,
    borderRadius: 20,
    alignItems: 'center',
    marginTop: 10,
  },
  editButtonText: {
    color: 'white',
    fontWeight: '500',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E1E8ED',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalForm: {
    maxHeight: 400,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 5,
    marginTop: 10,
  },
  textInput: {
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
    borderWidth: 0,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 20,
  },
  cancelButton: {
    padding: 10,
    marginRight: 10,
  },
  cancelButtonText: {
    color: '#657786',
    fontSize: 16,
  },
  saveModalButton: {
    backgroundColor: '#1DA1F2',
    padding: 10,
    borderRadius: 5,
  },
  saveModalButtonText: {
    color: 'white',
    fontSize: 16,
  },
  errorText: {
    color: 'red',
    marginTop: 10,
    textAlign: 'center',
  },
  imagePicker: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 150,
    borderWidth: 1,
    borderColor: '#E1E8ED',
    borderRadius: 10,
    marginBottom: 15,
  },
  imagePickerText: {
    color: '#657786',
  },
  profileImage: {
    width: 150,
    height: 150,
    borderRadius: 75,
  },
}); 