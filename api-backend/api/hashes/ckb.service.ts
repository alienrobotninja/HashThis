import { ccc } from "@ckb-ccc/core";

const ANCHOR_CAPACITY = BigInt("9500000000"); // 95 CKB in shannons (reduced from 110 CKB)

// Timestamp is intentionally absent — always derived server-side.
interface HashPayload {
  fileHash: string;
}

interface UnsignedTxPayload {
  fileHash: string;
  userAddress: string; // CKB address of the user — output cell is locked to them
}

interface UnsignedTxResult {
  outputs: { lock: object; capacity: string }[];
  outputsData: string[];
}

interface SubmissionResult {
  txHash: string;
  blockNumber: string;
  status: string;
}

class CKBService {
  private client: ccc.Client;
  private signer: ccc.SignerCkbPrivateKey | null = null;

  constructor() {
    const network = process.env.CKB_NETWORK || "testnet";
    this.client =
      network === "mainnet"
        ? new ccc.ClientPublicMainnet()
        : new ccc.ClientPublicTestnet();
  }

  private getSigner(): ccc.SignerCkbPrivateKey {
    if (!this.signer) {
      const privKey = process.env.PRIVATE_KEY;
      if (!privKey || privKey === "0x") {
        throw new Error("PRIVATE_KEY is missing from environment variables");
      }
      this.signer = new ccc.SignerCkbPrivateKey(this.client, privKey);
    }
    return this.signer;
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

      console.log(`[CKB] Built batch unsigned tx for ${userAddress} — ${fileHashes.length} hashes, total capacity: ${totalCapacity.toString()} shannons`);

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
      console.error("[CKB] Build batch unsigned tx failed:", error.message);
      throw new Error(`Failed to build batch transaction: ${error.message}`);
    }
  }

  /**
   * Builds an unsigned transaction shell locked to the user's address.
   * Cell data contains only the file hash — timestamp comes from block header.
   * The server wallet is not involved in signing or paying.
   */
  public async buildUnsignedTx(payload: UnsignedTxPayload): Promise<UnsignedTxResult> {
    const { fileHash, userAddress } = payload;

    const userScript = (await ccc.Address.fromString(userAddress, this.client)).script;

    // Encode only the hash — no timestamp in cell data
    const encodedData = this.encodeHashData(fileHash);

    console.log(`[CKB] Built unsigned tx for ${userAddress} — hash: ${fileHash}`);

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
    try {
      const signer = this.getSigner();
      const addressObj = await signer.getRecommendedAddressObj();

      // Encode only the hash — no timestamp in cell data
      const encodedData = this.encodeHashData(payload.fileHash);

      const tx = ccc.Transaction.from({
        outputs: [{ lock: addressObj.script, capacity: ccc.numToHex(ANCHOR_CAPACITY) }],
        outputsData: [encodedData],
      });

      await tx.completeInputsByCapacity(signer);
      await tx.completeFeeBy(signer, 1000);

      const txHash = await signer.sendTransaction(tx);
      console.log(`[CKB] Transaction sent: ${txHash}`);

      return { txHash, blockNumber: "pending", status: "committed" };
    } catch (error: any) {
      console.error("[CKB] Submit failed:", error.message);
      throw new Error(`Failed to anchor hash: ${error.message}`);
    }
  }

  /**
   * Scans cells locked to the given user address for a matching file hash.
   * Does not require the server wallet — userAddress is passed from the client.
   * Note: Timestamp is no longer in cell data — use getBlockTime() instead.
   */
  public async verifyHash(
    fileHash: string,
    userAddress: string
  ): Promise<{ blockNumber: string; txHash?: string } | null> {
    try {
      // Resolve user address -> lock script, no server signer needed
      const userScript = (await ccc.Address.fromString(userAddress, this.client)).script;
      const cleanSearchHash = fileHash.startsWith("0x") ? fileHash.slice(2) : fileHash;

      console.log(`[CKB] Searching for hash: ${cleanSearchHash} under ${userAddress}`);

      const cells: any[] = [];
      try {
        const iterator: any = this.client.findCells(
          { script: userScript, scriptType: "lock", scriptSearchMode: "exact" },
          "asc"
        );
        for await (const cell of iterator) cells.push(cell);
      } catch (e: any) {
        console.log("[CKB] findCells error:", e.message);
      }

      for (const cell of cells) {
        if (!cell?.outputData) continue;
        if (!cell.outputData.includes(cleanSearchHash)) continue;

        const decoded = this.decodeHashData(cell.outputData);
        return {
          blockNumber: cell.blockNumber?.toString() || "unknown",
          txHash: cell.txHash, // Include txHash so caller can fetch block timestamp
        };
      }

      return null;
    } catch (error: any) {
      console.error("[CKB] Verify failed:", error.message);
      throw new Error(`Failed to verify hash: ${error.message}`);
    }
  }

  /**
   * Returns all proof cells locked to the given user address.
   * Scans the live cell set and decodes each cell's hash data.
   * Results are returned in descending order (most recent first).
   */
  public async getUserProofs(userAddress: string): Promise<Array<{
    fileHash: string;
    txHash: string;
    blockNumber: string;
  }>> {
    try {
      const userScript = (await ccc.Address.fromString(userAddress, this.client)).script;

      console.log(`[CKB] Fetching all proofs for: ${userAddress}`);

      const proofs: Array<{ fileHash: string; txHash: string; blockNumber: string }> = [];

      try {
        const iterator: any = this.client.findCells(
          { script: userScript, scriptType: "lock", scriptSearchMode: "exact" },
          "desc"
        );
        for await (const cell of iterator) {
          if (!cell?.outputData) continue;

          // Must be at least 64 hex chars (32 bytes) to be a valid hash cell
          const raw = cell.outputData.startsWith("0x")
            ? cell.outputData.slice(2)
            : cell.outputData;
          if (raw.length < 64) continue;

          const decoded = this.decodeHashData(cell.outputData);
          proofs.push({
            fileHash: decoded.hash,
            txHash: cell.txHash || "",
            blockNumber: cell.blockNumber?.toString() ?? "unknown",
          });
        }
      } catch (e: any) {
        console.log("[CKB] findCells error in getUserProofs:", e.message);
      }

      console.log(`[CKB] Found ${proofs.length} proofs for ${userAddress}`);
      return proofs;
    } catch (error: any) {
      console.error("[CKB] getUserProofs failed:", error.message);
      throw new Error(`Failed to fetch user proofs: ${error.message}`);
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
    const cleanTxHash = txHash.startsWith("0x") ? txHash : `0x${txHash}`;
    
    console.log(`[CKB] Polling transaction status: ${cleanTxHash}`);
    
    // Poll until transaction is committed (max 60 attempts = ~5 minutes)
    const txStatus = await this.pollTransactionStatus(cleanTxHash, 60, 5000);
    
    if (!txStatus || !txStatus.blockHash) {
      throw new Error("Transaction not confirmed - no block hash available");
    }

    console.log(`[CKB] Transaction committed in block: ${txStatus.blockHash}`);

    // Fetch the block header to get the timestamp
    const block = await this.client.getBlockByHash(txStatus.blockHash);
    
    if (!block || !block.header) {
      throw new Error("Failed to fetch block header");
    }

    // Extract timestamp from block header (it's in milliseconds as hex)
    const timestampMs = Number(BigInt(block.header.timestamp));
    const timestamp = new Date(timestampMs).toISOString();
    const blockNumber = BigInt(block.header.number).toString();

    console.log(`[CKB] Block timestamp: ${timestamp}, Block number: ${blockNumber}`);

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
        console.error(`[CKB] Error polling tx status (attempt ${attempt + 1}):`, error.message);
        
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