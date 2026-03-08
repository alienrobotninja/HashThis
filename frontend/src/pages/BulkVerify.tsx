import { useState, useRef } from 'react';
import { useCcc } from '@ckb-ccc/connector-react';
import { hashFile } from '../utils/hash';
import { api } from '../services/api';
import {
  downloadCsv,
  summariseResults,
  type BulkVerifyResult,
} from '../utils/csvExport';

type PageStatus = 'idle' | 'processing' | 'done';

const TESTNET_EXPLORER = 'https://pudge.explorer.nervos.org/transaction';

export const BulkVerifyPage = () => {
  const { signerInfo, open } = useCcc();
  const signer = signerInfo?.signer ?? null;

  const [pageStatus, setPageStatus]   = useState<PageStatus>('idle');
  const [walletAddress, setWalletAddress] = useState('');
  const [results, setResults]         = useState<BulkVerifyResult[]>([]);
  const [progress, setProgress]       = useState({ current: 0, total: 0 });
  const [currentFile, setCurrentFile] = useState('');
  const abortRef                      = useRef(false);
  const fileInputRef                  = useRef<HTMLInputElement>(null);

  // Resolve wallet address
  useState(() => {
    if (!signer) { setWalletAddress(''); return; }
    signer.getRecommendedAddress().then(setWalletAddress).catch(() => {});
  });

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length || !signer) return;

    abortRef.current = false;
    setResults([]);
    setPageStatus('processing');
    setProgress({ current: 0, total: files.length });

    const userAddress = await signer.getRecommendedAddress();
    setWalletAddress(userAddress);

    const collected: BulkVerifyResult[] = [];

    for (let i = 0; i < files.length; i++) {
      if (abortRef.current) break;

      const file = files[i];
      setCurrentFile(file.name);
      setProgress({ current: i + 1, total: files.length });

      let result: BulkVerifyResult = {
        fileName:     file.name,
        fileHash:     '',
        status:       'error',
        txHash:       '',
        blockNumber:  '',
        timestamp:    '',
        errorMessage: '',
      };

      try {
        const hash = await hashFile(file);
        result.fileHash = hash;

        const data = await api.verifyHash(hash, userAddress);

        if (!data) {
          result.status = 'not_found';
        } else {
          result.txHash      = data.txHash   || '';
          result.blockNumber = data.blockNumber || '';

          // Best-effort block timestamp — non-fatal if unavailable
          if (data.txHash) {
            try {
              const blockInfo = await api.getBlockTime(data.txHash);
              result.timestamp    = blockInfo.timestamp;
              result.blockNumber  = blockInfo.blockNumber;
            } catch {
              // Proof valid — timestamp just not yet confirmed
            }
          }

          result.status = 'verified';
        }
      } catch (err: any) {
        result.status       = 'error';
        result.errorMessage = err.message || 'Unknown error';
      }

      collected.push(result);
      // Update results incrementally so the table fills in real-time
      setResults([...collected]);
    }

    setPageStatus('done');
    setCurrentFile('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAbort = () => { abortRef.current = true; };

  const handleReset = () => {
    setResults([]);
    setPageStatus('idle');
    setProgress({ current: 0, total: 0 });
    abortRef.current = false;
  };

  const summary = summariseResults(results);
  const isProcessing = pageStatus === 'processing';

  const statusBadge = (status: BulkVerifyResult['status']) => {
    if (status === 'verified')  return <span className="text-xs font-medium bg-green-100 text-green-700 px-2 py-0.5 rounded-full">✓ Verified</span>;
    if (status === 'not_found') return <span className="text-xs font-medium bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">— Not found</span>;
    return                              <span className="text-xs font-medium bg-red-100 text-red-600 px-2 py-0.5 rounded-full">✕ Error</span>;
  };

  // ── Wallet gate ───────────────────────────────────────────────────────────
  if (!signer) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <div className="text-6xl mb-4">📦</div>
        <h1 className="text-3xl font-bold mb-3">Bulk Verify</h1>
        <p className="text-gray-600 mb-8">
          Upload multiple files to verify their on-chain proofs at once.
          Results can be exported as CSV for audits and compliance.
        </p>
        <button
          onClick={open}
          className="bg-indigo-600 text-white px-8 py-3 rounded-full font-bold shadow-lg hover:bg-indigo-700 transition-transform hover:-translate-y-1"
        >
          Connect Wallet
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-1">Bulk Verify</h1>
        <p className="text-gray-500 text-sm">
          Select multiple files to check their on-chain proofs simultaneously.
        </p>
        <p className="text-xs font-mono text-gray-400 mt-1 break-all">{walletAddress}</p>
      </div>

      {/* Upload area */}
      {pageStatus === 'idle' && (
        <div className="border-2 border-dashed border-indigo-200 rounded-xl p-10 text-center bg-indigo-50 hover:border-indigo-400 transition-colors mb-6">
          <p className="text-4xl mb-3">📂</p>
          <p className="text-gray-600 mb-4">
            Select all files you want to verify at once
          </p>
          <label className="cursor-pointer inline-block bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-indigo-700 transition-colors">
            Choose Files
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFiles}
              className="hidden"
            />
          </label>
          <p className="text-xs text-gray-400 mt-3">
            Files are hashed locally — contents never leave your device
          </p>
        </div>
      )}

      {/* Progress bar */}
      {isProcessing && (
        <div className="mb-6 bg-white border border-indigo-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-indigo-700">
              Verifying {progress.current} of {progress.total}…
            </span>
            <button
              onClick={handleAbort}
              className="text-xs text-red-500 hover:text-red-700 font-medium"
            >
              Cancel
            </button>
          </div>
          <div className="w-full bg-indigo-100 rounded-full h-2 mb-2">
            <div
              className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
          {currentFile && (
            <p className="text-xs text-gray-500 truncate">
              Processing: {currentFile}
            </p>
          )}
        </div>
      )}

      {/* Summary bar */}
      {results.length > 0 && (
        <div className="mb-4 bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-4 text-sm">
            <span><span className="font-bold text-gray-800">{summary.total}</span> <span className="text-gray-500">total</span></span>
            <span><span className="font-bold text-green-600">{summary.verified}</span> <span className="text-gray-500">verified</span></span>
            <span><span className="font-bold text-gray-400">{summary.notFound}</span> <span className="text-gray-500">not found</span></span>
            {summary.errors > 0 && (
              <span><span className="font-bold text-red-500">{summary.errors}</span> <span className="text-gray-500">errors</span></span>
            )}
          </div>

          {pageStatus === 'done' && (
            <div className="flex gap-2">
              <button
                onClick={() => downloadCsv(results)}
                className="inline-flex items-center gap-1.5 text-sm font-medium px-4 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
              >
                ⬇ Export CSV
              </button>
              <button
                onClick={handleReset}
                className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-gray-300"
              >
                ↺ New batch
              </button>
            </div>
          )}
        </div>
      )}

      {/* Results table */}
      {results.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-left">
                <th className="px-4 py-3 font-semibold text-gray-600 w-8">#</th>
                <th className="px-4 py-3 font-semibold text-gray-600">File</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Status</th>
                <th className="px-4 py-3 font-semibold text-gray-600 hidden md:table-cell">Block</th>
                <th className="px-4 py-3 font-semibold text-gray-600 hidden lg:table-cell">Timestamp</th>
                <th className="px-4 py-3 font-semibold text-gray-600 hidden lg:table-cell">Tx</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {results.map((r, i) => (
                <tr key={i} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800 truncate max-w-[180px]" title={r.fileName}>
                      {r.fileName}
                    </p>
                    <p className="font-mono text-xs text-gray-400 truncate max-w-[180px]" title={r.fileHash}>
                      {r.fileHash ? `${r.fileHash.slice(0, 14)}…` : '—'}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    {statusBadge(r.status)}
                    {r.status === 'error' && r.errorMessage && (
                      <p className="text-xs text-red-500 mt-0.5">{r.errorMessage}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell font-mono text-xs text-gray-600">
                    {r.blockNumber ? `#${r.blockNumber}` : '—'}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-xs text-gray-600">
                    {r.timestamp
                      ? new Date(r.timestamp).toLocaleString()
                      : r.status === 'verified'
                        ? <span className="italic text-gray-400">Confirming…</span>
                        : '—'}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {r.txHash
                      ? (
                        <a
                          href={`${TESTNET_EXPLORER}/${r.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-xs text-blue-500 hover:text-blue-700"
                          title={r.txHash}
                        >
                          {r.txHash.slice(0, 10)}…↗
                        </a>
                      )
                      : <span className="text-gray-300">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};