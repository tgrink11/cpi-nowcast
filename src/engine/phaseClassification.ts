import type {
  CommodityObservation,
  RateOfChangeSignal,
  PhaseClassification,
  EconomicPhase,
} from '../types/cpiNowcast';

/**
 * Step 4: Phase Classification
 * Classify the current economic regime based on growth + inflation directions.
 *
 * Phase 1: Growth up,   Inflation down  (Goldilocks)
 * Phase 2: Growth up,   Inflation up    (Reflation)
 * Phase 3: Growth down,  Inflation up    (Stagflation)
 * Phase 4: Growth down,  Inflation down  (Deflation/Contraction)
 */

const PHASE_DEFINITIONS: Record<
  EconomicPhase,
  Omit<PhaseClassification, 'phase' | 'growthDirection' | 'inflationDirection'>
> = {
  1: {
    phaseName: 'Goldilocks',
    description: 'Growth accelerating, inflation decelerating — ideal conditions',
    favoredAssets: [
      'Growth Equities',
      'Long-Duration Bonds',
      'Technology',
      'Consumer Discretionary',
    ],
  },
  2: {
    phaseName: 'Reflation',
    description: 'Growth and inflation both accelerating — expansion with pricing pressure',
    favoredAssets: [
      'Commodities',
      'Value Equities',
      'TIPS',
      'Energy',
      'Financials',
      'Short-Duration Bonds',
    ],
  },
  3: {
    phaseName: 'Stagflation',
    description: 'Growth decelerating, inflation accelerating — worst of both worlds',
    favoredAssets: [
      'Commodities',
      'Gold',
      'TIPS',
      'Cash',
      'Real Assets',
      'Defensive Equities',
    ],
  },
  4: {
    phaseName: 'Deflation / Contraction',
    description: 'Growth and inflation both decelerating — risk-off environment',
    favoredAssets: [
      'Long-Duration Treasuries',
      'Investment-Grade Bonds',
      'Cash',
      'Utilities',
      'Healthcare',
    ],
  },
};

/**
 * Returns the effective growth direction used for phase classification.
 *
 * Despite the name, this combines a level rule and a direction rule:
 *   - Latest quarter below 1.5% annualized → "down" regardless of trend.
 *   - Latest quarter decelerating from prior → "down".
 *   - Otherwise → "up".
 *
 * This is deliberate. A pure direction comparison would classify 0.3% → 0.7%
 * as "up" (growth accelerating) and put the regime in Phase 1/Goldilocks,
 * which mis-represents what a sub-trend-growth environment feels like. The
 * level floor catches stagflation cases where growth is technically positive
 * but too weak to be expansionary (e.g., Q4 2025 GDP at 0.7% annualized).
 *
 * The output is consumed by `classifyPhase` as a binary growth dimension; if
 * a future caller needs to distinguish "weak-but-accelerating" from "strong-
 * and-decelerating," add a separate `growthRegime` field rather than relaxing
 * this rule.
 */
function getGdpDirection(gdpData: CommodityObservation[]): 'up' | 'down' {
  if (gdpData.length < 2) return 'up'; // default assumption

  // Sort by date descending
  const sorted = [...gdpData].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const latest = sorted[0].value;
  const prior = sorted[1].value;

  if (latest < 1.5) return 'down';
  if (latest < prior) return 'down';
  return 'up';
}

export function classifyPhase(
  rateOfChange: RateOfChangeSignal,
  gdpData: CommodityObservation[]
): PhaseClassification {
  const growthDirection = getGdpDirection(gdpData);
  // The phase grid is 2x2 (up/down × up/down), so "stable" inflation needs
  // to be projected onto either "up" or "down." We treat stable as "down"
  // (i.e., not accelerating) because the asset-class implications of stable
  // inflation are closer to those of decelerating inflation than to
  // accelerating: bond duration, growth equities, and quality factors still
  // benefit when CPI is anchored. If a future caller wants a 3-state grid,
  // expand `EconomicPhase` rather than retuning this mapping.
  const inflationDirection: 'up' | 'down' =
    rateOfChange.direction === 'accelerating' ? 'up' : 'down';

  let phase: EconomicPhase;
  if (growthDirection === 'up' && inflationDirection === 'down') {
    phase = 1;
  } else if (growthDirection === 'up' && inflationDirection === 'up') {
    phase = 2;
  } else if (growthDirection === 'down' && inflationDirection === 'up') {
    phase = 3;
  } else {
    phase = 4;
  }

  const def = PHASE_DEFINITIONS[phase];
  return {
    phase,
    growthDirection,
    inflationDirection,
    ...def,
  };
}
