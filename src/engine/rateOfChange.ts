import type {
  BaseEffectsAnalysis,
  CommodityInputs,
  RateOfChangeSignal,
} from '../types/cpiNowcast';

/**
 * Step 3: Rate-of-Change Signal
 * Synthesize base effects and commodity inputs into a directional signal.
 */

// Commodity pass-through coefficient: how much commodity YoY
// translates to CPI YoY change. Empirically ~0.03-0.05 for energy,
// lower for food. We use a blended coefficient.
const COMMODITY_PASSTHROUGH = 0.04;

export function computeRateOfChangeSignal(
  baseEffects: BaseEffectsAnalysis,
  commodityInputs: CommodityInputs
): RateOfChangeSignal {
  // Start with the actual trailing YoY as anchor
  const trailingYoY = baseEffects.actualYoY;

  // Adjust for commodity momentum
  const commodityAdjustment = commodityInputs.compositeSignal * COMMODITY_PASSTHROUGH;

  // Base effect adjustment: if base is "easy", YoY tends higher; if "hard", lower
  let baseAdjustment = 0;
  if (baseEffects.baseClassification === 'easy') {
    baseAdjustment = 0.2; // easy base biases YoY up
  } else if (baseEffects.baseClassification === 'hard') {
    baseAdjustment = -0.2; // hard base biases YoY down
  }

  // Inflection signal from 2-year base effect first difference
  let inflectionAdjustment = 0;
  if (baseEffects.inflectionSignal === 'accelerating') {
    inflectionAdjustment = 0.1;
  } else if (baseEffects.inflectionSignal === 'decelerating') {
    inflectionAdjustment = -0.1;
  }

  const pointEstimate =
    trailingYoY + commodityAdjustment + baseAdjustment + inflectionAdjustment;

  // Uncertainty range: wider when commodity volatility is high
  const commodityVolatility = Math.abs(commodityInputs.compositeSignal);
  const halfRange = 0.3 + commodityVolatility * 0.01;

  const probableRange = {
    low: Math.round((pointEstimate - halfRange) * 100) / 100,
    high: Math.round((pointEstimate + halfRange) * 100) / 100,
  };

  // Direction: comparing our estimate to trailing
  let direction: 'accelerating' | 'decelerating' | 'stable';
  const delta = pointEstimate - trailingYoY;
  if (delta > 0.15) {
    direction = 'accelerating';
  } else if (delta < -0.15) {
    direction = 'decelerating';
  } else {
    direction = 'stable';
  }

  // Momentum alignment: are base effects and commodities pointing same way?
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
