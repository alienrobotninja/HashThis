import { describe, it, expect, beforeEach } from 'vitest';
import { ckbService } from './ckb.service.js';

describe('CKBService - Hash Encoding (Stage 1: Block Timestamp)', () => {
  describe('encodeHashData', () => {
    it('should encode only the file hash without timestamp', () => {
      const fileHash = '0x' + '1'.repeat(64);
      const encoded = (ckbService as any).encodeHashData(fileHash);
      
      // Should only contain the hash (32 bytes = 64 hex chars + 0x prefix)
      expect(encoded).toMatch(/^0x[0-9a-f]{64}$/);
      expect(encoded.length).toBe(66); // 0x + 64 chars
      expect(encoded).toBe(fileHash);
    });

    it('should handle hash without 0x prefix', () => {
      const fileHash = '2'.repeat(64);
      const encoded = (ckbService as any).encodeHashData(fileHash);
      
      expect(encoded).toBe('0x' + fileHash);
    });

    it('should preserve the exact hash value', () => {
      const testCases = [
        '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        '0x' + 'a'.repeat(64),
        '0x' + 'f'.repeat(64),
        '0x0000000000000000000000000000000000000000000000000000000000000001',
      ];

      testCases.forEach(hash => {
        const encoded = (ckbService as any).encodeHashData(hash);
        expect(encoded).toBe(hash);
      });
    });
  });

  describe('decodeHashData', () => {
    it('should decode hash-only cell data', () => {
      const originalHash = '0x' + '3'.repeat(64);
      const decoded = (ckbService as any).decodeHashData(originalHash);
      
      expect(decoded).toHaveProperty('hash');
      expect(decoded.hash).toBe(originalHash);
    });

    it('should handle data without 0x prefix', () => {
      const hashWithoutPrefix = '4'.repeat(64);
      const decoded = (ckbService as any).decodeHashData(hashWithoutPrefix);
      
      expect(decoded.hash).toBe('0x' + hashWithoutPrefix);
    });

    it('should decode various hash formats correctly', () => {
      const testCases = [
        '0x' + 'a'.repeat(64),
        '0x' + 'f'.repeat(64),
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      ];

      testCases.forEach(originalHash => {
        const decoded = (ckbService as any).decodeHashData(originalHash);
        expect(decoded.hash).toBe(originalHash);
      });
    });

    it('should handle legacy cell data with timestamp gracefully', () => {
      // Legacy format: 64 chars hash + 16 chars timestamp
      const legacyData = '0x' + '5'.repeat(64) + '0000018d1234abcd';
      const decoded = (ckbService as any).decodeHashData(legacyData);
      
      // Should extract just the first 32 bytes (64 hex chars) as hash
      expect(decoded.hash).toBe('0x' + '5'.repeat(64));
    });
  });

  describe('Round-trip encoding/decoding', () => {
    it('should maintain hash integrity through encode-decode cycle', () => {
      const testHashes = [
        '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
        '0x' + '0'.repeat(64),
        '0x' + 'f'.repeat(64),
        '0x123abc456def789012345678901234567890123456789012345678901234abcd',
      ];

      testHashes.forEach(originalHash => {
        const encoded = (ckbService as any).encodeHashData(originalHash);
        const decoded = (ckbService as any).decodeHashData(encoded);
        expect(decoded.hash).toBe(originalHash);
      });
    });
  });

  describe('buildUnsignedTx', () => {
    it('should build tx with hash-only cell data', async () => {
      const fileHash = '0x' + 'a'.repeat(64);
      const userAddress = 'ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqwgx292hnvmn68xf779vmzrshpmm6epn4c0cgwga';
      
      const result = await ckbService.buildUnsignedTx({ fileHash, userAddress });
      
      expect(result).toHaveProperty('outputs');
      expect(result).toHaveProperty('outputsData');
      expect(result.outputs).toHaveLength(1);
      expect(result.outputsData).toHaveLength(1);
      
      // Cell data should only contain the hash (32 bytes = 64 hex + 0x)
      const cellData = result.outputsData[0];
      expect(cellData).toMatch(/^0x[0-9a-f]{64}$/);
      expect(cellData.length).toBe(66);
      expect(cellData).toBe(fileHash);
    });

    it('should not include timestamp in cell data', async () => {
      const fileHash = '0x' + 'b'.repeat(64);
      const userAddress = 'ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqwgx292hnvmn68xf779vmzrshpmm6epn4c0cgwga';
      
      const result = await ckbService.buildUnsignedTx({ fileHash, userAddress });
      const cellData = result.outputsData[0];
      
      // Should be exactly 66 chars (0x + 64), no timestamp appended
      expect(cellData.length).toBe(66);
      // Should not have the old 80-char format (64 hash + 16 timestamp)
      expect(cellData.length).not.toBe(82);
    });
  });
});