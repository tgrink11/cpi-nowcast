import type { AssetClass } from '../types/portfolio';

/** Portfolio volatility using full covariance: sqrt(w' * Cov * w) */
export function portfolioVol(weights: number[], assets: AssetClass[], corr: number[][]): number {
  const n = assets.length;
  if (weights.length !== n || corr.length !== n) {
    throw new Error(`Dimension mismatch: ${weights.length} weights, ${n} assets, ${corr.length}x correlation matrix`);
  }
  let variance = 0;
  for (let i = 0; i < n; i++) {
    if (corr[i].length !== n) {
      throw new Error(`Correlation matrix row ${i} has ${corr[i].length} entries, expected ${n}`);
    }
    for (let j = 0; j < n; j++) {
      variance += weights[i] * weights[j] *
        assets[i].annualVolatility * assets[j].annualVolatility * corr[i][j];
    }
  }
  return Math.sqrt(Math.max(0, variance));
}
