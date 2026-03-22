const isDev = import.meta.env.DEV;

interface FmpEconomicData {
  date: string;
  value: number;
}

interface FmpQuote {
  symbol: string;
  price: number;
  yearHigh: number;
  yearLow: number;
  priceAvg50: number;
  priceAvg200: number;
}

export async function fetchFmpEconomicIndicator(
  indicator: string,
  signal?: AbortSignal
): Promise<{ date: string; value: number }[]> {
  let url: string;
  if (isDev) {
    const apiKey = import.meta.env.VITE_FMP_API_KEY;
    url = `/fmp-api-v4/economic?name=${encodeURIComponent(indicator)}&apikey=${apiKey}`;
  } else {
    url = `/api/fmp?endpoint=economic&name=${encodeURIComponent(indicator)}`;
  }

  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new Error(`FMP API error for ${indicator}: ${res.status}`);
  }

  const json: FmpEconomicData[] = await res.json();
  return json
    .filter((d) => d.value != null)
    .map((d) => ({ date: d.date, value: d.value }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Fetch real-time quote for a commodity symbol (e.g., BZUSD for Brent).
 */
export async function fetchFmpQuote(
  symbol: string,
  signal?: AbortSignal
): Promise<FmpQuote | null> {
  let url: string;
  if (isDev) {
    const apiKey = import.meta.env.VITE_FMP_API_KEY;
    url = `/fmp-api-v3/quote/${encodeURIComponent(symbol)}?apikey=${apiKey}`;
  } else {
    url = `/api/fmp?endpoint=quote&symbol=${encodeURIComponent(symbol)}`;
  }

  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const json = await res.json();
    const data = Array.isArray(json) ? json[0] : json;
    if (!data?.price) return null;
    return data as FmpQuote;
  } catch {
    return null;
  }
}

export async function fetchFmpCommodityPrice(
  symbol: string,
  startDate: string,
  endDate: string,
  signal?: AbortSignal
): Promise<{ date: string; value: number }[]> {
  let url: string;
  if (isDev) {
    const apiKey = import.meta.env.VITE_FMP_API_KEY;
    url = `/fmp-api-v3/historical-price-full/${encodeURIComponent(symbol)}?from=${startDate}&to=${endDate}&apikey=${apiKey}`;
  } else {
    url = `/api/fmp?endpoint=historical&symbol=${encodeURIComponent(symbol)}&from=${startDate}&to=${endDate}`;
  }

  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return [];
    const json = await res.json();
    const historical: Array<{ date: string; close: number }> =
      json.historical ?? [];
    return historical
      .map((d) => ({ date: d.date, value: d.close }))
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch {
    return [];
  }
}
