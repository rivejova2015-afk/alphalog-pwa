import { TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AlgoAccordion } from "@/components/intelligence/algorithms/AlgoAccordion.client";
import { NewStrategyButton } from "@/components/intelligence/algorithms/NewStrategyButton.client";
import CmeAlgoTabs from "@/components/intelligence/algorithms/CmeAlgoTabs.client";
import { DispatchModeChip } from "@/components/intelligence/algorithms/DispatchModeChip.client";
import { DispatchModeBanner } from "@/components/intelligence/algorithms/DispatchModeBanner.client";
import { GlobexStatusBanner } from "@/components/intelligence/algorithms/GlobexStatusBanner";
import { CrossMarketOverviewStats } from "@/components/intelligence/algorithms/CrossMarketOverviewStats.client";

export default async function AlgorithmsPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  type MarketType = 'forex' | 'futures' | 'options' | 'crypto';
  type Direction  = 'long' | 'short' | 'both';

  const algorithms = userData?.user
    ? (await supabase
        .from("algorithms")
        .select("id, name, instrument, status, parameters, market_type, direction, linked_bot_account_id, default_backtest_balance, pnl_today, pnl_total, win_rate, trade_count, profit_factor, max_drawdown_pct, sort_index, created_at, platform, last_dispatch_at, last_signal_bar_ts, last_dispatch_action, last_dispatch_reason")
        .eq("user_id", userData.user.id)
        .is("deleted_at", null)
        .order("sort_index", { ascending: true })
        .order("created_at", { ascending: true })
      ).data ?? []
    : [];

  const active = algorithms.filter((a) => a.status === "running" || a.status === "live");

  const algos = algorithms.map((a) => {
    const params = (a.parameters as Record<string, unknown>) ?? {};

    const marketType: MarketType =
      (a.market_type as MarketType) ?? "forex";

    const status =
      a.status === "running" || a.status === "live" ? ("ACTIVE" as const) : ("PAUSED" as const);

    return {
      id: a.id as string,
      name: a.name as string,
      marketType,
      instrument: Array.isArray(a.instrument)
        ? (a.instrument as string[])
        : a.instrument
          ? [a.instrument as string]
          : params.instrument
            ? [params.instrument as string]
            : params.trade_symbol
              ? [params.trade_symbol as string]
              : ["XAUUSD"],
      direction: (["long","short","both"].includes(a.direction as string) ? a.direction : "both") as Direction,
      parameters: params,
      status,
      algoStatus: a.status as string,
      linkedBotAccountId: (a.linked_bot_account_id as string | null) ?? null,
      defaultBacktestBalance: a.default_backtest_balance != null ? Number(a.default_backtest_balance) : null,
      pnlToday: Number(a.pnl_today ?? 0),
      pnlTotal: Number(a.pnl_total ?? 0),
      winRate: Number(a.win_rate ?? 0),
      totalTrades: Number(a.trade_count ?? 0),
      profitFactor: Number(a.profit_factor ?? 0),
      maxDrawdown: Number(a.max_drawdown_pct ?? 0),
      platform: (a.platform as string | null) ?? null,
      lastDispatchAt:     (a.last_dispatch_at     as string | null) ?? null,
      lastSignalBarTs:    (a.last_signal_bar_ts   as string | null) ?? null,
      lastDispatchAction: (a.last_dispatch_action as string | null) ?? null,
      lastDispatchReason: (a.last_dispatch_reason as string | null) ?? null,
    };
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#e2e8f0] font-mono flex items-center gap-2">
            <TrendingUp size={22} className="text-[#34d399]" />
            Algorithmic Trading
            <DispatchModeChip />
          </h1>
          <p className="text-sm text-[#94a3b8] mt-1">Forex and futures algorithm strategies</p>
        </div>
        <NewStrategyButton />
      </div>

      <div className="mb-4 space-y-2">
        <GlobexStatusBanner />
        <DispatchModeBanner />
      </div>

      <CrossMarketOverviewStats activeStrategies={active.length} />

      {algos.length === 0 ? (
        <div className="text-center py-20">
          <TrendingUp size={40} className="text-[#1f2937] mx-auto mb-4" />
          <p className="text-[#475569] text-sm">No strategies configured yet.</p>
          <p className="text-[#2d3748] text-xs mt-1">Create your first strategy to start tracking performance.</p>
        </div>
      ) : (
        <AlgoAccordion algos={algos} />
      )}

      <div className="mt-8">
        <CmeAlgoTabs />
      </div>
    </div>
  );
}
