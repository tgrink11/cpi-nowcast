import type {
  CommodityObservation,
  YieldCurveAnalysis,
  YieldCurveState,
} from '../types/cpiNowcast';

/**
 * Yield curve signal.
 *
 * Primary spread: 10yr − 3mo (FRED T10Y3M). The 3-month bill tracks the
 * policy rate itself, and this spread has the stronger recession-prediction
 * record (Estrella & Mishkin; the NY Fed's recession-probability model).
 * The 10yr − 2yr (T10Y2Y) is carried alongside for reference only.
 *
 * All state logic runs on MONTHLY AVERAGES, not daily closes, so a one-day
 * dip (e.g. the 10–2 in Aug 2019) can't flip the state on its own.
 *
 * States (10–3mo):
 *   inverted       monthly avg < 0
 *   re-steepening  back ≥ 0, but inverted within the last 18 months —
 *                  historically the window in which recessions begin
 *   flat           0 to 0.5pp, no recent inversion
 *   normal         > 0.5pp, no recent inversion
 *
 * The curve leads growth by ~6–18 months, so it is an early-warning input,
 * never a replacement for GDP: see `curveWarnsGrowth`.
 */

const RESTEEPEN_LOOKBACK_MONTHS = 18;
const FLAT_THRESHOLD_PP = 0.5;
/** Months of inversion (within the last 12) before an inversion counts as a warning. */
const MIN_INVERTED_MONTHS = 3;
const HISTORY_MONTHS = 36;

function monthKey(date: string): string {
  return date.slice(0, 7);
}

/** Average daily observations into { 'YYYY-MM': mean } up to and including asOf. */
function monthlyAverages(
  data: CommodityObservation[],
  asOf: string
): Array<{ month: string; value: number }> {
  const sums = new Map<string, { sum: number; n: number }>();
  for (const d of data) {
    if (d.date > asOf || !Number.isFinite(d.value)) continue;
    const k = monthKey(d.date);
    const s = sums.get(k) ?? { sum: 0, n: 0 };
    s.sum += d.value;
    s.n += 1;
    sums.set(k, s);
  }
  return [...sums.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, s]) => ({ month, value: s.sum / s.n }));
}

function latestOnOrBefore(
  data: CommodityObservation[],
  asOf: string
): CommodityObservation | null {
  for (let i = data.length - 1; i >= 0; i--) {
    if (data[i].date <= asOf && Number.isFinite(data[i].value)) return data[i];
  }
  return null;
}

function classifyState(
  monthly: Array<{ month: string; value: number }>
): { state: YieldCurveState; invertedMonths12: number; monthsSinceInverted: number | null } {
  const n = monthly.length;
  const current = monthly[n - 1].value;

  let invertedMonths12 = 0;
  for (let i = Math.max(0, n - 12); i < n; i++) {
    if (monthly[i].value < 0) invertedMonths12++;
  }

  let monthsSinceInverted: number | null = null;
  for (let i = n - 1; i >= 0 && n - 1 - i <= RESTEEPEN_LOOKBACK_MONTHS; i--) {
    if (monthly[i].value < 0) {
      monthsSinceInverted = n - 1 - i;
      break;
    }
  }

  let state: YieldCurveState;
  if (current < 0) state = 'inverted';
  else if (monthsSinceInverted != null) state = 're-steepening';
  else if (current < FLAT_THRESHOLD_PP) state = 'flat';
  else state = 'normal';

  return { state, invertedMonths12, monthsSinceInverted };
}

/**
 * Does the curve warn that growth is about to weaken?
 * True when the curve is re-steepening out of an inversion, or has been
 * inverted for at least MIN_INVERTED_MONTHS of the last 12.
 */
export function curveWarnsGrowth(
  state: YieldCurveState,
  invertedMonths12: number
): boolean {
  if (state === 're-steepening') return true;
  return state === 'inverted' && invertedMonths12 >= MIN_INVERTED_MONTHS;
}

function describe(a: Omit<YieldCurveAnalysis, 'note' | 'history'>): string {
  switch (a.state) {
    case 'inverted':
      return a.invertedMonths12 >= MIN_INVERTED_MONTHS
        ? `Inverted ${a.invertedMonths12} of the last 12 months — historically precedes slowdowns by 6–18 months.`
        : 'Newly inverted — not yet a sustained warning (needs 3+ months).';
    case 're-steepening':
      return `Re-steepening after an inversion ${a.monthsSinceInverted} month${a.monthsSinceInverted === 1 ? '' : 's'} ago — historically the window when slowdowns begin.`;
    case 'flat':
      return 'Flat but positive — late-cycle, no inversion warning.';
    case 'normal':
      return 'Positively sloped — no recession warning from the curve.';
  }
}

/**
 * Analyze the curve as of a given date using only data on or before it,
 * so the same function drives the live snapshot and the historical backtest.
 * Returns null if there isn't enough 10–3mo history.
 */
export function analyzeYieldCurve(
  t10y3m: CommodityObservation[],
  t10y2y: CommodityObservation[],
  asOf: string
): YieldCurveAnalysis | null {
  const monthly3m = monthlyAverages(t10y3m, asOf);
  if (monthly3m.length < 13) return null;

  const monthly2y = monthlyAverages(t10y2y, asOf);
  const { state, invertedMonths12, monthsSinceInverted } = classifyState(monthly3m);
  const latest3m = latestOnOrBefore(t10y3m, asOf);
  const latest2y = latestOnOrBefore(t10y2y, asOf);

  const twoYearByMonth = new Map(monthly2y.map((m) => [m.month, m.value]));
  const history = monthly3m.slice(-HISTORY_MONTHS).map((m) => ({
    month: m.month,
    spread10y3m: Math.round(m.value * 100) / 100,
    spread10y2y:
      twoYearByMonth.has(m.month)
        ? Math.round((twoYearByMonth.get(m.month) as number) * 100) / 100
        : null,
  }));

  const core = {
    asOf: latest3m?.date ?? asOf,
    spread10y3m: latest3m ? latest3m.value : monthly3m[monthly3m.length - 1].value,
    spread10y2y: latest2y ? latest2y.value : null,
    state,
    state10y2y: monthly2y.length >= 13 ? classifyState(monthly2y).state : null,
    invertedMonths12,
    monthsSinceInverted,
    growthWarning: curveWarnsGrowth(state, invertedMonths12),
  };

  return { ...core, history, note: describe(core) };
}
