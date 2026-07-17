import type { ClevelandBaseline, ClevelandSeries } from '../types/cpiNowcast';
import { fetchJsonWithRetry } from './http';

/**
 * Ingests the Federal Reserve Bank of Cleveland's public inflation-nowcasting
 * feeds and reduces them to the current CPI / Core CPI nowcast.
 *
 * The feeds are FusionCharts payloads powering the chart at
 *   clevelandfed.org/indicators-and-data/inflation-nowcasting
 * They are a rolling ~2-week daily window: each series (CPI, Core CPI, PCE,
 * Core PCE, plus "Actual …" counterparts) is forward-filled across business
 * days as the Fed refines its estimate, then reset when a print lands. So the
 * *latest non-empty* value in a series is the Fed's freshest nowcast for the
 * next unreleased month. When the Fed is between cycles for an index (e.g.
 * right after a CPI print while only PCE is live), that index is empty and we
 * surface null rather than a stale number.
 *
 * Two views exist: nowcast_year.json (year-over-year) and nowcast_month.json
 * (month-over-month). No API key is required, but the CDN rejects
 * non-browser User-Agents, so we send a browser-like one.
 */

const YEAR_URL =
  'https://www.clevelandfed.org/-/media/files/webcharts/inflationnowcasting/nowcast_year.json?sc_lang=en';
const MONTH_URL =
  'https://www.clevelandfed.org/-/media/files/webcharts/inflationnowcasting/nowcast_month.json?sc_lang=en';

interface FusionSeries {
  seriesname: string;
  data: { value: string }[];
}
interface FusionChart {
  chart: { _comment?: string };
  categories: { category: { label: string }[] }[];
  dataset: FusionSeries[];
}
type FusionPayload = FusionChart[];

/** Last non-empty numeric value in a forward-filled series, or null. */
function latestValue(series: FusionSeries | undefined): number | null {
  if (!series) return null;
  for (let i = series.data.length - 1; i >= 0; i--) {
    const raw = series.data[i]?.value;
    if (raw != null && raw !== '') {
      const n = Number(raw);
      if (Number.isFinite(n)) return Math.round(n * 100) / 100;
    }
  }
  return null;
}

function findSeries(chart: FusionChart, name: string): FusionSeries | undefined {
  return chart.dataset.find((d) => d.seriesname === name);
}

/** Marker label sits in the final category slot, e.g. "CPI Jul" / "PCE Jul". */
function targetLabel(chart: FusionChart | undefined): string | null {
  const cats = chart?.categories?.[0]?.category;
  if (!cats || cats.length === 0) return null;
  return cats[cats.length - 1]?.label ?? null;
}

export async function fetchClevelandBaseline(
  signal?: AbortSignal
): Promise<ClevelandBaseline | null> {
  let yearPayload: FusionPayload;
  let monthPayload: FusionPayload | null = null;
  try {
    yearPayload = await fetchJsonWithRetry<FusionPayload>(YEAR_URL, {
      signal,
      browserLike: true,
    });
  } catch {
    // YoY is the anchor we actually display; if it's unreachable, treat the
    // whole baseline as unavailable and let the app fall back to our model.
    return null;
  }
  try {
    monthPayload = await fetchJsonWithRetry<FusionPayload>(MONTH_URL, {
      signal,
      browserLike: true,
    });
  } catch {
    monthPayload = null; // MoM is a nice-to-have; degrade gracefully.
  }

  const yearChart = yearPayload?.[0];
  const monthChart = monthPayload?.[0];
  if (!yearChart) return null;

  const build = (name: string): ClevelandSeries => ({
    yoY: latestValue(findSeries(yearChart, name)),
    moM: monthChart ? latestValue(findSeries(monthChart, name)) : null,
    actualYoY: latestValue(findSeries(yearChart, `Actual ${name}`)),
  });

  return {
    asOf: yearChart.chart?._comment ?? null,
    targetLabel: targetLabel(yearChart),
    cpi: build('CPI Inflation'),
    coreCpi: build('Core CPI Inflation'),
  };
}
