import { ccc } from "@ckb-ccc/core";

const ANCHOR_CAPACITY = BigInt("11000000000"); // 110 CKB in shannons

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