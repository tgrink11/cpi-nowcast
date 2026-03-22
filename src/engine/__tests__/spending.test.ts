import { describe, it, expect } from 'vitest';
import { projectSpending } from '../spending';

describe('projectSpending', () => {
  it('first year equals base spend (no inflation applied)', () => {
    const result = projectSpending(60000, [0.05], false, 0.02);
    expect(result[0]).toBe(60000);
  });

  it('compounds over multiple years with constant inflation', () => {
    const inflations = [0.05, 0.05, 0.05];
    const result = projectSpending(60000, inflations, false, 0.02);
    expect(result[0]).toBe(60000);
    expect(result[1]).toBeCloseTo(63000, 0);
    expect(result[2]).toBeCloseTo(66150, 0);
  });

  it('applies lifestyle creep when enabled', () => {
    const inflations = [0.05, 0.05];
    const withCreep = projectSpending(60000, inflations, true, 0.02);
    const withoutCreep = projectSpending(60000, inflations, false, 0.02);
    // First year is the same (base spend)
    expect(withCreep[0]).toBe(withoutCreep[0]);
    // Second year onwards, creep kicks in
    expect(withCreep[1]).toBeGreaterThan(withoutCreep[1]);
  });

  it('returns empty array for empty inflation input', () => {
    const result = projectSpending(60000, [], false, 0.02);
    expect(result).toHaveLength(0);
  });

  it('handles zero base spend', () => {
    const result = projectSpending(0, [0.05, 0.05], false, 0.02);
    expect(result[0]).toBe(0);
    expect(result[1]).toBe(0);
  });
});
