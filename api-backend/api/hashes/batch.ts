import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ckbService } from "./ckb.service.js";

/**
 * POST /api/hashes/batch
 * 
 * Builds an unsigned transaction with multiple hash proofs in a single transaction.
 * Each hash gets its own output cell with 95 CKB capacity.
 * 
 * Request:
 * {
 *   fileHashes: string[],   // Array of file hashes (32 bytes each)
 *   userAddress: string     // User's CKB address
 * }
 * 
 * Response:
 * {
 *   transaction: object,     // Unsigned transaction with N outputs
 *   proofCount: number,      // Number of proofs in this batch
 *   totalCapacity: string,   // Total CKB locked (95N)
 *   estimatedFee: string     // Estimated transaction fee (~1 CKB regardless of N)
 * }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", process.env.CORS_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { fileHashes, userAddress } = req.body;

    // Validation
    if (!fileHashes || !Array.isArray(fileHashes)) {
      return res.status(400).json({ error: "fileHashes must be an array" });
    }

    if (fileHashes.length === 0) {
      return res.status(400).json({ error: "fileHashes array cannot be empty" });
    }

    if (fileHashes.length > 50) {
      return res.status(400).json({ 
        error: "Maximum 50 hashes per batch. Please split into multiple batches." 
      });
    }

    if (!userAddress) {
      return res.status(400).json({ error: "userAddress is required" });
    }

    // Validate each hash
    for (let i = 0; i < fileHashes.length; i++) {
      const hash = fileHashes[i];
      const cleanHash = hash.startsWith("0x") ? hash.slice(2) : hash;
      
      if (!/^[0-9a-fA-F]{64}$/.test(cleanHash)) {
        return res.status(400).json({ 
          error: `Invalid hash at index ${i}: must be 64 hex characters` 
        });
      }
    }

    console.log(`[API] Building batch transaction for ${fileHashes.length} hashes`);

    const result = await ckbService.buildBatchUnsignedTx(fileHashes, userAddress);

    return res.status(200).json(result);
  } catch (error: any) {
    console.error("[API] Batch build error:", error.message);
    return res.status(500).json({ error: error.message || "Failed to build batch transaction" });
  }
}