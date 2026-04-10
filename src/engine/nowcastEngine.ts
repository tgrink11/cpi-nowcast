import type {
  RawDataBundle,
  NowcastOutput,
  CpiChartPoint,
  CpiObservation,
  CommodityInputs,
} from '../types/cpiNowcast';
import { analyzeBaseEffects } from './baseEffects';
import { analyzeCommoditySignals } from './commoditySignals';
import { computeRateOfChangeSignal, computeNowcastOverlays } from './rateOfChange';
import { classifyPhase } from './phaseClassification';

/**
 * Step 5: Nowcast Engine
 * Orchestrates all steps for a given target month.
 */

export function runNowcast(
  data: RawDataBundle,
  targetMonth: string
): NowcastOutput {
  // Step 1: Base Effects (anchored to latest CPI report month)
  const baseEffects = analyzeBaseEffects(data.cpi, targetMonth);

  // Step 2: Commodity Signals
  // Use the current calendar month for commodity signals when it's ahead
  // of the latest CPI report, since commodity prices are available in
  // real-time even when CPI hasn't been reported yet.
  const today = new Date().toISOString().slice(0, 10);
  const commodityMonth = today > targetMonth ? today : targetMonth;
  const commodityInputs = analyzeCommoditySignals(
    data.brent,
    data.ppiaco,
    data.faoFood,
    commodityMonth
  );

  // Step 3: Rate of Change Signal
  const rateOfChange = computeRateOfChangeSignal(baseEffects, commodityInputs);

  // Step 4: Phase Classification
  const phase = classifyPhase(rateOfChange, data.gdpGrowth);

  // Step 5: Confidence assessment
  let confidence: 'high' | 'medium' | 'low';
  let confidenceRationale: string;

  if (rateOfChange.momentumAligned && Math.abs(rateOfChange.pointEstimate - baseEffects.actualYoY) < 0.5) {
    confidence = 'high';
    confidenceRationale =
      'Base effects and commodity signals are aligned; estimate close to trailing YoY';
  } else if (!rateOfChange.momentumAligned) {
    confidence = 'low';
    confidenceRationale =
      'Base effects and commodity signals diverge — higher uncertainty';
  } else {
    confidence = 'medium';
    confidenceRationale =
      'Signals partially aligned; moderate deviation from trailing YoY';
  }

  return {
    asOfDate: targetMonth,
    nowcastCpiYoY: rateOfChange.pointEstimate,
    direction: rateOfChange.direction,
    confidence,
    confidenceRationale,
    phase,
    baseEffects,
    commodityInputs,
    rateOfChange,
  };
}

/**
 * Shift a YYYY-MM-DD date string by the given number of months,
 * keeping the result timezone-agnostic (always the 1st of the month).
 */
function shiftMonth(dateStr: string, months: number): string {
  const [y, m] = dateStr.slice(0, 7).split('-').map(Number);
  const total = y * 12 + (m - 1) + months;
  const newY = Math.floor(total / 12);
  const newM = (total % 12) + 1;
  return `${newY}-${String(newM).padStart(2, '0')}-01`;
}

/**
 * Format a YYYY-MM-DD string as "Mon YYYY" without timezone issues.
 */
