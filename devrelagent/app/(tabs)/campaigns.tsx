import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Modal, TextInput, Switch } from 'react-native';
import { apiClient } from '../../utils/api';
import { Ionicons } from '@expo/vector-icons';

export default function CampaignsScreen() {
  const [campaigns, setCampaigns] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [newCampaign, setNewCampaign] = useState({
    title: '',
    description: '',
    autoGenerated: false
  });

  const fetchCampaigns = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await apiClient.get('/campaigns');
      setCampaigns(data);
    } catch (err) {
      console.error('Error fetching campaigns:', err);
      setError('Failed to load campaigns. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const handleCreateCampaign = async () => {
    try {
      if (!newCampaign.title) {
        setError('Campaign title is required');
        return;
      }

      setIsLoading(true);
      const response = await apiClient.post('/campaigns', newCampaign);
      
      // Add the new campaign to the list
      setCampaigns([response, ...campaigns]);
      
      // Reset form and close modal
      setNewCampaign({
        title: '',
        description: '',
        autoGenerated: false
      });
      setModalVisible(false);
    } catch (err) {
      console.error('Error creating campaign:', err);
      setError('Failed to create campaign. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleCampaignStatus = async (campaign) => {
    try {
      setIsLoading(true);
      
      const endpoint = campaign.status === 'active' 
        ? `/campaigns/${campaign.id}/pause` 
        : `/campaigns/${campaign.id}/start`;
      
      const updatedCampaign = await apiClient.post(endpoint);
      
      // Update the campaign in the list
      setCampaigns(campaigns.map(c => 
        c.id === updatedCampaign.id ? updatedCampaign : c
      ));
    } catch (err) {
      console.error('Error updating campaign status:', err);
      setError('Failed to update campaign status. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderCampaignItem = ({ item }) => {
    const isActive = item.status === 'active';
    
    return (
      <View style={styles.campaignCard}>
        <View style={styles.campaignHeader}>
          <Text style={styles.campaignTitle}>{item.title}</Text>
          <View style={[
            styles.statusBadge, 
            { backgroundColor: isActive ? '#17BF63' : '#AAB8C2' }
          ]}>
            <Text style={styles.statusText}>
              {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
            </Text>
          </View>
        </View>
        
        {item.description && (
          <Text style={styles.campaignDescription}>{item.description}</Text>
        )}
        
        <View style={styles.campaignMeta}>
          <Text style={styles.campaignDate}>
            Created: {new Date(item.created_at).toLocaleDateString()}
          </Text>
          {item.auto_generated === 1 && (
            <View style={styles.autoBadge}>
              <Text style={styles.autoBadgeText}>Auto-generated</Text>
            </View>
          )}
        </View>
        
        <View style={styles.campaignActions}>
          <TouchableOpacity 
            style={[
              styles.campaignActionButton,
              { backgroundColor: isActive ? '#E0245E' : '#17BF63' }
            ]}
            onPress={() => handleToggleCampaignStatus(item)}
          >
            <Ionicons 
              name={isActive ? "pause" : "play"} 
              size={16} 
              color="white" 
            />
            <Text style={styles.campaignActionText}>
              {isActive ? 'Pause' : 'Start'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.campaignActionButton}>
            <Ionicons name="analytics-outline" size={16} color="white" />
            <Text style={styles.campaignActionText}>Analytics</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Campaigns</Text>
        <TouchableOpacity 
          style={styles.createButton}
          onPress={() => setModalVisible(true)}
        >
          <Ionicons name="add" size={24} color="white" />
          <Text style={styles.createButtonText}>Create</Text>
        </TouchableOpacity>
      </View>
      
      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchCampaigns}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : campaigns.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="megaphone-outline" size={64} color="#AAB8C2" />
          <Text style={styles.emptyText}>No campaigns yet</Text>
          <Text style={styles.emptySubtext}>
            Create your first campaign to start engaging with developers
          </Text>
        </View>
      ) : (
        <FlatList
          data={campaigns}
          renderItem={renderCampaignItem}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={styles.listContainer}
          refreshing={isLoading}
          onRefresh={fetchCampaigns}
        />
      )}

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Campaign</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#657786" />
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Title *</Text>
              <TextInput
                style={styles.input}
                value={newCampaign.title}
                onChangeText={text => setNewCampaign({...newCampaign, title: text})}
                placeholder="Enter campaign title"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={newCampaign.description}
                onChangeText={text => setNewCampaign({...newCampaign, description: text})}
                placeholder="Enter campaign description or leave blank for auto-generation"
                multiline
                numberOfLines={4}
              />
            </View>

            <View style={styles.formGroup}>
              <View style={styles.switchContainer}>
                <Text style={styles.label}>Auto-generate content</Text>
                <Switch
                  value={newCampaign.autoGenerated}
                  onValueChange={value => setNewCampaign({...newCampaign, autoGenerated: value})}
                  trackColor={{ false: "#AAB8C2", true: "#1DA1F2" }}
                />
              </View>
              <Text style={styles.helperText}>
                Let the AI agent automatically generate content for this campaign
              </Text>
            </View>

            <TouchableOpacity 
              style={styles.submitButton}
              onPress={handleCreateCampaign}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={styles.submitButtonText}>Create Campaign</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1DA1F2',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
  },
  createButtonText: {
    color: 'white',
    fontWeight: 'bold',
    marginLeft: 5,
  },
  listContainer: {
    padding: 10,
  },
  campaignCard: {
    backgroundColor: '#F5F8FA',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#E1E8ED',
  },
  campaignHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  campaignTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  campaignDescription: {
    fontSize: 14,
    color: '#657786',
    marginBottom: 10,
  },
  campaignMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  campaignDate: {
    fontSize: 12,
    color: '#657786',
  },
  autoBadge: {
    backgroundColor: '#1DA1F2',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 10,
  },
  autoBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  campaignActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  campaignActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1DA1F2',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 15,
    marginLeft: 10,
  },
  campaignActionText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 5,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#657786',
    textAlign: 'center',
  },
  errorContainer: {
    padding: 20,
    alignItems: 'center',
  },
  errorText: {
    color: '#E0245E',
    marginBottom: 10,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#1DA1F2',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    margin: 20,
    borderRadius: 10,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E1E8ED',
    borderRadius: 5,
    padding: 10,
    fontSize: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  helperText: {
    fontSize: 12,
    color: '#657786',
    marginTop: 5,
  },
  submitButton: {
    backgroundColor: '#1DA1F2',
    paddingVertical: 12,
    borderRadius: 5,
    alignItems: 'center',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
}); 