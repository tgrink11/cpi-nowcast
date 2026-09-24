import type { ClevelandBaseline, NowcastTilt } from '../types/cpiNowcast';
import { formatPercent } from '../utils/formatPercent';

interface Props {
  cleveland: ClevelandBaseline | null;
  tilt: NowcastTilt;
}

/**
 * Anchors the app on the Federal Reserve Bank of Cleveland's inflation nowcast
 * (a peer-reviewed daily model) and shows our overlay as a *tilt* on top of
 * it, rather than presenting our number as an independent forecast.
 */
export function ClevelandBaseline({ cleveland, tilt }: Props) {
  const fedCpi = cleveland?.cpi.yoY ?? null;
  const fedCore = cleveland?.coreCpi.yoY ?? null;

  const tiltColor =
    tilt.direction === 'hotter'
      ? 'text-red-600'
      : tilt.direction === 'cooler'
        ? 'text-green-600'
        : 'text-slate-600';

  const tiltLabel =
    tilt.cpiDeltaPp == null
      ? '—'
      : `${tilt.cpiDeltaPp > 0 ? '+' : ''}${tilt.cpiDeltaPp.toFixed(2)}pp ${tilt.direction}`;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-900">
          Cleveland Fed Baseline
        </h2>
        <a
          href="https://www.clevelandfed.org/indicators-and-data/inflation-nowcasting"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-600 hover:underline"
        >
          source ↗
        </a>
      </div>

      {fedCpi == null ? (
        <p className="text-sm text-slate-500">
          The Cleveland Fed CPI nowcast is between release cycles right now, so
          there is no live baseline this week. Our model estimate below stands
          on its own until the next CPI nowcast window opens.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Fed CPI
            </p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {formatPercent(fedCpi)}
            </p>
            {fedCore != null && (
              <p className="text-xs text-slate-500 mt-1">
                Core {formatPercent(fedCore)}
              </p>
            )}
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Our Estimate
            </p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {formatPercent(tilt.ourCpiYoY)}
            </p>
            <p className="text-xs text-slate-500 mt-1">next print</p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Our Tilt
            </p>
            <p className={`text-2xl font-bold mt-1 ${tiltColor}`}>{tiltLabel}</p>
            <p className="text-xs text-slate-500 mt-1">vs baseline</p>
          </div>
        </div>
      )}

      <p className="text-xs text-slate-400 mt-4 pt-3 border-t border-slate-100">
        Baseline is the Cleveland Fed's daily nowcast for the next CPI release.
        Our overlay adds a commodity + base-effect tilt on top; a large tilt
        means our fast-moving inputs disagree with their model.
        {cleveland?.asOf ? ` Fed data as of ${cleveland.asOf}.` : ''}
      </p>
    </div>
  );
}
