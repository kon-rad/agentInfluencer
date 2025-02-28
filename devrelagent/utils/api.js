import axios from 'axios';

// Create an API client with the base URL
export const apiClient = {
  get: async (endpoint, params = {}) => {
    try {
      const response = await axios.get(`http://localhost:3000/api${endpoint}`, { params });
      return response.data;
    } catch (error) {
      console.error(`API GET error for ${endpoint}:`, error);
      throw error;
    }
  },
  
  post: async (endpoint, data = {}) => {
    try {
      const response = await axios.post(`http://localhost:3000/api${endpoint}`, data);
      return response.data;
    } catch (error) {
      console.error(`API POST error for ${endpoint}:`, error);
      throw error;
    }
  }
}; 