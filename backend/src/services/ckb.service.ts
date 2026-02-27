import { ccc } from "@ckb-ccc/core";
import { registry } from "../config/registry.js";
import { logger } from "../utils/logger.js";
import { HashPayload, SubmissionResult } from "../types/index.js";

// 110 CKB in shannons — 101 CKB minimum (cell + data) plus headroom
const ANCHOR_CAPACITY = BigInt("11000000000");

export class CKBService {
  private client: ccc.Client;
  private signer: ccc.SignerCkbPrivateKey;
  private isInitialized: boolean = false;

  constructor() {
    // Initialize CCC client based on network configuration
    if (registry.ckb.network === 'mainnet') {
      this.client = new ccc.ClientPublicMainnet();
    } else {
      this.client = new ccc.ClientPublicTestnet();
    }
    
    // Create signer from private key
    this.signer = new ccc.SignerCkbPrivateKey(
      this.client,
      registry.ckb.signerPrivKey
    );
  }

  /**
   * Initializes the CKB service - CCC handles configuration automatically
   */
  public async start() {
    if (this.isInitialized) return;
    try {
      this.isInitialized = true;
      logger.info(`CKB Service Initialized [${registry.ckb.network}]`);
    } catch (error) {
      logger.error("Failed to init CKB Service", error);
    }
  }

  /**
   * Anchors a file hash to the blockchain by creating a new cell.
   */
  public async submitHash(payload: HashPayload): Promise<SubmissionResult> {
    if (!this.isInitialized) await this.start();

    const privKey = registry.ckb.signerPrivKey;
    if (!privKey || privKey === '0x') {
      throw new Error("Private key is missing. Check your .env file.");
    }

    try {
      // Get lock script from signer
      const addressObj = await this.signer.getRecommendedAddressObj();
      const lockScript = addressObj.script;
      
      logger.info(`Building transaction for address: ${addressObj.address}`);

      // Encode hash + timestamp into cell data
      const encodedData = this.encodeHashData(payload.fileHash, payload.timestamp);

      // Create transaction with output cell containing the hash data
      const tx = ccc.Transaction.from({
        outputs: [{
          lock: lockScript,
          capacity: ccc.numLeToHex(ANCHOR_CAPACITY),
        }],
        outputsData: [encodedData],
      });

      // CCC automatically handles:
      // - Input collection (replaces injectCapacity)
      // - Cell dependencies (no manual cellDeps needed)
      // - Change output creation
      await tx.completeInputsByCapacity(this.signer);
      
      // Pay network fees (1000 shannons/KB fee rate)
      await tx.completeFeeBy(this.signer, 1000);

      // Sign and send transaction
      const txHash = await this.signer.sendTransaction(tx);
      
      logger.info(`Transaction Sent: ${txHash}`);

      return {
        txHash,
        blockNumber: "pending",
        status: "committed",
      };
    } catch (error: any) {
      logger.error("Transaction failed", error);
      throw new Error(`Failed to anchor hash: ${error.message}`);
    }
  }

  /**
   * Scans the blockchain for a specific file hash.
   */
  public async verifyHash(fileHash: string): Promise<{ timestamp: string; blockNumber: string } | null> {
    if (!this.isInitialized) await this.start();

    try {
      const privKey = registry.ckb.signerPrivKey;
      const addressObj = await this.signer.getRecommendedAddressObj();
      const lockScript = addressObj.script;

      const cleanSearchHash = fileHash.startsWith('0x') ? fileHash.slice(2) : fileHash;
      logger.info(`Searching for hash: ${cleanSearchHash}`);

      // Collect all cells with our lock script
      const collector = this.client.findCellsByLock(lockScript, "asc");

      for await (const cell of collector.collect()) {
        const cellData = cell.outputData || '';
        if (cellData.includes(cleanSearchHash)) {
          const decoded = this.decodeHashData(cellData);
          return {
            timestamp: decoded.timestamp,
            blockNumber: cell.blockNumber?.toString() || 'unknown',
          };
        }
      }

      return null;
    } catch (error: any) {
      logger.error("Verification failed", error);
      throw new Error(`Failed to verify hash: ${error.message}`);
    }
  }

  public encodeHashData(fileHash: string, timestampISO: string): string {
    const cleanHash = fileHash.startsWith('0x') ? fileHash.slice(2) : fileHash;
    const timestamp = BigInt(new Date(timestampISO).getTime());
    const timestampHex = timestamp.toString(16).padStart(16, '0');
    return `0x${cleanHash}${timestampHex}`;
  }

  private decodeHashData(hexData: string): { hash: string; timestamp: string } {
    const data = hexData.startsWith('0x') ? hexData.slice(2) : hexData;
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