import type {
  BaseEffectsAnalysis,
  CommodityInputs,
  RateOfChangeSignal,
} from '../types/cpiNowcast';
import { computeCommodityCpiImpact } from './commoditySignals';

/**
 * Step 3: Rate-of-Change Signal
 *
 * Uses CPI basket-weighted pass-through rates so that large energy
 * moves (e.g., +50% oil YoY) correctly produce a ~3-4pp CPI impact
 * rather than the ~2pp the old single-coefficient model gave.
 */

export interface NowcastOverlays {
  commodityAdjustment: number;
  baseAdjustment: number;
  inflectionAdjustment: number;
  total: number;
}

/**
 * Pure per-month overlay adjustments added on top of a trailing YoY anchor.
 *
 * Shared between the current-month nowcast and the forward projection so
 * that both use identical commodity, base-effect, and inflection logic.
 */
// Fraction of (saturated) commodity impact that is incremental to the
// already-reported trailing CPI reading. The remainder is assumed to already
// be embedded in trailing.
//
// Empirically, in 2023-2025 the actual CPI YoY moved by ~0.1-0.3pp
// month-to-month even when commodity YoY moved by tens of pp, which says
// trailing CPI absorbs ~70-80% of commodity impact and only ~20-30% remains
// as a forward delta. 0.6 (the previous value) implied 40% absorption,
// which over-attributed forecast power to commodities and produced a
// historical model line that oscillated 5x more than actual CPI.
const COMMODITY_DAMPENING = 0.3;

export function computeNowcastOverlays(
  baseEffects: BaseEffectsAnalysis,
  commodityInputs: CommodityInputs
): NowcastOverlays {
  // Commodity impact using basket-weighted pass-through rates.
  const commodityImpact = computeCommodityCpiImpact(
    commodityInputs.brentCrudeYoY,
    commodityInputs.crbIndexYoY,
    commodityInputs.faoFoodPriceYoY
  );
  const commodityAdjustment = commodityImpact * COMMODITY_DAMPENING;

  // Base effect adjustment
  let baseAdjustment = 0;
  if (baseEffects.baseClassification === 'easy') {
    baseAdjustment = 0.3;
  } else if (baseEffects.baseClassification === 'hard') {
    baseAdjustment = -0.3;
  }

  // Inflection signal from 2-year base effect first difference
  let inflectionAdjustment = 0;
  if (baseEffects.inflectionSignal === 'accelerating') {
    inflectionAdjustment = 0.15;
  } else if (baseEffects.inflectionSignal === 'decelerating') {
    inflectionAdjustment = -0.15;
  }

  return {
    commodityAdjustment,
    baseAdjustment,
    inflectionAdjustment,
    total: commodityAdjustment + baseAdjustment + inflectionAdjustment,
  };
}

export function computeRateOfChangeSignal(
  baseEffects: BaseEffectsAnalysis,
  commodityInputs: CommodityInputs
): RateOfChangeSignal {
  const trailingYoY = baseEffects.actualYoY;
  const overlays = computeNowcastOverlays(baseEffects, commodityInputs);
  const pointEstimate = trailingYoY + overlays.total;

  // Uncertainty range: wider when commodity volatility is high
  const commodityVolatility = Math.abs(commodityInputs.compositeSignal);
  const halfRange = 0.3 + commodityVolatility * 0.02;

  const probableRange = {
    low: Math.round((pointEstimate - halfRange) * 100) / 100,
    high: Math.round((pointEstimate + halfRange) * 100) / 100,
  };

  // Direction
  let direction: 'accelerating' | 'decelerating' | 'stable';
  const delta = pointEstimate - trailingYoY;
  if (delta > 0.1) {
    direction = 'accelerating';
  } else if (delta < -0.1) {
    direction = 'decelerating';
  } else {
    direction = 'stable';
  }

  // Momentum alignment
  const baseDirection =
    baseEffects.baseClassification === 'easy'
      ? 'up'
      : baseEffects.baseClassification === 'hard'
        ? 'down'
        : 'neutral';
  const commodityDirection =
    commodityInputs.signalDirection === 'inflationary'
      ? 'up'
      : commodityInputs.signalDirection === 'deflationary'
        ? 'down'
        : 'neutral';

  const momentumAligned =
    baseDirection === commodityDirection ||
    baseDirection === 'neutral' ||
    commodityDirection === 'neutral';

  let baseAndCommodityAgreement: string;
  if (baseDirection === commodityDirection && baseDirection !== 'neutral') {
    baseAndCommodityAgreement = `Aligned ${baseDirection === 'up' ? 'inflationary' : 'deflationary'} — both base effects and commodities point ${baseDirection}`;
  } else if (baseDirection !== 'neutral' && commodityDirection !== 'neutral') {
    baseAndCommodityAgreement = `Diverging — base effects (${baseDirection}) and commodities (${commodityDirection}) conflict`;
  } else {
    baseAndCommodityAgreement = 'Mixed — one or both signals are neutral';
  }

  return {
    direction,
    pointEstimate: Math.round(pointEstimate * 100) / 100,
    probableRange,
    momentumAligned,
    baseAndCommodityAgreement,
  };
}
