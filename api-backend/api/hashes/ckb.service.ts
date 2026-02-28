import { ccc } from "@ckb-ccc/core";

const ANCHOR_CAPACITY = BigInt("11000000000"); // 110 CKB

interface HashPayload {
  fileHash: string;
  timestamp: string;
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
    const network = process.env.CKB_NETWORK || 'testnet';
    this.client = network === 'mainnet'
      ? new ccc.ClientPublicMainnet()
      : new ccc.ClientPublicTestnet();
  }

  private getSigner(): ccc.SignerCkbPrivateKey {
    if (!this.signer) {
      const privKey = process.env.PRIVATE_KEY;
      if (!privKey || privKey === '0x') {
        throw new Error("Private key is missing in environment variables");
      }
      this.signer = new ccc.SignerCkbPrivateKey(this.client, privKey);
    }
    return this.signer;
  }

  public async submitHash(payload: HashPayload): Promise<SubmissionResult> {
    try {
      const signer = this.getSigner();
      const addressObj = await signer.getRecommendedAddressObj();
      
      console.log(`[CKB] Building transaction`);

      const encodedData = this.encodeHashData(payload.fileHash, payload.timestamp);

      const tx = ccc.Transaction.from({
        outputs: [{
          lock: addressObj.script,
          capacity: ccc.numToHex(ANCHOR_CAPACITY),
        }],
        outputsData: [encodedData],
      });

      await tx.completeInputsByCapacity(signer);
      await tx.completeFeeBy(signer, 1000);

      const txHash = await signer.sendTransaction(tx);
      console.log(`[CKB] Transaction sent: ${txHash}`);

      return {
        txHash,
        blockNumber: "pending",
        status: "committed",
      };
    } catch (error: any) {
      console.error("[CKB] Submit failed:", error.message);
      throw new Error(`Failed to anchor hash: ${error.message}`);
    }
  }

  public async verifyHash(fileHash: string): Promise<{ timestamp: string; blockNumber: string } | null> {
    try {
      const signer = this.getSigner();
      
      const cleanSearchHash = fileHash.startsWith('0x') ? fileHash.slice(2) : fileHash;
      console.log(`[CKB] Searching for hash: ${cleanSearchHash}`);

      // Get all transactions sent by this signer
      const addressObj = await signer.getRecommendedAddressObj();
      const address = addressObj.address;
      
      console.log(`[CKB] Searching transactions for address: ${address}`);

      // Use findTransactions instead of findCellsByLock
      let found = false;
      for await (const tx of this.client.findTransactions(address, "asc", "lock")) {
        console.log('[CKB] Checking transaction:', tx.txHash);
        
        // Get full transaction details
        try {
          const txWithStatus = await this.client.getTransaction(tx.txHash);
          if (!txWithStatus?.transaction) continue;
          
          // Check outputs data
          const outputs = txWithStatus.transaction.outputsData || [];
          for (const outputData of outputs) {
            if (!outputData) continue;
            
            console.log('[CKB] Checking output data:', outputData);
            
            if (outputData.includes(cleanSearchHash)) {
              console.log('[CKB] Match found!');
              const decoded = this.decodeHashData(outputData);
              
              const blockNum = txWithStatus.blockNumber?.toString() || 'unknown';
              
              return {
                timestamp: decoded.timestamp,
                blockNumber: blockNum,
              };
            }
          }
        } catch (e: any) {
          console.log('[CKB] Error checking tx:', e.message);
        }
      }

      console.log('[CKB] No matching hash found');
      return null;
    } catch (error: any) {
      console.error("[CKB] Verify failed:", error.message);
      console.error("[CKB] Full error:", error);
      throw new Error(`Failed to verify hash: ${error.message}`);
    }
  }

  private encodeHashData(fileHash: string, timestampISO: string): string {
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