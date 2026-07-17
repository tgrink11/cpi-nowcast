import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildSnapshot } from '../src/server/buildSnapshot.js';

/**
 * Precomputed daily CPI-nowcast snapshot. All heavy work (FRED + FMP + the
 * Cleveland Fed anchor + the engine + accuracy scoring) happens here, once,
 * server-side. The response is cached at the Vercel edge so every visitor in
 * the window shares one computation instead of each browser hammering the
 * upstream APIs. A daily cron (see vercel.json) warms this after the Cleveland
 * Fed's ~10am ET update.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const fredKey = process.env.FRED_API_KEY ?? process.env.VITE_FRED_API_KEY;
  const fmpKey = process.env.FMP_API_KEY ?? process.env.VITE_FMP_API_KEY;

  if (!fredKey || !fmpKey) {
    return res
      .status(500)
      .json({ error: 'FRED_API_KEY / FMP_API_KEY not configured' });
  }

  try {
    const snapshot = await buildSnapshot({ fredKey, fmpKey });
    // Fresh for 6h, then serve stale for up to a day while revalidating. This
    // is also our resilience layer: if a later refresh fails upstream, the
    // last good snapshot keeps serving.
    res.setHeader(
      'Cache-Control',
      's-maxage=21600, stale-while-revalidate=86400'
    );
    return res.status(200).json(snapshot);
  } catch (err) {
    return res.status(502).json({
      error: err instanceof Error ? err.message : 'Failed to build snapshot',
    });
  }
}
