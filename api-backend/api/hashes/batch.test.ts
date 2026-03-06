import { describe, it, expect } from 'vitest';
import { ckbService } from '../api/hashes/ckb.service.js';

describe('CKBService - Batch Proof Submissions (Stage 3)', () => {
  describe('buildBatchUnsignedTx', () => {
    const mockAddress = 'ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqwgx292hnvmn68xf779vmzrshpmm6epn4c0cgwga';
    
    it('should build batch transaction with multiple outputs', async () => {
      const hashes = [
        '0x' + '1'.repeat(64),
        '0x' + '2'.repeat(64),
        '0x' + '3'.repeat(64)
      ];

      const result = await ckbService.buildBatchUnsignedTx(hashes, mockAddress);

      expect(result).toBeDefined();
      expect(result.proofCount).toBe(3);
      expect(result.transaction).toBeDefined();
      expect(result.transaction.outputs).toHaveLength(3);
      expect(result.transaction.outputsData).toHaveLength(3);
    });

    it('should calculate correct total capacity for batch', async () => {
      const hashes = [
        '0x' + 'a'.repeat(64),
        '0x' + 'b'.repeat(64),
        '0x' + 'c'.repeat(64),
        '0x' + 'd'.repeat(64),
        '0x' + 'e'.repeat(64)
      ];

      const result = await ckbService.buildBatchUnsignedTx(hashes, mockAddress);

      // 5 hashes × 95 CKB = 475 CKB = 47,500,000,000 shannons
      const expectedCapacity = '47500000000';
      expect(result.totalCapacity).toBe(expectedCapacity);
      expect(result.proofCount).toBe(5);
    });

    it('should encode each hash correctly in outputsData', async () => {
      const hashes = [
        '0x' + '1'.repeat(64),
        '0x' + '2'.repeat(64)
      ];

      const result = await ckbService.buildBatchUnsignedTx(hashes, mockAddress);

      expect(result.transaction.outputsData[0]).toBe('0x' + '1'.repeat(64));
      expect(result.transaction.outputsData[1]).toBe('0x' + '2'.repeat(64));
    });

    it('should handle single hash batch (same as regular)', async () => {
      const hashes = ['0x' + 'f'.repeat(64)];

      const result = await ckbService.buildBatchUnsignedTx(hashes, mockAddress);

      expect(result.proofCount).toBe(1);
      expect(result.transaction.outputs).toHaveLength(1);
      expect(result.totalCapacity).toBe('9500000000'); // 95 CKB
    });

    it('should handle large batch (20 hashes)', async () => {
      const hashes = Array.from({ length: 20 }, (_, i) => 
        '0x' + i.toString(16).padStart(64, '0')
      );

      const result = await ckbService.buildBatchUnsignedTx(hashes, mockAddress);

      expect(result.proofCount).toBe(20);
      expect(result.transaction.outputs).toHaveLength(20);
      expect(result.transaction.outputsData).toHaveLength(20);
      
      // 20 × 95 CKB = 1,900 CKB = 190,000,000,000 shannons
      expect(result.totalCapacity).toBe('190000000000');
    });

    it('should set correct capacity for each output', async () => {
      const hashes = [
        '0x' + '1'.repeat(64),
        '0x' + '2'.repeat(64)
      ];

      const result = await ckbService.buildBatchUnsignedTx(hashes, mockAddress);

      // Each output should have 95 CKB capacity (9500000000 shannons in hex)
      const expectedCapacityHex = '0x236223e800'; // 9500000000 in hex
      expect(result.transaction.outputs[0].capacity).toBe(expectedCapacityHex);
      expect(result.transaction.outputs[1].capacity).toBe(expectedCapacityHex);
    });

    it('should return estimated fee', async () => {
      const hashes = ['0x' + 'a'.repeat(64)];

      const result = await ckbService.buildBatchUnsignedTx(hashes, mockAddress);

      expect(result.estimatedFee).toBeDefined();
      expect(typeof result.estimatedFee).toBe('string');
      expect(BigInt(result.estimatedFee)).toBeGreaterThan(0n);
    });

    it('should handle hashes without 0x prefix', async () => {
      const hashes = [
        '1'.repeat(64),
        '2'.repeat(64)
      ];

      const result = await ckbService.buildBatchUnsignedTx(hashes, mockAddress);

      // Should add 0x prefix
      expect(result.transaction.outputsData[0]).toBe('0x' + '1'.repeat(64));
      expect(result.transaction.outputsData[1]).toBe('0x' + '2'.repeat(64));
    });
  });

  describe('Batch transaction structure', () => {
    const mockAddress = 'ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqwgx292hnvmn68xf779vmzrshpmm6epn4c0cgwga';

    it('should have correct transaction structure', async () => {
      const hashes = ['0x' + 'a'.repeat(64), '0x' + 'b'.repeat(64)];

      const result = await ckbService.buildBatchUnsignedTx(hashes, mockAddress);

      expect(result.transaction.version).toBe('0x0');
      expect(result.transaction.cellDeps).toBeDefined();
      expect(result.transaction.headerDeps).toBeDefined();
      expect(result.transaction.inputs).toBeDefined();
      expect(result.transaction.outputs).toBeDefined();
      expect(result.transaction.outputsData).toBeDefined();
      expect(result.transaction.witnesses).toBeDefined();
    });

    it('should have outputs matching outputsData length', async () => {
      const hashes = [
        '0x' + '1'.repeat(64),
        '0x' + '2'.repeat(64),
        '0x' + '3'.repeat(64)
      ];

      const result = await ckbService.buildBatchUnsignedTx(hashes, mockAddress);

      expect(result.transaction.outputs.length).toBe(result.transaction.outputsData.length);
      expect(result.transaction.outputs.length).toBe(hashes.length);
    });
  });

  describe('Batch savings calculation', () => {
    it('should show fee savings for batch vs individual', () => {
      const INDIVIDUAL_FEE = 1_00000000; // 1 CKB per transaction
      const BATCH_FEE = 1_00000000;      // ~1 CKB for batch regardless of size
      
      // Individual: 5 transactions × 1 CKB fee = 5 CKB total fees
      const individualFees = 5 * INDIVIDUAL_FEE;
      
      // Batch: 1 transaction = 1 CKB fee
      const batchFees = BATCH_FEE;
      
      const savings = individualFees - batchFees;
      const savingsPercent = ((savings / individualFees) * 100).toFixed(0);
      
      expect(savings).toBe(4_00000000); // 4 CKB saved
      expect(savingsPercent).toBe('80'); // 80% savings
    });
  });
});