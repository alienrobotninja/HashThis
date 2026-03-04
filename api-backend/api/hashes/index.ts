import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ckbService } from "./ckb.service.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", process.env.CORS_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { fileHash } = req.body;

    if (!fileHash || typeof fileHash !== "string") {
      return res.status(400).json({ error: "Missing or invalid fileHash" });
    }

    console.log(`[API] Submit hash: ${fileHash}`);
    const result = await ckbService.submitHash({ fileHash });

    return res.status(200).json(result);
  } catch (error: any) {
    console.error("[API] Submit error:", error.message);
    return res.status(500).json({ error: error.message || "Internal Server Error" });
  }
}
