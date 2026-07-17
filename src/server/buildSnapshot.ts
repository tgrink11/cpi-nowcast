import type {
  Snapshot,
  CpiChartPoint,
  NowcastTilt,
  AccuracyStats,
  ClevelandBaseline,
  RawDataBundle,
} from '../types/cpiNowcast';
import { runNowcast, buildChartData } from '../engine/nowcastEngine';
import { assembleRawData } from './dataBundle';
import { fetchClevelandBaseline } from './clevelandFed';

/** Most recent month with a CPI observation (falls back to ~2 months ago). */
function getLatestCpiMonth(cpi: RawDataBundle['cpi']): string {
  if (cpi.length === 0) {
    const d = new Date();
    d.setMonth(d.getMonth() - 2);
    return d.toISOString().slice(0, 10);
  }
  return cpi[cpi.length - 1].date;
}

/**
 * Replay the 36-month backtest and score it honestly against realized CPI.
 * Reports both our model's MAE and a naive persistence MAE so the reader can
 * see whether the overlay actually adds skill over "next YoY = last YoY".
 */
function computeAccuracy(chartData: CpiChartPoint[]): AccuracyStats | null {
  const hist = chartData
    .filter((p) => p.actualYoY != null && p.modelYoY != null)
    .map((p) => ({ actual: p.actualYoY as number, model: p.modelYoY as number }));
  if (hist.length < 6) return null;

  const absErr = hist.map((h) => Math.abs(h.actual - h.model));
  const modelMae = absErr.reduce((s, e) => s + e, 0) / absErr.length;
  const sorted = [...absErr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const medianAe =
    sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];

  // Naive persistence: predict each month's YoY with the prior month's actual.
  let naiveSum = 0;
  let naiveN = 0;
  for (let i = 1; i < hist.length; i++) {
    naiveSum += Math.abs(hist[i].actual - hist[i - 1].actual);
    naiveN++;
  }
  const naiveMae = naiveN > 0 ? naiveSum / naiveN : modelMae;
  const skillVsNaive = naiveMae > 0 ? 1 - modelMae / naiveMae : 0;

  return {
    modelMae: Math.round(modelMae * 100) / 100,
    medianAe: Math.round(medianAe * 100) / 100,
    naiveMae: Math.round(naiveMae * 100) / 100,
    skillVsNaive: Math.round(skillVsNaive * 100) / 100,
    n: hist.length,
  };
}

function buildTilt(
  chartData: CpiChartPoint[],
  fallbackYoY: number,
  cleveland: ClevelandBaseline | null
): { tilt: NowcastTilt; chartData: CpiChartPoint[] } {
  // Our estimate for the *next unreleased* month = first forward projection,
  // which lines up with what the Cleveland Fed is nowcasting.
  const firstProjectionIdx = chartData.findIndex((p) => p.projectedYoY != null);
  const ourCpiYoY =
    firstProjectionIdx >= 0
      ? (chartData[firstProjectionIdx].projectedYoY as number)
      : fallbackYoY;

  const clevelandCpiYoY = cleveland?.cpi.yoY ?? null;

  let deltaPp: number | null = null;
  let direction: NowcastTilt['direction'] = 'n/a';
  if (clevelandCpiYoY != null) {
    deltaPp = Math.round((ourCpiYoY - clevelandCpiYoY) * 100) / 100;
    direction =
      Math.abs(deltaPp) < 0.1 ? 'inline' : deltaPp > 0 ? 'hotter' : 'cooler';
  }

  // Plot the Fed's nowcast on the same month our projection starts.
  const withCleveland = chartData.map((p, i) =>
    i === firstProjectionIdx ? { ...p, clevelandYoY: clevelandCpiYoY } : p
  );

  return {
    tilt: { cpiDeltaPp: deltaPp, ourCpiYoY, clevelandCpiYoY, direction },
    chartData: withCleveland,
  };
}

/**
 * The single server-side entry point. Fetches every source, runs the engine
 * once, anchors on the Cleveland Fed baseline, and returns the full payload
 * the client renders. Never throws for a missing Cleveland/FMP source — only
 * a hard FRED/CPI failure (no anchor data at all) propagates.
 */
export async function buildSnapshot(
  keys: { fredKey: string; fmpKey: string },
  signal?: AbortSignal
): Promise<Snapshot> {
  const [{ data, fredHealth, fmpHealth }, cleveland] = await Promise.all([
    assembleRawData(keys, signal),
    fetchClevelandBaseline(signal),
  ]);

  const latestMonth = getLatestCpiMonth(data.cpi);
  const nowcast = runNowcast(data, latestMonth);
  const baseChart = buildChartData(data, latestMonth);
  const accuracy = computeAccuracy(baseChart);

  const { tilt, chartData } = buildTilt(
    baseChart,
    nowcast.nowcastCpiYoY,
    cleveland
  );

  return {
    generatedAt: new Date().toISOString(),
    nowcast,
    chartData,
    cleveland,
    tilt,
    accuracy,
    dataStatus: {
      fred: fredHealth,
      fmp: fmpHealth,
      cleveland: cleveland ? 'ok' : 'unavailable',
    },
  };
}
