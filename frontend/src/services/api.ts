import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

const client = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const api = {
  submitHash: async (fileHash: string, timestamp: string) => {
    const response = await client.post('/hashes', { fileHash, timestamp });
    return response.data;
  },

  verifyHash: async (hash: string) => {
    try {
      const response = await client.get(`/hashes/${hash}`);
      return response.data;
    } catch (err: any) {
      // 404 means the hash simply isn't on chain yet — not a service failure
      if (err.response?.status === 404) return null;
      throw err;
    }
  },

  checkHealth: async () => {
    try {
      const response = await client.get('http://localhost:3001/health');
      return response.data;
    } catch (error) {
      console.error("API Health Check Failed", error);
      return { status: 'offline' };
    }
  }
};