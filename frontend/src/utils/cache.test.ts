// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  buildCacheKey,
  getCached,
  setCached,
  clearCache,
  pruneExpired,
  getCacheStats,
} from './cache';

// ── Helpers ───────────────────────────────────────────────────────────────────

const HASH    = '0x' + 'a'.repeat(64);
const ADDR    = 'ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqwgx292hnvmn68xf779vmzrshpmm6epn4c0cgwga';
const TX      = '0x' + 'b'.repeat(64);

const DATA = {
  txHash:      TX,
  blockNumber: '9999',
  timestamp:   '2026-03-05T14:32:07.000Z',
};

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
  vi.useRealTimers();
});

// ── buildCacheKey ─────────────────────────────────────────────────────────────

describe('buildCacheKey', () => {
  it('returns a string', () => {
    expect(typeof buildCacheKey(HASH, ADDR)).toBe('string');
  });

  it('strips 0x prefix from hash', () => {
    const key = buildCacheKey(HASH, ADDR);
    expect(key.startsWith('0x')).toBe(false);
    expect(key).toContain('a'.repeat(64));
  });

  it('lowercases the wallet address', () => {
    const key = buildCacheKey(HASH, ADDR.toUpperCase());
    expect(key).toBe(buildCacheKey(HASH, ADDR.toLowerCase()));
  });

  it('produces the same key for hash with and without 0x prefix', () => {
    const withPrefix    = buildCacheKey('0x' + 'a'.repeat(64), ADDR);
    const withoutPrefix = buildCacheKey('a'.repeat(64), ADDR);
    expect(withPrefix).toBe(withoutPrefix);
  });

  it('produces different keys for different hashes', () => {
    expect(buildCacheKey(HASH, ADDR)).not.toBe(buildCacheKey('0x' + 'b'.repeat(64), ADDR));
  });

  it('produces different keys for different wallet addresses', () => {
    const addr2 = 'ckt1different';
    expect(buildCacheKey(HASH, ADDR)).not.toBe(buildCacheKey(HASH, addr2));
  });
});

// ── getCached / setCached ─────────────────────────────────────────────────────

describe('getCached', () => {
  it('returns null when cache is empty', () => {
    expect(getCached(HASH, ADDR)).toBeNull();
  });

  it('returns null for an unknown hash', () => {
    setCached(HASH, ADDR, DATA);
    expect(getCached('0x' + 'f'.repeat(64), ADDR)).toBeNull();
  });

  it('returns the stored entry after setCached', () => {
    setCached(HASH, ADDR, DATA);
    const entry = getCached(HASH, ADDR);
    expect(entry).not.toBeNull();
    expect(entry!.txHash).toBe(TX);
    expect(entry!.blockNumber).toBe('9999');
    expect(entry!.timestamp).toBe('2026-03-05T14:32:07.000Z');
  });

  it('stores the fileHash on the entry', () => {
    setCached(HASH, ADDR, DATA);
    expect(getCached(HASH, ADDR)!.fileHash).toBe(HASH);
  });

  it('returns null for an expired entry', () => {
    vi.useFakeTimers();
    setCached(HASH, ADDR, DATA);
    // Advance time past the 24h TTL
    vi.advanceTimersByTime(25 * 60 * 60 * 1000);
    expect(getCached(HASH, ADDR)).toBeNull();
  });

  it('returns entry that has not yet expired', () => {
    vi.useFakeTimers();
    setCached(HASH, ADDR, DATA);
    vi.advanceTimersByTime(23 * 60 * 60 * 1000); // 23 hours — still valid
    expect(getCached(HASH, ADDR)).not.toBeNull();
  });

  it('is scoped to wallet address — different address returns null', () => {
    setCached(HASH, ADDR, DATA);
    expect(getCached(HASH, 'ckt1different')).toBeNull();
  });
});

describe('setCached', () => {
  it('overwrites an existing entry for the same key', () => {
    setCached(HASH, ADDR, { ...DATA, blockNumber: '100' });
    setCached(HASH, ADDR, { ...DATA, blockNumber: '200' });
    expect(getCached(HASH, ADDR)!.blockNumber).toBe('200');
  });

  it('persists to localStorage', () => {
    setCached(HASH, ADDR, DATA);
    expect(localStorage.getItem('hashthis:verify-cache')).not.toBeNull();
  });

  it('stores cachedAt as a number', () => {
    setCached(HASH, ADDR, DATA);
    expect(typeof getCached(HASH, ADDR)!.cachedAt).toBe('number');
  });

  it('allows empty timestamp (unconfirmed proof)', () => {
    setCached(HASH, ADDR, { ...DATA, timestamp: '' });
    expect(getCached(HASH, ADDR)!.timestamp).toBe('');
  });
});

// ── clearCache ────────────────────────────────────────────────────────────────

describe('clearCache', () => {
  it('returns 0 when cache is already empty', () => {
    expect(clearCache()).toBe(0);
  });

  it('returns the number of entries cleared', () => {
    setCached(HASH, ADDR, DATA);
    setCached('0x' + 'c'.repeat(64), ADDR, DATA);
    expect(clearCache()).toBe(2);
  });

  it('makes getCached return null after clearing', () => {
    setCached(HASH, ADDR, DATA);
    clearCache();
    expect(getCached(HASH, ADDR)).toBeNull();
  });

  it('removes the localStorage key', () => {
    setCached(HASH, ADDR, DATA);
    clearCache();
    expect(localStorage.getItem('hashthis:verify-cache')).toBeNull();
  });
});

// ── pruneExpired ──────────────────────────────────────────────────────────────

describe('pruneExpired', () => {
  it('returns 0 when nothing is expired', () => {
    setCached(HASH, ADDR, DATA);
    expect(pruneExpired()).toBe(0);
  });

  it('removes only expired entries and leaves valid ones', () => {
    vi.useFakeTimers();
    const HASH2 = '0x' + 'e'.repeat(64);

    setCached(HASH, ADDR, DATA);                    // will expire
    vi.advanceTimersByTime(25 * 60 * 60 * 1000);    // 25h later
    setCached(HASH2, ADDR, DATA);                   // fresh entry

    const pruned = pruneExpired();
    expect(pruned).toBe(1);
    expect(getCached(HASH, ADDR)).toBeNull();
    expect(getCached(HASH2, ADDR)).not.toBeNull();
  });
});

// ── getCacheStats ─────────────────────────────────────────────────────────────

describe('getCacheStats', () => {
  it('returns zero stats for empty cache', () => {
    const stats = getCacheStats();
    expect(stats.entries).toBe(0);
    expect(stats.oldestAt).toBeNull();
    expect(stats.newestAt).toBeNull();
  });

  it('returns correct entry count', () => {
    setCached(HASH, ADDR, DATA);
    setCached('0x' + 'd'.repeat(64), ADDR, DATA);
    expect(getCacheStats().entries).toBe(2);
  });

  it('oldestAt and newestAt are numbers when entries exist', () => {
    setCached(HASH, ADDR, DATA);
    const stats = getCacheStats();
    expect(typeof stats.oldestAt).toBe('number');
    expect(typeof stats.newestAt).toBe('number');
  });

  it('oldestAt <= newestAt', () => {
    vi.useFakeTimers();
    setCached(HASH, ADDR, DATA);
    vi.advanceTimersByTime(1000);
    setCached('0x' + 'f'.repeat(64), ADDR, DATA);
    const { oldestAt, newestAt } = getCacheStats();
    expect(oldestAt!).toBeLessThanOrEqual(newestAt!);
  });
});