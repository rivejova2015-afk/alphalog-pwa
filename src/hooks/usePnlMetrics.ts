"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  computePnlTotals,
  type PnlFilterOptions,
  type PnlTradeLike,
  type PnlTotals,
} from "@/lib/metrics/pnl";
import { subscribeTradeUpdates } from "@/lib/metrics/tradeUpdates";

interface UsePnlMetricsOptions extends PnlFilterOptions {
  fetcher?: () => Promise<PnlTradeLike[]>;
  accountId?: string;
  setupId?: string;
  range?: string;
  status?: string;
  limit?: number;
  enabled?: boolean;
  refreshOnTradeUpdate?: boolean;
}

interface UsePnlMetricsResult {
  trades: PnlTradeLike[];
  metrics: PnlTotals;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function usePnlMetrics(options: UsePnlMetricsOptions = {}): UsePnlMetricsResult {
  const {
    fetcher,
    accountId,
    setupId,
    range = "all",
    status,
    limit = 500,
    closedOnly = true,
    requireExitDate = true,
    ignoreZero = true,
    enabled = true,
    refreshOnTradeUpdate = true,
  } = options;

  const [trades, setTrades] = useState<PnlTradeLike[]>([]);
  const [loading, setLoading] = useState<boolean>(enabled);
  const [error, setError] = useState<string | null>(null);

  const loadTrades = useCallback(async () => {
    if (!enabled) return;
    try {
      setLoading(true);
      setError(null);

      if (fetcher) {
        const data = await fetcher();
        setTrades(Array.isArray(data) ? data : []);
        return;
      }

      const params = new URLSearchParams();
      if (accountId) params.append("accountId", accountId);
      if (setupId) params.append("setupId", setupId);
      if (status) params.append("status", status);
      if (closedOnly) params.append("closedOnly", "true");
      if (range) params.append("range", range);
      if (limit) params.append("limit", String(limit));
      params.append("offset", "0");

      const response = await fetch(`/api/tradehub/trades?${params.toString()}`);
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || "Failed to fetch trades");
      }

      const data = await response.json();
      setTrades(Array.isArray(data) ? data : []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error loading trades";
      setError(message);
      setTrades([]);
    } finally {
      setLoading(false);
    }
  }, [accountId, closedOnly, enabled, fetcher, limit, range, setupId, status]);

  useEffect(() => {
    void loadTrades();
  }, [loadTrades]);

  useEffect(() => {
    if (!refreshOnTradeUpdate) return;
    return subscribeTradeUpdates(() => {
      void loadTrades();
    });
  }, [loadTrades, refreshOnTradeUpdate]);

  const metrics = useMemo(
    () => computePnlTotals(trades, { closedOnly, requireExitDate, ignoreZero }),
    [trades, closedOnly, requireExitDate, ignoreZero]
  );

  return {
    trades,
    metrics,
    loading,
    error,
    refresh: loadTrades,
  };
}
