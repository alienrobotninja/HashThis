import React, { useState } from 'react';
import { generateCertificate, type CertificateData } from '../utils/pdfGenerator';

interface CertificateButtonProps {
  data: CertificateData;
  /** Compact icon-only mode for use inside tables / history rows */
  compact?: boolean;
  className?: string;
}

type ButtonState = 'idle' | 'generating' | 'success' | 'error';

export const CertificateButton: React.FC<CertificateButtonProps> = ({
  data,
  compact = false,
  className = '',
}) => {
  const [state, setState] = useState<ButtonState>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleClick = async () => {
    if (state === 'generating') return;

    setState('generating');
    setErrorMsg('');

    try {
      await generateCertificate(data);
      setState('success');
      // Reset back to idle after 2.5 s
      setTimeout(() => setState('idle'), 2500);
    } catch (err: any) {
      console.error('[Certificate] Generation failed:', err.message);
      setErrorMsg(err.message || 'Failed to generate certificate');
      setState('error');
      setTimeout(() => setState('idle'), 4000);
    }
  };

  // ── Compact variant (icon + short label, for History rows) ───────────────
  if (compact) {
    return (
      <div className="relative inline-flex flex-col items-center">
        <button
          onClick={handleClick}
          disabled={state === 'generating'}
          title={
            state === 'generating' ? 'Generating…'
            : state === 'success'   ? 'Downloaded!'
            : state === 'error'     ? errorMsg
            : 'Download PDF Certificate'
          }
          className={`
            inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full
            transition-all duration-200
            ${state === 'generating' ? 'bg-blue-50 text-blue-400 cursor-wait'
              : state === 'success'  ? 'bg-green-100 text-green-700'
              : state === 'error'    ? 'bg-red-100 text-red-600'
              : 'bg-blue-50 text-blue-600 hover:bg-blue-100 cursor-pointer'}
            ${className}
          `}
        >
          {state === 'generating' && <span className="animate-spin">⏳</span>}
          {state === 'success'    && <span>✅</span>}
          {state === 'error'      && <span>❌</span>}
          {state === 'idle'       && <span>📄</span>}
          <span>
            {state === 'generating' ? 'Generating…'
              : state === 'success' ? 'Downloaded!'
              : state === 'error'   ? 'Failed'
              : 'Certificate'}
          </span>
        </button>
        {state === 'error' && errorMsg && (
          <span className="absolute top-full mt-1 left-0 z-10 text-xs text-red-600 bg-white border border-red-200 rounded px-2 py-1 shadow-sm whitespace-nowrap max-w-xs">
            {errorMsg}
          </span>
        )}
      </div>
    );
  }

  // ── Full variant (for Submit / Verify success screens) ───────────────────
  return (
    <div className="flex flex-col items-start gap-1">
      <button
        onClick={handleClick}
        disabled={state === 'generating'}
        className={`
          inline-flex items-center gap-2 font-semibold text-sm px-5 py-2.5 rounded-lg
          border transition-all duration-200
          ${state === 'generating'
            ? 'bg-blue-50 border-blue-200 text-blue-400 cursor-wait'
            : state === 'success'
            ? 'bg-green-50 border-green-300 text-green-700'
            : state === 'error'
            ? 'bg-red-50 border-red-300 text-red-600'
            : 'bg-white border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-400 shadow-sm cursor-pointer'}
          ${className}
        `}
      >
        {state === 'generating' && (
          <>
            <span className="animate-spin inline-block">⏳</span>
            Generating certificate…
          </>
        )}
        {state === 'success' && <>✅ Certificate downloaded!</>}
        {state === 'error'   && <>❌ Generation failed</>}
        {state === 'idle'    && <>📄 Download PDF Certificate</>}
      </button>

      {state === 'error' && errorMsg && (
        <p className="text-xs text-red-600 ml-1">{errorMsg}</p>
      )}

      {state === 'idle' && (
        <p className="text-xs text-gray-400 ml-1">
          Includes QR code, block timestamp &amp; transaction hash
        </p>
      )}
    </div>
  );
};