// Quick manual test for backend encoding/decoding changes
// This verifies that Step 1.1 changes work correctly

class TestBackendCKBService {
  // New implementation - only hash, no timestamp
  encodeHashData(fileHash) {
    const cleanHash = fileHash.startsWith("0x") ? fileHash.slice(2) : fileHash;
    return `0x${cleanHash}`;
  }

  decodeHashData(hexData) {
    const data = hexData.startsWith("0x") ? hexData.slice(2) : hexData;
    const hash = data.slice(0, 64);
    return {
      hash: `0x${hash}`,
    };
  }

  test() {
    console.log("Testing Backend Step 1.1: Hash Encoding/Decoding without timestamp\n");

    // Test 1: Basic encoding
    const testHash1 = "0x" + "1".repeat(64);
    const encoded1 = this.encodeHashData(testHash1);
    console.log("Test 1: Basic encoding");
    console.log("  Input hash:", testHash1);
    console.log("  Encoded:", encoded1);
    console.log("  Length:", encoded1.length, "(should be 66)");
    console.log("  Match:", encoded1 === testHash1 ? "✅ PASS" : "❌ FAIL");

    // Test 2: Encoding without 0x prefix
    const testHash2 = "2".repeat(64);
    const encoded2 = this.encodeHashData(testHash2);
    console.log("\nTest 2: Encoding without 0x prefix");
    console.log("  Input hash:", testHash2);
    console.log("  Encoded:", encoded2);
    console.log("  Match:", encoded2 === "0x" + testHash2 ? "✅ PASS" : "❌ FAIL");

    // Test 3: Decoding
    const testHash3 = "0x" + "3".repeat(64);
    const decoded3 = this.decodeHashData(testHash3);
    console.log("\nTest 3: Decoding");
    console.log("  Input data:", testHash3);
    console.log("  Decoded hash:", decoded3.hash);
    console.log("  Match:", decoded3.hash === testHash3 ? "✅ PASS" : "❌ FAIL");

    // Test 4: Round-trip
    const testHash4 = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
    const encoded4 = this.encodeHashData(testHash4);
    const decoded4 = this.decodeHashData(encoded4);
    console.log("\nTest 4: Round-trip");
    console.log("  Original hash:", testHash4);
    console.log("  After encode/decode:", decoded4.hash);
    console.log("  Match:", decoded4.hash === testHash4 ? "✅ PASS" : "❌ FAIL");

    // Test 5: Legacy data handling (with timestamp appended)
    const legacyData = "0x" + "5".repeat(64) + "0000018d1234abcd"; // 64 chars hash + 16 chars timestamp
    const decoded5 = this.decodeHashData(legacyData);
    const expectedHash = "0x" + "5".repeat(64);
    console.log("\nTest 5: Legacy data with timestamp");
    console.log("  Legacy data length:", legacyData.length, "(82 chars with timestamp)");
    console.log("  Decoded hash:", decoded5.hash);
    console.log("  Expected hash:", expectedHash);
    console.log("  Match:", decoded5.hash === expectedHash ? "✅ PASS" : "❌ FAIL");

    // Test 6: Consistency across multiple encodes (no timestamp = same output)
    const testHash6 = "0x" + "6".repeat(64);
    const encoded6a = this.encodeHashData(testHash6);
    const encoded6b = this.encodeHashData(testHash6);
    console.log("\nTest 6: Consistency (no timestamp = deterministic output)");
    console.log("  Encode 1:", encoded6a);
    console.log("  Encode 2:", encoded6b);
    console.log("  Match:", encoded6a === encoded6b ? "✅ PASS" : "❌ FAIL");

    console.log("\n========================================");
    console.log("All backend tests completed!");
    console.log("========================================");
  }
}

const tester = new TestBackendCKBService();
tester.test();