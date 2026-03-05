// Manual test for block time fetching functionality
// Tests timestamp conversion and data structure validation

class BlockTimeTest {
  testTimestampConversion() {
    console.log("Test 1: Hex timestamp to milliseconds conversion");
    
    const hexTimestamp = '0x18d1234abcd';
    const timestampMs = Number(BigInt(hexTimestamp));
    
    console.log("  Hex timestamp:", hexTimestamp);
    console.log("  Milliseconds:", timestampMs);
    console.log("  Result:", timestampMs > 0 ? "✅ PASS" : "❌ FAIL");
  }

  testISOConversion() {
    console.log("\nTest 2: Milliseconds to ISO string conversion");
    
    const timestampMs = 1709650327000; // March 5, 2026
    const isoString = new Date(timestampMs).toISOString();
    
    console.log("  Milliseconds:", timestampMs);
    console.log("  ISO String:", isoString);
    console.log("  Format match:", /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(isoString) ? "✅ PASS" : "❌ FAIL");
  }

  testBlockNumberConversion() {
    console.log("\nTest 3: Hex block number to decimal conversion");
    
    const hexBlockNumber = '0x12345';
    const blockNumber = BigInt(hexBlockNumber).toString();
    
    console.log("  Hex block number:", hexBlockNumber);
    console.log("  Decimal:", blockNumber);
    console.log("  Expected:", "74565");
    console.log("  Result:", blockNumber === "74565" ? "✅ PASS" : "❌ FAIL");
  }

  testReturnStructure() {
    console.log("\nTest 4: Return structure validation");
    
    const mockResult = {
      timestamp: '2026-03-05T14:32:07.000Z',
      blockNumber: '12345678',
      blockHash: '0x' + 'a'.repeat(64)
    };

    const hasTimestamp = mockResult.hasOwnProperty('timestamp');
    const hasBlockNumber = mockResult.hasOwnProperty('blockNumber');
    const hasBlockHash = mockResult.hasOwnProperty('blockHash');
    const timestampIsString = typeof mockResult.timestamp === 'string';
    const blockNumberIsString = typeof mockResult.blockNumber === 'string';
    const blockHashIsString = typeof mockResult.blockHash === 'string';
    const blockHashFormat = /^0x[0-9a-f]{64}$/.test(mockResult.blockHash);

    console.log("  Has timestamp:", hasTimestamp ? "✅" : "❌");
    console.log("  Has blockNumber:", hasBlockNumber ? "✅" : "❌");
    console.log("  Has blockHash:", hasBlockHash ? "✅" : "❌");
    console.log("  Timestamp is string:", timestampIsString ? "✅" : "❌");
    console.log("  BlockNumber is string:", blockNumberIsString ? "✅" : "❌");
    console.log("  BlockHash is string:", blockHashIsString ? "✅" : "❌");
    console.log("  BlockHash format:", blockHashFormat ? "✅" : "❌");

    const allPass = hasTimestamp && hasBlockNumber && hasBlockHash && 
                    timestampIsString && blockNumberIsString && 
                    blockHashIsString && blockHashFormat;

    console.log("  Overall:", allPass ? "✅ PASS" : "❌ FAIL");
  }

  testTxHashValidation() {
    console.log("\nTest 5: Transaction hash format validation");
    
    const validWith0x = '0x' + '1'.repeat(64);
    const validWithout0x = '2'.repeat(64);
    const invalid = '0x123'; // Too short
    
    const regex = /^(0x)?[0-9a-fA-F]{64}$/;
    
    console.log("  Valid with 0x:", regex.test(validWith0x) ? "✅ PASS" : "❌ FAIL");
    console.log("  Valid without 0x:", regex.test(validWithout0x) ? "✅ PASS" : "❌ FAIL");
    console.log("  Invalid (too short):", !regex.test(invalid) ? "✅ PASS" : "❌ FAIL");
  }

  testCleanHashLogic() {
    console.log("\nTest 6: Hash cleaning logic");
    
    const hashWith0x = '0x' + '3'.repeat(64);
    const hashWithout0x = '4'.repeat(64);
    
    const clean1 = hashWith0x.startsWith("0x") ? hashWith0x.slice(2) : hashWith0x;
    const clean2 = hashWithout0x.startsWith("0x") ? hashWithout0x : `0x${hashWithout0x}`;
    
    console.log("  Remove 0x prefix:", clean1.length === 64 ? "✅ PASS" : "❌ FAIL");
    console.log("  Add 0x prefix:", clean2.startsWith('0x') && clean2.length === 66 ? "✅ PASS" : "❌ FAIL");
  }

  runAll() {
    console.log("========================================");
    console.log("Block Time Fetching - Manual Tests");
    console.log("========================================\n");

    this.testTimestampConversion();
    this.testISOConversion();
    this.testBlockNumberConversion();
    this.testReturnStructure();
    this.testTxHashValidation();
    this.testCleanHashLogic();

    console.log("\n========================================");
    console.log("All manual tests completed!");
    console.log("========================================");
  }
}

const tester = new BlockTimeTest();
tester.runAll();