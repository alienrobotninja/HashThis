import { ccc } from "@ckb-ccc/core";
import { registry } from "../config/registry.js";
import { logger } from "../utils/logger.js";
import { HashPayload, SubmissionResult, UnsignedTxPayload, UnsignedTxResult } from "../types/index.js";

// 110 CKB in shannons — 101 CKB minimum (cell + data) plus headroom for fees
const ANCHOR_CAPACITY = BigInt("11000000000");

export class CKBService {
  private client: ccc.Client;
  private signer: ccc.SignerCkbPrivateKey;
  private isInitialized = false;

  constructor() {
    this.client =
      registry.ckb.network === "mainnet"
        ? new ccc.ClientPublicMainnet()
        : new ccc.ClientPublicTestnet();

    this.signer = new ccc.SignerCkbPrivateKey(
      this.client,
      registry.ckb.signerPrivKey
    );
  }

  public async start() {
    if (this.isInitialized) return;
    this.isInitialized = true;
    logger.info(`CKB Service initialized [${registry.ckb.network}]`);
  }

  /**
   * Builds an unsigned transaction shell locked to the user's address.
   * Server generates the timestamp — not the caller.
   * The server wallet is not involved in signing or paying.
   */
  public async buildUnsignedTx(payload: UnsignedTxPayload): Promise<UnsignedTxResult> {
    if (!this.isInitialized) await this.start();

    const { fileHash, userAddress } = payload;
    const userScript = (await ccc.Address.fromString(userAddress, this.client)).script;

    // Server owns the timestamp — not the caller
    const serverTimestamp = new Date().toISOString();
    const encodedData = this.encodeHashData(fileHash, serverTimestamp);

    logger.info(`Built unsigned tx for ${userAddress} — hash: ${fileHash}`);

    return {
      outputs: [{ lock: userScript, capacity: ccc.numLeToHex(ANCHOR_CAPACITY) }],
      outputsData: [encodedData],
    };
  }

  /**
   * Legacy: server-signs-and-pays flow. Retained for admin/internal use only.
   */
  public async submitHash(payload: HashPayload): Promise<SubmissionResult> {
    if (!this.isInitialized) await this.start();

    try {
      const addressObj = await this.signer.getRecommendedAddressObj();
      logger.info(`Building transaction for address: ${addressObj.address}`);

      // Server owns the timestamp — not the caller
      const serverTimestamp = new Date().toISOString();
      const encodedData = this.encodeHashData(payload.fileHash, serverTimestamp);

      const tx = ccc.Transaction.from({
        outputs: [{ lock: addressObj.script, capacity: ccc.numLeToHex(ANCHOR_CAPACITY) }],
        outputsData: [encodedData],
      });

      await tx.completeInputsByCapacity(this.signer);
      await tx.completeFeeBy(this.signer, 1000);

      const txHash = await this.signer.sendTransaction(tx);
      logger.info(`Transaction sent: ${txHash}`);

      return { txHash, blockNumber: "pending", status: "committed" };
    } catch (error: any) {
      logger.error("Transaction failed", error);
      throw new Error(`Failed to anchor hash: ${error.message}`);
    }
  }

  public async verifyHash(
    fileHash: string
  ): Promise<{ timestamp: string; blockNumber: string } | null> {
    if (!this.isInitialized) await this.start();

    try {
      const addressObj = await this.signer.getRecommendedAddressObj();
      const cleanSearchHash = fileHash.startsWith("0x") ? fileHash.slice(2) : fileHash;

      logger.info(`Searching for hash: ${cleanSearchHash}`);

      const collector = this.client.findCellsByLock(addressObj.script, "asc");

      for await (const cell of collector.collect()) {
        const cellData = cell.outputData || "";
        if (!cellData.includes(cleanSearchHash)) continue;

        const decoded = this.decodeHashData(cellData);
        return {
          timestamp: decoded.timestamp,
          blockNumber: cell.blockNumber?.toString() || "unknown",
        };
      }

      return null;
    } catch (error: any) {
      logger.error("Verification failed", error);
      throw new Error(`Failed to verify hash: ${error.message}`);
    }
  }

  private encodeHashData(fileHash: string, timestampISO: string): string {
    const cleanHash = fileHash.startsWith("0x") ? fileHash.slice(2) : fileHash;
    const timestampMs = BigInt(new Date(timestampISO).getTime());
    const timestampHex = timestampMs.toString(16).padStart(16, "0");
    return `0x${cleanHash}${timestampHex}`;
  }

  private decodeHashData(hexData: string): { hash: string; timestamp: string } {
    const data = hexData.startsWith("0x") ? hexData.slice(2) : hexData;
    const hash = data.slice(0, 64);
    const timestampHex = data.slice(64, 80);
    const timestampMs = BigInt(`0x${timestampHex}`);
    return {
      hash: `0x${hash}`,
      timestamp: new Date(Number(timestampMs)).toISOString(),
    };
  }
}

export const ckbService = new CKBService();
