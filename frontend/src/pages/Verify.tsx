import React, { useState, useEffect, useRef } from "react";
import { useCcc } from "@ckb-ccc/connector-react";
import { hashFile } from "../utils/hash";
import { api } from "../services/api";

type VerifyStatus = "idle" | "hashing" | "checking" | "fetching_time" | "found" | "not_found" | "error";

export const VerifyPage = () => {
  const { signerInfo, open } = useCcc();
  const signer = signerInfo?.signer ?? null;

  const [status, setStatus] = useState<VerifyStatus>("idle");
  const [walletAddress, setWalletAddress] = useState("");
  const [result, setResult] = useState<any>(null);
  const [blockTimestamp, setBlockTimestamp] = useState("");
  const [blockNumber, setBlockNumber] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isBusy = status === "hashing" || status === "checking" || status === "fetching_time";

  // Resolve connected wallet address
  useEffect(() => {
    if (!signer) { setWalletAddress(""); return; }
    signer.getRecommendedAddress().then(setWalletAddress).catch(() => {});
  }, [signer]);

  const handleVerifyFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !signer) return;

    setStatus("hashing");
    setError("");
    setResult(null);
    setBlockTimestamp("");
    setBlockNumber("");

    try {
      // Hash the file locally
      const hash = await hashFile(file);
      const userAddress = await signer.getRecommendedAddress();

      setStatus("checking");

      // Pass userAddress so the backend knows which lock script to search
      const data = await api.verifyHash(hash, userAddress);

      if (data) {
        setResult(data);
        
        // If we have a txHash, fetch the block timestamp
        if (data.txHash) {
          setStatus("fetching_time");
          const blockInfo = await api.getBlockTime(data.txHash);
          setBlockTimestamp(blockInfo.timestamp);
          setBlockNumber(blockInfo.blockNumber);
        } else {
          // Fallback: use blockNumber from cell if no txHash
          setBlockNumber(data.blockNumber || "unknown");
        }
        
        setStatus("found");
      } else {
        setStatus("not_found");
      }
    } catch (err: any) {
      console.error(err);
      setError("Verification service unavailable.");
      setStatus("error");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="max-w-lg mx-auto bg-white p-8 rounded-xl shadow-lg border border-gray-100 mt-10">
      <h2 className="text-2xl font-bold mb-2">Verify Integrity</h2>
      <p className="text-gray-500 mb-6">Upload a file to check if its original record exists on-chain.</p>

      {/* Wallet connection — needed to know which address to search */}
      {signer ? (
        <div className="flex items-center justify-between mb-6 p-3 bg-green-50 border border-green-200 rounded-lg">
          <span className="text-xs font-mono text-green-800 truncate">
            {walletAddress || "Resolving address…"}
          </span>
          <button onClick={open} className="ml-3 text-xs text-gray-500 hover:text-gray-700 shrink-0">
            Switch
          </button>
        </div>
      ) : (
        <button
          onClick={open}
          className="w-full mb-6 py-3 px-4 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Connect Wallet to Verify
        </button>
      )}

      <div className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
        isBusy ? "border-indigo-400 bg-indigo-50"
        : !signer ? "border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed"
        : "border-gray-300 hover:bg-gray-50"
      }`}>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleVerifyFile}
          disabled={isBusy || !signer}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed"
        />
        {!signer && <p className="text-xs text-gray-400 mt-3">Connect your wallet first</p>}
      </div>

      {status === "hashing" && <div className="mt-4 text-center text-blue-600 animate-pulse font-medium">Hashing file…</div>}
      {status === "checking" && <div className="mt-4 text-center text-indigo-600 animate-pulse font-medium">Searching CKB…</div>}
      {status === "fetching_time" && <div className="mt-4 text-center text-indigo-600 animate-pulse font-medium">Fetching block timestamp…</div>}

      {status === "found" && result && (
        <div className="mt-6 p-5 bg-blue-50 text-blue-900 rounded-lg border border-blue-200">
          <p className="font-bold text-lg mb-3">✅ Proof Verified</p>
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-start">
              <span className="text-gray-600">Anchored at:</span>
              <span className="font-semibold font-mono text-right">
                {blockTimestamp ? new Date(blockTimestamp).toLocaleString() : "—"}
              </span>
            </div>
            
            <div className="flex justify-between items-start">
              <span className="text-gray-600">Block:</span>
              <span className="font-semibold font-mono">#{blockNumber || result.blockNumber || "—"}</span>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-blue-200">
            <p className="text-xs text-gray-600">
              ✓ File fingerprint matches on-chain record.
              This timestamp is cryptographically proven by the blockchain.
            </p>
          </div>
        </div>
      )}

      {status === "not_found" && (
        <div className="mt-6 p-4 bg-gray-100 text-gray-600 rounded-md text-center">
          <p className="font-bold">❓ Not Found</p>
          <p className="text-sm">This file has no record on the blockchain.</p>
        </div>
      )}

      {status === "error" && (
        <div className="mt-6 p-4 bg-red-50 text-red-800 rounded-md">
          <p className="font-bold">⚠️ Error</p>
          <p className="text-sm">{error}</p>
        </div>
      )}
    </div>
  );
};