import type { RawDataBundle } from '../types/cpiNowcast';
import { fetchFredSeries } from './fredClient';
import { fetchFmpEconomicIndicator, fetchFmpQuote, fetchFmpCommodityPrice } from './fmpClient';

/**
 * Fetches all required data series in parallel.
 * Supplements FRED's lagged Brent data with FMP's real-time quote
 * so the model captures fast-moving energy shocks.
 */
export async function fetchAllData(signal?: AbortSignal): Promise<RawDataBundle> {
  const now = new Date();
  const endDate = now.toISOString().slice(0, 10);

  // 60 months back for 2-year base effects + 36-month chart
  const start = new Date(now);
  start.setMonth(start.getMonth() - 60);
  const startDate = start.toISOString().slice(0, 10);

  // Recent window for FMP daily Brent to fill FRED gap
  const recentStart = new Date(now);
  recentStart.setMonth(recentStart.getMonth() - 2);
  const recentStartDate = recentStart.toISOString().slice(0, 10);

  const [cpi, fredBrent, ppiaco, gdpGrowth, faoFood, brentQuote, fmpBrentRecent] =
    await Promise.all([
      fetchFredSeries('CPIAUCSL', startDate, endDate, signal),
      fetchFredSeries('DCOILBRENTEU', startDate, endDate, signal),
      fetchFredSeries('PPIACO', startDate, endDate, signal),
      fetchFredSeries('A191RL1Q225SBEA', startDate, endDate, signal).catch(
        () => []
      ),
      fetchFredSeries('CUSR0000SAF11', startDate, endDate, signal).catch(
        async () => {
          try {
            return await fetchFmpEconomicIndicator('CPI', signal);
          } catch {
            return [];
          }
        }
      ),
      // Real-time Brent quote from FMP
      fetchFmpQuote('BZUSD', signal),
      // Recent daily Brent prices from FMP to fill gap
      fetchFmpCommodityPrice('BZUSD', recentStartDate, endDate, signal),
    ]);

  // Merge FRED Brent with FMP's more recent daily data
  const brent = mergeBrentData(fredBrent, fmpBrentRecent, brentQuote);

  return {
    cpi,
    brent,
    ppiaco,
    faoFood,
    gdpGrowth,
  };
}

/**
 * Merge FRED's historical Brent data with FMP's recent daily prices
 * and real-time quote. This fills the gap where FRED hasn't published yet.
 */
function mergeBrentData(
  fredData: { date: string; value: number }[],
  fmpRecent: { date: string; value: number }[],
  liveQuote: { price: number } | null
): { date: string; value: number }[] {
  // Start with FRED data
  const merged = [...fredData];
  const fredDates = new Set(fredData.map((d) => d.date));

  // Add FMP daily prices that FRED doesn't have
  for (const d of fmpRecent) {
    if (!fredDates.has(d.date)) {
      merged.push(d);
    }
  }

  // Add today's live quote if we have one
  if (liveQuote) {
    const today = new Date().toISOString().slice(0, 10);
    if (!fredDates.has(today) && !fmpRecent.some((d) => d.date === today)) {
      merged.push({ date: today, value: liveQuote.price });
    }
  }

  return merged.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Get the most recent month with CPI data available.
 */
export function getLatestCpiMonth(
  cpi: { date: string; value: number }[]
): string {
  if (cpi.length === 0) {
    const d = new Date();
    d.setMonth(d.getMonth() - 2);
    return d.toISOString().slice(0, 10);
  }
  return cpi[cpi.length - 1].date;
}
