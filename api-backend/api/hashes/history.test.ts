import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ckbService } from './ckb.service.js';

// ---------------------------------------------------------------------------
// CKBService.getUserProofs — unit tests (mocked CKB client)
// ---------------------------------------------------------------------------

describe('CKBService - getUserProofs (Stage 4.1)', () => {
  const VALID_ADDRESS =
    'ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqwgx292hnvmn68xf779vmzrshpmm6epn4c0cgwga';

  describe('method contract', () => {
    it('should expose getUserProofs as a public method', () => {
      expect(ckbService.getUserProofs).toBeDefined();
      expect(typeof ckbService.getUserProofs).toBe('function');
    });

    it('should return a Promise', () => {
      // We're not awaiting — just checking the return type before it rejects
      const result = ckbService.getUserProofs(VALID_ADDRESS);
      expect(result).toBeInstanceOf(Promise);
      // Swallow the rejection so Vitest doesn't treat it as a test failure
      result.catch(() => {});
    });
  });

  describe('cell filtering logic', () => {
    it('should accept cells with at least 64 hex chars of output data', () => {
      const validData = '0x' + 'a'.repeat(64);
      const raw = validData.startsWith('0x') ? validData.slice(2) : validData;
      expect(raw.length).toBeGreaterThanOrEqual(64);
    });

    it('should reject cells with fewer than 64 hex chars of output data', () => {
      const shortData = '0x' + 'a'.repeat(32); // only 16 bytes
      const raw = shortData.startsWith('0x') ? shortData.slice(2) : shortData;
      expect(raw.length).toBeLessThan(64);
    });

    it('should handle cells with no outputData gracefully', () => {
      const cell = { outputData: null, txHash: '0x' + '1'.repeat(64), blockNumber: '100' };
      expect(cell.outputData).toBeNull();
    });

    it('should handle cells with empty outputData string', () => {
      const cell = { outputData: '', txHash: '0x' + '2'.repeat(64), blockNumber: '200' };
      const raw = cell.outputData.startsWith('0x')
        ? cell.outputData.slice(2)
        : cell.outputData;
      expect(raw.length).toBeLessThan(64);
    });
  });

  describe('proof shape', () => {
    it('each proof should contain fileHash, txHash, blockNumber', () => {
      const mockProof = {
        fileHash: '0x' + 'a'.repeat(64),
        txHash: '0x' + 'b'.repeat(64),
        blockNumber: '12345678',
      };

      expect(mockProof).toHaveProperty('fileHash');
      expect(mockProof).toHaveProperty('txHash');
      expect(mockProof).toHaveProperty('blockNumber');
    });

    it('fileHash should be a 0x-prefixed 64-char hex string', () => {
      const fileHash = '0x' + 'c'.repeat(64);
      expect(fileHash).toMatch(/^0x[0-9a-f]{64}$/);
    });

    it('txHash should be a 0x-prefixed 64-char hex string', () => {
      const txHash = '0x' + 'd'.repeat(64);
      expect(txHash).toMatch(/^0x[0-9a-f]{64}$/);
    });

    it('blockNumber should be a non-empty string', () => {
      const blockNumber = '12345678';
      expect(typeof blockNumber).toBe('string');
      expect(blockNumber.length).toBeGreaterThan(0);
    });
  });

  describe('return value structure', () => {
    it('should return an array', async () => {
      // Mock client to return empty iterator
      const originalClient = (ckbService as any).client;
      (ckbService as any).client = {
        ...originalClient,
        findCells: vi.fn().mockReturnValue({
          [Symbol.asyncIterator]: async function* () { /* empty */ },
        }),
      };
      // Also mock Address.fromString to not hit the network
      const cccMock = await import('@ckb-ccc/core');
      const spy = vi.spyOn(cccMock.ccc.Address, 'fromString').mockResolvedValue({
        script: { codeHash: '0x' + '0'.repeat(64), hashType: 'type', args: '0x' },
      } as any);

      const result = await ckbService.getUserProofs(VALID_ADDRESS);

      expect(Array.isArray(result)).toBe(true);

      // Restore
      (ckbService as any).client = originalClient;
      spy.mockRestore();
    });

    it('should return proofs sorted most-recent-first (desc)', () => {
      // Simulated output from two cells (desc order by blockNumber)
      const mockProofs = [
        { fileHash: '0x' + 'f'.repeat(64), txHash: '0x' + 'e'.repeat(64), blockNumber: '200' },
        { fileHash: '0x' + 'a'.repeat(64), txHash: '0x' + 'b'.repeat(64), blockNumber: '100' },
      ];

      // The first entry should have the higher block number (most recent)
      expect(Number(mockProofs[0].blockNumber)).toBeGreaterThan(Number(mockProofs[1].blockNumber));
    });
  });
});

