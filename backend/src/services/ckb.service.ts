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
   * Cell data contains only the file hash — timestamp comes from block header.
   * The server wallet is not involved in signing or paying.
   */
  public async buildUnsignedTx(payload: UnsignedTxPayload): Promise<UnsignedTxResult> {
    if (!this.isInitialized) await this.start();

    const { fileHash, userAddress } = payload;
    const userScript = (await ccc.Address.fromString(userAddress, this.client)).script;

    // Encode only the hash — no timestamp in cell data
    const encodedData = this.encodeHashData(fileHash);

    logger.info(`Built unsigned tx for ${userAddress} — hash: ${fileHash}`);

    return {
      outputs: [{ lock: userScript, capacity: ccc.numToHex(ANCHOR_CAPACITY) }],
      outputsData: [encodedData],
    };
  }

  /**
   * Legacy: server-signs-and-pays flow. Retained for admin/internal use only.
   * Cell data contains only the hash — timestamp comes from block header.
   */
  public async submitHash(payload: HashPayload): Promise<SubmissionResult> {
    if (!this.isInitialized) await this.start();

    try {
      const addressObj = await this.signer.getRecommendedAddressObj();
      logger.info(`Building transaction for address: ${addressObj.address}`);

      // Encode only the hash — no timestamp in cell data
      const encodedData = this.encodeHashData(payload.fileHash);

      const tx = ccc.Transaction.from({
        outputs: [{ lock: addressObj.script, capacity: ccc.numToHex(ANCHOR_CAPACITY) }],
        outputsData: [encodedData],
      });

      await tx.completeInputsByCapacity(this.signer);
      await tx.completeFeeBy(this.signer, 2000);

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
  ): Promise<{ blockNumber: string } | null> {
    if (!this.isInitialized) await this.start();

    try {
      const addressObj = await this.signer.getRecommendedAddressObj();
      const cleanSearchHash = fileHash.startsWith("0x") ? fileHash.slice(2) : fileHash;

      logger.info(`Searching for hash: ${cleanSearchHash}`);

      const cells: any[] = [];
      try {
        const iterator: any = this.client.findCells(
          { script: addressObj.script, scriptType: "lock", scriptSearchMode: "exact" },
          "asc"
        );
        for await (const cell of iterator) cells.push(cell);
      } catch (e: any) {
        logger.info(`findCells error: ${e.message}`);
      }

      for (const cell of cells) {
        const cellData = cell.outputData || "";
        if (!cellData.includes(cleanSearchHash)) continue;

        const decoded = this.decodeHashData(cellData);
        return {
          blockNumber: cell.blockNumber?.toString() || "unknown",
        };
      }

      return null;
    } catch (error: any) {
      logger.error("Verification failed", error);
      throw new Error(`Failed to verify hash: ${error.message}`);
    }
  }

  // Encodes only the 32-byte file hash.
  // Timestamp is no longer stored in cell data — it comes from block header.
  private encodeHashData(fileHash: string): string {
    const cleanHash = fileHash.startsWith("0x") ? fileHash.slice(2) : fileHash;
    return `0x${cleanHash}`;
  }

  // Decodes cell data to extract only the file hash.
  // Timestamp is no longer stored — comes from block header.
  // Backwards compatible: if legacy data has timestamp appended, we ignore it.
  private decodeHashData(hexData: string): { hash: string } {
    const data = hexData.startsWith("0x") ? hexData.slice(2) : hexData;
    // Extract only the first 32 bytes (64 hex chars) as the hash
    const hash = data.slice(0, 64);
    return {
      hash: `0x${hash}`,
    };
  }
}

export const ckbService = new CKBService();