import { Request, Response } from "express";
import { ckbService } from "../services/ckb.service.js";
import { logger } from "../utils/logger.js";

/**
 * POST /api/v1/hashes/build
 * Builds an unsigned tx shell locked to the user's address.
 * Client wallet completes inputs, pays fees, signs, and broadcasts.
 */
export const buildTx = async (req: Request, res: Response) => {
  try {
    const { fileHash, userAddress } = req.body;

    if (!fileHash || typeof fileHash !== "string") {
      return res.status(400).json({ error: "Missing or invalid fileHash" });
    }
    if (!userAddress || typeof userAddress !== "string") {
      return res.status(400).json({ error: "Missing or invalid userAddress" });
    }

    logger.info(`Build unsigned tx — hash: ${fileHash}, address: ${userAddress}`);
    const result = await ckbService.buildUnsignedTx({ fileHash, userAddress });

    return res.status(200).json(result);
  } catch (error: any) {
    logger.error("buildTx controller error", error);
    return res.status(500).json({ error: error.message || "Internal Server Error" });
  }
};

/**
 * POST /api/v1/hashes
 * Legacy server-signs flow — admin/internal use only.
 */
export const submitHash = async (req: Request, res: Response) => {
  try {
    const { fileHash } = req.body;

    if (!fileHash || typeof fileHash !== "string") {
      return res.status(400).json({ error: "Missing or invalid fileHash" });
    }

    logger.info(`Submit hash: ${fileHash}`);
    const result = await ckbService.submitHash({ fileHash });

    return res.status(200).json(result);
  } catch (error: any) {
    logger.error("submitHash controller error", error);
    return res.status(500).json({ error: error.message || "Internal Server Error" });
  }
};

/**
 * GET /api/v1/hashes/:hash
 */
export const verifyHash = async (req: Request, res: Response) => {
  try {
    const { hash } = req.params;

    if (!hash) {
      return res.status(400).json({ error: "Hash parameter is required" });
    }

    logger.info(`Verify hash: ${hash}`);
    const result = await ckbService.verifyHash(hash);

    if (!result) {
      return res.status(404).json({ message: "Hash not found on chain" });
    }

    return res.status(200).json(result);
  } catch (error: any) {
    logger.error("verifyHash controller error", error);
    return res.status(500).json({ error: error.message || "Internal Server Error" });
  }
};
