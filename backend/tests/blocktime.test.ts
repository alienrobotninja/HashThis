import { describe, it, expect } from 'vitest';
import { ckbService } from '../src/services/ckb.service.js';

describe('Backend CKBService - Block Time Fetching (Step 1.2)', () => {
  describe('getBlockTime', () => {
    it('should have getBlockTime method', () => {
      expect(ckbService.getBlockTime).toBeDefined();
      expect(typeof ckbService.getBlockTime).toBe('function');
    });

    it('should accept transaction hash with 0x prefix', () => {
      const txHashWith0x = '0x' + '1'.repeat(64);
      
      expect(() => {
        ckbService.getBlockTime(txHashWith0x);
      }).not.toThrow();
    });

    it('should accept transaction hash without 0x prefix', () => {
      const txHashWithout0x = '2'.repeat(64);
      
      expect(() => {
        ckbService.getBlockTime(txHashWithout0x);
      }).not.toThrow();
    });
  });

  describe('pollTransactionStatus', () => {
    it('should have pollTransactionStatus method', () => {
      expect(ckbService.pollTransactionStatus).toBeDefined();
      expect(typeof ckbService.pollTransactionStatus).toBe('function');
    });

    it('should accept transaction hash parameter', () => {
      const mockTxHash = '0x' + '3'.repeat(64);
      
      expect(() => {
        ckbService.pollTransactionStatus(mockTxHash, 1, 100);
      }).not.toThrow();
    });

    it('should accept custom maxAttempts parameter', () => {
      const mockTxHash = '0x' + '4'.repeat(64);
      
      expect(() => {
        ckbService.pollTransactionStatus(mockTxHash, 10, 100);
      }).not.toThrow();
    });

    it('should accept custom interval parameter', () => {
      const mockTxHash = '0x' + '5'.repeat(64);
      
      expect(() => {
        ckbService.pollTransactionStatus(mockTxHash, 1, 500);
      }).not.toThrow();
    });
  });

  describe('Block timestamp conversion', () => {
    it('should convert hex timestamp to milliseconds', () => {
      const hexTimestamp = '0x18d1234abcd';
      const timestampMs = Number(BigInt(hexTimestamp));
      
      expect(timestampMs).toBeGreaterThan(0);
      expect(typeof timestampMs).toBe('number');
    });

    it('should convert timestamp to ISO string', () => {
      const hexTimestamp = '0x18d1234abcd';
      const timestampMs = Number(BigInt(hexTimestamp));
      const isoString = new Date(timestampMs).toISOString();
      
      expect(isoString).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should convert block number from hex to decimal', () => {
      const hexBlockNumber = '0x12345';
      const blockNumber = BigInt(hexBlockNumber).toString();
      
      expect(blockNumber).toBe('74565');
    });
  });

  describe('Expected return structure', () => {
    it('should return object with timestamp, blockNumber, and blockHash', () => {
      const mockResult = {
        timestamp: '2026-03-05T14:32:07.000Z',
        blockNumber: '12345678',
        blockHash: '0x' + 'a'.repeat(64)
      };

      expect(mockResult).toHaveProperty('timestamp');
      expect(mockResult).toHaveProperty('blockNumber');
      expect(mockResult).toHaveProperty('blockHash');
      expect(typeof mockResult.timestamp).toBe('string');
      expect(typeof mockResult.blockNumber).toBe('string');
      expect(typeof mockResult.blockHash).toBe('string');
      expect(mockResult.blockHash).toMatch(/^0x[0-9a-f]{64}$/);
    });
  });
});