import { RPC, Indexer, config, commons, Cell, HexString, Script, hd } from "@ckb-lumos/lumos";
import { TransactionSkeleton, TransactionSkeletonType, sealTransaction } from "@ckb-lumos/helpers";
import { registry } from "../config/registry.js";
import { logger } from "../utils/logger.js";
import { HashPayload, SubmissionResult } from "../types/index.js";

export class CKBService {
  private rpc: RPC;
  private indexer: Indexer;
  private isInitialized: boolean = false;

  constructor() {
    this.rpc = new RPC(registry.ckb.rpcUrl);
    this.indexer = new Indexer(registry.ckb.indexerUrl);
  }

  /**
   * Initializes the Lumos configuration for the Aggron4 Testnet.
   */
  public async start() {
    if (this.isInitialized) return;
    try {
      config.initializeConfig(config.predefined.AGGRON4);
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
    const pubKey = hd.key.privateToPublic(privKey);
    const args = hd.key.publicKeyToBlake160(pubKey);
    
    const lockScript: Script = {
      codeHash: config.predefined.AGGRON4.SCRIPTS.SECP256K1_BLAKE160.CODE_HASH,
      hashType: config.predefined.AGGRON4.SCRIPTS.SECP256K1_BLAKE160.HASH_TYPE,
      args: args
    };

    let txSkeleton = TransactionSkeleton({ cellProvider: this.indexer });

    const outputCell: Cell = {
      cellOutput: {
        capacity: "0x174876e800", // 100 CKB
        lock: lockScript,
      },
      data: this.encodeHashData(payload.fileHash, payload.timestamp),
    };

    txSkeleton = txSkeleton.update("outputs", (outputs) => outputs.push(outputCell));

    // Inject Capacity (Inputs)
    txSkeleton = await commons.common.setupInputCell(
      txSkeleton,
      lockScript as any, 
      undefined,
      { config: config.predefined.AGGRON4 }
    );

    // Pay Network Fees
    txSkeleton = await commons.common.payFeeByFeeRate(
      txSkeleton,
      [lockScript as any],
      1000,
      undefined,
      { config: config.predefined.AGGRON4 }
    );

    const txHash = await this.signAndSend(txSkeleton);

    return {
      txHash,
      blockNumber: "pending",
      status: "committed"
    };
  }

  /**
   * Scans the blockchain for a specific file hash.
   * Returns the metadata if found, or null if it's a "fresh" hash.
   */
  public async verifyHash(fileHash: string): Promise<{ timestamp: string; blockNumber: string } | null> {
    if (!this.isInitialized) await this.start();

    const privKey = registry.ckb.signerPrivKey;
    const pubKey = hd.key.privateToPublic(privKey);
    const args = hd.key.publicKeyToBlake160(pubKey);
    
    const lockScript: Script = {
      codeHash: config.predefined.AGGRON4.SCRIPTS.SECP256K1_BLAKE160.CODE_HASH,
      hashType: config.predefined.AGGRON4.SCRIPTS.SECP256K1_BLAKE160.HASH_TYPE,
      args: args
    };

    // Use CellCollector to find all cells associated with this lock script
    const collector = this.indexer.collector({ lock: lockScript });
    const cleanSearchHash = fileHash.startsWith('0x') ? fileHash.slice(2) : fileHash;

    logger.info(`Searching for hash: ${cleanSearchHash}`);

    for await (const cell of collector.collect()) {
      const cellData = cell.data;
      
      // Data format: 0x + <32 bytes hash> + <8 bytes timestamp>
      // We check if the hash part matches our search target
      if (cellData.includes(cleanSearchHash)) {
        const decoded = this.decodeHashData(cellData);
        return {
          timestamp: decoded.timestamp,
          blockNumber: cell.blockNumber || 'unknown'
        };
      }
    }

    return null;
  }

  /**
   * Hex-encodes hash and timestamp for cell storage.
   */
  public encodeHashData(fileHash: string, timestampISO: string): HexString {
    const cleanHash = fileHash.startsWith('0x') ? fileHash.slice(2) : fileHash;
    const timestamp = BigInt(new Date(timestampISO).getTime());
    const timestampHex = timestamp.toString(16).padStart(16, '0');
    return `0x${cleanHash}${timestampHex}`;
  }

  /**
   * Extracts data from hex-encoded cell data.
   */
  private decodeHashData(hexData: string): { hash: string; timestamp: string } {
    const data = hexData.startsWith('0x') ? hexData.slice(2) : hexData;
    
    // First 64 hex chars = 32 bytes (The SHA-256 Hash)
    const hash = data.slice(0, 64);
    
    // Remaining 16 hex chars = 8 bytes (The Timestamp)
    const timestampHex = data.slice(64, 80);
    const timestampMs = BigInt(`0x${timestampHex}`);
    
    return {
      hash: `0x${hash}`,
      timestamp: new Date(Number(timestampMs)).toISOString()
    };
  }

  /**
   * Signs and broadcasts the transaction.
   */
  private async signAndSend(txSkeleton: TransactionSkeletonType): Promise<string> {
    const privKey = registry.ckb.signerPrivKey;
    const txSkeletonWithWitness = commons.common.prepareSigningEntries(txSkeleton);
    const tx = sealTransaction(txSkeletonWithWitness, [privKey]);
    const txHash = await this.rpc.sendTransaction(tx, "passthrough");
    logger.info(`Transaction Sent: ${txHash}`);
    return txHash;
  }
}

export const ckbService = new CKBService();