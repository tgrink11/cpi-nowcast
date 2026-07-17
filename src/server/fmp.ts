import type { CommodityObservation } from '../types/cpiNowcast';
import { fetchJsonWithRetry } from './http.js';

/**
 * FMP data via the current `/stable` API surface (the legacy /api/v3 and
 * /api/v4 paths are deprecated). Used to supplement FRED's lagged Brent
 * series with a real-time quote plus recent daily closes.
 */

interface FmpQuote {
  symbol: string;
  price: number;
}

/** Real-time commodity quote, e.g. BZUSD (Brent). Null on any failure. */
export async function fetchFmpQuote(
  symbol: string,
  apiKey: string,
  signal?: AbortSignal
): Promise<{ price: number } | null> {
  const url = `https://financialmodelingprep.com/stable/quote?symbol=${encodeURIComponent(
    symbol
  )}&apikey=${apiKey}`;
  try {
    const json = await fetchJsonWithRetry<FmpQuote[] | FmpQuote>(url, { signal });
    const data = Array.isArray(json) ? json[0] : json;
    if (!data?.price) return null;
    return { price: data.price };
  } catch {
    return null;
  }
}

interface FmpEodRow {
  date: string;
  close: number;
}

/**
 * Recent daily end-of-day closes for a commodity symbol. Returns [] on
 * failure so a missing FMP response never breaks the snapshot.
 */
export async function fetchFmpHistory(
  symbol: string,
  from: string,
  to: string,
  apiKey: string,
  signal?: AbortSignal
): Promise<CommodityObservation[]> {
  const url =
    `https://financialmodelingprep.com/stable/historical-price-eod/full` +
    `?symbol=${encodeURIComponent(symbol)}&from=${from}&to=${to}&apikey=${apiKey}`;
  try {
    // Stable returns a flat array of EOD rows (newest first).
    const json = await fetchJsonWithRetry<FmpEodRow[]>(url, { signal });
    if (!Array.isArray(json)) return [];
    return json
      .filter((d) => d && d.date != null && d.close != null)
      .map((d) => ({ date: d.date, value: d.close }))
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch {
    return [];
  }
}
