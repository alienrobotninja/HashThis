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

  /**
   * Builds an unsigned transaction for multiple file hashes (batch submission).
   * Creates multiple output cells in a single transaction.
   * Significantly reduces per-file transaction fees.
   */
  buildBatchUnsignedTx: async (fileHashes: string[], userAddress: string) => {
    const response = await client.post("/hashes/batch", { fileHashes, userAddress });
    return response.data; // { transaction, proofCount, totalCapacity, estimatedFee }
  },

  /**
   * Polls the transaction until confirmed, then fetches the block timestamp.
   * Returns the authoritative proof time from the block header.
   */
  getBlockTime: async (txHash: string): Promise<{
    timestamp: string;
    blockNumber: string;
    blockHash: string;
  }> => {
    const response = await client.get("/hashes/blocktime", {
      params: { txHash },
    });
    return response.data;
  },

  /**
   * Fetches all proof cells anchored by the connected user.
   * Returns proofs in descending order (most recent first).
   */
  getUserProofs: async (
    userAddress: string,
    limit?: number
  ): Promise<{
    proofs: Array<{ fileHash: string; txHash: string; blockNumber: string }>;
    count: number;
  }> => {
    const params: Record<string, string | number> = { userAddress };
    if (limit !== undefined) params.limit = limit;
    const response = await client.get('/hashes/history', { params });
    return response.data;
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