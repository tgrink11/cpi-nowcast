import type { CpiObservation, BaseEffectsAnalysis } from '../types/cpiNowcast';

/**
 * Step 1: Base Effects Analysis
 * Determines whether the year-ago CPI base is "easy" or "hard"
 * and whether the 2-year base effect signals an inflection point.
 */

function findClosestObservation(
  data: CpiObservation[],
  targetDate: string
): CpiObservation | undefined {
  // Compare by YYYY-MM to avoid timezone issues with Date parsing
  const targetYm = targetDate.slice(0, 7);
  let closest: CpiObservation | undefined;
  let minMonthDiff = Infinity;
  for (const obs of data) {
    const obsYm = obs.date.slice(0, 7);
    const [ty, tm] = targetYm.split('-').map(Number);
    const [oy, om] = obsYm.split('-').map(Number);
    const diff = Math.abs((ty * 12 + tm) - (oy * 12 + om));
    if (diff < minMonthDiff) {
      minMonthDiff = diff;
      closest = obs;
    }
  }
  // Only match within 2 months to avoid stale data
  if (minMonthDiff > 2) return undefined;
  return closest;
}

function shiftMonths(dateStr: string, months: number): string {
  const [y, m] = dateStr.slice(0, 7).split('-').map(Number);
  const total = y * 12 + (m - 1) + months;
  const newY = Math.floor(total / 12);
  const newM = (total % 12) + 1;
  return `${newY}-${String(newM).padStart(2, '0')}-01`;
}

export interface BaseEffectsOptions {
  // Use this value as `currentCpiLevel` instead of looking it up in cpiData.
  // Required when nowcasting a future month whose CPI hasn't been reported.
  currentLevelOverride?: number;
  // Use this value as the prior-month CPI level instead of looking it up.
  // Pair with `currentLevelOverride` for forward projections, or pass M-1's
  // and M-2's levels for a clean backtest of month M (avoids leaking M's CPI
  // through twoYearBaseEffect).
  priorMonthLevelOverride?: number;
}

export function analyzeBaseEffects(
  cpiData: CpiObservation[],
  targetMonth: string,
  options?: BaseEffectsOptions
): BaseEffectsAnalysis {
  const current = findClosestObservation(cpiData, targetMonth);
  const yearAgo = findClosestObservation(cpiData, shiftMonths(targetMonth, -12));
  const twoYearAgo = findClosestObservation(cpiData, shiftMonths(targetMonth, -24));
  const priorMonth = findClosestObservation(cpiData, shiftMonths(targetMonth, -1));
  const priorTwoYearAgo = findClosestObservation(
    cpiData,
    shiftMonths(targetMonth, -25)
  );

  const currentVal = options?.currentLevelOverride ?? current?.value ?? 0;
  const yearAgoVal = yearAgo?.value ?? 0;
  const twoYearAgoVal = twoYearAgo?.value ?? 0;
  const priorMonthVal = options?.priorMonthLevelOverride ?? priorMonth?.value ?? 0;
  const priorTwoYearAgoVal = priorTwoYearAgo?.value ?? 0;

  // YoY change
  const actualYoY = yearAgoVal > 0 ? ((currentVal - yearAgoVal) / yearAgoVal) * 100 : 0;

  // One-year base effect: how much did CPI rise in the base period?
  const oneYearBaseEffect =
    twoYearAgoVal > 0 ? ((yearAgoVal - twoYearAgoVal) / twoYearAgoVal) * 100 : 0;

  // Two-year base effect (annualized)
  const twoYearBaseEffect =
    twoYearAgoVal > 0
      ? (Math.pow(currentVal / twoYearAgoVal, 0.5) - 1) * 100
      : 0;

  // Prior month's two-year base effect
  const priorTwoYearBaseEffect =
    priorTwoYearAgoVal > 0
      ? (Math.pow(priorMonthVal / priorTwoYearAgoVal, 0.5) - 1) * 100
      : 0;

  // First difference of 2-year base effects
  const baseEffectFirstDifference = twoYearBaseEffect - priorTwoYearBaseEffect;

  // Classify: if the base period had high inflation, it's a "hard" base
  // (current YoY will tend to look lower). Low base → "easy" (YoY looks higher).
  // Tighter thresholds: median CPI ~2.5%, +-0.5% band for neutral
  const medianBaseEffect = 2.5;
  let baseClassification: 'easy' | 'hard' | 'neutral';
  if (oneYearBaseEffect > medianBaseEffect + 0.5) {
    baseClassification = 'hard';
  } else if (oneYearBaseEffect < medianBaseEffect - 0.5) {
    baseClassification = 'easy';
  } else {
    baseClassification = 'neutral';
  }

  // Inflection signal: sign change in first difference predicts turns ~70% of time.
  // Threshold of 0.15pp filters out month-to-month noise; the 2Y annualized
  // base effect routinely jitters by ±0.05pp without representing a real
  // turn, which previously caused this signal to flip sign almost every
  // month and inject ±0.15pp noise into the overlay.
  const INFLECTION_THRESHOLD = 0.15;
  let inflectionSignal: 'accelerating' | 'decelerating' | 'none';
  if (baseEffectFirstDifference > INFLECTION_THRESHOLD) {
    inflectionSignal = 'accelerating';
  } else if (baseEffectFirstDifference < -INFLECTION_THRESHOLD) {
    inflectionSignal = 'decelerating';
  } else {
    inflectionSignal = 'none';
  }

  return {
    targetMonth,
    currentCpiLevel: currentVal,
    yearAgoCpiLevel: yearAgoVal,
    twoYearAgoCpiLevel: twoYearAgoVal,
    actualYoY,
    oneYearBaseEffect,
    twoYearBaseEffect,
    priorTwoYearBaseEffect,
    baseEffectFirstDifference,
    baseClassification,
    inflectionSignal,
  };
}
