import { getHealthShare } from './healthRamp';
import { getEffectiveInflation } from './inflation';
import { projectSpending } from './spending';
import { projectIncome } from './income';
import type { CalculatorInputs, CalculationResult, YearProjection } from '../types/calculator';

/**
 * Main calculation orchestrator.
 * Computes the required nest egg by summing discounted net withdrawals
 * over the entire retirement period.
 */
export function calculateNestEgg(inputs: CalculatorInputs): CalculationResult {
  const totalYears = inputs.lifeExpectancy - inputs.retirementAge;

  if (totalYears <= 0) {
    return {
      requiredNestEgg: 0,
      yearProjections: [],
      retirementYears: 0,
      averageEffectiveInflation: 0,
      peakSpendingYear: {
        year: 0, age: inputs.retirementAge, healthShare: 0,
        effectiveInflation: 0, grossSpend: 0, income: 0,
        netWithdrawal: 0, presentValueNet: 0, cumulativePV: 0,
      },
    };
  }

  // Step 1: Compute health share and effective inflation for each year
  const healthShares = Array.from({ length: totalYears }, (_, n) =>
    getHealthShare(n, totalYears, inputs.healthShareStart, inputs.healthShareEnd)
  );

  const effectiveInflations = healthShares.map((h) =>
    getEffectiveInflation(
      inputs.baselineInflation,
      inputs.healthInflation,
      inputs.techLifestyleInflation,
      inputs.climateBuffer,
      h
    )
  );

  // Step 2: Project spending
  const grossSpending = projectSpending(
    inputs.annualSpend,
    effectiveInflations,
    inputs.lifestyleCreepEnabled,
    inputs.lifestyleCreepRate
  );

  // Step 3: Project income
  const incomes = projectIncome(
    inputs.partTimeIncome,
    inputs.incomeGrowthRate,
    totalYears
  );

  // Steps 4-5: Net withdrawal and present value sum
  let cumulativePV = 0;
  const yearProjections: YearProjection[] = [];

  for (let n = 0; n < totalYears; n++) {
    const netWithdrawal = Math.max(0, grossSpending[n] - incomes[n]);
    const discountFactor = Math.pow(1 + inputs.safeRate, n + 1);
    const presentValueNet = netWithdrawal / discountFactor;
    cumulativePV += presentValueNet;

    yearProjections.push({
      year: n + 1,
      age: inputs.retirementAge + n,
      healthShare: healthShares[n],
      effectiveInflation: effectiveInflations[n],
      grossSpend: grossSpending[n],
      income: incomes[n],
      netWithdrawal,
      presentValueNet,
      cumulativePV,
    });
  }

  const avgInflation =
    effectiveInflations.reduce((a, b) => a + b, 0) / totalYears;

  const peakSpendingYear = yearProjections.reduce((max, yp) =>
    yp.grossSpend > max.grossSpend ? yp : max
  );

  return {
    requiredNestEgg: cumulativePV,
    yearProjections,
    retirementYears: totalYears,
    averageEffectiveInflation: avgInflation,
    peakSpendingYear,
  };
}
