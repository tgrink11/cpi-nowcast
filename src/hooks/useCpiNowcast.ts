import { useState, useEffect, useCallback } from 'react';
import type { CpiNowcastState } from '../types/cpiNowcast';
import { fetchAllData, getLatestCpiMonth } from '../api/cpiDataService';
import { runNowcast, buildChartData } from '../engine/nowcastEngine';

const INITIAL_STATE: CpiNowcastState = {
  status: 'idle',
  error: null,
  nowcast: null,
  chartData: [],
  historicalNowcasts: [],
};

export function useCpiNowcast() {
  const [state, setState] = useState<CpiNowcastState>(INITIAL_STATE);

  const load = useCallback(async (signal?: AbortSignal) => {
    setState((s) => ({ ...s, status: 'loading', error: null }));

    try {
      const data = await fetchAllData(signal);
      const latestMonth = getLatestCpiMonth(data.cpi);
      const nowcast = runNowcast(data, latestMonth);
      const chartData = buildChartData(data, latestMonth);

      if (signal?.aborted) return;

      setState({
        status: 'success',
        error: null,
        nowcast,
        chartData,
        historicalNowcasts: chartData
          .filter((p) => p.actualYoY != null && p.modelYoY != null)
          .map((p) => ({
            date: p.date,
            nowcast: p.modelYoY!,
            actual: p.actualYoY!,
          })),
      });
    } catch (err) {
      if (signal?.aborted) return;
      setState((s) => ({
        ...s,
        status: 'error',
        error: err instanceof Error ? err.message : 'Failed to fetch data',
      }));
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const refresh = useCallback(() => {
    load();
  }, [load]);

  return { ...state, refresh };
}
