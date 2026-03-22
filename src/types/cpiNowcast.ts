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
