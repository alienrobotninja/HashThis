import { describe, it, expect } from 'vitest';
import { classifyError, isRetryable, type ClassifiedError } from './errorRecovery';

// ── helpers ───────────────────────────────────────────────────────────────────

const classify = (msg: string) => classifyError(new Error(msg));

// ── classifyError — known patterns ────────────────────────────────────────────

describe('classifyError — WALLET_REJECTED', () => {
  it('matches "User rejected"', () => {
    expect(classify('User rejected the request').code).toBe('WALLET_REJECTED');
  });
  it('matches "user denied"', () => {
    expect(classify('user denied signing').code).toBe('WALLET_REJECTED');
  });
  it('matches "User cancelled"', () => {
    expect(classify('User cancelled transaction').code).toBe('WALLET_REJECTED');
  });
  it('is retryable', () => {
    expect(classify('User rejected').retryable).toBe(true);
  });
});

describe('classifyError — WALLET_DISCONNECTED', () => {
  it('matches "wallet disconnect"', () => {
    expect(classify('wallet disconnect detected').code).toBe('WALLET_DISCONNECTED');
  });
  it('matches "lost connection"', () => {
    expect(classify('lost connection to wallet').code).toBe('WALLET_DISCONNECTED');
  });
  it('is retryable', () => {
    expect(classify('no signer available').retryable).toBe(true);
  });
});

describe('classifyError — INSUFFICIENT_FUNDS', () => {
  it('matches "insufficient capacity"', () => {
    expect(classify('insufficient capacity to build tx').code).toBe('INSUFFICIENT_FUNDS');
  });
  it('matches "not enough ckb"', () => {
    expect(classify('not enough CKB in live cells').code).toBe('INSUFFICIENT_FUNDS');
  });
  it('matches "capacity insufficient"', () => {
    expect(classify('capacity insufficient for outputs').code).toBe('INSUFFICIENT_FUNDS');
  });
  it('is NOT retryable', () => {
    expect(classify('insufficient balance').retryable).toBe(false);
  });
});

describe('classifyError — TX_TIMEOUT', () => {
  it('matches "Transaction not confirmed"', () => {
    expect(classify('Transaction not confirmed - no block hash available').code).toBe('TX_TIMEOUT');
  });
  it('matches "timed out"', () => {
    expect(classify('Request timed out after 60 attempts').code).toBe('TX_TIMEOUT');
  });
  it('matches "max attempt"', () => {
    expect(classify('max attempt reached, poll failed').code).toBe('TX_TIMEOUT');
  });
  it('is retryable', () => {
    expect(classify('timeout waiting for confirmation').retryable).toBe(true);
  });
});

describe('classifyError — TX_REJECTED', () => {
  it('matches "Transaction rejected"', () => {
    expect(classify('Transaction rejected by node').code).toBe('TX_REJECTED');
  });
  it('matches "duplicate transaction"', () => {
    expect(classify('duplicate transaction detected').code).toBe('TX_REJECTED');
  });
  it('matches "dead cell"', () => {
    expect(classify('dead cell referenced in inputs').code).toBe('TX_REJECTED');
  });
  it('is NOT retryable', () => {
    expect(classify('transaction already exists').retryable).toBe(false);
  });
});

describe('classifyError — NETWORK_OFFLINE', () => {
  it('matches "Failed to fetch"', () => {
    expect(classify('Failed to fetch').code).toBe('NETWORK_OFFLINE');
  });
  it('matches "NetworkError"', () => {
    expect(classify('NetworkError when attempting to fetch resource').code).toBe('NETWORK_OFFLINE');
  });
  it('matches ECONNREFUSED', () => {
    expect(classify('connect ECONNREFUSED 127.0.0.1:3001').code).toBe('NETWORK_OFFLINE');
  });
  it('is retryable', () => {
    expect(classify('Failed to fetch').retryable).toBe(true);
  });
});

describe('classifyError — RPC_ERROR', () => {
  it('matches "rpc error"', () => {
    expect(classify('rpc error: code -32000').code).toBe('RPC_ERROR');
  });
  it('matches "jsonrpc"', () => {
    expect(classify('jsonrpc server error').code).toBe('RPC_ERROR');
  });
  it('matches status 503', () => {
    expect(classify('server error 503').code).toBe('RPC_ERROR');
  });
  it('is retryable', () => {
    expect(classify('rpc error from node').retryable).toBe(true);
  });
});

describe('classifyError — ADDRESS_INVALID', () => {
  it('matches "address invalid"', () => {
    expect(classify('address invalid: unexpected prefix').code).toBe('ADDRESS_INVALID');
  });
  it('matches "parse address"', () => {
    expect(classify('failed to parse address format').code).toBe('ADDRESS_INVALID');
  });
  it('is NOT retryable', () => {
    expect(classify('invalid address format').retryable).toBe(false);
  });
});

// ── classifyError — UNKNOWN / fallback ───────────────────────────────────────

describe('classifyError — UNKNOWN', () => {
  it('returns UNKNOWN for unrecognised messages', () => {
    expect(classify('some completely random error message xyz').code).toBe('UNKNOWN');
  });
  it('includes the original message in detail', () => {
    const ce = classify('some random error abc');
    expect(ce.detail).toContain('some random error abc');
  });
  it('is retryable by default', () => {
    expect(classify('??').retryable).toBe(true);
  });
  it('handles non-Error input — null', () => {
    expect(classifyError(null).code).toBe('UNKNOWN');
  });
  it('handles non-Error input — plain string', () => {
    expect(classifyError('plain string error').code).toBe('UNKNOWN');
  });
  it('handles non-Error input — object', () => {
    expect(() => classifyError({ foo: 'bar' })).not.toThrow();
  });
});

// ── structure of returned object ─────────────────────────────────────────────

describe('ClassifiedError shape', () => {
  it('always has all required fields', () => {
    const ce: ClassifiedError = classify('something went wrong');
    expect(ce).toHaveProperty('code');
    expect(ce).toHaveProperty('title');
    expect(ce).toHaveProperty('detail');
    expect(ce).toHaveProperty('retryable');
    expect(ce).toHaveProperty('suggestion');
  });

  it('title is a non-empty string', () => {
    expect(classify('User rejected').title.length).toBeGreaterThan(0);
  });

  it('suggestion is a non-empty string', () => {
    expect(classify('Failed to fetch').suggestion.length).toBeGreaterThan(0);
  });
});

// ── isRetryable ───────────────────────────────────────────────────────────────

describe('isRetryable', () => {
  it('returns true for retryable errors', () => {
    expect(isRetryable(classify('User rejected'))).toBe(true);
  });
  it('returns false for non-retryable errors', () => {
    expect(isRetryable(classify('insufficient capacity'))).toBe(false);
  });
});