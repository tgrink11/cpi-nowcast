import { describe, it, expect } from 'vitest';
import { calculateNestEgg } from '../nestEgg';
import { DEFAULT_INPUTS } from '../../state/defaults';

describe('calculateNestEgg', () => {
  it('computes a reasonable nest egg for default inputs', () => {
    const result = calculateNestEgg(DEFAULT_INPUTS);
    // With default inputs (65 retire, 90 life, $60k spend), expect $1M-$3M range
    expect(result.requiredNestEgg).toBeGreaterThan(1_000_000);
    expect(result.requiredNestEgg).toBeLessThan(3_000_000);
  });

  it('returns correct number of year projections', () => {
    const result = calculateNestEgg(DEFAULT_INPUTS);
    expect(result.yearProjections).toHaveLength(25); // 90 - 65
    expect(result.retirementYears).toBe(25);
  });

  it('first year age equals retirement age', () => {
    const result = calculateNestEgg(DEFAULT_INPUTS);
    expect(result.yearProjections[0].age).toBe(DEFAULT_INPUTS.retirementAge);
  });

  it('has monotonically increasing cumulative PV', () => {
    const result = calculateNestEgg(DEFAULT_INPUTS);
    for (let i = 1; i < result.yearProjections.length; i++) {
      expect(result.yearProjections[i].cumulativePV).toBeGreaterThanOrEqual(
        result.yearProjections[i - 1].cumulativePV
      );
    }
  });

  it('net withdrawal is never negative', () => {
    const result = calculateNestEgg(DEFAULT_INPUTS);
    result.yearProjections.forEach((yp) => {
      expect(yp.netWithdrawal).toBeGreaterThanOrEqual(0);
    });
  });

  it('peak spending year is last year (spending always grows)', () => {
    const result = calculateNestEgg(DEFAULT_INPUTS);
    const lastYear = result.yearProjections[result.yearProjections.length - 1];
    expect(result.peakSpendingYear.year).toBe(lastYear.year);
  });

  it('handles zero retirement years', () => {
    const inputs = { ...DEFAULT_INPUTS, retirementAge: 90, lifeExpectancy: 90 };
    const result = calculateNestEgg(inputs);
    expect(result.requiredNestEgg).toBe(0);
    expect(result.yearProjections).toHaveLength(0);
  });

  it('higher spending requires larger nest egg', () => {
    const low = calculateNestEgg({ ...DEFAULT_INPUTS, annualSpend: 40000 });
    const high = calculateNestEgg({ ...DEFAULT_INPUTS, annualSpend: 80000 });
    expect(high.requiredNestEgg).toBeGreaterThan(low.requiredNestEgg);
  });

  it('longer retirement requires larger nest egg', () => {
    const short = calculateNestEgg({ ...DEFAULT_INPUTS, lifeExpectancy: 80 });
    const long = calculateNestEgg({ ...DEFAULT_INPUTS, lifeExpectancy: 100 });
    expect(long.requiredNestEgg).toBeGreaterThan(short.requiredNestEgg);
  });

  it('health share ramps from start to end over the period', () => {
    const result = calculateNestEgg(DEFAULT_INPUTS);
    const firstYear = result.yearProjections[0];
    const lastYear = result.yearProjections[result.yearProjections.length - 1];
    expect(firstYear.healthShare).toBeLessThan(lastYear.healthShare);
  });
});
