import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ckbService } from "./ckb.service.js";

/**
 * GET /api/hashes/history?userAddress=ckt1...
 *
 * Returns all proof cells anchored by the given user address.
 * Each entry includes the file hash, transaction hash, and block number.
 * Results are in descending order (most recent first).
 *
 * Query params:
 *   userAddress  — CKB address whose lock script to scan
 *   limit        — optional max results (default: 100)
 *
 * Response:
 * {
 *   proofs: Array<{ fileHash: string; txHash: string; blockNumber: string }>,
 *   count: number
 * }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", process.env.CORS_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    // Use WHATWG URL API — avoids deprecated url.parse() used by req.query
    const url = new URL(req.url ?? "", `https://${req.headers.host}`);
    const userAddress = url.searchParams.get("userAddress");
    const limitParam = url.searchParams.get("limit");

    if (!userAddress || typeof userAddress !== "string") {
      return res.status(400).json({ error: "Missing or invalid userAddress query parameter" });
    }

    // Basic CKB address sanity check
    if (!userAddress.startsWith("ckb") && !userAddress.startsWith("ckt")) {
      return res.status(400).json({ error: "Invalid CKB address format" });
    }

    // Parse optional limit (default 100, max 500)
    let maxResults = 100;
    if (limitParam !== null) {
      const parsed = parseInt(limitParam, 10);
      if (isNaN(parsed) || parsed < 1) {
        return res.status(400).json({ error: "limit must be a positive integer" });
      }
      maxResults = Math.min(parsed, 500);
    }

    console.log(`[API] Fetching proof history for: ${userAddress} (limit: ${maxResults})`);

    const allProofs = await ckbService.getUserProofs(userAddress);
    const proofs = allProofs.slice(0, maxResults);

    return res.status(200).json({ proofs, count: proofs.length });
  } catch (error: any) {
    console.error("[API] History fetch error:", error.message);
    return res.status(500).json({ error: error.message || "Failed to fetch proof history" });
  }
}