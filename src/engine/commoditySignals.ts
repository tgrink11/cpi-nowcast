import type { CommodityObservation, CommodityInputs } from '../types/cpiNowcast';

/**
 * Step 2: Commodity Price Inputs
 * Calculate YoY rate of change for each commodity series
 * and produce a weighted composite signal.
 */

function getMonthlyAverage(
  data: CommodityObservation[],
  yearMonth: string
): number | null {
  const matching = data.filter((d) => d.date.startsWith(yearMonth));
  if (matching.length === 0) return null;
  return matching.reduce((sum, d) => sum + d.value, 0) / matching.length;
}

function computeYoY(
  data: CommodityObservation[],
  targetMonth: string
): number | null {
  const ym = targetMonth.slice(0, 7); // "2025-03"
  const d = new Date(targetMonth);
  d.setFullYear(d.getFullYear() - 1);
  const ymAgo = d.toISOString().slice(0, 7);

  const current = getMonthlyAverage(data, ym);
  const yearAgo = getMonthlyAverage(data, ymAgo);

  if (current == null || yearAgo == null || yearAgo === 0) return null;
  return ((current - yearAgo) / yearAgo) * 100;
}

const WEIGHTS = {
  brent: 0.35,
  crb: 0.30,
  faoFood: 0.35,
};

export function analyzeCommoditySignals(
  brentData: CommodityObservation[],
  ppiacoData: CommodityObservation[],
  faoFoodData: CommodityObservation[],
  targetMonth: string
): CommodityInputs {
  const brentYoY = computeYoY(brentData, targetMonth);
  const crbYoY = computeYoY(ppiacoData, targetMonth);
  const faoFoodYoY = computeYoY(faoFoodData, targetMonth);

  // Weighted composite using available data
  let totalWeight = 0;
  let weightedSum = 0;

  if (brentYoY != null) {
    weightedSum += brentYoY * WEIGHTS.brent;
    totalWeight += WEIGHTS.brent;
  }
  if (crbYoY != null) {
    weightedSum += crbYoY * WEIGHTS.crb;
    totalWeight += WEIGHTS.crb;
  }
  if (faoFoodYoY != null) {
    weightedSum += faoFoodYoY * WEIGHTS.faoFood;
    totalWeight += WEIGHTS.faoFood;
  }

  const compositeSignal = totalWeight > 0 ? weightedSum / totalWeight : 0;

  let signalDirection: 'inflationary' | 'deflationary' | 'neutral';
  if (compositeSignal > 5) {
    signalDirection = 'inflationary';
  } else if (compositeSignal < -5) {
    signalDirection = 'deflationary';
  } else {
    signalDirection = 'neutral';
  }

  return {
    brentCrudeYoY: brentYoY,
    crbIndexYoY: crbYoY,
    faoFoodPriceYoY: faoFoodYoY,
    compositeSignal,
    signalDirection,
  };
}
