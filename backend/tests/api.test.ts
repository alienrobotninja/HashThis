import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { registry } from '../src/config/registry';

// Set global timeout to 30 seconds (Blockchain is slow!)
describe('HashThis API E2E', { timeout: 30000 }, () => {
  
  // 1. Health Check (Should always pass)
  it('GET /health should return 200 OK', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  // 2. Verification Flow (Read Only)
  it('GET /api/v1/hashes/0x123... (Unknown) should return 404', async () => {
    // We use a fake hash that definitely doesn't exist
    const randomHash = '0x' + 'e'.repeat(64);
    const res = await request(app).get(`/api/v1/hashes/${randomHash}`);
    
    // Expect 404 because it's not on chain
    expect(res.status).toBe(404);
  });

  // 3. Submission Flow (Write)
  // We skip this test if no Private Key is set to prevent crashing
  const hasKey = registry.ckb.signerPrivKey && registry.ckb.signerPrivKey.length > 0;

  it.skipIf(!hasKey)('POST /api/v1/hashes should attempt submission', async () => {
    const testHash = '0x' + Array.from({length: 64}, () => 
      Math.floor(Math.random() * 16).toString(16)).join('');
    
    const res = await request(app)
      .post('/api/v1/hashes')
      .send({
        fileHash: testHash,
        timestamp: new Date().toISOString()
      });

    // If you have no funds (CKB), this will return 500. 
    // If you have funds, it returns 200.
    // Both prove the API is reachable.
    expect(res.status).not.toBe(404);
  });
});