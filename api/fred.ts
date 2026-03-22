import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { series_id, observation_start, observation_end } = req.query;
  const apiKey = process.env.FRED_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'FRED_API_KEY not configured' });
  }

  const params = new URLSearchParams({
    series_id: String(series_id),
    api_key: apiKey,
    file_type: 'json',
    observation_start: String(observation_start),
    observation_end: String(observation_end),
    sort_order: 'asc',
  });

  try {
    const response = await fetch(
      `https://api.stlouisfed.org/fred/series/observations?${params}`
    );
    const data = await response.json();
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch from FRED' });
  }
}
