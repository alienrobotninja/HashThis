import React, { useState, useRef } from 'react';
import { hashFile } from '../utils/hash';
import { api } from '../services/api';

export const VerifyPage = () => {
  const [status, setStatus] = useState<'idle' | 'hashing' | 'checking' | 'found' | 'not_found' | 'error'>('idle');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleVerifyFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus('hashing');
    setError('');
    setResult(null);

    try {
      const hash = await hashFile(file);
      setStatus('checking');
      
      const data = await api.verifyHash(hash);
      
      if (data) {
        setResult(data);
        setStatus('found');
      } else {
        setStatus('not_found');
      }
    } catch (err: any) {
      console.error(err);
      setError('Verification service unavailable.');
      setStatus('error');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="max-w-lg mx-auto bg-white p-8 rounded-xl shadow-lg border border-gray-100 mt-10">
      <h2 className="text-2xl font-bold mb-2">Verify Integrity</h2>
      <p className="text-gray-500 mb-6">Upload a file to check if its original record exists on-chain.</p>

      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:bg-gray-50 transition-colors">
        <input 
          type="file" 
          ref={fileInputRef}
          onChange={handleVerifyFile}
          disabled={status === 'hashing' || status === 'checking'}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
        />
      </div>

      {status === 'hashing' && <div className="mt-4 text-center text-blue-600 animate-pulse">Hashing file...</div>}
      {status === 'checking' && <div className="mt-4 text-center text-indigo-600 animate-pulse">Searching CKB...</div>}

      {status === 'found' && result && (
        <div className="mt-6 p-4 bg-blue-50 text-blue-900 rounded-md border border-blue-200">
          <p className="font-bold mb-1 flex items-center">✅ Record Verified</p>
          <p className="text-sm font-medium">Anchored: {new Date(result.timestamp).toLocaleString()}</p>
          <p className="text-xs text-blue-700 mt-1 font-mono">Block: {result.blockNumber}</p>
        </div>
      )}

      {status === 'not_found' && (
        <div className="mt-6 p-4 bg-gray-100 text-gray-600 rounded-md text-center">
          <p className="font-bold">❓ Not Found</p>
          <p className="text-sm">This file has no record on the blockchain.</p>
        </div>
      )}

      {status === 'error' && (
        <div className="mt-6 p-4 bg-red-50 text-red-800 rounded-md">
          <p className="font-bold">⚠️ Error</p>
          <p className="text-sm">{error}</p>
        </div>
      )}
    </div>
  );
};