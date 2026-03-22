import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { endpoint, name } = req.query;
  const apiKey = process.env.FMP_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'FMP_API_KEY not configured' });
  }

  let url: string;
  if (endpoint === 'economic') {
    url = `https://financialmodelingprep.com/api/v4/economic?name=${encodeURIComponent(String(name))}&apikey=${apiKey}`;
  } else {
    return res.status(400).json({ error: 'Unknown endpoint' });
  }

  try {
    const response = await fetch(url);
    const data = await response.json();
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch from FMP' });
  }
}
