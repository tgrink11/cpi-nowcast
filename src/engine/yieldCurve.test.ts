import { describe, it, expect } from 'vitest';
import { analyzeYieldCurve } from './yieldCurve';

/** One observation mid-month for each monthly spread value, starting 2023-01. */
function series(monthlyValues: number[]) {
  return monthlyValues.map((value, i) => {
    const y = 2023 + Math.floor(i / 12);
    const m = String((i % 12) + 1).padStart(2, '0');
    return { date: `${y}-${m}-15`, value };
  });
}
const asOfFor = (n: number) => {
  const y = 2023 + Math.floor((n - 1) / 12);
  const m = String(((n - 1) % 12) + 1).padStart(2, '0');
  return `${y}-${m}-28`;
};

describe('analyzeYieldCurve', () => {
  it('returns null with under 13 months of history', () => {
    expect(analyzeYieldCurve(series(new Array(12).fill(1)), [], asOfFor(12))).toBeNull();
  });

  it('classifies a steadily positive curve as normal with no warning', () => {
    const r = analyzeYieldCurve(series(new Array(24).fill(1.2)), [], asOfFor(24))!;
    expect(r.state).toBe('normal');
    expect(r.growthWarning).toBe(false);
  });

  it('does not warn on a fresh (under 3 month) inversion', () => {
    const vals = [...new Array(22).fill(0.8), -0.2, -0.3];
    const r = analyzeYieldCurve(series(vals), [], asOfFor(24))!;
    expect(r.state).toBe('inverted');
    expect(r.invertedMonths12).toBe(2);
    expect(r.growthWarning).toBe(false);
  });

  it('warns once inverted for 3+ of the last 12 months', () => {
    const vals = [...new Array(20).fill(0.8), -0.2, -0.3, -0.4, -0.5];
    const r = analyzeYieldCurve(series(vals), [], asOfFor(24))!;
    expect(r.growthWarning).toBe(true);
  });

  it('flags re-steepening after an inversion and stops after 18 months', () => {
    const vals = [...new Array(12).fill(0.8), -0.5, -0.5, -0.5, 0.3, 0.6];
    const r = analyzeYieldCurve(series(vals), [], asOfFor(vals.length))!;
    expect(r.state).toBe('re-steepening');
    expect(r.monthsSinceInverted).toBe(2);
    expect(r.growthWarning).toBe(true);

    const later = [...vals, ...new Array(17).fill(1.0)];
    const r2 = analyzeYieldCurve(series(later), [], asOfFor(later.length))!;
    expect(r2.state).toBe('normal');
  });

  it('ignores data after asOf (no look-ahead)', () => {
    const vals = [...new Array(24).fill(1.0), -1, -1, -1, -1];
    const r = analyzeYieldCurve(series(vals), [], asOfFor(24))!;
    expect(r.state).toBe('normal');
  });
});
