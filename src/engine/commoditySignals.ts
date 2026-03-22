import type { CommodityObservation, CommodityInputs } from '../types/cpiNowcast';

/**
 * Step 2: Commodity Price Inputs
 *
 * CPI basket weights (approximate):
 * - Energy: ~7.5% of CPI (gasoline alone ~3.5%)
 * - Food: ~13.5% of CPI
 * - Commodities ex-food/energy: ~21%
 *
 * Energy pass-through is fast (1-2 months) and large.
 * Food pass-through is moderate (2-4 months).
 * Industrial commodities pass through slower (3-6 months).
 */

function getMonthlyAverage(
  data: CommodityObservation[],
  yearMonth: string
): number | null {
  const matching = data.filter((d) => d.date.startsWith(yearMonth));
  if (matching.length === 0) return null;
  return matching.reduce((sum, d) => sum + d.value, 0) / matching.length;
}

/**
 * Find the latest year-month in the data at or before the target.
 * Returns null if no data exists at or before the target month.
 */
function findLatestAvailableMonth(
  data: CommodityObservation[],
  targetYearMonth: string
): string | null {
  const candidates = new Set<string>();
  for (const d of data) {
    const ym = d.date.slice(0, 7);
    if (ym <= targetYearMonth) candidates.add(ym);
  }
  if (candidates.size === 0) return null;
  return [...candidates].sort().pop()!;
}

function computeYoY(
  data: CommodityObservation[],
  targetMonth: string
): number | null {
  const ym = targetMonth.slice(0, 7);

  // If the target month has no data, fall back to the most recent month
  const effectiveYm = getMonthlyAverage(data, ym) != null
    ? ym
    : findLatestAvailableMonth(data, ym);
  if (effectiveYm == null) return null;

  const d = new Date(effectiveYm + '-01');
  d.setFullYear(d.getFullYear() - 1);
  const ymAgo = d.toISOString().slice(0, 7);

  const current = getMonthlyAverage(data, effectiveYm);
  const yearAgo = getMonthlyAverage(data, ymAgo);

  if (current == null || yearAgo == null || yearAgo === 0) return null;
  return ((current - yearAgo) / yearAgo) * 100;
}

// Weights for composite commodity signal
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
  if (compositeSignal > 3) {
    signalDirection = 'inflationary';
  } else if (compositeSignal < -3) {
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

// CPI basket pass-through rates per 1% commodity YoY move
const PASSTHROUGH_RATES = {
  brent: 0.075,    // energy ~7.5% of CPI, gasoline amplifies crude ~1.3x
  crb: 0.03,       // broad commodities ex-energy
  faoFood: 0.04,   // food ~13.5% but not all food tracks FAO
};

/**
 * Compute estimated CPI impact from commodity moves using
 * CPI basket pass-through rates rather than a single blended coefficient.
 */
export function computeCommodityCpiImpact(
  brentYoY: number | null,
  crbYoY: number | null,
  faoFoodYoY: number | null
): number {
  let impact = 0;
  if (brentYoY != null) impact += brentYoY * PASSTHROUGH_RATES.brent;
  if (crbYoY != null) impact += crbYoY * PASSTHROUGH_RATES.crb;
  if (faoFoodYoY != null) impact += faoFoodYoY * PASSTHROUGH_RATES.faoFood;
  return impact;
}
