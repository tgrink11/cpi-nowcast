const isDev = import.meta.env.DEV;

interface FmpEconomicData {
  date: string;
  value: number;
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
    // Not used in production yet — add serverless function if needed
    throw new Error('FMP commodity price not available in production');
  }

  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new Error(`FMP API error for ${symbol}: ${res.status}`);
  }

  const json = await res.json();
  const historical: Array<{ date: string; close: number }> =
    json.historical ?? [];

  return historical
    .map((d) => ({ date: d.date, value: d.close }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
