import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  buildProofJson,
  proofToJsonString,
  buildJsonFilename,
  downloadProofJson,
  copyProofToClipboard,
  type ProofJson,
} from './proofExport';
import type { CertificateData } from './pdfGenerator';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const VALID: CertificateData = {
  fileHash:      '0x' + 'a'.repeat(64),
  txHash:        '0x' + 'b'.repeat(64),
  blockNumber:   '9876543',
  timestamp:     '2026-03-05T14:32:07.000Z',
  walletAddress: 'ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqwgx292hnvmn68xf779vmzrshpmm6epn4c0cgwga',
  fileName:      'contract.pdf',
};

const CONFIRMING: CertificateData = { ...VALID, timestamp: '' };

// ── buildProofJson ────────────────────────────────────────────────────────────

describe('buildProofJson', () => {
  it('sets schema to hashthis-proof-v1', () => {
    expect(buildProofJson(VALID).schema).toBe('hashthis-proof-v1');
  });

  it('sets generatedAt to a valid ISO string', () => {
    const { generatedAt } = buildProofJson(VALID);
    expect(new Date(generatedAt).toISOString()).toBe(generatedAt);
  });

  it('includes file.sha256 matching the input fileHash', () => {
    expect(buildProofJson(VALID).file.sha256).toBe(VALID.fileHash);
  });

  it('includes file.name matching the input fileName', () => {
    expect(buildProofJson(VALID).file.name).toBe(VALID.fileName);
  });

  it('sets file.name to null when fileName is absent', () => {
    const { fileName: _f, ...noName } = VALID;
    expect(buildProofJson(noName).file.name).toBeNull();
  });

  it('includes blockchain.transactionHash', () => {
    expect(buildProofJson(VALID).blockchain.transactionHash).toBe(VALID.txHash);
  });

  it('includes blockchain.blockNumber', () => {
    expect(buildProofJson(VALID).blockchain.blockNumber).toBe(VALID.blockNumber);
  });

  it('includes blockchain.blockTimestamp when timestamp is present', () => {
    expect(buildProofJson(VALID).blockchain.blockTimestamp).toBe(VALID.timestamp);
  });

  it('sets blockchain.blockTimestamp to null when timestamp is empty string', () => {
    expect(buildProofJson(CONFIRMING).blockchain.blockTimestamp).toBeNull();
  });

  it('sets blockchain.ownerAddress', () => {
    expect(buildProofJson(VALID).blockchain.ownerAddress).toBe(VALID.walletAddress);
  });

  it('builds an explorer URL containing the txHash', () => {
    expect(buildProofJson(VALID).blockchain.explorerUrl).toContain(VALID.txHash);
  });

  it('includes at least 3 verification instructions', () => {
    expect(buildProofJson(VALID).verification.instructions.length).toBeGreaterThanOrEqual(3);
  });

  it('includes a verifyUrl', () => {
    expect(buildProofJson(VALID).verification.verifyUrl).toMatch(/^https?:\/\//);
  });

  it('top-level keys match the ProofJson schema', () => {
    const keys = Object.keys(buildProofJson(VALID));
    expect(keys).toContain('schema');
    expect(keys).toContain('generatedAt');
    expect(keys).toContain('file');
    expect(keys).toContain('blockchain');
    expect(keys).toContain('verification');
  });
});

// ── proofToJsonString ─────────────────────────────────────────────────────────

describe('proofToJsonString', () => {
  it('returns a string', () => {
    expect(typeof proofToJsonString(VALID)).toBe('string');
  });

  it('is valid JSON', () => {
    expect(() => JSON.parse(proofToJsonString(VALID))).not.toThrow();
  });

  it('round-trips correctly', () => {
    const parsed: ProofJson = JSON.parse(proofToJsonString(VALID));
    expect(parsed.schema).toBe('hashthis-proof-v1');
    expect(parsed.file.sha256).toBe(VALID.fileHash);
    expect(parsed.blockchain.transactionHash).toBe(VALID.txHash);
  });

  it('is pretty-printed (contains newlines)', () => {
    expect(proofToJsonString(VALID)).toContain('\n');
  });
});

// ── buildJsonFilename ─────────────────────────────────────────────────────────

describe('buildJsonFilename', () => {
  it('starts with hashthis-proof-', () => {
    expect(buildJsonFilename('file.pdf')).toMatch(/^hashthis-proof-/);
  });

  it('ends with .json', () => {
    expect(buildJsonFilename('file.pdf')).toMatch(/\.json$/);
  });

  it('strips the source file extension', () => {
    expect(buildJsonFilename('contract.docx')).not.toContain('.docx');
  });

  it('replaces special characters with underscores', () => {
    expect(buildJsonFilename('my file (1).txt')).not.toMatch(/[ ()]/);
  });

  it('truncates long names to 40 chars base', () => {
    const base = buildJsonFilename('a'.repeat(100) + '.txt')
      .replace('hashthis-proof-', '').replace('.json', '');
    expect(base.length).toBeLessThanOrEqual(40);
  });

  it('falls back to "proof" with no argument', () => {
    expect(buildJsonFilename()).toBe('hashthis-proof-proof.json');
  });

  it('falls back to "proof" with undefined', () => {
    expect(buildJsonFilename(undefined)).toBe('hashthis-proof-proof.json');
  });
});

// ── downloadProofJson ─────────────────────────────────────────────────────────
// These tests mock browser globals via globalThis so they run in any environment.

describe('downloadProofJson', () => {
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;
  let clickSpy: ReturnType<typeof vi.fn>;
  let appendChildSpy: ReturnType<typeof vi.fn>;
  let removeChildSpy: ReturnType<typeof vi.fn>;
  let mockAnchor: any;

  beforeEach(() => {
    // Mock URL blob methods
    createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    revokeObjectURL = vi.fn();
    (globalThis as any).URL = {
      createObjectURL,
      revokeObjectURL,
    };

    // Mock anchor element returned by createElement
    clickSpy = vi.fn();
    mockAnchor = { href: '', download: '', click: clickSpy, style: {} };

    // Mock document on globalThis
    appendChildSpy = vi.fn();
    removeChildSpy = vi.fn();
    (globalThis as any).document = {
      createElement: vi.fn().mockReturnValue(mockAnchor),
      body: {
        appendChild: appendChildSpy,
        removeChild: removeChildSpy,
      },
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Clean up globalThis overrides
    delete (globalThis as any).document;
    delete (globalThis as any).URL;
  });

  it('calls URL.createObjectURL with a Blob', () => {
    downloadProofJson(VALID);
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
  });

  it('triggers a click on the anchor element', () => {
    downloadProofJson(VALID);
    expect(clickSpy).toHaveBeenCalledOnce();
  });

  it('calls URL.revokeObjectURL to clean up', () => {
    downloadProofJson(VALID);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('appends and removes the anchor from the DOM', () => {
    downloadProofJson(VALID);
    expect(appendChildSpy).toHaveBeenCalled();
    expect(removeChildSpy).toHaveBeenCalled();
  });
});

// ── copyProofToClipboard ──────────────────────────────────────────────────────
// Mock navigator.clipboard via globalThis — works in Node and jsdom alike.

describe('copyProofToClipboard', () => {
  afterEach(() => {
    delete (globalThis as any).navigator;
  });

  const mockNavigator = (clipboard: any) => {
    (globalThis as any).navigator = { clipboard };
  };

  it('returns true when clipboard.writeText resolves', async () => {
    mockNavigator({ writeText: vi.fn().mockResolvedValue(undefined) });
    expect(await copyProofToClipboard(VALID)).toBe(true);
  });

  it('copies the proof JSON string to clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    mockNavigator({ writeText });
    await copyProofToClipboard(VALID);
    const copied = writeText.mock.calls[0][0];
    expect(() => JSON.parse(copied)).not.toThrow();
    expect(JSON.parse(copied).file.sha256).toBe(VALID.fileHash);
  });

  it('returns false when clipboard API throws', async () => {
    mockNavigator({ writeText: vi.fn().mockRejectedValue(new Error('denied')) });
    expect(await copyProofToClipboard(VALID)).toBe(false);
  });

  it('returns false when clipboard API is unavailable', async () => {
    mockNavigator(undefined);
    expect(await copyProofToClipboard(VALID)).toBe(false);
  });
});