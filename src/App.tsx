import { Header } from './components/Header';
import { NowcastSummary } from './components/NowcastSummary';
import { CpiChart } from './components/CpiChart';
import { BaseEffectsCard } from './components/BaseEffectsCard';
import { CommodityTable } from './components/CommodityTable';
import { PhaseQuadrant } from './components/PhaseQuadrant';
import { AssetImplications } from './components/AssetImplications';
import { LoadingState } from './components/LoadingState';
import { useCpiNowcast } from './hooks/useCpiNowcast';

export default function App() {
  const { status, error, nowcast, chartData, refresh } = useCpiNowcast();

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {status === 'loading' && <LoadingState />}

        {status === 'error' && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <p className="text-red-800 font-medium">Failed to load data</p>
            <p className="text-sm text-red-600 mt-1">{error}</p>
            <button
              onClick={refresh}
              className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {status === 'success' && nowcast && (
          <div className="space-y-6">
            {/* Refresh button */}
            <div className="flex justify-end">
              <button
                onClick={refresh}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Refresh Data
              </button>
            </div>

            {/* Summary */}
            <NowcastSummary nowcast={nowcast} />

            {/* 36-month chart */}
            <CpiChart data={chartData} />

            {/* Detail cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <BaseEffectsCard baseEffects={nowcast.baseEffects} />
              <CommodityTable commodityInputs={nowcast.commodityInputs} />
            </div>

            {/* Phase + Assets */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <PhaseQuadrant phase={nowcast.phase} />
              <AssetImplications phase={nowcast.phase} />
            </div>

            {/* Disclaimer */}
            <div className="text-xs text-slate-400 text-center py-4 border-t border-slate-200">
              <p>
                This nowcast is for educational purposes only and should not be
                considered investment advice. The model uses a rate-of-change
                framework based on base effects and commodity prices.
              </p>
              <p className="mt-1">
                &copy; {new Date().getFullYear()} Best of US Investors. All
                rights reserved.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
