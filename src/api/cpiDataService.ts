import type { RawDataBundle } from '../types/cpiNowcast';
import { fetchFredSeries } from './fredClient';
import { fetchFmpEconomicIndicator } from './fmpClient';

/**
 * Fetches all required data series in parallel.
 * Needs 48 months of history (36 chart months + 12 for YoY lookback).
 */
export async function fetchAllData(signal?: AbortSignal): Promise<RawDataBundle> {
  const now = new Date();
  const endDate = now.toISOString().slice(0, 10);

  // 48 months back for YoY calculations + lookback
  const start = new Date(now);
  start.setMonth(start.getMonth() - 60); // extra buffer for 2-year base effects
  const startDate = start.toISOString().slice(0, 10);

  const [cpi, brent, ppiaco, gdpGrowth, faoFood] = await Promise.all([
    // CPI-U All Urban Consumers (monthly, seasonally adjusted)
    fetchFredSeries('CPIAUCSL', startDate, endDate, signal),

    // Brent Crude Oil (daily, we'll compute monthly averages)
    fetchFredSeries('DCOILBRENTEU', startDate, endDate, signal),

    // PPI All Commodities (monthly, as CRB proxy)
    fetchFredSeries('PPIACO', startDate, endDate, signal),

    // Real GDP Growth Rate (quarterly annualized)
    fetchFredSeries('A191RL1Q225SBEA', startDate, endDate, signal).catch(
      () => [] // GDP might have fewer data points, graceful fallback
    ),

    // Food price proxy: FRED food-at-home CPI, fallback to FMP
    fetchFredSeries('CUSR0000SAF11', startDate, endDate, signal).catch(
      async () => {
        try {
          return await fetchFmpEconomicIndicator('CPI', signal);
        } catch {
          return [];
        }
      }
    ),
  ]);

  return {
    cpi,
    brent,
    ppiaco,
    faoFood,
    gdpGrowth,
  };
}

/**
 * Get the most recent month with CPI data available.
 */
export function getLatestCpiMonth(
  cpi: { date: string; value: number }[]
): string {
  if (cpi.length === 0) {
    const d = new Date();
    d.setMonth(d.getMonth() - 2); // CPI is typically released with 2-month lag
    return d.toISOString().slice(0, 10);
  }
  return cpi[cpi.length - 1].date;
}
