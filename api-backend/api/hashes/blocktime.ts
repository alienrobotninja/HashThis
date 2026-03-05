import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ckbService } from "./ckb.service.js";

/**
 * GET /api/hashes/blocktime?txHash=0x...
 * 
 * Fetches the authoritative block timestamp for a confirmed transaction.
 * This is the cryptographic proof of when the transaction was anchored.
 * 
 * Flow:
 * 1. Poll transaction status until committed
 * 2. Fetch block header using block hash
 * 3. Extract timestamp from block header
 * 4. Return block timestamp, number, and hash
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", process.env.CORS_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { txHash } = req.query;

    if (!txHash || typeof txHash !== "string") {
      return res.status(400).json({ error: "Missing or invalid txHash query parameter" });
    }

    // Validate txHash format (64 hex chars with optional 0x prefix)
    const cleanHash = txHash.startsWith("0x") ? txHash.slice(2) : txHash;
    if (!/^[0-9a-fA-F]{64}$/.test(cleanHash)) {
      return res.status(400).json({ error: "Invalid transaction hash format" });
    }

    console.log(`[API] Fetching block time for tx: ${txHash}`);
    
    const result = await ckbService.getBlockTime(txHash);

    return res.status(200).json(result);
  } catch (error: any) {
    console.error("[API] Block time fetch error:", error.message);
    
    // Distinguish between timeout and other errors
    if (error.message.includes("not confirmed")) {
      return res.status(408).json({ 
        error: "Transaction confirmation timeout",
        message: "Transaction has not been confirmed yet. Please try again in a few moments."
      });
    }
    
    return res.status(500).json({ error: error.message || "Failed to fetch block time" });
  }
}