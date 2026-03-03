export interface HashPayload {
  fileHash: string;    // SHA-256 hash of the file, hex-encoded
  fileName?: string;   // Optional — stored as metadata only, not on-chain
}

// Timestamp is intentionally absent from this interface.
// It is captured server-side inside CKBService.submitHash() and is
// never accepted from the caller. See ckb.service.ts for details.

export interface UnsignedTxPayload {
  fileHash: string;
  userAddress: string; // CKB address of the user — output cell is locked to them
}

export interface UnsignedTxResult {
  outputs: { lock: object; capacity: string }[];
  outputsData: string[];
}

export interface SubmissionResult {
  txHash: string;
  blockNumber: string;
  status: "pending" | "committed";
}
