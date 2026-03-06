import { ccc } from "@ckb-ccc/core";
import { registry } from "../config/registry.js";
import { logger } from "../utils/logger.js";
import { HashPayload, SubmissionResult, UnsignedTxPayload, UnsignedTxResult } from "../types/index.js";

// 95 CKB in shannons — minimum capacity for cell with 32-byte data + standard lock
const ANCHOR_CAPACITY = BigInt("9500000000");

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
   * Builds an unsigned transaction with multiple hash outputs (batch proof).
   * Each hash gets its own output cell with ANCHOR_CAPACITY.
   * User's wallet will complete inputs and sign.
   */
  public async buildBatchUnsignedTx(
    fileHashes: string[],
    userAddress: string
  ): Promise<{
    transaction: any;
    proofCount: number;
    totalCapacity: string;
    estimatedFee: string;
  }> {
    if (!this.isInitialized) await this.start();

    try {
      const userScript = (await ccc.Address.fromString(userAddress, this.client)).script;
      
      // Build outputs array - one cell per hash
      const outputs = fileHashes.map(() => ({
        lock: userScript,
        capacity: ccc.numToHex(ANCHOR_CAPACITY)
      }));

      // Build outputs data array - one hash per cell
      const outputsData = fileHashes.map(hash => this.encodeHashData(hash));

      const totalCapacity = ANCHOR_CAPACITY * BigInt(fileHashes.length);

      logger.info(`Built batch unsigned tx for ${userAddress} — ${fileHashes.length} hashes, total capacity: ${totalCapacity.toString()} shannons`);

      return {
        transaction: {
          version: "0x0",
          cellDeps: [],
          headerDeps: [],
          inputs: [],
          outputs,
          outputsData,
          witnesses: []
        },
        proofCount: fileHashes.length,
        totalCapacity: totalCapacity.toString(),
        estimatedFee: "100000000" // ~1 CKB estimate (actual will be calculated by wallet)
      };
    } catch (error: any) {
      logger.error(`Build batch unsigned tx failed: ${error.message}`);
      throw new Error(`Failed to build batch transaction: ${error.message}`);
    }
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
      logger.info(`Building transaction for address: ${addressObj.toString()}`);

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

  /**
   * Polls transaction status until it's committed, then fetches the block timestamp.
   * This is the authoritative proof timestamp - from the block header, not server time.
   */
  public async getBlockTime(txHash: string): Promise<{
    timestamp: string;
    blockNumber: string;
    blockHash: string;
  }> {
    if (!this.isInitialized) await this.start();

    const cleanTxHash = txHash.startsWith("0x") ? txHash : `0x${txHash}`;
    
    logger.info(`Polling transaction status: ${cleanTxHash}`);
    
    // Poll until transaction is committed (max 60 attempts = ~5 minutes)
    const txStatus = await this.pollTransactionStatus(cleanTxHash, 60, 5000);
    
    if (!txStatus || !txStatus.blockHash) {
      throw new Error("Transaction not confirmed - no block hash available");
    }

    logger.info(`Transaction committed in block: ${txStatus.blockHash}`);

    // Fetch the block header to get the timestamp
    const block = await this.client.getBlockByHash(txStatus.blockHash);
    
    if (!block || !block.header) {
      throw new Error("Failed to fetch block header");
    }

    // Extract timestamp from block header (it's in milliseconds as hex)
    const timestampMs = Number(BigInt(block.header.timestamp));
    const timestamp = new Date(timestampMs).toISOString();
    const blockNumber = BigInt(block.header.number).toString();

    logger.info(`Block timestamp: ${timestamp}, Block number: ${blockNumber}`);

    return {
      timestamp,
      blockNumber,
      blockHash: txStatus.blockHash,
    };
  }

  /**
   * Polls transaction status until committed or timeout.
   * Returns transaction status with blockHash when committed.
   */
  public async pollTransactionStatus(
    txHash: string,
    maxAttempts: number = 60,
    intervalMs: number = 5000
  ): Promise<{ blockHash: string; status: string } | null> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const txResponse = await this.client.getTransaction(txHash);
        
        if (txResponse && txResponse.status === "committed") {
          return {
            blockHash: txResponse.blockHash || "",
            status: "committed",
          };
        }

        // Wait before next attempt (except on last attempt)
        if (attempt < maxAttempts - 1) {
          await new Promise(resolve => setTimeout(resolve, intervalMs));
        }
      } catch (error: any) {
        logger.info(`Error polling tx status (attempt ${attempt + 1}): ${error.message}`);
        
        // Continue polling even on error (transaction might not be visible yet)
        if (attempt < maxAttempts - 1) {
          await new Promise(resolve => setTimeout(resolve, intervalMs));
        }
      }
    }

    return null; // Timeout
  }
}

export const ckbService = new CKBService();