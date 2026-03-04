import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

const client = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

export const api = {
  /**
   * Asks the backend to build an unsigned transaction shell for the given hash.
   * The server encodes the file hash + a server-generated timestamp into the
   * cell outputs, then returns the raw tx object for the user's wallet to
   * complete (inputs, fees) and sign. Nothing is broadcast here.
   */
  buildUnsignedTx: async (fileHash: string, userAddress: string) => {
    const response = await client.post("/hashes/build", { fileHash, userAddress });
    return response.data; // Partial tx: { outputs, outputsData }
  },

  verifyHash: async (hash: string, userAddress: string) => {
    try {
      const response = await client.get(`/hashes/${hash}`, {
        params: { userAddress },
      });
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