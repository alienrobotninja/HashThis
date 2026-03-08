import React, { useState } from 'react';
import { downloadProofJson, copyProofToClipboard } from '../utils/proofExport';
import type { CertificateData } from '../utils/pdfGenerator';

interface ExportProofButtonProps {
  data: CertificateData;
  /** Compact pill mode for History rows */
  compact?: boolean;
  className?: string;
}

type CopyState = 'idle' | 'copied' | 'failed';

export const ExportProofButton: React.FC<ExportProofButtonProps> = ({
  data,
  compact = false,
  className = '',
}) => {
  const [copyState, setCopyState] = useState<CopyState>('idle');
  const [menuOpen, setMenuOpen] = useState(false);

  const handleDownload = () => {
    downloadProofJson(data);
    setMenuOpen(false);
  };

  const handleCopy = async () => {
    const ok = await copyProofToClipboard(data);
    setCopyState(ok ? 'copied' : 'failed');
    setMenuOpen(false);
    setTimeout(() => setCopyState('idle'), 2500);
  };

  const buttonLabel =
    copyState === 'copied' ? '✅ Copied!' :
    copyState === 'failed' ? '❌ Copy failed' :
    compact ? '{}  Export' : '{ } Export Proof';

  const buttonClass = `
    inline-flex items-center gap-1.5 font-medium transition-all duration-200
    ${compact
      ? 'text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200'
      : 'text-sm px-4 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300 shadow-sm'}
    ${copyState === 'copied' ? '!bg-green-50 !text-green-700 !border-green-200' : ''}
    ${copyState === 'failed' ? '!bg-red-50 !text-red-600 !border-red-200' : ''}
    ${className}
  `;

  return (
    <div className="relative inline-block">
      {/* Main toggle button */}
      <button
        onClick={() => copyState === 'idle' ? setMenuOpen(v => !v) : undefined}
        className={buttonClass}
        title="Export proof as JSON"
      >
        {buttonLabel}
      </button>

      {/* Dropdown */}
      {menuOpen && copyState === 'idle' && (
        <>
          {/* Click-away overlay */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute z-20 mt-1 left-0 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[170px]">
            <button
              onClick={handleDownload}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            >
              <span>⬇</span> Download .json
            </button>
            <button
              onClick={handleCopy}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            >
              <span>📋</span> Copy to clipboard
            </button>
          </div>
        </>
      )}
    </div>
  );
};