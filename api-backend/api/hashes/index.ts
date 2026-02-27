import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ckbService } from '../services/ckb.service.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS preflight
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { fileHash, timestamp } = req.body;

    if (!fileHash || !timestamp) {
      return res.status(400).json({ error: 'Missing fileHash or timestamp' });
    }

    console.log(`[API] Submit Hash ${fileHash}`);
    const result = await ckbService.submitHash({ fileHash, timestamp });

    return res.status(200).json(result);
  } catch (error: any) {
    console.error('[API] Submit Error:', error.message);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}