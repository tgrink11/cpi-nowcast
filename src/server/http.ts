/**
 * Server-side fetch helpers shared by the snapshot builder.
 *
 * These run inside the Vercel serverless function (and the Vite dev
 * middleware), never in the browser, so there is no localStorage or
 * import.meta.env here — API keys are passed in explicitly.
 */

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/122.0 Safari/537.36';

export interface FetchOptions {
  signal?: AbortSignal;
  /** Send a browser-like User-Agent (needed for clevelandfed.org's CDN). */
  browserLike?: boolean;
}

const MAX_ATTEMPTS = 4;
const BASE_BACKOFF_MS = 600;

function backoffDelay(attempt: number): number {
  const base = BASE_BACKOFF_MS * Math.pow(2, attempt);
  const jitter = base * (0.75 + Math.random() * 0.5);
  return Math.round(jitter);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Fetch JSON with exponential backoff. Retries on network error or non-2xx.
 * Throws the last error if every attempt fails.
 */
export async function fetchJsonWithRetry<T>(
  url: string,
  opts: FetchOptions = {}
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (opts.browserLike) headers['User-Agent'] = BROWSER_UA;

  let lastErr: unknown = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, { headers, signal: opts.signal });
      // FRED occasionally returns a 5xx status with a valid JSON body, so we
      // try to parse regardless and only treat a parse failure as an error.
      const json = (await res.json()) as T;
      if (res.ok || json != null) return json;
      lastErr = new Error(`HTTP ${res.status} for ${url}`);
    } catch (err) {
      if (opts.signal?.aborted) throw err;
      lastErr = err;
    }
    if (attempt < MAX_ATTEMPTS - 1) await sleep(backoffDelay(attempt));
  }
  throw lastErr instanceof Error ? lastErr : new Error(`fetch failed: ${url}`);
}
