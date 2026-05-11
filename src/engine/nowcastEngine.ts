import type {
  RawDataBundle,
  NowcastOutput,
  CpiChartPoint,
  CpiObservation,
} from '../types/cpiNowcast';
import { analyzeBaseEffects } from './baseEffects';
import { analyzeCommoditySignals } from './commoditySignals';
import {
  computeNowcastOverlays,
  buildRateOfChangeSignal,
} from './rateOfChange';
import { classifyPhase } from './phaseClassification';

/**
 * Step 5: Nowcast Engine
 *
 * The headline nowcast targets the FIRST UNREPORTED month — i.e., the month
 * after the latest CPI release. The chart "model" line is a clean backtest
 * (anchored on M-1's actual YoY, with overlay inputs scrubbed of M's CPI and
 * of slow-publishing commodity series). The chart "projection" line extends
 * the nowcast forward 6 months by walking projected CPI levels.
 */

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

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
 * Project a CPI level forward by one month using a trend rate derived from
 * trailing YoY plus the calendar month's seasonal offset.
 */
function projectCpiForward(
  priorLevel: number,
  trailingYoY: number,
  seasonalOffsets: number[],
  targetMonth: string
): number {
  const trendMoM = Math.pow(1 + trailingYoY / 100, 1 / 12) - 1;
  const monthIdx = Number(targetMonth.slice(5, 7)) - 1;
  const seasonal = seasonalOffsets[monthIdx] ?? 0;
  return priorLevel * (1 + trendMoM + seasonal);
}

/**
 * Run a forward nowcast targeted at `latestCpiMonth + 1`.
 *
 * The trailing anchor is the latest reported actual YoY. Overlay inputs are
 * computed for the target month using a projected CPI level for that month
 * (so base effects, commodity, and inflection signals all reflect the period
 * we're nowcasting — not the period we already have data for).
 */
export function runNowcast(
  data: RawDataBundle,
  latestCpiMonth: string
): NowcastOutput {
  const target = shiftMonth(latestCpiMonth, 1);

  // Trailing snapshot: real, fully-reported state. Used as the YoY anchor
  // AND as the BaseEffectsAnalysis surfaced in the UI.
  const trailingBase = analyzeBaseEffects(data.cpi, latestCpiMonth);
  const trailingYoY = trailingBase.actualYoY;

  // Project a CPI level for the target month so we can compute target-month
  // base effects honestly (rather than letting findClosestObservation return
  // a stale level or zero).
  const seasonalOffsets = computeSeasonalMomFactors(data.cpi, 5);
  const projectedTargetCpi = projectCpiForward(
    trailingBase.currentCpiLevel,
    trailingYoY,
    seasonalOffsets,
    target
  );

  // Target-month overlay inputs. The base effects analysis is computed with
  // the projected level so twoYearBaseEffect and inflectionSignal reflect
  // the right period.
  const targetBase = analyzeBaseEffects(data.cpi, target, {
    currentLevelOverride: projectedTargetCpi,
    priorMonthLevelOverride: trailingBase.currentCpiLevel,
  });

  // Real-time commodity readings for the target month (Brent is daily, PPI
  // and FAO publish mid-following-month — `analyzeCommoditySignals` falls
  // back to the latest available month per series).
  const commodityInputs = analyzeCommoditySignals(
    data.brent,
    data.ppiaco,
    data.faoFood,
    target
  );

  // Forward overlays exclude the discretionary baseAdjustment because the
  // mechanical base effect is already encoded in targetBase.actualYoY
  // (projected CPI vs real year-ago CPI).
  const overlays = computeNowcastOverlays(targetBase, commodityInputs, {
    excludeBaseAdjustment: true,
  });
  const pointEstimate = targetBase.actualYoY + overlays.total;
  const { signal: rateOfChange, pointEstimateUnrounded } =
    buildRateOfChangeSignal(
      pointEstimate,
      trailingYoY,
      targetBase,
      commodityInputs
    );

  const phase = classifyPhase(rateOfChange, data.gdpGrowth);

  // Confidence: use the unrounded point estimate so the threshold isn't
  // perturbed by 2-decimal rounding in rateOfChange.pointEstimate.
  let confidence: 'high' | 'medium' | 'low';
  let confidenceRationale: string;
  if (
    rateOfChange.momentumAligned &&
    Math.abs(pointEstimateUnrounded - trailingYoY) < 0.5
  ) {
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
    asOfDate: target,
    nowcastCpiYoY: rateOfChange.pointEstimate,
    direction: rateOfChange.direction,
    confidence,
    confidenceRationale,
    phase,
    // Surface the trailing (fully-reported) base effects in the UI. Overlay
    // math uses target-month base effects internally, but the user wants to
    // see actual current numbers, not projections.
    baseEffects: trailingBase,
    commodityInputs,
    rateOfChange,
  };
}

