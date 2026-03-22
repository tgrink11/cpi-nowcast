import type { NowcastOutput } from '../types/cpiNowcast';
import { formatPercent } from '../utils/formatPercent';

interface Props {
  nowcast: NowcastOutput;
}

export function NowcastSummary({ nowcast }: Props) {
  const directionIcon =
    nowcast.direction === 'accelerating'
      ? '\u2191'
      : nowcast.direction === 'decelerating'
        ? '\u2193'
        : '\u2192';

  const directionColor =
    nowcast.direction === 'accelerating'
      ? 'text-red-600'
      : nowcast.direction === 'decelerating'
        ? 'text-green-600'
        : 'text-slate-600';

  const confidenceColor =
    nowcast.confidence === 'high'
      ? 'bg-green-100 text-green-800'
      : nowcast.confidence === 'medium'
        ? 'bg-amber-100 text-amber-800'
        : 'bg-red-100 text-red-800';

  const phaseColors: Record<number, string> = {
    1: 'bg-emerald-100 text-emerald-800',
    2: 'bg-amber-100 text-amber-800',
    3: 'bg-red-100 text-red-800',
    4: 'bg-blue-100 text-blue-800',
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500 uppercase tracking-wide">
            CPI YoY Nowcast
          </p>
          <div className="flex items-baseline gap-3 mt-1">
            <span className="text-4xl font-bold text-slate-900">
              {formatPercent(nowcast.nowcastCpiYoY)}
            </span>
            <span className={`text-2xl font-semibold ${directionColor}`}>
              {directionIcon} {nowcast.direction}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Range: {formatPercent(nowcast.rateOfChange.probableRange.low)} to{' '}
            {formatPercent(nowcast.rateOfChange.probableRange.high)}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${confidenceColor}`}
          >
            {nowcast.confidence} confidence
          </span>
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${phaseColors[nowcast.phase.phase]}`}
          >
            Phase {nowcast.phase.phase}: {nowcast.phase.phaseName}
          </span>
        </div>
      </div>

      <p className="text-sm text-slate-600 mt-3">
        {nowcast.confidenceRationale}
      </p>
      <p className="text-xs text-slate-400 mt-2">
        As of {nowcast.asOfDate} &middot; {nowcast.rateOfChange.baseAndCommodityAgreement}
      </p>
    </div>
  );
}
