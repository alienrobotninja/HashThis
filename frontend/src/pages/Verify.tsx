import React, { useState, useEffect, useRef } from "react";
import { useCcc } from "@ckb-ccc/connector-react";
import { hashFile } from "../utils/hash";
import { api } from "../services/api";
import { CertificateButton } from "../components/CertificateButton";
import { ExportProofButton } from "../components/ExportProofButton";

type VerifyStatus = "idle" | "hashing" | "checking" | "fetching_time" | "found" | "not_found" | "error";

export const VerifyPage = () => {
  const { signerInfo, open } = useCcc();
  const signer = signerInfo?.signer ?? null;

  const [status, setStatus] = useState<VerifyStatus>("idle");
  const [walletAddress, setWalletAddress] = useState("");
  const [result, setResult] = useState<any>(null);
  const [verifiedFileHash, setVerifiedFileHash] = useState("");
  const [verifiedFileName, setVerifiedFileName] = useState("");
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
    setVerifiedFileHash("");
    setVerifiedFileName("");
    setBlockTimestamp("");
    setBlockNumber("");

    try {
      // Hash the file locally
      const hash = await hashFile(file);
      setVerifiedFileHash(hash);
      setVerifiedFileName(file.name);
      const userAddress = await signer.getRecommendedAddress();

      setStatus("checking");

      // Pass userAddress so the backend knows which lock script to search
      const data = await api.verifyHash(hash, userAddress);

      if (data) {
        setResult(data);

        // Always set blockNumber from cell scan first so it is never blank
        setBlockNumber(data.blockNumber || "");

        // Try to enrich with authoritative block-header timestamp.
        // Own try/catch so a confirmation timeout never hides a valid proof.
        if (data.txHash) {
          setStatus("fetching_time");
          try {
            const blockInfo = await api.getBlockTime(data.txHash);
            setBlockTimestamp(blockInfo.timestamp);
            setBlockNumber(blockInfo.blockNumber);
          } catch {
            // Timestamp fetch failed (tx not yet confirmed on this node).
            // Proof is still valid — show cell blockNumber as fallback.
          }
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
                {blockTimestamp
                  ? new Date(blockTimestamp).toLocaleString()
                  : <span className="text-gray-400 italic text-xs">Awaiting confirmation</span>}
              </span>
            </div>

            <div className="flex justify-between items-start">
              <span className="text-gray-600">Block:</span>
              <span className="font-semibold font-mono">
                #{blockNumber || result.blockNumber || "—"}
              </span>
            </div>

            {!blockTimestamp && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                ⚠ Block timestamp unavailable — the transaction may still be confirming.
                The on-chain proof is valid regardless.
              </p>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-blue-200">
            <p className="text-xs text-gray-600 mb-3">
              ✓ File fingerprint matches on-chain record.
              {blockTimestamp && " This timestamp is cryptographically proven by the blockchain."}
            </p>
            <div className="flex flex-wrap gap-2 items-center">
              <CertificateButton
                data={{
                  fileHash: verifiedFileHash,
                  txHash: result?.txHash || "",
                  blockNumber: blockNumber || result?.blockNumber || "",
                  timestamp: blockTimestamp,
                  walletAddress,
                  fileName: verifiedFileName,
                }}
              />
              <ExportProofButton
                data={{
                  fileHash: verifiedFileHash,
                  txHash: result?.txHash || "",
                  blockNumber: blockNumber || result?.blockNumber || "",
                  timestamp: blockTimestamp,
                  walletAddress,
                  fileName: verifiedFileName,
                }}
              />
            </div>
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