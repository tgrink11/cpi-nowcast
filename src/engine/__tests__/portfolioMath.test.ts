import { describe, it, expect } from 'vitest';
import { portfolioVol } from '../portfolioMath';
import { GLIDE_ASSETS, GLIDE_CORR } from '../glidePath';
import { ASSET_CLASSES, RP_CORR } from '../riskParity';

function assertValidCorrelationMatrix(corr: number[][], assets: { name: string }[], label: string) {
  it(`${label}: matrix rows match asset count`, () => {
    expect(corr.length).toBe(assets.length);
  });

  it(`${label}: every row has correct length`, () => {
    for (let i = 0; i < corr.length; i++) {
      expect(corr[i].length).toBe(assets.length);
    }
  });

  it(`${label}: diagonal is 1.0`, () => {
    for (let i = 0; i < corr.length; i++) {
      expect(corr[i][i]).toBe(1.0);
    }
  });

  it(`${label}: matrix is symmetric`, () => {
    for (let i = 0; i < corr.length; i++) {
      for (let j = i + 1; j < corr[i].length; j++) {
        expect(corr[i][j]).toBe(corr[j][i]);
      }
    }
  });

  it(`${label}: all values in [-1, 1]`, () => {
    for (let i = 0; i < corr.length; i++) {
      for (let j = 0; j < corr[i].length; j++) {
        expect(corr[i][j]).toBeGreaterThanOrEqual(-1);
        expect(corr[i][j]).toBeLessThanOrEqual(1);
      }
    }
  });
}

describe('correlation matrix validation', () => {
  assertValidCorrelationMatrix(GLIDE_CORR, GLIDE_ASSETS, 'glidePath');
  assertValidCorrelationMatrix(RP_CORR, ASSET_CLASSES, 'riskParity');
});

describe('portfolioVol', () => {
  it('single asset returns that asset volatility', () => {
    const assets = [{ name: 'A', annualVolatility: 0.16, expectedReturn: 0.10, color: '#000' }];
    const corr = [[1.0]];
    expect(portfolioVol([1.0], assets, corr)).toBeCloseTo(0.16, 6);
  });

  it('two uncorrelated assets reduce volatility', () => {
    const assets = [
      { name: 'A', annualVolatility: 0.16, expectedReturn: 0.10, color: '#000' },
      { name: 'B', annualVolatility: 0.16, expectedReturn: 0.10, color: '#000' },
    ];
    const corr = [[1, 0], [0, 1]];
    const vol = portfolioVol([0.5, 0.5], assets, corr);
    expect(vol).toBeLessThan(0.16);
    // 50/50 uncorrelated: σ = 0.16 * sqrt(0.5) ≈ 0.1131
    expect(vol).toBeCloseTo(0.16 * Math.sqrt(0.5), 6);
  });

  it('perfectly correlated assets give weighted sum of vols', () => {
    const assets = [
      { name: 'A', annualVolatility: 0.16, expectedReturn: 0.10, color: '#000' },
      { name: 'B', annualVolatility: 0.08, expectedReturn: 0.05, color: '#000' },
    ];
    const corr = [[1, 1], [1, 1]];
    const vol = portfolioVol([0.6, 0.4], assets, corr);
    expect(vol).toBeCloseTo(0.6 * 0.16 + 0.4 * 0.08, 6);
  });

  it('throws on dimension mismatch', () => {
    const assets = [
      { name: 'A', annualVolatility: 0.16, expectedReturn: 0.10, color: '#000' },
    ];
    const corr = [[1, 0], [0, 1]];
    expect(() => portfolioVol([1.0], assets, corr)).toThrow('Dimension mismatch');
  });
});
