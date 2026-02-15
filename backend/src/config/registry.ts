import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// --- FIXED: Explicit Path Resolution for Monorepo ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// This looks two levels up from src/config/ to find the backend/.env
const envPath = path.resolve(__dirname, '../../.env');

dotenv.config({ path: envPath });

/**
 * Registry serves as the immutable source of truth for the backend.
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
    // FIXED: Ensure 0x prefix if missing
    signerPrivKey: process.env.PRIVATE_KEY?.startsWith('0x') 
      ? process.env.PRIVATE_KEY 
      : `0x${process.env.PRIVATE_KEY}`,
    network: (process.env.CKB_NETWORK || 'testnet') as 'testnet' | 'mainnet',
  },
  app: {
    // FIXED: Default to Vite's port 5173 for local development
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    apiPrefix: '/api/v1',
  }
};

/**
 * Validates critical environment variables.
 * Call this in your entry point (app.ts) to crash early if setup is wrong.
 */
export function checkEnvStability() {
  const required = ['PRIVATE_KEY', 'CKB_RPC_URL'];
  const missing = required.filter(key => !process.env[key] || process.env[key] === 'undefined');
  
  if (missing.length > 0) {
    console.error('❌ Found missing variables at:', envPath);
    throw new Error(`Environment Instability: Missing ${missing.join(', ')}`);
  }
  
  console.log('✅ Registry: Environment variables loaded successfully.');
}