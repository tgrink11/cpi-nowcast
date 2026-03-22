/**
 * Project spending year-over-year using iterative compounding.
 * Year 1 = baseSpend (in retirement-year dollars).
 * Year 2+ = previous year * (1 + I_eff_n) * (1 + creep).
 * We use iterative compounding because I_eff varies each year
 * as the health share ramps up.
 */
export function projectSpending(
  baseSpend: number,
  effectiveInflations: number[],
  lifestyleCreepEnabled: boolean,
  lifestyleCreepRate: number
): number[] {
  const years = effectiveInflations.length;
  if (years === 0) return [];
  const spending: number[] = new Array(years);
  let current = baseSpend;
  spending[0] = current;

  for (let n = 1; n < years; n++) {
    const inflFactor = 1 + effectiveInflations[n];
    const creepFactor = lifestyleCreepEnabled ? 1 + lifestyleCreepRate : 1;
    current = current * inflFactor * creepFactor;
    spending[n] = current;
  }

  return spending;
}
