import type { BaseEffectsAnalysis } from '../types/cpiNowcast';
import { formatPercent } from '../utils/formatPercent';

interface Props {
  baseEffects: BaseEffectsAnalysis;
}

export function BaseEffectsCard({ baseEffects }: Props) {
  const classificationColor =
    baseEffects.baseClassification === 'easy'
      ? 'bg-red-100 text-red-800'
      : baseEffects.baseClassification === 'hard'
        ? 'bg-green-100 text-green-800'
        : 'bg-slate-100 text-slate-700';

  const inflectionColor =
    baseEffects.inflectionSignal === 'accelerating'
      ? 'text-red-600'
      : baseEffects.inflectionSignal === 'decelerating'
        ? 'text-green-600'
        : 'text-slate-500';

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
      <h3 className="text-lg font-semibold text-slate-900 mb-3">
        Base Effects Analysis
      </h3>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-600">Base Classification</span>
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${classificationColor}`}
          >
            {baseEffects.baseClassification.toUpperCase()} base
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-xs text-slate-500">Current CPI Level</p>
            <p className="text-lg font-semibold text-slate-900">
              {baseEffects.currentCpiLevel.toFixed(1)}
            </p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-xs text-slate-500">Year-Ago Level</p>
            <p className="text-lg font-semibold text-slate-900">
              {baseEffects.yearAgoCpiLevel.toFixed(1)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-xs text-slate-500">Actual YoY</p>
            <p className="text-lg font-semibold text-slate-900">
              {formatPercent(baseEffects.actualYoY)}
            </p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-xs text-slate-500">1Y Base Effect</p>
            <p className="text-lg font-semibold text-slate-900">
              {formatPercent(baseEffects.oneYearBaseEffect)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-xs text-slate-500">2Y Base Effect (ann.)</p>
            <p className="text-lg font-semibold text-slate-900">
              {formatPercent(baseEffects.twoYearBaseEffect)}
            </p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-xs text-slate-500">Base 1st Difference</p>
            <p className={`text-lg font-semibold ${inflectionColor}`}>
              {baseEffects.baseEffectFirstDifference > 0 ? '+' : ''}
              {baseEffects.baseEffectFirstDifference.toFixed(2)}
            </p>
          </div>
        </div>

        <div className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3">
          <span className="font-medium">Inflection Signal:</span>{' '}
          <span className={inflectionColor}>
            {baseEffects.inflectionSignal === 'none'
              ? 'No clear signal'
              : `CPI likely ${baseEffects.inflectionSignal}`}
          </span>
          <p className="text-xs text-slate-400 mt-1">
            Sign change in 2Y base effect first difference predicts inflation
            turns ~70% of the time
          </p>
        </div>
      </div>
    </div>
  );
}
