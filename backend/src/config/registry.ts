import dotenv from 'dotenv';

// Pre-load environment variables
dotenv.config();

/**
 * The Registry is the immutable source of truth for the backend.
 * We parse and validate environment variables here to ensure 
 * the app fails fast if critical keys are missing.
 */
export const registry = {
  server: {
    port: Number(process.env.PORT) || 3001,
    env: process.env.NODE_ENV || 'development',
    isDev: process.env.NODE_ENV !== 'production',
  },
  ckb: {
    rpcUrl: process.env.CKB_RPC_URL || 'https://testnet.ckb.dev/rpc',
    indexerUrl: process.env.CKB_INDEXER_URL || 'https://testnet.ckb.dev/indexer',
    // We treat the private key as a sensitive string
    signerPrivKey: process.env.PRIVATE_KEY || '',
    network: (process.env.CKB_NETWORK || 'testnet') as 'testnet' | 'mainnet',
  },
  security: {
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    apiPrefix: '/api/v1',
  }
};

/**
 * Simple guard clause to be called during the bootstrap process.
 */
export function assertEnvPolicy(): void {
  const criticalKeys = ['PRIVATE_KEY', 'CKB_RPC_URL'];
  const missing = criticalKeys.filter(k => !process.env[k]);
  
  if (missing.length > 0) {
    throw new Error(`Bootstrap failed. Missing critical environment keys: ${missing.join(', ')}`);
  }
}