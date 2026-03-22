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

function getGdpDirection(gdpData: CommodityObservation[]): 'up' | 'down' {
  if (gdpData.length < 2) return 'up'; // default assumption

  // Sort by date descending
  const sorted = [...gdpData].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const latest = sorted[0].value;
  const prior = sorted[1].value;

  // Use both absolute level AND direction of change:
  // - Below 1.5% annualized = weak growth → "down"
  // - Decelerating from prior quarter → "down"
  // This captures stagflation where growth is technically positive
  // but decelerating (e.g., Q4 2025 GDP at 0.7% annualized)
  if (latest < 1.5) return 'down';
  if (latest < prior) return 'down';
  return 'up';
}

export function classifyPhase(
  rateOfChange: RateOfChangeSignal,
  gdpData: CommodityObservation[]
): PhaseClassification {
  const growthDirection = getGdpDirection(gdpData);
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