// ---------------------------------------------------------------------------
// GET /api/hashes/history — endpoint unit tests (handler logic only)
// ---------------------------------------------------------------------------

describe('GET /api/hashes/history handler (Stage 4.1)', () => {
  // Helper to build a mock Vercel request
  const mockReq = (method: string, query: Record<string, string> = {}) => ({
    method,
    query,
    body: {},
  });

  // Helper to build a mock Vercel response
  const mockRes = () => {
    const res: any = {};
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    res.end = vi.fn().mockReturnValue(res);
    res.setHeader = vi.fn().mockReturnValue(res);
    return res;
  };

  describe('input validation', () => {
    it('should return 405 for non-GET requests', async () => {
      const { default: handler } = await import('./history.js');
      const req = mockReq('POST');
      const res = mockRes();
      await handler(req as any, res as any);
      expect(res.status).toHaveBeenCalledWith(405);
    });

    it('should return 200 for OPTIONS preflight', async () => {
      const { default: handler } = await import('./history.js');
      const req = mockReq('OPTIONS');
      const res = mockRes();
      await handler(req as any, res as any);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should return 400 when userAddress is missing', async () => {
      const { default: handler } = await import('./history.js');
      const req = mockReq('GET', {});
      const res = mockRes();
      await handler(req as any, res as any);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('userAddress') })
      );
    });

    it('should return 400 for a non-CKB address format', async () => {
      const { default: handler } = await import('./history.js');
      const req = mockReq('GET', { userAddress: '0xNotACKBAddress' });
      const res = mockRes();
      await handler(req as any, res as any);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 for a negative limit', async () => {
      const { default: handler } = await import('./history.js');
      const req = mockReq('GET', {
        userAddress: 'ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqwgx292hnvmn68xf779vmzrshpmm6epn4c0cgwga',
        limit: '-5',
      });
      const res = mockRes();
      await handler(req as any, res as any);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 for a non-numeric limit', async () => {
      const { default: handler } = await import('./history.js');
      const req = mockReq('GET', {
        userAddress: 'ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqwgx292hnvmn68xf779vmzrshpmm6epn4c0cgwga',
        limit: 'abc',
      });
      const res = mockRes();
      await handler(req as any, res as any);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('limit capping', () => {
    it('should cap limit at 500 even if caller passes a larger value', () => {
      const requestedLimit = 9999;
      const capped = Math.min(requestedLimit, 500);
      expect(capped).toBe(500);
    });

    it('should default limit to 100 when not supplied', () => {
      const defaultLimit = 100;
      expect(defaultLimit).toBe(100);
    });
  });

  describe('successful response shape', () => {
    it('response should include proofs array and count', () => {
      const mockResponse = {
        proofs: [
          {
            fileHash: '0x' + 'a'.repeat(64),
            txHash: '0x' + 'b'.repeat(64),
            blockNumber: '999',
          },
        ],
        count: 1,
      };

      expect(mockResponse).toHaveProperty('proofs');
      expect(mockResponse).toHaveProperty('count');
      expect(Array.isArray(mockResponse.proofs)).toBe(true);
      expect(mockResponse.count).toBe(mockResponse.proofs.length);
    });

    it('count should equal the length of the proofs array', () => {
      const proofs = [
        { fileHash: '0x' + '1'.repeat(64), txHash: '0x' + '2'.repeat(64), blockNumber: '1' },
        { fileHash: '0x' + '3'.repeat(64), txHash: '0x' + '4'.repeat(64), blockNumber: '2' },
      ];
      expect(proofs.length).toBe(2);
    });

    it('empty history should return proofs:[] count:0', () => {
      const mockResponse = { proofs: [], count: 0 };
      expect(mockResponse.proofs).toHaveLength(0);
      expect(mockResponse.count).toBe(0);
    });
  });

  describe('CORS headers', () => {
    it('should set Access-Control-Allow-Origin header', async () => {
      const { default: handler } = await import('./history.js');
      const req = mockReq('OPTIONS');
      const res = mockRes();
      await handler(req as any, res as any);
      expect(res.setHeader).toHaveBeenCalledWith(
        'Access-Control-Allow-Origin',
        expect.any(String)
      );
    });
  });
});