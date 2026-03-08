// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  escapeCsvField,
  buildCsvString,
  buildCsvFilename,
  summariseResults,
  downloadCsv,
  type BulkVerifyResult,
} from './csvExport';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const verified: BulkVerifyResult = {
  fileName:     'contract.pdf',
  fileHash:     '0x' + 'a'.repeat(64),
  status:       'verified',
  txHash:       '0x' + 'b'.repeat(64),
  blockNumber:  '9876543',
  timestamp:    '2026-03-05T14:32:07.000Z',
  errorMessage: '',
};

const notFound: BulkVerifyResult = {
  fileName:     'draft.docx',
  fileHash:     '0x' + 'c'.repeat(64),
  status:       'not_found',
  txHash:       '',
  blockNumber:  '',
  timestamp:    '',
  errorMessage: '',
};

const errored: BulkVerifyResult = {
  fileName:     'image.png',
  fileHash:     '0x' + 'd'.repeat(64),
  status:       'error',
  txHash:       '',
  blockNumber:  '',
  timestamp:    '',
  errorMessage: 'Network timeout',
};

const ALL = [verified, notFound, errored];

// ── escapeCsvField ────────────────────────────────────────────────────────────

describe('escapeCsvField', () => {
  it('returns plain value unchanged when no special characters', () => {
    expect(escapeCsvField('hello')).toBe('hello');
  });

  it('wraps in quotes when value contains a comma', () => {
    expect(escapeCsvField('a,b')).toBe('"a,b"');
  });

  it('wraps in quotes and escapes internal double quotes', () => {
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
  });

  it('wraps in quotes when value contains a newline', () => {
    expect(escapeCsvField('line1\nline2')).toContain('"');
  });

  it('handles empty string', () => {
    expect(escapeCsvField('')).toBe('');
  });

  it('handles null-like values gracefully', () => {
    expect(() => escapeCsvField(undefined as any)).not.toThrow();
  });

  it('handles value that is only quotes', () => {
    expect(escapeCsvField('"')).toBe('""""');
  });
});

// ── buildCsvString ────────────────────────────────────────────────────────────

describe('buildCsvString', () => {
  it('returns a non-empty string', () => {
    expect(buildCsvString([verified]).length).toBeGreaterThan(0);
  });

  it('first row is the header', () => {
    const csv = buildCsvString([verified]);
    const firstLine = csv.split('\n')[0];
    expect(firstLine).toContain('File Name');
    expect(firstLine).toContain('SHA-256 Hash');
    expect(firstLine).toContain('Status');
    expect(firstLine).toContain('Transaction Hash');
    expect(firstLine).toContain('Block Number');
  });

  it('has one data row per result', () => {
    const lines = buildCsvString(ALL).split('\n');
    // header + 3 results = 4 lines
    expect(lines).toHaveLength(4);
  });

  it('includes fileName in the data row', () => {
    expect(buildCsvString([verified])).toContain('contract.pdf');
  });

  it('includes fileHash in the data row', () => {
    expect(buildCsvString([verified])).toContain(verified.fileHash);
  });

  it('includes status in the data row', () => {
    expect(buildCsvString([verified])).toContain('verified');
    expect(buildCsvString([notFound])).toContain('not_found');
    expect(buildCsvString([errored])).toContain('error');
  });

  it('includes txHash in the data row', () => {
    expect(buildCsvString([verified])).toContain(verified.txHash);
  });

  it('includes blockNumber in the data row', () => {
    expect(buildCsvString([verified])).toContain('9876543');
  });

  it('converts timestamp to ISO string in the data row', () => {
    expect(buildCsvString([verified])).toContain('2026-03-05T14:32:07.000Z');
  });

  it('leaves timestamp cell empty when timestamp is empty string', () => {
    const csv = buildCsvString([notFound]);
    const dataRow = csv.split('\n')[1];
    // Should have empty field for timestamp — count commas to confirm
    expect(dataRow.split(',').length).toBe(7);
  });

  it('includes errorMessage when status is error', () => {
    expect(buildCsvString([errored])).toContain('Network timeout');
  });

  it('handles empty results array (header only)', () => {
    const csv = buildCsvString([]);
    const lines = csv.split('\n').filter(Boolean);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('File Name');
  });

  it('escapes file names containing commas', () => {
    const r: BulkVerifyResult = { ...verified, fileName: 'report, final.pdf' };
    const csv = buildCsvString([r]);
    expect(csv).toContain('"report, final.pdf"');
  });
});

