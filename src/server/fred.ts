import type { CpiObservation } from '../types/cpiNowcast';
import { fetchJsonWithRetry } from './http';

interface FredObservation {
  date: string;
  value: string;
}
interface FredResponse {
  observations?: FredObservation[];
  error_message?: string;
}

/**
 * Fetch a FRED series server-side. Returns [] on failure (callers decide
 * whether an empty series is fatal). Keeps the key server-side.
 */
export async function fetchFredSeries(
  seriesId: string,
  startDate: string,
  endDate: string,
  apiKey: string,
  signal?: AbortSignal
): Promise<CpiObservation[]> {
  const params = new URLSearchParams({
    series_id: seriesId,
    api_key: apiKey,
    file_type: 'json',
    observation_start: startDate,
    observation_end: endDate,
    sort_order: 'asc',
  });
  const url = `https://api.stlouisfed.org/fred/series/observations?${params}`;

  const json = await fetchJsonWithRetry<FredResponse>(url, { signal });
  if (!json.observations || json.observations.length === 0) {
    throw new Error(
      `FRED returned no observations for ${seriesId}: ${json.error_message ?? 'empty'}`
    );
  }
  return json.observations
    .filter((o) => o.value !== '.')
    .map((o) => ({ date: o.date, value: parseFloat(o.value) }));
}
