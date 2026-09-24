/**
 * Yield-curve growth-overlay backtest.
 *
 * Question: does adding the 10yr−3mo curve warning to the GDP growth rule
 * make the phase quadrant's growth call more accurate?
 *
 * Run (Node 24+, native TS):
 *   node scripts/backtest-yield-curve.ts <dataDir>
 *
 * <dataDir> must contain:
 *   ust/<year>.csv   Treasury.gov daily par yield curve CSVs (1990→present)
 *   NipaDataQ.txt    BEA bulk NIPA quarterly file (series A191RL = real GDP
 *                    % change SAAR, identical to FRED A191RL1Q225SBEA)
 *
 * Point-in-time rules (no look-ahead in the signals):
 *   - At month-end M, a GDP quarter is "known" only if it ended ≤ M−1
 *     (advance estimate lands ~4 weeks after quarter end).
 *   - The curve uses daily yields dated ≤ M-end only.
 *   Caveat: GDP values are today's revised figures, not first-print vintages.
 *   Revisions make the GDP-only baseline look better than it was in real
 *   time, so this biases the test AGAINST the curve.
 *
 * Truth targets (both forward-looking — what the growth call should anticipate):
 *   T1 recession   any NBER recession month in M+1..M+12
 *   T2 weak growth average real GDP growth over the next 4 quarters < 1.5%
 *                  (same 1.5% floor the growth rule uses)
 *   T3 slowdown    next-4Q average growth < trailing-4Q average (known quarters)
 *                  — scores the "direction" half of the GDP rule fairly
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { analyzeYieldCurve } from '../src/engine/yieldCurve.ts';
import { getGdpDirection } from '../src/engine/phaseClassification.ts';

type Obs = { date: string; value: number };

const dataDir = process.argv[2];
if (!dataDir) throw new Error('usage: node scripts/backtest-yield-curve.ts <dataDir>');

// ---------- load Treasury yields → daily spreads ----------
function parseCsvLine(line: string): string[] {
  return line.split(',').map((s) => s.replace(/"/g, '').trim());
}
const t10y3m: Obs[] = [];
const t10y2y: Obs[] = [];
for (const f of readdirSync(join(dataDir, 'ust')).filter((f) => f.endsWith('.csv'))) {
  const lines = readFileSync(join(dataDir, 'ust', f), 'utf8').trim().split(/\r?\n/);
  const header = parseCsvLine(lines[0]);
  const i3m = header.indexOf('3 Mo');
  const i2y = header.indexOf('2 Yr');
  const i10 = header.indexOf('10 Yr');
  for (const line of lines.slice(1)) {
    const c = parseCsvLine(line);
    const [mm, dd, yyyy] = c[0].split('/');
    const date = `${yyyy}-${mm}-${dd}`;
    const y10 = parseFloat(c[i10]);
    const y3m = parseFloat(c[i3m]);
    const y2 = parseFloat(c[i2y]);
    if (Number.isFinite(y10) && Number.isFinite(y3m)) t10y3m.push({ date, value: y10 - y3m });
    if (Number.isFinite(y10) && Number.isFinite(y2)) t10y2y.push({ date, value: y10 - y2 });
  }
}
t10y3m.sort((a, b) => a.date.localeCompare(b.date));
t10y2y.sort((a, b) => a.date.localeCompare(b.date));

// ---------- load GDP (quarter → growth, dated at quarter START like FRED) ----------
const gdp: Array<Obs & { qEnd: string }> = [];
for (const line of readFileSync(join(dataDir, 'NipaDataQ.txt'), 'utf8').split(/\r?\n/)) {
  if (!line.startsWith('A191RL,')) continue;
  const [, period, raw] = line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
  const y = Number(period.slice(0, 4));
  const q = Number(period.slice(5));
  const startM = (q - 1) * 3 + 1;
  const endM = q * 3;
  gdp.push({
    date: `${y}-${String(startM).padStart(2, '0')}-01`,
    qEnd: `${y}-${String(endM).padStart(2, '0')}`,
    value: parseFloat(raw.replace(/"/g, '')),
  });
}

// ---------- NBER recession months (USREC convention: month after peak → trough) ----------
const RECESSIONS: Array<[string, string]> = [
  ['1990-08', '1991-03'],
  ['2001-04', '2001-11'],
  ['2008-01', '2009-06'],
  ['2020-03', '2020-04'],
];
const inRecession = (ym: string) => RECESSIONS.some(([a, b]) => ym >= a && ym <= b);

// ---------- helpers ----------
function shiftYm(ym: string, n: number): string {
  const [y, m] = ym.split('-').map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
}
const monthEnd = (ym: string) => `${ym}-31`;

// ---------- replay ----------
type Row = {
  ym: string;
  gdpLatest: number;
  base: boolean; // true = growth "down"
  curveWarn: boolean;
  state: string;
  t1: boolean | null;
  t2: boolean | null;
  t3: boolean | null;
};
const rows: Row[] = [];
const lastGdpQEnd = gdp[gdp.length - 1].qEnd;

for (let ym = '1991-01'; ym <= '2026-08'; ym = shiftYm(ym, 1)) {
  const known = gdp.filter((g) => g.qEnd <= shiftYm(ym, -1));
  if (known.length < 2) continue;
  const curve = analyzeYieldCurve(t10y3m, t10y2y, monthEnd(ym));
  if (!curve) continue;

  const base = getGdpDirection(known) === 'down';

  // T1: recession in next 12 months (needs 12 months of realized history)
  let t1: boolean | null = null;
  if (shiftYm(ym, 12) <= '2026-08') {
    t1 = false;
    for (let k = 1; k <= 12; k++) if (inRecession(shiftYm(ym, k))) t1 = true;
  }
  // T2: next 4 not-yet-known quarters average < 1.5%
  const future = gdp.filter((g) => g.qEnd > shiftYm(ym, -1)).slice(0, 4);
  const t2 =
    future.length === 4 && future[3].qEnd <= lastGdpQEnd
      ? future.reduce((s, g) => s + g.value, 0) / 4 < 1.5
      : null;
  const trailing = known.slice(-4);
  const t3 =
    t2 == null
      ? null
      : future.reduce((s, g) => s + g.value, 0) / 4 <
        trailing.reduce((s, g) => s + g.value, 0) / trailing.length;

  rows.push({
    ym,
    gdpLatest: known[known.length - 1].value,
    base,
    curveWarn: curve.growthWarning,
    state: curve.state,
    t1,
    t2,
    t3,
  });
}

// ---------- scoring ----------
type Rule = { name: string; call: (r: Row) => boolean };
const RULES: Rule[] = [
  { name: 'GDP only (current)', call: (r) => r.base },
  { name: 'GDP + curve, gated GDP<2.5 (proposed)', call: (r) => r.base || (r.curveWarn && r.gdpLatest < 2.5) },
  { name: 'GDP + curve, no gate', call: (r) => r.base || r.curveWarn },
  { name: 'Curve warning alone', call: (r) => r.curveWarn },
  { name: 'GDP level only (<1.5, no decel)', call: (r) => r.gdpLatest < 1.5 },
  { name: 'GDP level + curve, gated', call: (r) => r.gdpLatest < 1.5 || (r.curveWarn && r.gdpLatest < 2.5) },
];

function score(rule: Rule, subset: Row[], target: 't1' | 't2' | 't3') {
  let tp = 0, fp = 0, tn = 0, fn = 0;
  for (const r of subset) {
    const truth = r[target];
    if (truth == null) continue;
    const pred = rule.call(r);
    if (pred && truth) tp++;
    else if (pred && !truth) fp++;
    else if (!pred && truth) fn++;
    else tn++;
  }
  const n = tp + fp + tn + fn;
  const recall = tp / (tp + fn || 1);
  const specificity = tn / (tn + fp || 1);
  return {
    n,
    downPct: Math.round(((tp + fp) / n) * 100),
    acc: Math.round(((tp + tn) / n) * 100),
    balAcc: Math.round(((recall + specificity) / 2) * 100),
    recall: Math.round(recall * 100),
    precision: Math.round((tp / (tp + fp || 1)) * 100),
  };
}

function table(label: string, subset: Row[]) {
  for (const target of ['t1', 't2', 't3'] as const) {
    const base = subset.filter((r) => r[target] != null);
    const rate = Math.round((base.filter((r) => r[target]).length / base.length) * 100);
    console.log(
      `\n## ${label} — ${{ t1: 'T1 recession within 12m', t2: 'T2 next-4Q GDP avg < 1.5%', t3: 'T3 next-4Q avg < trailing-4Q avg' }[target]}  (base rate ${rate}%)`
    );
    console.log('rule'.padEnd(42) + 'n    %down  acc  balAcc  recall  precision');
    for (const rule of RULES) {
      const s = score(rule, subset, target);
      console.log(
        rule.name.padEnd(42) +
          `${String(s.n).padEnd(5)}${String(s.downPct).padStart(4)}%  ${String(s.acc).padStart(3)}%  ${String(s.balAcc).padStart(4)}%  ${String(s.recall).padStart(5)}%  ${String(s.precision).padStart(7)}%`
      );
    }
  }
}

console.log(`Months replayed: ${rows[0].ym} → ${rows[rows.length - 1].ym} (${rows.length})`);
table('FULL 1991–2026', rows);
table('FIRST HALF 1991–2008', rows.filter((r) => r.ym < '2009-01'));
table('SECOND HALF 2009–2026', rows.filter((r) => r.ym >= '2009-01'));

// Months where the proposed overlay flips the call from up → down
const proposed = RULES[1];
const flips = rows.filter((r) => !r.base && proposed.call(r));
console.log(`\n## Flip months (GDP said "up", proposed overlay says "down"): ${flips.length}`);
const scoredT1 = flips.filter((r) => r.t1 != null);
const scoredT2 = flips.filter((r) => r.t2 != null);
console.log(
  `  right on T1: ${scoredT1.filter((r) => r.t1).length}/${scoredT1.length}   right on T2: ${scoredT2.filter((r) => r.t2).length}/${scoredT2.length}`
);
// Group consecutive flip months into episodes
const episodes: Row[][] = [];
for (const r of flips) {
  const last = episodes[episodes.length - 1];
  if (last && shiftYm(last[last.length - 1].ym, 3) >= r.ym) last.push(r);
  else episodes.push([r]);
}
for (const e of episodes) {
  const t1 = e.filter((r) => r.t1).length;
  const t2 = e.filter((r) => r.t2).length;
  console.log(
    `  ${e[0].ym} → ${e[e.length - 1].ym}  (${e.length} mo, states: ${[...new Set(e.map((r) => r.state))].join('/')})  T1 hit ${t1}/${e.filter((r) => r.t1 != null).length}  T2 hit ${t2}/${e.filter((r) => r.t2 != null).length}`
  );
}

// Lead time: first warning month before each recession
console.log('\n## Curve warning lead time before each recession');
for (const [start] of RECESSIONS) {
  const window = rows.filter((r) => r.ym >= shiftYm(start, -24) && r.ym < start && r.curveWarn);
  console.log(`  ${start}: ${window.length ? `first warning ${window[0].ym} (${rows.findIndex((r) => r.ym === start) - rows.indexOf(window[0])} mo lead)` : 'NO warning in prior 24m'}`);
}

const now = analyzeYieldCurve(t10y3m, t10y2y, '2026-12-31');
console.log('\n## Current reading:', JSON.stringify({ ...now, history: undefined }, null, 1));
