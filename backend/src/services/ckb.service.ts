import { RPC, Indexer, config, commons, Cell, HexString, Transaction } from "@ckb-lumos/lumos";
import { TransactionSkeletonType, sealTransaction } from "@ckb-lumos/helpers";
import { registry } from "../config/registry.js";
import { logger } from "../utils/logger.js";

export class CKBService {
  private rpc: RPC;
  private indexer: Indexer;
  private isInitialized: boolean = false;

  constructor() {
    this.rpc = new RPC(registry.ckb.rpcUrl);
    this.indexer = new Indexer(registry.ckb.indexerUrl);
  }

  public async start() {
    if (this.isInitialized) return;
    try {
      config.initializeConfig(config.predefined.AGGRON4);
      const tip = await this.rpc.getTipHeader();
      logger.info(`Connected to CKB Node [${registry.ckb.network}]`, {
        blockNumber: tip.number
      });
      this.isInitialized = true;
    } catch (error) {
      logger.error("Failed to connect to CKB Node", error);
      throw error;
    }
  }

  /**
   * Packs the file hash and timestamp into a single hex string 
   * compatible with CKB Cell Data.
   */
  public encodeHashData(fileHash: string, timestampISO: string): HexString {
    const cleanHash = fileHash.startsWith('0x') ? fileHash.slice(2) : fileHash;
    const timestamp = BigInt(new Date(timestampISO).getTime());
    const timestampHex = timestamp.toString(16).padStart(16, '0');
    
    const data = `0x${cleanHash}${timestampHex}`;
    
    logger.debug("Encoded Cell Data", { data });
    return data;
  }

  /**
   * Signs a transaction skeleton with the server's private key 
   * and broadcasts it to the network.
   */
  public async signAndSend(txSkeleton: TransactionSkeletonType): Promise<string> {
    // FIX 1: Use the correct key name from registry.ts (signerPrivKey)
    const privKey = registry.ckb.signerPrivKey;
    if (!privKey) throw new Error("Missing Private Key for signing");

    // FIX 2: Use commons.common for signing entries
    // "common" handles the standard SECP256K1 signature placeholder logic
    const txSkeletonWithWitness = commons.common.prepareSigningEntries(txSkeleton);
    
    // Sign the message
    const tx = sealTransaction(txSkeletonWithWitness, [privKey]);

    // Broadcast
    const txHash = await this.rpc.sendTransaction(tx, "passthrough");
    
    logger.info(`Transaction Broadcasted`, { txHash });
    return txHash;
  }
}

export const ckbService = new CKBService();