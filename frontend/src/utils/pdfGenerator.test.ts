import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  formatTimestamp,
  validateCertificateData,
  buildExplorerUrl,
  buildPdfFilename,
  generateCertificate,
  type CertificateData,
} from './pdfGenerator';

// ── Test fixtures ─────────────────────────────────────────────────────────────

const VALID_DATA: CertificateData = {
  fileHash:      '0x' + 'a'.repeat(64),
  txHash:        '0x' + 'b'.repeat(64),
  blockNumber:   '12345678',
  timestamp:     '2026-03-05T14:32:07.000Z',
  walletAddress: 'ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqwgx292hnvmn68xf779vmzrshpmm6epn4c0cgwga',
  fileName:      'contract.pdf',
};

// ── formatTimestamp ───────────────────────────────────────────────────────────

describe('formatTimestamp', () => {
  it('returns date, time, and iso fields', () => {
    const result = formatTimestamp('2026-03-05T14:32:07.000Z');
    expect(result).toHaveProperty('date');
    expect(result).toHaveProperty('time');
    expect(result).toHaveProperty('iso');
  });

  it('preserves the original ISO string in .iso', () => {
    const iso = '2026-03-05T14:32:07.000Z';
    expect(formatTimestamp(iso).iso).toBe(iso);
  });

  it('formats date in human-readable English', () => {
    const { date } = formatTimestamp('2026-03-05T14:32:07.000Z');
    expect(date).toContain('2026');
    expect(date).toMatch(/March|3/);
  });

  it('formats time in HH:MM:SS', () => {
    const { time } = formatTimestamp('2026-03-05T14:32:07.000Z');
    expect(time).toMatch(/\d{2}:\d{2}:\d{2}/);
  });

  it('handles midnight correctly', () => {
    const { time } = formatTimestamp('2026-01-01T00:00:00.000Z');
    expect(time).toContain('00:00:00');
  });

  it('handles end-of-day timestamp correctly', () => {
    const { time } = formatTimestamp('2026-12-31T23:59:59.000Z');
    expect(time).toContain('23:59:59');
  });
});

// ── validateCertificateData ───────────────────────────────────────────────────

describe('validateCertificateData', () => {
  describe('valid data', () => {
    it('returns valid:true for a fully populated object', () => {
      expect(validateCertificateData(VALID_DATA).valid).toBe(true);
    });

    it('returns an empty errors array for valid data', () => {
      expect(validateCertificateData(VALID_DATA).errors).toHaveLength(0);
    });

    it('accepts hashes without 0x prefix', () => {
      const data = { ...VALID_DATA, fileHash: 'a'.repeat(64), txHash: 'b'.repeat(64) };
      expect(validateCertificateData(data).valid).toBe(true);
    });

    it('accepts both ckb (mainnet) and ckt (testnet) addresses', () => {
      const mainnet = { ...VALID_DATA, walletAddress: 'ckb1mainnetaddress' };
      const testnet = { ...VALID_DATA, walletAddress: 'ckt1testnetaddress' };
      // Both should pass the prefix check (deep format may still fail, but prefix is correct)
      const mainnetErrs = validateCertificateData(mainnet).errors.filter(e => e.includes('walletAddress'));
      const testnetErrs = validateCertificateData(testnet).errors.filter(e => e.includes('walletAddress'));
      expect(mainnetErrs).toHaveLength(0);
      expect(testnetErrs).toHaveLength(0);
    });

    it('is valid without an optional fileName', () => {
      const { fileName: _f, ...withoutFileName } = VALID_DATA;
      expect(validateCertificateData(withoutFileName).valid).toBe(true);
    });
  });

  describe('missing required fields', () => {
    it('reports error for missing fileHash', () => {
      const { errors } = validateCertificateData({ ...VALID_DATA, fileHash: '' });
      expect(errors.some(e => e.includes('fileHash'))).toBe(true);
    });

    it('reports error for missing txHash', () => {
      const { errors } = validateCertificateData({ ...VALID_DATA, txHash: '' });
      expect(errors.some(e => e.includes('txHash'))).toBe(true);
    });

    it('reports error for missing blockNumber', () => {
      const { errors } = validateCertificateData({ ...VALID_DATA, blockNumber: '' });
      expect(errors.some(e => e.includes('blockNumber'))).toBe(true);
    });

    it('reports error for missing timestamp', () => {
      const { errors } = validateCertificateData({ ...VALID_DATA, timestamp: '' });
      expect(errors.some(e => e.includes('timestamp'))).toBe(true);
    });

    it('reports error for missing walletAddress', () => {
      const { errors } = validateCertificateData({ ...VALID_DATA, walletAddress: '' });
      expect(errors.some(e => e.includes('walletAddress'))).toBe(true);
    });
  });

  describe('malformed fields', () => {
    it('rejects a fileHash shorter than 64 hex chars', () => {
      const { errors } = validateCertificateData({ ...VALID_DATA, fileHash: '0x' + 'a'.repeat(32) });
      expect(errors.some(e => e.includes('fileHash'))).toBe(true);
    });

    it('rejects a fileHash longer than 64 hex chars', () => {
      const { errors } = validateCertificateData({ ...VALID_DATA, fileHash: '0x' + 'a'.repeat(65) });
      expect(errors.some(e => e.includes('fileHash'))).toBe(true);
    });

    it('rejects a fileHash with non-hex characters', () => {
      const { errors } = validateCertificateData({ ...VALID_DATA, fileHash: '0x' + 'z'.repeat(64) });
      expect(errors.some(e => e.includes('fileHash'))).toBe(true);
    });

    it('rejects an invalid ISO timestamp', () => {
      const { errors } = validateCertificateData({ ...VALID_DATA, timestamp: 'not-a-date' });
      expect(errors.some(e => e.includes('timestamp'))).toBe(true);
    });

    it('rejects a walletAddress that does not start with ckb or ckt', () => {
      const { errors } = validateCertificateData({ ...VALID_DATA, walletAddress: '0xEthAddress' });
      expect(errors.some(e => e.includes('walletAddress'))).toBe(true);
    });

    it('accumulates multiple errors', () => {
      const bad: CertificateData = {
        fileHash: '',
        txHash: '',
        blockNumber: '',
        timestamp: '',
        walletAddress: '',
      };
      const { valid, errors } = validateCertificateData(bad);
      expect(valid).toBe(false);
      expect(errors.length).toBeGreaterThan(1);
    });
  });
});

