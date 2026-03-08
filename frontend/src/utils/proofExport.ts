import type { CertificateData } from './pdfGenerator';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ProofJson {
  schema: 'hashthis-proof-v1';
  generatedAt: string;           // ISO timestamp of export (client clock)
  file: {
    name: string | null;
    sha256: string;              // 0x-prefixed hex
  };
  blockchain: {
    network: 'nervos-ckb-testnet' | 'nervos-ckb-mainnet';
    transactionHash: string;     // 0x-prefixed hex
    blockNumber: string;
    blockTimestamp: string | null; // ISO — null when still confirming
    ownerAddress: string;
    explorerUrl: string;
  };
  verification: {
    instructions: string[];
    verifyUrl: string;
  };
}

const TESTNET_EXPLORER = 'https://pudge.explorer.nervos.org/transaction';
const VERIFY_URL       = 'https://hashthis.app/verify';

// ── Pure helpers ──────────────────────────────────────────────────────────────

/**
 * Builds the canonical ProofJson object from CertificateData.
 * Safe to call when timestamp is empty (still confirming).
 */
export function buildProofJson(data: CertificateData): ProofJson {
  return {
    schema: 'hashthis-proof-v1',
    generatedAt: new Date().toISOString(),
    file: {
      name: data.fileName ?? null,
      sha256: data.fileHash,
    },
    blockchain: {
      network: 'nervos-ckb-testnet',
      transactionHash: data.txHash,
      blockNumber: data.blockNumber,
      blockTimestamp: data.timestamp || null,
      ownerAddress: data.walletAddress,
      explorerUrl: `${TESTNET_EXPLORER}/${data.txHash}`,
    },
    verification: {
      instructions: [
        'Visit the verifyUrl and connect your CKB wallet.',
        'Upload the original file — it is hashed locally in your browser.',
        'The computed SHA-256 must exactly match file.sha256 above.',
        'Look up blockchain.transactionHash on CKB Explorer to inspect the raw cell.',
        'The on-chain record proves this file hash existed no later than blockTimestamp.',
      ],
      verifyUrl: VERIFY_URL,
    },
  };
}

/**
 * Serialises proof data to a formatted JSON string.
 */
export function proofToJsonString(data: CertificateData): string {
  return JSON.stringify(buildProofJson(data), null, 2);
}

/**
 * Returns a safe filename for the JSON download.
 */
export function buildJsonFilename(fileName?: string): string {
  const base = fileName
    ? fileName.replace(/\.[^.]+$/, '').replace(/[^a-z0-9_-]/gi, '_').slice(0, 40)
    : 'proof';
  return `hashthis-proof-${base}.json`;
}

// ── Browser actions ───────────────────────────────────────────────────────────

/**
 * Triggers a browser download of the proof as a JSON file.
 */
export function downloadProofJson(data: CertificateData): void {
  const json     = proofToJsonString(data);
  const blob     = new Blob([json], { type: 'application/json' });
  const url      = URL.createObjectURL(blob);
  const a        = document.createElement('a');
  a.href         = url;
  a.download     = buildJsonFilename(data.fileName);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Copies the proof JSON to the clipboard.
 * Returns true on success, false if the Clipboard API is unavailable.
 */
export async function copyProofToClipboard(data: CertificateData): Promise<boolean> {
  const json = proofToJsonString(data);
  try {
    // Guard: navigator may be undefined in non-browser environments
    const nav = (typeof navigator !== 'undefined' ? navigator : undefined) as any;
    if (!nav?.clipboard?.writeText) return false;
    await nav.clipboard.writeText(json);
    return true;
  } catch {
    return false;
  }
}