/**
 * Build chart data: 36-month backtest + 6-month forward projection.
 */
export function buildChartData(
  data: RawDataBundle,
  latestCpiMonth: string
): CpiChartPoint[] {
  const points: CpiChartPoint[] = [];

  // ---------- 36 months of historical backtest ----------
  //
  // For each month M:
  //
  //     modelYoY[M] = actualYoY(M-1) + overlays(M)
  //
  // Anchoring on M-1's actual YoY (rather than M's) means the model can't
  // see its own answer key. The overlays for M are computed from inputs that
  // would have been knowable at end of M-1:
  //   - oneYearBaseEffect: historical CPI only — safe
  //   - twoYearBaseEffect / inflectionSignal: would otherwise leak M's CPI
  //     level via the `current` term. We pass M-1's level as the override so
  //     the computation uses (M-1's CPI / M-24's CPI) instead.
  //   - Commodity: Brent is daily/real-time (safe), but PPI and FAO publish
  //     mid-(M+1). We lag those two series by one month for the backtest.
  for (let i = 35; i >= 0; i--) {
    const monthStr = shiftMonth(latestCpiMonth, -i);
    const ym = monthStr.slice(0, 7);

    const priorBaseEffects = analyzeBaseEffects(
      data.cpi,
      shiftMonth(monthStr, -1)
    );
    const priorPriorBase = analyzeBaseEffects(
      data.cpi,
      shiftMonth(monthStr, -2)
    );

    const baseEffects = analyzeBaseEffects(data.cpi, monthStr, {
      currentLevelOverride: priorBaseEffects.currentCpiLevel,
      priorMonthLevelOverride: priorPriorBase.currentCpiLevel,
    });

    const commodityInputs = analyzeCommoditySignals(
      data.brent,
      data.ppiaco,
      data.faoFood,
      monthStr,
      { lagSlowSeries: true }
    );

    const overlays = computeNowcastOverlays(baseEffects, commodityInputs);
    const trailingAnchor =
      priorBaseEffects.currentCpiLevel > 0
        ? priorBaseEffects.actualYoY
        : baseEffects.actualYoY;
    const modelYoY = trailingAnchor + overlays.total;

    // The chart's "Actual YoY" line uses the genuine reported value, sourced
    // directly from the CPI series (not from any override).
    const realCurrent = analyzeBaseEffects(data.cpi, monthStr);
    const label = formatMonthLabel(monthStr);

    points.push({
      date: label,
      month: ym,
      actualYoY:
        realCurrent.currentCpiLevel > 0
          ? Math.round(realCurrent.actualYoY * 100) / 100
          : null,
      modelYoY: Math.round(modelYoY * 100) / 100,
      projectedYoY: null,
    });
  }

  // ---------- 6-month forward projection ----------
  //
  // Walk the CPI level forward month by month using trend + seasonal offset.
  // For each future month, compute target base effects with the projected
  // level as `currentLevelOverride`, then add overlays.
  const latestCpi = data.cpi.length > 0 ? data.cpi[data.cpi.length - 1] : null;
  if (!latestCpi) return points;

  const seasonalOffsets = computeSeasonalMomFactors(data.cpi, 5);
  const trailingBase = analyzeBaseEffects(data.cpi, latestCpiMonth);
  const trailingYoY = trailingBase.actualYoY;

  let projectedCpi = trailingBase.currentCpiLevel;

  for (let i = 1; i <= 6; i++) {
    const monthStr = shiftMonth(latestCpiMonth, i);
    const ym = monthStr.slice(0, 7);
    const label = formatMonthLabel(monthStr);

    const priorProjectedCpi = projectedCpi;
    projectedCpi = projectCpiForward(
      priorProjectedCpi,
      trailingYoY,
      seasonalOffsets,
      monthStr
    );

    const futureBase = analyzeBaseEffects(data.cpi, monthStr, {
      currentLevelOverride: projectedCpi,
      priorMonthLevelOverride: priorProjectedCpi,
    });

    // Use the commodity reading for the target future month if available;
    // analyzeCommoditySignals will fall back to the latest available month
    // per series when the target month has no data yet. No artificial decay:
    // commodity YoY is already a month-specific reading.
    const commodityInputs = analyzeCommoditySignals(
      data.brent,
      data.ppiaco,
      data.faoFood,
      monthStr
    );

    // Exclude baseAdjustment to avoid double-counting with the mechanical
    // base effect already encoded in futureBase.actualYoY.
    const overlays = computeNowcastOverlays(futureBase, commodityInputs, {
      excludeBaseAdjustment: true,
    });
    const projected = futureBase.actualYoY + overlays.total;

    points.push({
      date: label,
      month: ym,
      actualYoY: null,
      modelYoY: null,
      projectedYoY: Math.round(projected * 100) / 100,
    });
  }

  return points;
}
