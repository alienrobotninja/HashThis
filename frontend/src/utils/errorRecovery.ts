// ── Error taxonomy ────────────────────────────────────────────────────────────

export type ErrorCode =
  | 'WALLET_REJECTED'       // User dismissed/rejected the signing prompt
  | 'WALLET_DISCONNECTED'   // Wallet lost connection mid-flow
  | 'INSUFFICIENT_FUNDS'    // Not enough CKB to cover capacity + fee
  | 'TX_TIMEOUT'            // Transaction not confirmed within poll window
  | 'TX_REJECTED'           // Node rejected the transaction (invalid/duplicate)
  | 'NETWORK_OFFLINE'       // fetch() failed — no connectivity
  | 'RPC_ERROR'             // CKB RPC returned an error
  | 'HASH_TOO_LARGE'        // File hash data malformed
  | 'ADDRESS_INVALID'       // Address parsing failed
  | 'UNKNOWN';              // Catch-all

export interface ClassifiedError {
  code:        ErrorCode;
  title:       string;
  detail:      string;
  /** If true the caller should offer a one-click retry of the same action. */
  retryable:   boolean;
  /** Suggested action for the user beyond retrying. */
  suggestion:  string;
}

// ── Classifier ────────────────────────────────────────────────────────────────

const PATTERNS: Array<{
  test: (msg: string) => boolean;
  result: Omit<ClassifiedError, 'detail'>;
}> = [
  {
    test: (m) => /user rejected|user denied|user cancelled|rejected by user/i.test(m),
    result: {
      code:       'WALLET_REJECTED',
      title:      'Signing cancelled',
      retryable:  true,
      suggestion: 'Open your wallet and approve the transaction when prompted.',
    },
  },
  {
    test: (m) => /wallet.*disconnect|disconnect.*wallet|lost.*connection|no.*signer/i.test(m),
    result: {
      code:       'WALLET_DISCONNECTED',
      title:      'Wallet disconnected',
      retryable:  true,
      suggestion: 'Reconnect your wallet using the button above, then try again.',
    },
  },
  {
    test: (m) => /insufficient.*capacity|not enough.*ckb|live cells.*enough|capacity.*insufficient|insufficient.*balance/i.test(m),
    result: {
      code:       'INSUFFICIENT_FUNDS',
      title:      'Insufficient CKB balance',
      retryable:  false,
      suggestion: 'You need at least 95 CKB in your wallet to anchor a proof. Top up your wallet and try again.',
    },
  },
  {
    test: (m) => /not confirmed|timeout|timed out|max.*attempt|poll.*failed/i.test(m),
    result: {
      code:       'TX_TIMEOUT',
      title:      'Confirmation timed out',
      retryable:  true,
      suggestion: 'The network may be busy. Your transaction may still confirm — check your wallet history before retrying.',
    },
  },
  {
    test: (m) => /transaction.*reject|reject.*transaction|duplicate.*transaction|already.*exist|dead.*cell/i.test(m),
    result: {
      code:       'TX_REJECTED',
      title:      'Transaction rejected by network',
      retryable:  false,
      suggestion: 'This file may already be anchored, or a prior transaction is pending. Check your proof history.',
    },
  },
  {
    test: (m) => /failed to fetch|network.*error|econnrefused|networkerror|load failed|offline/i.test(m),
    result: {
      code:       'NETWORK_OFFLINE',
      title:      'Connection failed',
      retryable:  true,
      suggestion: 'Check your internet connection, then retry.',
    },
  },
  {
    test: (m) => /rpc.*error|jsonrpc|server.*error|500|503|bad.*gateway/i.test(m),
    result: {
      code:       'RPC_ERROR',
      title:      'Node RPC error',
      retryable:  true,
      suggestion: 'The CKB node returned an unexpected error. Wait a moment and retry.',
    },
  },
  {
    test: (m) => /address.*invalid|invalid.*address|parse.*address|address.*parse/i.test(m),
    result: {
      code:       'ADDRESS_INVALID',
      title:      'Invalid wallet address',
      retryable:  false,
      suggestion: 'Reconnect your wallet — the address format may not be supported.',
    },
  },
];

/**
 * Classifies any thrown error into a structured, user-readable form.
 * Pass the raw error object (or string) from any catch block.
 */
export function classifyError(err: unknown): ClassifiedError {
  const raw = err instanceof Error ? err.message : String(err ?? 'Unknown error');

  for (const { test, result } of PATTERNS) {
    if (test(raw)) {
      return { ...result, detail: raw };
    }
  }

  return {
    code:       'UNKNOWN',
    title:      'Something went wrong',
    detail:     raw,
    retryable:  true,
    suggestion: 'An unexpected error occurred. Please try again or check the browser console for details.',
  };
}

/**
 * Returns true if the error code represents a transient condition worth retrying.
 */
export function isRetryable(err: ClassifiedError): boolean {
  return err.retryable;
}