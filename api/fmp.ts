import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { endpoint, name, symbol, from, to } = req.query;
  const apiKey = process.env.FMP_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'FMP_API_KEY not configured' });
  }

  let url: string;
  if (endpoint === 'economic') {
    url = `https://financialmodelingprep.com/api/v4/economic?name=${encodeURIComponent(String(name))}&apikey=${apiKey}`;
  } else if (endpoint === 'quote') {
    url = `https://financialmodelingprep.com/api/v3/quote/${encodeURIComponent(String(symbol))}?apikey=${apiKey}`;
  } else if (endpoint === 'historical') {
    url = `https://financialmodelingprep.com/api/v3/historical-price-full/${encodeURIComponent(String(symbol))}?from=${from}&to=${to}&apikey=${apiKey}`;
  } else {
    return res.status(400).json({ error: 'Unknown endpoint' });
  }

  try {
    const response = await fetch(url);
    const data = await response.json();
    // Short cache for real-time quotes, longer for historical
    const maxAge = endpoint === 'quote' ? 300 : 3600;
    res.setHeader('Cache-Control', `s-maxage=${maxAge}, stale-while-revalidate`);
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch from FMP' });
  }
}
