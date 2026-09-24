import type { YieldCurveAnalysis, YieldCurveState } from '../types/cpiNowcast';

interface Props {
  yieldCurve: YieldCurveAnalysis | null;
}

const STATE_STYLES: Record<YieldCurveState, { label: string; badge: string }> = {
  normal: { label: 'Normal', badge: 'bg-green-100 text-green-800' },
  flat: { label: 'Flat', badge: 'bg-slate-100 text-slate-700' },
  inverted: { label: 'Inverted', badge: 'bg-red-100 text-red-800' },
  're-steepening': { label: 'Re-steepening', badge: 'bg-amber-100 text-amber-800' },
};

function formatSpread(v: number | null): string {
  if (v == null) return '—';
  return `${v > 0 ? '+' : ''}${v.toFixed(2)}pp`;
}

/** 36-month monthly-average sparkline of both spreads with a zero line. */
function Sparkline({ history }: { history: YieldCurveAnalysis['history'] }) {
  const W = 320;
  const H = 72;
  const values = history.flatMap((h) =>
    h.spread10y2y == null ? [h.spread10y3m] : [h.spread10y3m, h.spread10y2y]
  );
  const lo = Math.min(0, ...values);
  const hi = Math.max(0, ...values);
  const pad = (hi - lo) * 0.1 || 0.1;
  const y = (v: number) => H - ((v - (lo - pad)) / (hi - lo + 2 * pad)) * H;
  const x = (i: number) => (i / Math.max(1, history.length - 1)) * W;
  const path = (pick: (h: YieldCurveAnalysis['history'][number]) => number | null) =>
    history
      .map((h, i) => {
        const v = pick(h);
        return v == null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      })
      .filter(Boolean)
      .join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-20" preserveAspectRatio="none">
      <line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke="#94a3b8" strokeDasharray="3 3" strokeWidth={1} />
      <polyline points={path((h) => h.spread10y2y)} fill="none" stroke="#94a3b8" strokeWidth={1.5} />
      <polyline points={path((h) => h.spread10y3m)} fill="none" stroke="#2563eb" strokeWidth={2} />
    </svg>
  );
}

/**
 * Yield curve readout. Informational: the 10–3mo signal is shown alongside
 * the regime but does not change the growth call (see buildSnapshot).
 */
export function YieldCurveCard({ yieldCurve }: Props) {
  if (!yieldCurve) return null;
  const style = STATE_STYLES[yieldCurve.state];
  const first = yieldCurve.history[0]?.month;
  const last = yieldCurve.history[yieldCurve.history.length - 1]?.month;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-start justify-between gap-3 mb-4">
        <h2 className="text-lg font-semibold text-slate-900">Yield Curve</h2>
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${style.badge}`}>
          {style.label}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            10yr − 3mo
          </p>
          <p className="text-2xl font-bold text-blue-600 mt-1">
            {formatSpread(yieldCurve.spread10y3m)}
          </p>
          <p className="text-xs text-slate-500 mt-1">signal spread</p>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            10yr − 2yr
          </p>
          <p className="text-2xl font-bold text-slate-400 mt-1">
            {formatSpread(yieldCurve.spread10y2y)}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            reference
            {yieldCurve.state10y2y ? ` · ${STATE_STYLES[yieldCurve.state10y2y].label.toLowerCase()}` : ''}
          </p>
        </div>
      </div>

      {yieldCurve.history.length > 1 && (
        <div className="mt-4">
          <Sparkline history={yieldCurve.history} />
          <div className="flex justify-between text-[11px] text-slate-400 mt-1">
            <span>{first}</span>
            <span className="flex gap-3">
              <span><span className="inline-block w-3 h-0.5 bg-blue-600 align-middle mr-1" />10–3mo</span>
              <span><span className="inline-block w-3 h-0.5 bg-slate-400 align-middle mr-1" />10–2yr</span>
            </span>
            <span>{last}</span>
          </div>
        </div>
      )}

      <p className="text-sm text-slate-700 mt-4">{yieldCurve.note}</p>

      <p className="text-xs text-slate-400 mt-4 pt-3 border-t border-slate-100">
        Monthly-average spreads, as of {yieldCurve.asOf}. The curve leads growth
        by roughly 6–18 months, so it's shown as an early-warning context and
        does not change the phase call above.
      </p>
    </div>
  );
}
