import React, { useState, useRef } from 'react';
import { hashFile, getCurrentISOTimestamp } from '../utils/hash';
import { api } from '../services/api';

export const SubmitPage = () => {
  const [status, setStatus] = useState<'idle' | 'hashing' | 'submitting' | 'success' | 'error'>('idle');
  const [txHash, setTxHash] = useState<string>('');
  const [error, setError] = useState<string>('');
  
  // Create a reference to the input to reset it
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset state for new attempt
    setError('');
    setTxHash('');

    try {
      setStatus('hashing');
      const hash = await hashFile(file);
      const timestamp = getCurrentISOTimestamp();
      
      setStatus('submitting');
      const result = await api.submitHash(hash, timestamp);
      
      setTxHash(result.txHash);
      setStatus('success');
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to process file. Is the backend running?');
      setStatus('error');
    } finally {
      // Allow re-selecting the same file if needed
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="max-w-lg mx-auto bg-white p-8 rounded-xl shadow-lg border border-gray-100 mt-10">
      <h2 className="text-2xl font-bold mb-2">Anchor a File</h2>
      <p className="text-gray-500 mb-6">Secure a file's integrity on the Nervos Blockchain.</p>

      <div className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
        status === 'hashing' || status === 'submitting' ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:bg-gray-50'
      }`}>
        <input 
          type="file" 
          ref={fileInputRef}
          onChange={handleFileChange} 
          disabled={status === 'hashing' || status === 'submitting'}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
        />
      </div>

      {status === 'hashing' && <div className="mt-4 text-center text-blue-600 animate-pulse font-medium">Computing SHA-256...</div>}
      {status === 'submitting' && <div className="mt-4 text-center text-indigo-600 animate-pulse font-medium">Broadcasting to CKB...</div>}
      
      {status === 'success' && (
        <div className="mt-6 p-4 bg-green-50 text-green-800 rounded-md break-all border border-green-200">
          <p className="font-bold">✅ Success!</p>
          <p className="text-xs mt-1 font-mono">TX: {txHash}</p>
          <a 
            href={`https://pudge.explorer.nervos.org/transaction/${txHash}`} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-xs text-blue-600 underline mt-2 block font-semibold"
          >
            View on CKB Explorer
          </a>
        </div>
      )}

      {status === 'error' && (
        <div className="mt-6 p-4 bg-red-50 text-red-800 rounded-md border border-red-200">
          <p className="font-bold">❌ Error</p>
          <p className="text-sm">{error}</p>
        </div>
      )}
    </div>
  );
};