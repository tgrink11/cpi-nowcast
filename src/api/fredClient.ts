const isDev = import.meta.env.DEV;

interface FredObservation {
  date: string;
  value: string;
}

interface FredResponse {
  observations?: FredObservation[];
  error_code?: number;
  error_message?: string;
}

function buildUrl(seriesId: string, startDate: string, endDate: string): string {
  if (isDev) {
    // Dev: use Vite proxy to avoid CORS
    const params = new URLSearchParams({
      series_id: seriesId,
      api_key: import.meta.env.VITE_FRED_API_KEY,
      file_type: 'json',
      observation_start: startDate,
      observation_end: endDate,
      sort_order: 'asc',
    });
    return `/fred-api/fred/series/observations?${params}`;
  } else {
    // Production: use Vercel serverless function
    const params = new URLSearchParams({
      series_id: seriesId,
      observation_start: startDate,
      observation_end: endDate,
    });
    return `/api/fred?${params}`;
  }
}

export async function fetchFredSeries(
  seriesId: string,
  startDate: string,
  endDate: string,
  signal?: AbortSignal
): Promise<{ date: string; value: number }[]> {
  const url = buildUrl(seriesId, startDate, endDate);

  // FRED sometimes returns 500/503 status but still includes valid JSON data.
  // Always try to parse the response body regardless of HTTP status code.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { signal });
      const json: FredResponse = await res.json();

      if (json.observations && json.observations.length > 0) {
        return json.observations
          .filter((o) => o.value !== '.')
          .map((o) => ({
            date: o.date,
            value: parseFloat(o.value),
          }));
      }

      if (json.error_message) {
        throw new Error(`FRED error for ${seriesId}: ${json.error_message}`);
      }

      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
        continue;
      }
      return [];
    } catch (err) {
      if (signal?.aborted) throw err;
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }

  return [];
}
