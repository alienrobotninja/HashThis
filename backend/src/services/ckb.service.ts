import { RPC, Indexer, config, commons, Cell, HexString, Script, hd, helpers } from "@ckb-lumos/lumos";
import { TransactionSkeleton, TransactionSkeletonType, sealTransaction } from "@ckb-lumos/helpers";
import { registry } from "../config/registry.js";
import { logger } from "../utils/logger.js";
import { HashPayload, SubmissionResult } from "../types/index.js";

// 110 CKB in shannons — 101 CKB minimum (cell + data) plus headroom
const ANCHOR_CAPACITY = BigInt("11000000000");

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

    const testnetConfig = config.predefined.AGGRON4;
    const scriptConfig = testnetConfig.SCRIPTS.SECP256K1_BLAKE160;

    if (!scriptConfig) {
      throw new Error("CKB Script configuration not found for Testnet.");
    }

    const privKey = registry.ckb.signerPrivKey;
    if (!privKey || privKey === '0x') {
      throw new Error("Private key is missing. Check your .env file.");
    }

    const pubKey = hd.key.privateToPublic(privKey);
    const args = hd.key.publicKeyToBlake160(pubKey);

    const lockScript: Script = {
      codeHash: scriptConfig.CODE_HASH,
      hashType: scriptConfig.HASH_TYPE,
      args,
    };

    const fromAddress = helpers.encodeToAddress(lockScript, { config: testnetConfig });
    logger.info(`Building transaction for address: ${fromAddress}`);

    const encodedData = this.encodeHashData(payload.fileHash, payload.timestamp);

    let txSkeleton = TransactionSkeleton({ cellProvider: this.indexer });

    // Define output cell with the hash data embedded
    const anchorCell: Cell = {
      cellOutput: {
        capacity: "0x28fa6ae00", // 110 CKB in shannons
        lock: lockScript,
      },
      data: encodedData,
    };

    txSkeleton = txSkeleton.update("outputs", (outputs) => outputs.push(anchorCell));

    // Fix the output so lumos doesn't treat it as a free-to-adjust change cell
    txSkeleton = txSkeleton.update("fixedEntries", (entries) =>
      entries.push({ field: "outputs", index: 0 })
    );

    // Add cell dependencies
    txSkeleton = txSkeleton.update("cellDeps", (cellDeps) =>
      cellDeps.push({
        outPoint: {
          txHash: scriptConfig.TX_HASH,
          index: scriptConfig.INDEX,
        },
        depType: scriptConfig.DEP_TYPE,
      })
    );

    // Collect enough inputs to cover the anchor cell + fees, change goes back to sender
    txSkeleton = await commons.common.injectCapacity(
      txSkeleton,
      [fromAddress],
      ANCHOR_CAPACITY,
      testnetConfig
    );

    // Pay network fees
    txSkeleton = await commons.common.payFeeByFeeRate(
      txSkeleton,
      [fromAddress],
      1000,
      undefined,
      { config: testnetConfig }
    );

    // Prepare signing entries (must be called exactly once after all tx building is done)
    txSkeleton = commons.common.prepareSigningEntries(txSkeleton, { config: testnetConfig });

    const signingEntries = txSkeleton.get("signingEntries");
    if (!signingEntries || signingEntries.size === 0) {
      throw new Error("No signing entries — wallet may have insufficient balance or indexer is unreachable.");
    }

    const sig = hd.key.signRecoverable(signingEntries.get(0)!.message, privKey);
    const tx = sealTransaction(txSkeleton, [sig]);
    const txHash = await this.rpc.sendTransaction(tx, "passthrough");
    logger.info(`Transaction Sent: ${txHash}`);

    return {
      txHash,
      blockNumber: "pending",
      status: "committed",
    };
  }

  /**
   * Scans the blockchain for a specific file hash.
   */
  public async verifyHash(fileHash: string): Promise<{ timestamp: string; blockNumber: string } | null> {
    if (!this.isInitialized) await this.start();

    const testnetConfig = config.predefined.AGGRON4;
    const scriptConfig = testnetConfig.SCRIPTS.SECP256K1_BLAKE160;

    const privKey = registry.ckb.signerPrivKey;
    const pubKey = hd.key.privateToPublic(privKey);
    const args = hd.key.publicKeyToBlake160(pubKey);

    const lockScript: Script = {
      codeHash: scriptConfig!.CODE_HASH,
      hashType: scriptConfig!.HASH_TYPE,
      args,
    };

    const collector = this.indexer.collector({ lock: lockScript });
    const cleanSearchHash = fileHash.startsWith('0x') ? fileHash.slice(2) : fileHash;

    logger.info(`Searching for hash: ${cleanSearchHash}`);

    for await (const cell of collector.collect()) {
      if (cell.data.includes(cleanSearchHash)) {
        const decoded = this.decodeHashData(cell.data);
        return {
          timestamp: decoded.timestamp,
          blockNumber: cell.blockNumber || 'unknown',
        };
      }
    }

    return null;
  }

  public encodeHashData(fileHash: string, timestampISO: string): HexString {
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