import { useState, useEffect, useCallback } from 'react';
import type { Snapshot } from '../types/cpiNowcast';

/**
 * Loads the precomputed daily snapshot from /api/snapshot. All modeling now
 * happens server-side (see src/server/buildSnapshot.ts); the client just
 * renders. This means every visitor shares one computation and the upstream
 * APIs are hit a few times a day instead of once per page load.
 */

type Status = 'loading' | 'success' | 'error';

interface HookState {
  status: Status;
  error: string | null;
  snapshot: Snapshot | null;
}

const INITIAL: HookState = { status: 'loading', error: null, snapshot: null };

export function useCpiNowcast() {
  const [state, setState] = useState<HookState>(INITIAL);

  const load = useCallback(async (signal?: AbortSignal) => {
    setState((s) => ({ ...s, status: 'loading', error: null }));
    try {
      const res = await fetch('/api/snapshot', { signal });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Snapshot request failed (${res.status})`);
      }
      const snapshot = (await res.json()) as Snapshot;
      if (signal?.aborted) return;
      setState({ status: 'success', error: null, snapshot });
    } catch (err) {
      if (signal?.aborted) return;
      setState({
        status: 'error',
        error: err instanceof Error ? err.message : 'Failed to load snapshot',
        snapshot: null,
      });
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

  return {
    status: state.status,
    error: state.error,
    snapshot: state.snapshot,
    nowcast: state.snapshot?.nowcast ?? null,
    chartData: state.snapshot?.chartData ?? [],
    refresh,
  };
}
