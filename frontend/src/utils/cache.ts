// ── Types ─────────────────────────────────────────────────────────────────────

export interface CacheEntry {
  fileHash:    string;
  txHash:      string;
  blockNumber: string;
  timestamp:   string;   // ISO — may be empty if still confirming at cache time
  cachedAt:    number;   // Date.now() ms
}

export interface CacheStats {
  entries: number;
  oldestAt: number | null;
  newestAt: number | null;
}

// Cache entries expire after 24 hours — block proofs are immutable so stale
// data is fine, but we don't want to serve entries from before a wallet change.
const TTL_MS        = 24 * 60 * 60 * 1000;
const STORAGE_KEY   = 'hashthis:verify-cache';
const MAX_ENTRIES   = 200;

// ── Storage helpers ───────────────────────────────────────────────────────────

function readStore(): Record<string, CacheEntry> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, CacheEntry>) : {};
  } catch {
    return {};
  }
}

function writeStore(store: Record<string, CacheEntry>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Quota exceeded or private browsing — silently no-op
  }
}

// ── Cache key ─────────────────────────────────────────────────────────────────

/**
 * Derives a cache key from the file hash and wallet address.
 * Including walletAddress prevents cross-wallet false positives.
 */
export function buildCacheKey(fileHash: string, walletAddress: string): string {
  const cleanHash = fileHash.startsWith('0x') ? fileHash.slice(2) : fileHash;
  const cleanAddr = walletAddress.toLowerCase();
  return `${cleanHash}:${cleanAddr}`;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns the cached entry for this (hash, wallet) pair, or null if absent/expired.
 */
export function getCached(fileHash: string, walletAddress: string): CacheEntry | null {
  const store = readStore();
  const key   = buildCacheKey(fileHash, walletAddress);
  const entry = store[key];
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > TTL_MS) {
    // Expired — clean up lazily
    delete store[key];
    writeStore(store);
    return null;
  }
  return entry;
}

/**
 * Stores a verification result. Only caches verified proofs (not "not found").
 * Evicts the oldest entries when MAX_ENTRIES is exceeded.
 */
export function setCached(fileHash: string, walletAddress: string, data: Omit<CacheEntry, 'cachedAt' | 'fileHash'>): void {
  const store = readStore();
  const key   = buildCacheKey(fileHash, walletAddress);

  store[key] = {
    fileHash,
    txHash:      data.txHash,
    blockNumber: data.blockNumber,
    timestamp:   data.timestamp,
    cachedAt:    Date.now(),
  };

  // Evict oldest entries if over limit
  const keys = Object.keys(store);
  if (keys.length > MAX_ENTRIES) {
    const sorted = keys.sort((a, b) => store[a].cachedAt - store[b].cachedAt);
    sorted.slice(0, keys.length - MAX_ENTRIES).forEach((k) => delete store[k]);
  }

  writeStore(store);
}

/**
 * Removes all cached entries. Returns the number of entries cleared.
 */
export function clearCache(): number {
  const store = readStore();
  const count = Object.keys(store).length;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // no-op
  }
  return count;
}

/**
 * Removes expired entries without clearing valid ones.
 * Returns the number of entries pruned.
 */
export function pruneExpired(): number {
  const store  = readStore();
  const before = Object.keys(store).length;
  const now    = Date.now();
  for (const key of Object.keys(store)) {
    if (now - store[key].cachedAt > TTL_MS) delete store[key];
  }
  writeStore(store);
  return before - Object.keys(store).length;
}

/**
 * Returns summary statistics about the current cache.
 */
export function getCacheStats(): CacheStats {
  const store   = readStore();
  const entries = Object.values(store);
  if (entries.length === 0) return { entries: 0, oldestAt: null, newestAt: null };
  const times = entries.map((e) => e.cachedAt);
  return {
    entries:  entries.length,
    oldestAt: Math.min(...times),
    newestAt: Math.max(...times),
  };
}