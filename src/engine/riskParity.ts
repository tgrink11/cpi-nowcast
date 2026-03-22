import type { AssetClass, PortfolioAllocation } from '../types/portfolio';
import type { CalculatorInputs } from '../types/calculator';

const ASSET_CLASSES: AssetClass[] = [
  { name: 'US Equities', annualVolatility: 0.16, expectedReturn: 0.10, color: '#3b82f6' },
  { name: 'Intl Equities', annualVolatility: 0.18, expectedReturn: 0.08, color: '#8b5cf6' },
  { name: 'US Bonds', annualVolatility: 0.05, expectedReturn: 0.04, color: '#22c55e' },
  { name: 'TIPS', annualVolatility: 0.07, expectedReturn: 0.035, color: '#f59e0b' },
  { name: 'Commodities', annualVolatility: 0.20, expectedReturn: 0.05, color: '#ef4444' },
  { name: 'REITs', annualVolatility: 0.19, expectedReturn: 0.07, color: '#ec4899' },
];

// Correlation matrix: [USEq, IntlEq, USBonds, TIPS, Commodities, REITs]
const RP_CORR: number[][] = [
  [1.00, 0.85, -0.10, 0.05, 0.15, 0.60],  // US Equities
  [0.85, 1.00, -0.05, 0.10, 0.20, 0.55],  // Intl Equities
  [-0.10, -0.05, 1.00, 0.70, -0.10, 0.10], // US Bonds
  [0.05, 0.10, 0.70, 1.00, 0.15, 0.15],   // TIPS
  [0.15, 0.20, -0.10, 0.15, 1.00, 0.25],  // Commodities
  [0.60, 0.55, 0.10, 0.15, 0.25, 1.00],   // REITs
];

/** Portfolio volatility using full covariance: sqrt(w' * Cov * w) */
function portfolioVol(weights: number[], assets: AssetClass[], corr: number[][]): number {
  let variance = 0;
  for (let i = 0; i < weights.length; i++) {
    for (let j = 0; j < weights.length; j++) {
      variance += weights[i] * weights[j] *
        assets[i].annualVolatility * assets[j].annualVolatility * corr[i][j];
    }
  }
  return Math.sqrt(Math.max(0, variance));
}

/**
 * Inverse-volatility Risk Parity allocation, adjusted for
 * time horizon, retirement length, and risk-need factor.
 *
 * Key driver: years until retirement (currentAge → retirementAge).
 * More years = more equity. Fewer years = more bonds.
 */
export function calculateRiskParity(
  inputs: CalculatorInputs,
  requiredNestEgg: number
): PortfolioAllocation {
  // Step 1: Raw inverse-vol weights
  const inverseVols = ASSET_CLASSES.map((a) => 1 / a.annualVolatility);
  const sumInverseVols = inverseVols.reduce((a, b) => a + b, 0);
  const rawWeights = inverseVols.map((iv) => iv / sumInverseVols);

  // Step 2: Time-horizon tilt — more years to retirement = can take more risk
  // Ranges from 0 (at retirement) to 1 (30+ years away)
  const yearsToRetirement = Math.max(0, inputs.retirementAge - inputs.currentAge);
  const horizonTilt = Math.max(0, Math.min(1, yearsToRetirement / 30));

  // Step 3: Retirement-length factor — longer retirement needs some growth too
  const retirementYears = Math.max(0, inputs.lifeExpectancy - inputs.retirementAge);
  const longevityBoost = Math.max(0, Math.min(0.3, retirementYears / 100));

  // Step 4: Risk-need factor — larger gap between savings and goal = more growth needed
  const riskNeedFactor = Math.min(2.0, Math.max(0.5, requiredNestEgg / 1_000_000));

  // Step 5: Combine into equity vs bond multipliers
  // equityMultiplier: high when young + large need, low when near retirement
  // bondMultiplier: high when near retirement, low when young
  const equityMultiplier = 1 + (horizonTilt + longevityBoost) * 0.8 * riskNeedFactor;
  const bondMultiplier = 1 + (1 - horizonTilt) * 1.2;

  // Step 6: Apply adjustments
  const adjustedWeights = rawWeights.map((w, i) => {
    const isEquity = ASSET_CLASSES[i].name.includes('Equit');
    const isBond =
      ASSET_CLASSES[i].name.includes('Bond') || ASSET_CLASSES[i].name === 'TIPS';

    if (isEquity) return w * equityMultiplier;
    if (isBond) return w * bondMultiplier;
    return w; // alternatives (commodities, REITs) stay at base weight
  });

  // Step 7: Normalize to sum to 1.0
  const totalAdj = adjustedWeights.reduce((a, b) => a + b, 0);
  const finalWeights = adjustedWeights.map((w) => w / totalAdj);

  const expectedPortfolioReturn = finalWeights.reduce(
    (sum, w, i) => sum + w * ASSET_CLASSES[i].expectedReturn,
    0
  );

  const portfolioVolatility = portfolioVol(finalWeights, ASSET_CLASSES, RP_CORR);

  return {
    allocations: ASSET_CLASSES.map((asset, i) => ({
      ...asset,
      weight: finalWeights[i],
    })),
    expectedPortfolioReturn,
    portfolioVolatility,
  };
}
