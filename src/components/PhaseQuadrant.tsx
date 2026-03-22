import type { PhaseClassification } from '../types/cpiNowcast';

interface Props {
  phase: PhaseClassification;
}

const QUADRANT_STYLES: Record<number, { bg: string; border: string; text: string }> = {
  1: { bg: 'bg-emerald-50', border: 'border-emerald-400', text: 'text-emerald-800' },
  2: { bg: 'bg-amber-50', border: 'border-amber-400', text: 'text-amber-800' },
  3: { bg: 'bg-red-50', border: 'border-red-400', text: 'text-red-800' },
  4: { bg: 'bg-blue-50', border: 'border-blue-400', text: 'text-blue-800' },
};

export function PhaseQuadrant({ phase }: Props) {
  const cells = [
    { phase: 1, label: 'Goldilocks', growth: '\u2191', inflation: '\u2193', row: 0, col: 1 },
    { phase: 2, label: 'Reflation', growth: '\u2191', inflation: '\u2191', row: 0, col: 0 },
    { phase: 3, label: 'Stagflation', growth: '\u2193', inflation: '\u2191', row: 1, col: 0 },
    { phase: 4, label: 'Contraction', growth: '\u2193', inflation: '\u2193', row: 1, col: 1 },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
      <h3 className="text-lg font-semibold text-slate-900 mb-3">
        Economic Phase Classification
      </h3>

      <div className="relative">
        {/* Axis labels */}
        <div className="flex justify-center mb-1">
          <span className="text-xs font-medium text-slate-500">
            INFLATION {'\u2191'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex flex-col items-center justify-center w-8">
            <span className="text-xs font-medium text-slate-500 [writing-mode:vertical-lr] rotate-180">
              GROWTH
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 flex-1">
            {cells.map((cell) => {
              const isActive = cell.phase === phase.phase;
              const style = QUADRANT_STYLES[cell.phase];
              return (
                <div
                  key={cell.phase}
                  className={`rounded-lg p-4 border-2 transition-all ${
                    isActive
                      ? `${style.bg} ${style.border} shadow-md ring-2 ring-offset-1 ring-${style.border.replace('border-', '')}`
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-sm font-semibold ${isActive ? style.text : 'text-slate-400'}`}
                    >
                      Phase {cell.phase}
                    </span>
                    {isActive && (
                      <span className="text-xs bg-white rounded-full px-2 py-0.5 font-medium shadow-sm">
                        CURRENT
                      </span>
                    )}
                  </div>
                  <p
                    className={`text-base font-bold ${isActive ? style.text : 'text-slate-400'}`}
                  >
                    {cell.label}
                  </p>
                  <p className={`text-xs mt-1 ${isActive ? style.text : 'text-slate-400'}`}>
                    Growth {cell.growth} / Inflation {cell.inflation}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-4 bg-slate-50 rounded-lg p-3">
        <p className="text-sm text-slate-700">
          <span className="font-semibold">{phase.phaseName}:</span>{' '}
          {phase.description}
        </p>
      </div>
    </div>
  );
}
