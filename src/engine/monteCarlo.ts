import { calculateNestEgg } from './nestEgg';
import type { CalculatorInputs, MonteCarloResult, YearlyPercentile } from '../types/calculator';

/**
 * Return the value at a given percentile from a pre-sorted array.
 * Uses nearest-rank method with linear interpolation for accuracy.
 */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = p * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/**
 * Run Monte Carlo simulation: randomize investment returns,
 * health inflation +/-1.5%, and longevity +/-5 years across N runs.
 */
export function runMonteCarlo(
  inputs: CalculatorInputs,
  runs: number = 1000
): MonteCarloResult {
  const allResults: number[] = [];
  const maxYears = (inputs.lifeExpectancy + 5) - inputs.retirementAge;
  const yearlyNestEggs: number[][] = Array.from({ length: maxYears }, () => []);

  for (let i = 0; i < runs; i++) {
    const healthDelta = (Math.random() - 0.5) * 0.03; // +/- 1.5%
    const longevityDelta = Math.round((Math.random() - 0.5) * 10); // +/- 5 years
    // Randomize safe rate (proxy for return environment) +/- 1.5%
    const returnDelta = (Math.random() - 0.5) * 0.03;

    const modifiedInputs: CalculatorInputs = {
      ...inputs,
      healthInflation: Math.max(0, inputs.healthInflation + healthDelta),
      lifeExpectancy: Math.max(
        inputs.retirementAge + 1,
        Math.min(100, inputs.lifeExpectancy + longevityDelta)
      ),
      safeRate: Math.max(0.01, inputs.safeRate + returnDelta),
    };

    const result = calculateNestEgg(modifiedInputs);
    allResults.push(result.requiredNestEgg);

    // Collect yearly data for fan chart
    for (let y = 0; y < result.yearProjections.length && y < maxYears; y++) {
      yearlyNestEggs[y].push(result.yearProjections[y].cumulativePV);
    }
  }

  // Sort once for percentile computation
  allResults.sort((a, b) => a - b);

  // Compute yearly percentiles for the fan chart
  const yearlyPercentiles: YearlyPercentile[] = [];
  for (let y = 0; y < maxYears; y++) {
    const yearData = yearlyNestEggs[y];
    if (yearData.length === 0) break;
    yearData.sort((a, b) => a - b);
    yearlyPercentiles.push({
      year: y + 1,
      age: inputs.retirementAge + y,
      p10: percentile(yearData, 0.10),
      p25: percentile(yearData, 0.25),
      p50: percentile(yearData, 0.50),
      p75: percentile(yearData, 0.75),
      p90: percentile(yearData, 0.90),
    });
  }

  return {
    results: allResults,
    percentiles: {
      p10: percentile(allResults, 0.10),
      p25: percentile(allResults, 0.25),
      p50: percentile(allResults, 0.50),
      p75: percentile(allResults, 0.75),
      p90: percentile(allResults, 0.90),
    },
    mean: allResults.reduce((a, b) => a + b, 0) / allResults.length,
    min: allResults[0],
    max: allResults[allResults.length - 1],
    yearlyPercentiles,
  };
}
