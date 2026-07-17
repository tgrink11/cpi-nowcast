import type { AccuracyStats } from '../types/cpiNowcast';

interface Props {
  accuracy: AccuracyStats | null;
}

/**
 * Replaces the old fabricated "confidence" band with a real, computed track
 * record: how far the model line has actually fallen from realized CPI over
 * the backtest, and whether it beats a naive persistence forecast.
 */
export function AccuracyCard({ accuracy }: Props) {
  if (!accuracy) return null;

  const beatsNaive = accuracy.skillVsNaive > 0;
  const skillPct = Math.round(accuracy.skillVsNaive * 100);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <h2 className="text-lg font-semibold text-slate-900 mb-4">
        Model Accuracy ({accuracy.n}-mo backtest)
      </h2>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            Mean Abs Error
          </p>
          <p className="text-2xl font-bold text-slate-900 mt-1">
            {accuracy.modelMae.toFixed(2)}pp
          </p>
          <p className="text-xs text-slate-500 mt-1">
            median {accuracy.medianAe.toFixed(2)}pp
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            Naive Persistence
          </p>
          <p className="text-2xl font-bold text-slate-400 mt-1">
            {accuracy.naiveMae.toFixed(2)}pp
          </p>
          <p className="text-xs text-slate-500 mt-1">last-YoY carry</p>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            Skill vs Naive
          </p>
          <p
            className={`text-2xl font-bold mt-1 ${
              beatsNaive ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {skillPct > 0 ? '+' : ''}
            {skillPct}%
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {beatsNaive ? 'beats carry' : 'trails carry'}
          </p>
        </div>
      </div>
      <p className="text-xs text-slate-400 mt-4 pt-3 border-t border-slate-100">
        Error is the model line vs realized CPI YoY. "Skill vs naive" is how
        much the overlay improves on simply carrying last month's YoY forward —
        positive means the model earns its complexity.
      </p>
    </div>
  );
}
