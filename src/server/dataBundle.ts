import type {
  RawDataBundle,
  CommodityObservation,
  SourceHealth,
} from '../types/cpiNowcast';
import { fetchFredSeries } from './fred';
import { fetchFmpQuote, fetchFmpHistory } from './fmp';

const BRENT_SYMBOL = 'BZUSD';

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Merge FRED historical Brent with FMP's recent daily closes + live quote. */
function mergeBrent(
  fred: CommodityObservation[],
  fmpRecent: CommodityObservation[],
  liveQuote: { price: number } | null
): CommodityObservation[] {
  const seen = new Set(fred.map((d) => d.date));
  const merged = [...fred];
  for (const d of fmpRecent) {
    if (!seen.has(d.date)) {
      merged.push(d);
      seen.add(d.date);
    }
  }
  if (liveQuote) {
    const today = isoDate(new Date());
    if (!seen.has(today)) merged.push({ date: today, value: liveQuote.price });
  }
  return merged.sort((a, b) => a.date.localeCompare(b.date));
}

export interface RawDataResult {
  data: RawDataBundle;
  fredHealth: SourceHealth;
  fmpHealth: SourceHealth;
}

export async function assembleRawData(
  keys: { fredKey: string; fmpKey: string },
  signal?: AbortSignal
): Promise<RawDataResult> {
  const now = new Date();
  const endDate = isoDate(now);
  const start = new Date(now);
  start.setMonth(start.getMonth() - 60); // 5y: 2y base effects + 3y chart
  const startDate = isoDate(start);
  const recent = new Date(now);
  recent.setMonth(recent.getMonth() - 2);
  const recentStart = isoDate(recent);

  const { fredKey, fmpKey } = keys;

  // CPI and FRED Brent are load-bearing; everything else degrades to empty.
  const [cpi, fredBrent] = await Promise.all([
    fetchFredSeries('CPIAUCSL', startDate, endDate, fredKey, signal),
    fetchFredSeries('DCOILBRENTEU', startDate, endDate, fredKey, signal),
  ]);

  const [ppiaco, gdpGrowth, faoFood, brentQuote, fmpBrentRecent] =
    await Promise.all([
      fetchFredSeries('PPIACO', startDate, endDate, fredKey, signal).catch(() => []),
      fetchFredSeries('A191RL1Q225SBEA', startDate, endDate, fredKey, signal).catch(
        () => []
      ),
      fetchFredSeries('CUSR0000SAF11', startDate, endDate, fredKey, signal).catch(
        () => []
      ),
      fetchFmpQuote(BRENT_SYMBOL, fmpKey, signal),
      fetchFmpHistory(BRENT_SYMBOL, recentStart, endDate, fmpKey, signal),
    ]);

  const fmpHealth: SourceHealth =
    brentQuote || fmpBrentRecent.length > 0 ? 'ok' : 'unavailable';
  const brent = mergeBrent(fredBrent, fmpBrentRecent, brentQuote);

  return {
    data: { cpi, brent, ppiaco, faoFood, gdpGrowth },
    fredHealth: 'ok',
    fmpHealth,
  };
}
