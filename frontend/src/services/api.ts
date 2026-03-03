import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

const client = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

export const api = {
  /**
   * Asks the backend to build an unsigned tx shell for the given hash.
   * Server encodes hash + server-generated timestamp into outputs.
   * User's wallet completes inputs, pays fees, signs, and broadcasts.
   */
  buildUnsignedTx: async (fileHash: string, userAddress: string) => {
    const response = await client.post("/hashes/build", { fileHash, userAddress });
    return response.data;
  },

  verifyHash: async (hash: string) => {
    try {
      const response = await client.get(`/hashes/${hash}`);
      return response.data;
    } catch (err: any) {
      if (err.response?.status === 404) return null;
      throw err;
    }
  },

  checkHealth: async () => {
    try {
      const response = await client.get("/health");
      return response.data;
    } catch {
      return { status: "offline" };
    }
  },
};
