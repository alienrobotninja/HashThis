import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ckbService } from './ckb.service.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS preflight
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Vercel extracts path parameter from URL
    const hash = req.query.hash as string;

    console.log('[API] Query params:', req.query);
    console.log('[API] Hash value:', hash);

    if (!hash) {
      return res.status(400).json({ error: 'Hash parameter is required' });
    }

    console.log(`[API] Verify Hash ${hash}`);
    const result = await ckbService.verifyHash(hash);

    if (!result) {
      return res.status(404).json({ message: 'Hash not found on chain' });
    }

    return res.status(200).json(result);
  } catch (error: any) {
    console.error('[API] Verify Error:', error.message);
    console.error('[API] Full error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}