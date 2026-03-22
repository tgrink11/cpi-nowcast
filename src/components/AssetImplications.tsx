import type { PhaseClassification } from '../types/cpiNowcast';

interface Props {
  phase: PhaseClassification;
}

export function AssetImplications({ phase }: Props) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
      <h3 className="text-lg font-semibold text-slate-900 mb-3">
        Asset Class Implications
      </h3>

      <p className="text-sm text-slate-600 mb-3">
        Based on Phase {phase.phase} ({phase.phaseName}), historically favored
        asset classes:
      </p>

      <div className="flex flex-wrap gap-2">
        {phase.favoredAssets.map((asset) => (
          <span
            key={asset}
            className="inline-flex items-center px-3 py-1.5 rounded-lg bg-slate-100 text-sm font-medium text-slate-700 border border-slate-200"
          >
            {asset}
          </span>
        ))}
      </div>

      <div className="mt-4 text-xs text-slate-400">
        Historical tendencies are not guarantees of future performance. Phase
        classifications are based on the rate-of-change framework and may shift
        as new data is released.
      </div>
    </div>
  );
}
