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

interface SeriesPoint {
  date: string;
  value: number;
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

// ---------- Last-known-good cache ----------
//
// FRED occasionally returns intermittent 500s (especially around CPI release
// time and during their nightly reindex). When that happens, the previous
// behavior was to either return [] or throw — both of which broke the whole
// nowcast load. We now persist the most recent successful series payload to
// localStorage, keyed by series ID, and serve from cache as a last-resort
// fallback if every retry fails. CPI data only updates monthly, so a cached
// series from a few hours or days ago is functionally equivalent to a fresh
// one.

const CACHE_PREFIX = 'fred-cache:';

interface CachedSeries {
  data: SeriesPoint[];
  cachedAt: string; // ISO timestamp
}

function readCache(seriesId: string): CachedSeries | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + seriesId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedSeries;
    if (!Array.isArray(parsed?.data)) return null;
    return parsed;
  } catch {
    // localStorage unavailable (SSR, private browsing, quota exceeded) or
    // payload corrupt. Treat as cache miss.
    return null;
  }
}

function writeCache(seriesId: string, data: SeriesPoint[]): void {
  try {
    const payload: CachedSeries = {
      data,
      cachedAt: new Date().toISOString(),
    };
    localStorage.setItem(CACHE_PREFIX + seriesId, JSON.stringify(payload));
  } catch {
    // Storage may be unavailable; cache is best-effort.
  }
}

// ---------- Retry policy ----------

const MAX_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 1000;

/**
 * Exponential backoff with ±25% jitter. Attempt 0 → ~1s, 1 → ~2s, 2 → ~4s,
 * 3 → ~8s. Jitter prevents synchronized retries from multiple parallel
 * series calls hammering FRED at the same instant.
 */
function backoffDelay(attempt: number): number {
  const base = BASE_BACKOFF_MS * Math.pow(2, attempt);
  const jitter = base * (0.75 + Math.random() * 0.5);
  return Math.round(jitter);
}

export async function fetchFredSeries(
  seriesId: string,
  startDate: string,
  endDate: string,
  signal?: AbortSignal
): Promise<SeriesPoint[]> {
  const url = buildUrl(seriesId, startDate, endDate);
  let lastErr: unknown = null;

  // FRED sometimes returns 500/503 status but still includes valid JSON data.
  // Always try to parse the response body regardless of HTTP status code.
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, { signal });
      const json: FredResponse = await res.json();

      if (json.observations && json.observations.length > 0) {
        const data: SeriesPoint[] = json.observations
          .filter((o) => o.value !== '.')
          .map((o) => ({
            date: o.date,
            value: parseFloat(o.value),
          }));
        writeCache(seriesId, data);
        return data;
      }

      lastErr = new Error(
        `FRED error for ${seriesId}: ${json.error_message ?? 'empty response'}`
      );
    } catch (err) {
      if (signal?.aborted) throw err;
      lastErr = err;
    }

    if (attempt < MAX_ATTEMPTS - 1) {
      await new Promise((r) => setTimeout(r, backoffDelay(attempt)));
    }
  }

  // All attempts exhausted. Fall back to last-known-good cache if we have it.
  const cached = readCache(seriesId);
  if (cached) {
    console.warn(
      `[FRED] ${seriesId} failed after ${MAX_ATTEMPTS} attempts; serving cached data from ${cached.cachedAt}`,
      lastErr
    );
    return cached.data;
  }

  throw lastErr instanceof Error
    ? lastErr
    : new Error(`FRED fetch failed for ${seriesId}`);
}
