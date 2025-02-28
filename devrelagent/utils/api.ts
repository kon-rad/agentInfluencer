import Constants from 'expo-constants';

// Get the local IP address for development
// This allows the app to connect to your local server when running in the Expo Go app
const getLocalHost = () => {
  // Use your computer's local IP address here
  // You can find this by running 'ipconfig' on Windows or 'ifconfig' on Mac/Linux
  return '192.168.1.X'; // Replace with your actual local IP address
};

// API configuration
export const API_CONFIG = {
  // Use localhost for web, and the local IP for mobile devices
  BASE_URL: Constants.expoConfig?.extra?.isWeb 
    ? 'http://localhost:3000/api' 
    : `http://${getLocalHost()}:3000/api`,
  ENDPOINTS: {
    REGISTER: '/users/register',
    LOGIN: '/users/login',
    PROFILE: '/users/profile',
    TWEETS: '/tweets',
    ANALYTICS: '/analytics',
  }
};

// API client for making requests
export const apiClient = {
  get: async (endpoint) => {
    try {
      const response = await fetch(`http://localhost:3000/api${endpoint}`);
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`GET request failed for ${endpoint}:`, error);
      throw error;
    }
  },
  
  post: async (endpoint, data = {}) => {
    try {
      const response = await fetch(`http://localhost:3000/api${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`POST request failed for ${endpoint}:`, error);
      throw error;
    }
  },
  
  // Add other methods as needed (PUT, DELETE, etc.)
}; 