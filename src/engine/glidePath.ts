import type { PortfolioAllocation } from '../types/portfolio';
import type { CalculatorInputs } from '../types/calculator';

/**
 * Target-date glide path allocation.
 *
 * Models the approach used by Vanguard/Fidelity/Schwab target-date funds:
 * - High equity when far from retirement
 * - Gradually shifts to bonds as retirement approaches
 * - Maintains some equity in retirement for longevity protection
 *
 * Equity glide: 90% at 40+ years out → 40% at retirement → 30% 20 years into retirement
 */

const GLIDE_ASSETS = [
  { name: 'US Equities', annualVolatility: 0.16, expectedReturn: 0.10, color: '#3b82f6' },
  { name: 'Intl Equities', annualVolatility: 0.18, expectedReturn: 0.08, color: '#8b5cf6' },
  { name: 'US Bonds', annualVolatility: 0.05, expectedReturn: 0.04, color: '#22c55e' },
  { name: 'TIPS', annualVolatility: 0.07, expectedReturn: 0.035, color: '#f59e0b' },
  { name: 'Short-Term Reserves', annualVolatility: 0.02, expectedReturn: 0.03, color: '#64748b' },
];

// Correlation matrix: [USEq, IntlEq, USBonds, TIPS, ShortTerm]
// Based on long-run historical correlations
const GLIDE_CORR: number[][] = [
  [1.00, 0.85, -0.10, 0.05, 0.02],  // US Equities
  [0.85, 1.00, -0.05, 0.10, 0.03],  // Intl Equities
  [-0.10, -0.05, 1.00, 0.70, 0.60], // US Bonds
  [0.05, 0.10, 0.70, 1.00, 0.50],   // TIPS
  [0.02, 0.03, 0.60, 0.50, 1.00],   // Short-Term Reserves
];

/** Portfolio volatility using full covariance: sqrt(w' * Cov * w) */
function portfolioVol(weights: number[], assets: typeof GLIDE_ASSETS, corr: number[][]): number {
  let variance = 0;
  for (let i = 0; i < weights.length; i++) {
    for (let j = 0; j < weights.length; j++) {
      variance += weights[i] * weights[j] *
        assets[i].annualVolatility * assets[j].annualVolatility * corr[i][j];
    }
  }
  return Math.sqrt(Math.max(0, variance));
}

export function calculateGlidePath(inputs: CalculatorInputs): PortfolioAllocation {
  const yearsToRetirement = Math.max(0, inputs.retirementAge - inputs.currentAge);

  // Equity percentage follows a glide curve
  // 40+ years out: 90%, at retirement: 40%, 20 years past: 30%
  let equityPct: number;
  if (yearsToRetirement >= 40) {
    equityPct = 0.90;
  } else if (yearsToRetirement >= 10) {
    // Linear glide from 90% at 40 years to 50% at 10 years
    equityPct = 0.50 + (yearsToRetirement - 10) * (0.40 / 30);
  } else if (yearsToRetirement > 0) {
    // Steeper glide from 50% at 10 years to 40% at retirement
    equityPct = 0.40 + yearsToRetirement * (0.10 / 10);
  } else {
    // Already at or past retirement age
    equityPct = 0.35;
  }

  // Split equity: 60% domestic, 40% international
  const usEquity = equityPct * 0.60;
  const intlEquity = equityPct * 0.40;

  // Bond allocation
  const bondPct = 1 - equityPct;

  // Split bonds: as retirement approaches, add more TIPS and short-term reserves
  const shortTermPct = yearsToRetirement <= 5
    ? bondPct * 0.25
    : yearsToRetirement <= 15
      ? bondPct * 0.10
      : 0;
  const tipsPct = bondPct * 0.35;
  const usBondPct = bondPct - tipsPct - shortTermPct;

  const weights = [usEquity, intlEquity, usBondPct, tipsPct, shortTermPct];

  const expectedPortfolioReturn = weights.reduce(
    (sum, w, i) => sum + w * GLIDE_ASSETS[i].expectedReturn,
    0
  );

  const portfolioVolatility = portfolioVol(weights, GLIDE_ASSETS, GLIDE_CORR);

  return {
    allocations: GLIDE_ASSETS.map((asset, i) => ({
      ...asset,
      weight: weights[i],
    })),
    expectedPortfolioReturn,
    portfolioVolatility,
  };
}
