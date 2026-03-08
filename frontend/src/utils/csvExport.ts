// ── Types ─────────────────────────────────────────────────────────────────────

export type VerificationStatus = 'verified' | 'not_found' | 'error';

export interface BulkVerifyResult {
  fileName: string;
  fileHash: string;
  status: VerificationStatus;
  txHash: string;
  blockNumber: string;
  timestamp: string;       // ISO string or empty
  errorMessage: string;    // empty unless status === 'error'
}

// ── Pure helpers ──────────────────────────────────────────────────────────────

/**
 * Escapes a single CSV field value.
 * Wraps in quotes and doubles any internal quotes.
 */
export function escapeCsvField(value: string): string {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Converts an array of BulkVerifyResult objects to a CSV string.
 */
export function buildCsvString(results: BulkVerifyResult[]): string {
  const headers = [
    'File Name',
    'SHA-256 Hash',
    'Status',
    'Transaction Hash',
    'Block Number',
    'Block Timestamp (UTC)',
    'Error',
  ];

  const headerRow = headers.map(escapeCsvField).join(',');

  const rows = results.map((r) =>
    [
      r.fileName,
      r.fileHash,
      r.status,
      r.txHash,
      r.blockNumber,
      r.timestamp ? new Date(r.timestamp).toISOString() : '',
      r.errorMessage,
    ]
      .map(escapeCsvField)
      .join(',')
  );

  return [headerRow, ...rows].join('\n');
}

/**
 * Derives a safe filename for the CSV download.
 */
export function buildCsvFilename(): string {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10); // YYYY-MM-DD
  return `hashthis-bulk-verify-${datePart}.csv`;
}

/**
 * Computes a summary of results for display.
 */
export function summariseResults(results: BulkVerifyResult[]): {
  total: number;
  verified: number;
  notFound: number;
  errors: number;
} {
  return {
    total:    results.length,
    verified: results.filter((r) => r.status === 'verified').length,
    notFound: results.filter((r) => r.status === 'not_found').length,
    errors:   results.filter((r) => r.status === 'error').length,
  };
}

// ── Browser action ────────────────────────────────────────────────────────────

/**
 * Triggers a browser download of the results as a CSV file.
 */
export function downloadCsv(results: BulkVerifyResult[]): void {
  const csv  = buildCsvString(results);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = buildCsvFilename();
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}