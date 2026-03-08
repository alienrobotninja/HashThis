import jsPDF from 'jspdf';
import QRCode from 'qrcode';

export interface CertificateData {
  fileHash: string;
  txHash: string;
  blockNumber: string;
  timestamp: string;     // ISO 8601 string from block header
  walletAddress: string;
  fileName?: string;     // Optional — shown when available
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface FormattedTimestamp {
  date: string;
  time: string;
  iso: string;
}

const TESTNET_EXPLORER = 'https://pudge.explorer.nervos.org/transaction';

// ── Pure helper functions (independently testable) ───────────────────────────

/**
 * Formats an ISO timestamp into human-readable date + time parts.
 */
export function formatTimestamp(isoString: string): FormattedTimestamp {
  const d = new Date(isoString);
  return {
    date: d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    }),
    time: d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'UTC',
      hourCycle: 'h23',
    }),
    iso: isoString,
  };
}

/**
 * Validates that all required certificate fields are present and correctly
 * formatted before we attempt PDF generation.
 */
export function validateCertificateData(data: CertificateData): ValidationResult {
  const errors: string[] = [];

  if (!data.fileHash) {
    errors.push('fileHash is required');
  } else {
    const clean = data.fileHash.startsWith('0x') ? data.fileHash.slice(2) : data.fileHash;
    if (!/^[0-9a-fA-F]{64}$/.test(clean)) {
      errors.push('fileHash must be exactly 64 hex characters (with or without 0x prefix)');
    }
  }

  if (!data.txHash) {
    errors.push('txHash is required');
  } else {
    const clean = data.txHash.startsWith('0x') ? data.txHash.slice(2) : data.txHash;
    if (!/^[0-9a-fA-F]{64}$/.test(clean)) {
      errors.push('txHash must be exactly 64 hex characters (with or without 0x prefix)');
    }
  }

  if (!data.blockNumber) errors.push('blockNumber is required');
  if (!data.timestamp)   errors.push('timestamp is required');

  if (data.timestamp) {
    const d = new Date(data.timestamp);
    if (isNaN(d.getTime())) errors.push('timestamp must be a valid ISO 8601 date string');
  }

  if (!data.walletAddress) {
    errors.push('walletAddress is required');
  } else if (!data.walletAddress.startsWith('ckb') && !data.walletAddress.startsWith('ckt')) {
    errors.push('walletAddress must start with ckb or ckt');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Builds the explorer URL for a given transaction hash.
 */
export function buildExplorerUrl(txHash: string): string {
  return `${TESTNET_EXPLORER}/${txHash}`;
}

/**
 * Derives a safe filename for the downloaded PDF.
 */
export function buildPdfFilename(fileName?: string): string {
  const base = fileName
    ? fileName.replace(/\.[^.]+$/, '').replace(/[^a-z0-9_-]/gi, '_').slice(0, 40)
    : 'proof';
  return `hashthis-certificate-${base}.pdf`;
}

// ── PDF generation ────────────────────────────────────────────────────────────

/**
 * Generates and triggers a browser download of the PDF certificate.
 * Throws if certificate data is invalid.
 */
export async function generateCertificate(data: CertificateData): Promise<void> {
  const { valid, errors } = validateCertificateData(data);
  if (!valid) throw new Error(`Invalid certificate data: ${errors.join('; ')}`);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210;
  const margin = 20;

  // ── Page background ──────────────────────────────────────────────────────
  doc.setFillColor(248, 250, 255);
  doc.rect(0, 0, W, 297, 'F');

  // ── Top accent bar ───────────────────────────────────────────────────────
  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, W, 18, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('HashThis', margin, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Immutable Proof of Existence · Nervos CKB', W - margin, 12, { align: 'right' });

  // ── Certificate title ────────────────────────────────────────────────────
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(19);
  doc.text('CERTIFICATE OF PROOF OF EXISTENCE', W / 2, 37, { align: 'center' });

  doc.setDrawColor(37, 99, 235);
  doc.setLineWidth(0.5);
  doc.line(margin, 41, W - margin, 41);

  // ── Subtitle with date ───────────────────────────────────────────────────
  const { date, time } = formatTimestamp(data.timestamp);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Issued on ${date} at ${time} UTC (Block-Confirmed)`, W / 2, 49, { align: 'center' });

  // ── Section + field helpers ───────────────────────────────────────────────
  let y = 61;

  const section = (label: string) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(37, 99, 235);
    doc.text(label.toUpperCase(), margin, y);
    y += 3.5;
    doc.setDrawColor(191, 219, 254);
    doc.setLineWidth(0.25);
    doc.line(margin, y, W - margin, y);
    y += 5;
  };

  const field = (label: string, value: string, mono = false, maxWidth = W - margin * 2) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(label, margin, y);
    y += 4;

    doc.setFont(mono ? 'courier' : 'helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    const lines = doc.splitTextToSize(value, maxWidth);
    doc.text(lines, margin, y);
    y += (lines.length * 5) + 3;
  };

  // ── File Information ─────────────────────────────────────────────────────
  section('File Information');
  if (data.fileName) field('File Name', data.fileName);
  field('SHA-256 Hash (hex)', data.fileHash, true);

  y += 2;

  // ── Blockchain Proof ─────────────────────────────────────────────────────
  section('Blockchain Proof');
  field('Network', 'Nervos CKB (Testnet — pudge)');
  field('Block Number', `#${data.blockNumber}`);
  field('Block-Confirmed Timestamp', `${date}  ${time} UTC`);
  field('Transaction Hash', data.txHash, true);
  field('Owner Wallet Address', data.walletAddress, true);

  y += 2;

  // ── Verification steps ───────────────────────────────────────────────────
  section('How to Independently Verify');

  const steps = [
    '1. Visit hashthis.app/verify and connect your CKB wallet.',
    '2. Upload the original file — it is hashed locally and never leaves your device.',
    '3. The computed SHA-256 hash must exactly match the hash shown above.',
    '4. The on-chain record proves this hash existed no later than the block-confirmed timestamp.',
    '5. Look up the Transaction Hash above on CKB Explorer to inspect the raw cell data.',
  ];

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  steps.forEach((step) => {
    doc.text(step, margin, y);
    y += 5.2;
  });

  // ── QR code (floated to the right, beside verification steps) ────────────
  const explorerUrl = buildExplorerUrl(data.txHash);
  try {
    const qrDataUrl = await QRCode.toDataURL(explorerUrl, { width: 140, margin: 1, color: { dark: '#0f172a', light: '#f8faff' } });
    const qrSize = 36;
    const qrX = W - margin - qrSize;
    const qrY = y - (steps.length * 5.2) - 3;
    doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Scan to view on', qrX + qrSize / 2, qrY + qrSize + 3.5, { align: 'center' });
    doc.text('CKB Explorer', qrX + qrSize / 2, qrY + qrSize + 7, { align: 'center' });
  } catch {
    // QR generation non-fatal — certificate remains valid
  }

  // ── Circular seal ────────────────────────────────────────────────────────
  y = Math.max(y + 8, 215);
  const sealX = W / 2;
  const sealY = y + 14;
  doc.setDrawColor(37, 99, 235);
  doc.setLineWidth(1);
  doc.circle(sealX, sealY, 18, 'S');
  doc.setLineWidth(0.4);
  doc.circle(sealX, sealY, 15.5, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(37, 99, 235);
  doc.text('BLOCKCHAIN', sealX, sealY - 3, { align: 'center' });
  doc.text('VERIFIED', sealX, sealY + 2.5, { align: 'center' });
  doc.setFontSize(5.5);
  doc.text('NERVOS CKB', sealX, sealY + 7.5, { align: 'center' });

  // ── Bottom accent bar ─────────────────────────────────────────────────────
  doc.setFillColor(37, 99, 235);
  doc.rect(0, 279, W, 18, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(
    'This certificate is backed by cryptographic proof on the Nervos CKB blockchain and cannot be tampered with.',
    W / 2, 287, { align: 'center' }
  );
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('hashthis.app', W / 2, 293, { align: 'center' });

  // ── Download ──────────────────────────────────────────────────────────────
  doc.save(buildPdfFilename(data.fileName));
}