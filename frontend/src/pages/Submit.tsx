import React, { useState, useEffect, useRef } from "react";
import { ccc } from "@ckb-ccc/core";
import { useCcc } from "@ckb-ccc/connector-react";
import { hashFile } from "../utils/hash";
import { api } from "../services/api";

type SubmitStatus = "idle" | "hashing" | "signing" | "broadcasting" | "success" | "error";

export const SubmitPage = () => {
  const { signerInfo, open } = useCcc();
  const signer = signerInfo?.signer ?? null;

  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [walletAddress, setWalletAddress] = useState("");
  const [txHash, setTxHash] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isBusy = status === "hashing" || status === "signing" || status === "broadcasting";

  useEffect(() => {
    if (!signer) { setWalletAddress(""); return; }
    signer.getRecommendedAddress().then(setWalletAddress).catch(() => {});
  }, [signer]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !signer) return;

    setError("");
    setTxHash("");

    try {
      // Step 1: hash the file locally — file contents never leave the device
      setStatus("hashing");
      const fileHash = await hashFile(file);

      // Step 2: resolve user address so backend locks the cell to them
      const userAddress = await signer.getRecommendedAddress();

      // Step 3: backend builds unsigned tx with server-generated timestamp
      const partialTx = await api.buildUnsignedTx(fileHash, userAddress);
      const tx = ccc.Transaction.from(partialTx);

      // Step 4: user wallet fills inputs, pays fees, signs
      setStatus("signing");
      await tx.completeInputsByCapacity(signer);
      await tx.completeFeeBy(signer, 1000);
      const signedTx = await signer.signTransaction(tx);

      // Step 5: broadcast — server wallet not involved
      setStatus("broadcasting");
      const hash = await signer.client.sendTransaction(signedTx);

      setTxHash(hash);
      setStatus("success");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to anchor file. Is your wallet connected?");
      setStatus("error");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="max-w-lg mx-auto bg-white p-8 rounded-xl shadow-lg border border-gray-100 mt-10">
      <h2 className="text-2xl font-bold mb-2">Anchor a File</h2>
      <p className="text-gray-500 mb-6">Secure a file's integrity on the Nervos Blockchain.</p>

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
          className="w-full mb-6 py-3 px-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
        >
          Connect Wallet to Continue
        </button>
      )}

      <div className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
        isBusy ? "border-blue-400 bg-blue-50"
        : !signer ? "border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed"
        : "border-gray-300 hover:bg-gray-50"
      }`}>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          disabled={isBusy || !signer}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
        />
        {!signer && <p className="text-xs text-gray-400 mt-3">Connect your wallet first</p>}
      </div>

      {status === "hashing" && <StatusPulse color="blue" text="Computing SHA-256 hash…" />}
      {status === "signing" && <StatusPulse color="indigo" text="Waiting for wallet signature…" />}
      {status === "broadcasting" && <StatusPulse color="indigo" text="Broadcasting to CKB…" />}

      {status === "success" && (
        <div className="mt-6 p-4 bg-green-50 text-green-800 rounded-md break-all border border-green-200">
          <p className="font-bold">✅ Anchored on-chain!</p>
          <p className="text-xs mt-1 font-mono">TX: {txHash}</p>
          <a
            href={`https://pudge.explorer.nervos.org/transaction/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 underline mt-2 block font-semibold"
          >
            View on CKB Explorer →
          </a>
        </div>
      )}

      {status === "error" && (
        <div className="mt-6 p-4 bg-red-50 text-red-800 rounded-md border border-red-200">
          <p className="font-bold">❌ Error</p>
          <p className="text-sm">{error}</p>
        </div>
      )}
    </div>
  );
};

const StatusPulse = ({ color, text }: { color: string; text: string }) => (
  <div className={`mt-4 text-center text-${color}-600 animate-pulse font-medium`}>{text}</div>
);
