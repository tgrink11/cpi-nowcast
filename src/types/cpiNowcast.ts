export interface CpiObservation {
  date: string;
  value: number;
}

export interface CommodityObservation {
  date: string;
  value: number;
}

export interface BaseEffectsAnalysis {
  targetMonth: string;
  currentCpiLevel: number;
  yearAgoCpiLevel: number;
  twoYearAgoCpiLevel: number;
  actualYoY: number;
  oneYearBaseEffect: number;
  twoYearBaseEffect: number;
  priorTwoYearBaseEffect: number;
  baseEffectFirstDifference: number;
  baseClassification: 'easy' | 'hard' | 'neutral';
  inflectionSignal: 'accelerating' | 'decelerating' | 'none';
}

export interface CommodityInputs {
  brentCrudeYoY: number | null;
  crbIndexYoY: number | null;
  faoFoodPriceYoY: number | null;
  compositeSignal: number;
  signalDirection: 'inflationary' | 'deflationary' | 'neutral';
}

export interface RateOfChangeSignal {
  direction: 'accelerating' | 'decelerating' | 'stable';
  pointEstimate: number;
  probableRange: { low: number; high: number };
  momentumAligned: boolean;
  baseAndCommodityAgreement: string;
}

export type EconomicPhase = 1 | 2 | 3 | 4;

export interface PhaseClassification {
  phase: EconomicPhase;
  phaseName: string;
  growthDirection: 'up' | 'down';
  inflationDirection: 'up' | 'down';
  description: string;
  favoredAssets: string[];
}

export interface NowcastOutput {
  asOfDate: string;
  nowcastCpiYoY: number;
  direction: 'accelerating' | 'decelerating' | 'stable';
  confidence: 'high' | 'medium' | 'low';
  confidenceRationale: string;
  phase: PhaseClassification;
  baseEffects: BaseEffectsAnalysis;
  commodityInputs: CommodityInputs;
  rateOfChange: RateOfChangeSignal;
}

export interface CpiChartPoint {
  date: string;
  month: string;
  actualYoY: number | null;
  modelYoY: number | null;
  projectedYoY: number | null;
  /** Cleveland Fed's current CPI YoY nowcast, plotted on the target month only. */
  clevelandYoY?: number | null;
}

/**
 * One index (headline or core) parsed from the Cleveland Fed nowcast feeds.
 * Values are null when the Fed's model is between cycles for that index.
 */
export interface ClevelandSeries {
  yoY: number | null;
  moM: number | null;
  /** Realized value if the target month has already printed, else null. */
  actualYoY: number | null;
}

export interface ClevelandBaseline {
  /** Generation timestamp reported inside the Fed feed (e.g. "2026-07-17 00:00"). */
  asOf: string | null;
  /** Marker label from the feed, e.g. "CPI Jul" / "PCE Jul". */
  targetLabel: string | null;
  cpi: ClevelandSeries;
  coreCpi: ClevelandSeries;
}

/** Our overlay's lean relative to the Cleveland Fed baseline, in percentage points. */
export interface NowcastTilt {
  /** ourNowcast − clevelandCpiYoY; null when the Fed CPI nowcast is unavailable. */
  cpiDeltaPp: number | null;
  ourCpiYoY: number;
  clevelandCpiYoY: number | null;
  direction: 'hotter' | 'cooler' | 'inline' | 'n/a';
}

/**
 * Honest, out-of-sample-style accuracy of our overlay model, computed by
 * replaying the backtest and comparing to realized CPI. Replaces the old
 * fabricated confidence band.
 */
export interface AccuracyStats {
  /** Mean absolute error of the model line vs actual, in pp, over the backtest. */
  modelMae: number;
  medianAe: number;
  /** MAE of a naive "next YoY = last YoY" persistence forecast, for skill context. */
  naiveMae: number;
  /** 1 − modelMae/naiveMae. Positive = beats persistence. */
  skillVsNaive: number;
  /** Number of months scored. */
  n: number;
}

export type SourceHealth = 'ok' | 'stale' | 'unavailable';

export interface DataStatus {
  fred: SourceHealth;
  fmp: SourceHealth;
  cleveland: SourceHealth;
}

/**
 * The precomputed daily payload served by /api/snapshot and rendered by the
 * client. All heavy computation happens server-side once per refresh.
 */
export interface Snapshot {
  /** ISO timestamp when this snapshot was computed. */
  generatedAt: string;
  nowcast: NowcastOutput;
  chartData: CpiChartPoint[];
  cleveland: ClevelandBaseline | null;
  tilt: NowcastTilt;
  accuracy: AccuracyStats | null;
  dataStatus: DataStatus;
}

export interface CpiNowcastState {
  status: 'idle' | 'loading' | 'success' | 'error';
  error: string | null;
  nowcast: NowcastOutput | null;
  chartData: CpiChartPoint[];
  historicalNowcasts: Array<{ date: string; nowcast: number; actual: number }>;
}

export interface RawDataBundle {
  cpi: CpiObservation[];
  brent: CommodityObservation[];
  ppiaco: CommodityObservation[];
  faoFood: CommodityObservation[];
  gdpGrowth: CommodityObservation[];
}