// ── buildExplorerUrl ──────────────────────────────────────────────────────────

describe('buildExplorerUrl', () => {
  it('produces a URL containing the tx hash', () => {
    const txHash = '0x' + 'c'.repeat(64);
    const url = buildExplorerUrl(txHash);
    expect(url).toContain(txHash);
  });

  it('points to the Nervos explorer domain', () => {
    const url = buildExplorerUrl('0x' + 'd'.repeat(64));
    expect(url).toContain('explorer.nervos.org');
  });

  it('includes /transaction/ path segment', () => {
    const url = buildExplorerUrl('0x' + 'e'.repeat(64));
    expect(url).toContain('/transaction/');
  });
});

// ── buildPdfFilename ──────────────────────────────────────────────────────────

describe('buildPdfFilename', () => {
  it('starts with hashthis-certificate-', () => {
    expect(buildPdfFilename('myfile.pdf')).toMatch(/^hashthis-certificate-/);
  });

  it('ends with .pdf', () => {
    expect(buildPdfFilename('myfile.pdf')).toMatch(/\.pdf$/);
  });

  it('strips the file extension from the source filename', () => {
    const result = buildPdfFilename('contract.docx');
    expect(result).not.toContain('.docx');
  });

  it('replaces special characters with underscores', () => {
    const result = buildPdfFilename('my file (draft) #1.txt');
    expect(result).not.toMatch(/[ ()#]/);
  });

  it('truncates very long filenames to 40 chars max (base portion)', () => {
    const longName = 'a'.repeat(100) + '.txt';
    const result = buildPdfFilename(longName);
    const base = result.replace('hashthis-certificate-', '').replace('.pdf', '');
    expect(base.length).toBeLessThanOrEqual(40);
  });

  it('falls back to "proof" when no filename is provided', () => {
    expect(buildPdfFilename()).toBe('hashthis-certificate-proof.pdf');
    expect(buildPdfFilename(undefined)).toBe('hashthis-certificate-proof.pdf');
  });
});

// ── generateCertificate ───────────────────────────────────────────────────────

describe('generateCertificate', () => {
  // Mock jsPDF and QRCode so we don't need a browser / canvas environment
  beforeEach(() => {
    vi.mock('jspdf', () => {
      const instance = {
        setFillColor: vi.fn(),
        setTextColor: vi.fn(),
        setDrawColor: vi.fn(),
        setLineWidth: vi.fn(),
        setFont: vi.fn(),
        setFontSize: vi.fn(),
        rect: vi.fn(),
        line: vi.fn(),
        circle: vi.fn(),
        text: vi.fn(),
        splitTextToSize: vi.fn((_txt: string, _w: number) => [_txt]),
        addImage: vi.fn(),
        save: vi.fn(),
      };
      return { default: vi.fn(() => instance) };
    });

    vi.mock('qrcode', () => ({
      default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,mock') },
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('throws for invalid certificate data', async () => {
    const bad: CertificateData = { ...VALID_DATA, fileHash: '' };
    await expect(generateCertificate(bad)).rejects.toThrow('Invalid certificate data');
  });

  it('throws and includes field name in error message', async () => {
    const bad: CertificateData = { ...VALID_DATA, txHash: '' };
    await expect(generateCertificate(bad)).rejects.toThrow(/txHash/);
  });

  it('resolves without error for valid data', async () => {
    await expect(generateCertificate(VALID_DATA)).resolves.toBeUndefined();
  });

  it('calls jsPDF save with a pdf filename', async () => {
    const jsPDF = (await import('jspdf')).default;
    await generateCertificate(VALID_DATA);
    const instance = (jsPDF as any).mock.results[0].value;
    expect(instance.save).toHaveBeenCalledWith(expect.stringMatching(/\.pdf$/));
  });

  it('uses the fileName in the saved filename', async () => {
    const jsPDF = (await import('jspdf')).default;
    await generateCertificate({ ...VALID_DATA, fileName: 'deed.pdf' });
    const instance = (jsPDF as any).mock.results[0].value;
    expect(instance.save).toHaveBeenCalledWith(expect.stringContaining('deed'));
  });

  it('still resolves when QRCode generation fails', async () => {
    const QRCode = (await import('qrcode')).default;
    vi.spyOn(QRCode, 'toDataURL').mockRejectedValue(new Error('canvas not available'));
    await expect(generateCertificate(VALID_DATA)).resolves.toBeUndefined();
  });
});