// ── buildCsvFilename ──────────────────────────────────────────────────────────

describe('buildCsvFilename', () => {
  it('starts with hashthis-bulk-verify-', () => {
    expect(buildCsvFilename()).toMatch(/^hashthis-bulk-verify-/);
  });

  it('ends with .csv', () => {
    expect(buildCsvFilename()).toMatch(/\.csv$/);
  });

  it('includes today\'s date in YYYY-MM-DD format', () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(buildCsvFilename()).toContain(today);
  });
});

// ── summariseResults ──────────────────────────────────────────────────────────

describe('summariseResults', () => {
  it('returns correct total count', () => {
    expect(summariseResults(ALL).total).toBe(3);
  });

  it('counts verified results', () => {
    expect(summariseResults(ALL).verified).toBe(1);
  });

  it('counts not_found results', () => {
    expect(summariseResults(ALL).notFound).toBe(1);
  });

  it('counts error results', () => {
    expect(summariseResults(ALL).errors).toBe(1);
  });

  it('handles empty array', () => {
    const s = summariseResults([]);
    expect(s.total).toBe(0);
    expect(s.verified).toBe(0);
    expect(s.notFound).toBe(0);
    expect(s.errors).toBe(0);
  });

  it('handles all verified', () => {
    const s = summariseResults([verified, verified]);
    expect(s.verified).toBe(2);
    expect(s.notFound).toBe(0);
    expect(s.errors).toBe(0);
  });
});

// ── downloadCsv ───────────────────────────────────────────────────────────────

describe('downloadCsv', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete (globalThis as any).URL;
    delete (globalThis as any).document;
  });

  it('calls URL.createObjectURL with a Blob', () => {
    const createObjectURL = vi.fn().mockReturnValue('blob:mock');
    const revokeObjectURL = vi.fn();
    const clickSpy = vi.fn();
    const mockAnchor = { href: '', download: '', click: clickSpy, style: {} };

    (globalThis as any).URL = { createObjectURL, revokeObjectURL };
    (globalThis as any).document = {
      createElement: vi.fn().mockReturnValue(mockAnchor),
      body: { appendChild: vi.fn(), removeChild: vi.fn() },
    };

    downloadCsv(ALL);
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
  });

  it('triggers a click on the anchor', () => {
    const clickSpy = vi.fn();
    const mockAnchor = { href: '', download: '', click: clickSpy, style: {} };

    (globalThis as any).URL = {
      createObjectURL: vi.fn().mockReturnValue('blob:mock'),
      revokeObjectURL: vi.fn(),
    };
    (globalThis as any).document = {
      createElement: vi.fn().mockReturnValue(mockAnchor),
      body: { appendChild: vi.fn(), removeChild: vi.fn() },
    };

    downloadCsv(ALL);
    expect(clickSpy).toHaveBeenCalledOnce();
  });

  it('revokes the object URL after download', () => {
    const revokeObjectURL = vi.fn();
    const mockAnchor = { href: '', download: '', click: vi.fn(), style: {} };

    (globalThis as any).URL = {
      createObjectURL: vi.fn().mockReturnValue('blob:mock'),
      revokeObjectURL,
    };
    (globalThis as any).document = {
      createElement: vi.fn().mockReturnValue(mockAnchor),
      body: { appendChild: vi.fn(), removeChild: vi.fn() },
    };

    downloadCsv(ALL);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock');
  });
});