const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
function formatMonthLabel(dateStr: string): string {
  const [y, m] = dateStr.slice(0, 7).split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

/**
 * Compute seasonal month-of-year offsets to the average monthly CPI change.
 *
 * Returns a length-12 array indexed by calendar month (0 = Jan). Each entry
 * is the average MoM CPI change for that calendar month over the last
 * `yearsOfHistory` years, minus the overall average monthly change. So the
 * offsets sum to ~0 and represent pure seasonal deviation from trend.
 */
function computeSeasonalMomFactors(
  cpiData: CpiObservation[],
  yearsOfHistory: number = 5
): number[] {
  const offsets = new Array(12).fill(0);
  if (cpiData.length < 13) return offsets;

  // Sorted ascending by convention (cpiDataService sorts on merge). Walk the
  // tail of the series up to yearsOfHistory * 12 months back.
  const lookback = Math.min(cpiData.length - 1, yearsOfHistory * 12);
  const startIdx = cpiData.length - 1 - lookback;

  const sums = new Array(12).fill(0);
  const counts = new Array(12).fill(0);
  let overallSum = 0;
  let overallCount = 0;

  for (let j = startIdx + 1; j < cpiData.length; j++) {
    const prev = cpiData[j - 1].value;
    const curr = cpiData[j].value;
    if (prev <= 0) continue;
    const mom = (curr - prev) / prev;
    const monthIdx = Number(cpiData[j].date.slice(5, 7)) - 1;
    if (monthIdx < 0 || monthIdx > 11) continue;
    sums[monthIdx] += mom;
    counts[monthIdx] += 1;
    overallSum += mom;
    overallCount += 1;
  }

  const overallAvg = overallCount > 0 ? overallSum / overallCount : 0;
  for (let m = 0; m < 12; m++) {
    const avg = counts[m] > 0 ? sums[m] / counts[m] : overallAvg;
    offsets[m] = avg - overallAvg;
  }
  return offsets;
}

/**
 * Decay a commodity YoY reading by a multiplicative factor. Null passes through.
 */
function decayYoY(value: number | null, factor: number): number | null {
  return value == null ? null : value * factor;
}

/**
 * Build chart data: 36-month backtest + 6-month forward projection.
 */
export function buildChartData(
  data: RawDataBundle,
  currentMonth: string
): CpiChartPoint[] {
  const points: CpiChartPoint[] = [];

  // 36 months of history
  //
  // The historical "model" line is a TRUE BACKTEST: for each month M, we
  // compute what the model would have predicted for M given only data
  // through M-1. That is:
  //
  //     modelYoY[M] = actualYoY(M-1) + overlays(M)
  //
  // Anchoring on M-1's actual instead of M's actual is the difference
  // between "forecast skill" and "overlay noise on top of perfect data".
  // The overlays themselves still use month M's base effects + commodity
  // signals, since both are computable from data available at end of M-1
  // (year-ago / two-year-ago CPI levels are historical, commodity prices
  // are real-time).
  for (let i = 35; i >= 0; i--) {
    const monthStr = shiftMonth(currentMonth, -i);
    const ym = monthStr.slice(0, 7);

    const baseEffects = analyzeBaseEffects(data.cpi, monthStr);
    const priorBaseEffects = analyzeBaseEffects(
      data.cpi,
      shiftMonth(monthStr, -1)
    );
    const commodityInputs = analyzeCommoditySignals(
      data.brent,
      data.ppiaco,
      data.faoFood,
      monthStr
    );

    const overlays = computeNowcastOverlays(baseEffects, commodityInputs);
    const trailingAnchor =
      priorBaseEffects.currentCpiLevel > 0
        ? priorBaseEffects.actualYoY
        : baseEffects.actualYoY;
    const modelYoY = trailingAnchor + overlays.total;

    const label = formatMonthLabel(monthStr);

    points.push({
      date: label,
      month: ym,
      actualYoY:
        baseEffects.currentCpiLevel > 0
          ? Math.round(baseEffects.actualYoY * 100) / 100
          : null,
      modelYoY: Math.round(modelYoY * 100) / 100,
      projectedYoY: null,
    });
  }

  // ---------- 6-month forward projection ----------
  //
  // Methodology:
  //   1. Walk a projected CPI level forward month by month using (a) a trend
  //      monthly rate derived from the latest *trailing* YoY (pure persistence,
  //      no overlays baked in) plus (b) a seasonal MoM offset from history.
  //   2. For each future month, compute a base YoY from (projected CPI) vs
  //      (real year-ago CPI) — this naturally captures base-effect dynamics
  //      because the denominator is real historical data.
  //   3. Add the standard nowcast overlays (commodity + base classification +
  //      inflection) using the *future* month's base-effect analysis and a
  //      decayed version of the latest commodity signals.
  //
  // This mirrors exactly what runNowcast does for the current month:
  //     nowcastYoY = trailingYoY + overlays
  // but with the trailing anchor replaced by a forward-walked projected YoY.

  const latestNowcast = runNowcast(data, currentMonth);
  const latestCpi = data.cpi.length > 0 ? data.cpi[data.cpi.length - 1] : null;

  if (latestCpi) {
    const seasonalOffsets = computeSeasonalMomFactors(data.cpi, 5);
    // Trend MoM from trailing YoY (NOT full nowcast YoY — overlays are added
    // back in per month, so using nowcastYoY here would double-count).
    const trailingYoY = latestNowcast.baseEffects.actualYoY;
    const trendMoM = Math.pow(1 + trailingYoY / 100, 1 / 12) - 1;

    let projectedCpi = latestCpi.value;

    for (let i = 1; i <= 6; i++) {
      const monthStr = shiftMonth(currentMonth, i);
      const ym = monthStr.slice(0, 7);
      const label = formatMonthLabel(monthStr);
      const calendarMonthIdx = Number(monthStr.slice(5, 7)) - 1;

      // Walk CPI level forward: trend + seasonal offset for this calendar month
      const seasonal = seasonalOffsets[calendarMonthIdx] ?? 0;
      projectedCpi = projectedCpi * (1 + trendMoM + seasonal);

      const futureBase = analyzeBaseEffects(data.cpi, monthStr);

      // Base YoY comes from projected CPI vs real year-ago CPI. If year-ago
      // data is unavailable, fall back to holding the trailing YoY flat.
      let baseYoY: number;
      if (futureBase.yearAgoCpiLevel > 0) {
        baseYoY =
          ((projectedCpi - futureBase.yearAgoCpiLevel) /
            futureBase.yearAgoCpiLevel) *
          100;
      } else {
        baseYoY = trailingYoY;
      }

      // Decay commodity inputs: as we project further out, current commodity
      // YoY readings are less informative about the future path. 0.85^i gives
      // a rough 4-month half-life, consistent with typical energy pass-through.
      const decay = Math.pow(0.85, i);
      const decayedCommodity: CommodityInputs = {
        brentCrudeYoY: decayYoY(latestNowcast.commodityInputs.brentCrudeYoY, decay),
        crbIndexYoY: decayYoY(latestNowcast.commodityInputs.crbIndexYoY, decay),
        faoFoodPriceYoY: decayYoY(latestNowcast.commodityInputs.faoFoodPriceYoY, decay),
        compositeSignal: latestNowcast.commodityInputs.compositeSignal * decay,
        signalDirection: latestNowcast.commodityInputs.signalDirection,
      };

      const overlays = computeNowcastOverlays(futureBase, decayedCommodity);
      const projected = baseYoY + overlays.total;

      points.push({
        date: label,
        month: ym,
        actualYoY: null,
        modelYoY: null,
        projectedYoY: Math.round(projected * 100) / 100,
      });
    }
  }

  return points;
}
