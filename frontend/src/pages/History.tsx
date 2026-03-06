import React, { useState, useEffect } from "react";
import { useCcc } from "@ckb-ccc/connector-react";
import { api } from "../services/api";

interface Proof {
  fileHash: string;
  txHash: string;
  blockNumber: string;
  // resolved after fetching block time
  timestamp?: string;
}

type HistoryStatus = "idle" | "loading" | "loaded" | "error";

const TESTNET_EXPLORER = "https://pudge.explorer.nervos.org/transaction";

export const HistoryPage = () => {
  const { signerInfo, open } = useCcc();
  const signer = signerInfo?.signer ?? null;

  const [status, setStatus] = useState<HistoryStatus>("idle");
  const [walletAddress, setWalletAddress] = useState("");
  const [proofs, setProofs] = useState<Proof[]>([]);
  const [error, setError] = useState("");
  const [filterDate, setFilterDate] = useState("");

  // Resolve wallet address whenever signer changes
  useEffect(() => {
    if (!signer) {
      setWalletAddress("");
      setProofs([]);
      setStatus("idle");
      return;
    }
    signer
      .getRecommendedAddress()
      .then((addr) => {
        setWalletAddress(addr);
      })
      .catch(() => {});
  }, [signer]);

  // Auto-load history once we have an address
  useEffect(() => {
    if (!walletAddress) return;
    loadHistory(walletAddress);
  }, [walletAddress]);

  const loadHistory = async (address: string) => {
    setStatus("loading");
    setError("");
    try {
      const { proofs: fetched } = await api.getUserProofs(address);
      setProofs(fetched);
      setStatus("loaded");
    } catch (err: any) {
      setError(err.message || "Failed to load proof history");
      setStatus("error");
    }
  };

  // Fetch block timestamp for a single proof lazily
  const fetchTimestamp = async (index: number, txHash: string) => {
    if (!txHash || proofs[index].timestamp) return;
    try {
      const { timestamp } = await api.getBlockTime(txHash);
      setProofs((prev) =>
        prev.map((p, i) => (i === index ? { ...p, timestamp } : p))
      );
    } catch {
      // Silently skip — block time is a nice-to-have
    }
  };

  // Filter by date
  const filteredProofs = filterDate
    ? proofs.filter((p) => p.timestamp?.startsWith(filterDate))
    : proofs;

  const shortHash = (hash: string) =>
    hash ? `${hash.slice(0, 10)}…${hash.slice(-8)}` : "—";

  // ── Wallet not connected ────────────────────────────────────────────────
  if (!signer) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <div className="text-6xl mb-4">📜</div>
        <h1 className="text-3xl font-bold mb-3">Proof History</h1>
        <p className="text-gray-600 mb-8">
          Connect your wallet to view all files you've anchored on-chain.
        </p>
        <button
          onClick={open}
          className="bg-blue-600 text-white px-8 py-3 rounded-full font-bold shadow-lg hover:bg-blue-700 transition-transform hover:-translate-y-1"
        >
          Connect Wallet
        </button>
      </div>
    );
  }

  // ── Loading ─────────────────────────────────────────────────────────────
  if (status === "loading") {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <div className="animate-spin text-5xl mb-4">⏳</div>
        <p className="text-gray-600 text-lg">Scanning blockchain for your proofs…</p>
        <p className="text-gray-400 text-sm mt-2 font-mono break-all">
          {walletAddress}
        </p>
      </div>
    );
  }

  // ── Error ───────────────────────────────────────────────────────────────
  if (status === "error") {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <div className="text-5xl mb-4">❌</div>
        <h2 className="text-xl font-bold text-red-600 mb-2">Failed to load history</h2>
        <p className="text-gray-600 mb-6">{error}</p>
        <button
          onClick={() => loadHistory(walletAddress)}
          className="bg-blue-600 text-white px-6 py-2 rounded-full hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  // ── Loaded ──────────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1">Proof History</h1>
        <p className="text-gray-500 text-sm font-mono break-all">{walletAddress}</p>
      </div>

      {/* Stats bar */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-4 mb-6 flex items-center justify-between">
        <div>
          <span className="text-2xl font-bold text-blue-700">{proofs.length}</span>
          <span className="text-gray-600 ml-2">
            {proofs.length === 1 ? "proof" : "proofs"} anchored
          </span>
        </div>
        <button
          onClick={() => loadHistory(walletAddress)}
          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Date filter */}
      {proofs.length > 0 && (
        <div className="mb-4 flex items-center gap-3">
          <label className="text-sm text-gray-600 font-medium">Filter by date:</label>
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1 text-sm"
          />
          {filterDate && (
            <button
              onClick={() => setFilterDate("")}
              className="text-xs text-gray-500 hover:text-gray-800"
            >
              ✕ Clear
            </button>
          )}
        </div>
      )}

      {/* Empty state */}
      {proofs.length === 0 && status === "loaded" && (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-xl">
          <div className="text-5xl mb-3">🔍</div>
          <p className="text-gray-500 text-lg">No proofs found for this wallet.</p>
          <p className="text-gray-400 text-sm mt-1">
            Anchor your first file on the{" "}
            <a href="/submit" className="text-blue-600 hover:underline">
              Submit page
            </a>
            .
          </p>
        </div>
      )}

      {/* Proof list */}
      <div className="space-y-3">
        {filteredProofs.map((proof, i) => (
          <div
            key={proof.txHash || i}
            className="bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-sm transition-all"
          >
            <div className="flex items-start justify-between gap-4">
              {/* Left: hash info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                    ✓ Anchored
                  </span>
                  <span className="text-xs text-gray-400">Block #{proof.blockNumber}</span>
                </div>

                <p className="text-xs text-gray-500 mb-0.5">File Hash</p>
                <p className="font-mono text-sm text-gray-800 truncate">{proof.fileHash}</p>

                <p className="text-xs text-gray-500 mt-2 mb-0.5">Transaction</p>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm text-blue-600">
                    {shortHash(proof.txHash)}
                  </span>
                  {proof.txHash && (
                    <a
                      href={`${TESTNET_EXPLORER}/${proof.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-500 hover:text-blue-700"
                    >
                      ↗ Explorer
                    </a>
                  )}
                </div>
              </div>

              {/* Right: timestamp */}
              <div className="text-right shrink-0">
                {proof.timestamp ? (
                  <>
                    <p className="text-xs text-gray-400">Block time</p>
                    <p className="text-sm font-medium text-gray-700">
                      {new Date(proof.timestamp).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(proof.timestamp).toLocaleTimeString()}
                    </p>
                  </>
                ) : (
                  <button
                    onClick={() => fetchTimestamp(i, proof.txHash)}
                    className="text-xs text-blue-500 hover:text-blue-700 underline"
                  >
                    Load time
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredProofs.length === 0 && filterDate && (
        <p className="text-center text-gray-400 py-8">
          No proofs found for {filterDate}.
        </p>
      )}
    </div>
  );
};