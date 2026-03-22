import type {
  RawDataBundle,
  NowcastOutput,
  CpiChartPoint,
} from '../types/cpiNowcast';
import { analyzeBaseEffects } from './baseEffects';
import { analyzeCommoditySignals } from './commoditySignals';
import { computeRateOfChangeSignal } from './rateOfChange';
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
 * Build chart data: 36-month backtest + 6-month forward projection.
 */
export function buildChartData(
  data: RawDataBundle,
  currentMonth: string
): CpiChartPoint[] {
  const points: CpiChartPoint[] = [];

  // 36 months of history
  for (let i = 35; i >= 0; i--) {
    const monthStr = shiftMonth(currentMonth, -i);
    const ym = monthStr.slice(0, 7);

    const baseEffects = analyzeBaseEffects(data.cpi, monthStr);
    const commodityInputs = analyzeCommoditySignals(
      data.brent,
      data.ppiaco,
      data.faoFood,
      monthStr
    );
    const rateOfChange = computeRateOfChangeSignal(baseEffects, commodityInputs);

    const label = formatMonthLabel(monthStr);

    points.push({
      date: label,
      month: ym,
      actualYoY:
        baseEffects.currentCpiLevel > 0
          ? Math.round(baseEffects.actualYoY * 100) / 100
          : null,
      modelYoY: Math.round(rateOfChange.pointEstimate * 100) / 100,
      projectedYoY: null,
    });
  }

  // 6 months forward projection
  // Use the latest available data to extrapolate
  const latestNowcast = runNowcast(data, currentMonth);
  const latestCpi = data.cpi.length > 0 ? data.cpi[data.cpi.length - 1] : null;

  for (let i = 1; i <= 6; i++) {
    const monthStr = shiftMonth(currentMonth, i);
    const ym = monthStr.slice(0, 7);

    const label = formatMonthLabel(monthStr);

    // Forward projection: use current nowcast adjusted by base effect trend
    // Each month further out adds uncertainty
    const futureBase = analyzeBaseEffects(data.cpi, monthStr);

    // Decay commodity signal over time (less reliable further out)
    const decayFactor = Math.pow(0.85, i);
    const commodityContribution =
      latestNowcast.commodityInputs.compositeSignal * 0.04 * decayFactor;

    // Project based on base effects + decaying commodity signal
    let projected: number;
    if (futureBase.yearAgoCpiLevel > 0 && latestCpi) {
      // Estimate: last CPI * (1 + monthly trend) compared to future base
      const monthlyTrend = latestNowcast.nowcastCpiYoY / 12 / 100;
      const estimatedFutureCpi =
        latestCpi.value * Math.pow(1 + monthlyTrend, i);
      projected =
        ((estimatedFutureCpi - futureBase.yearAgoCpiLevel) /
          futureBase.yearAgoCpiLevel) *
        100;
    } else {
      projected = latestNowcast.nowcastCpiYoY + commodityContribution;
    }

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
