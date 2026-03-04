import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ckbService } from "./ckb.service.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", process.env.CORS_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const hash = req.query.hash as string;
    const userAddress = req.query.userAddress as string;

    if (!hash) {
      return res.status(400).json({ error: "Hash parameter is required" });
    }
    if (!userAddress) {
      return res.status(400).json({ error: "userAddress query parameter is required" });
    }

    console.log(`[API] Verify hash: ${hash} for address: ${userAddress}`);
    const result = await ckbService.verifyHash(hash, userAddress);

    if (!result) {
      return res.status(404).json({ message: "Hash not found on chain" });
    }

    return res.status(200).json(result);
  } catch (error: any) {
    console.error("[API] Verify error:", error.message);
    return res.status(500).json({ error: error.message || "Internal Server Error" });
  }
}