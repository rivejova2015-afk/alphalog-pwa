"use client";

// Cross-market P&L/exposure summary (Wave 5 item 21) — replaces the 3
// stats tiles that AlgorithmsPage used to hardcode as static placeholder
// strings ("P&L Today: +$0.00", "Avg Win Rate: —", "Total Trades: 0") with
// real numbers aggregated across forex (bot_telemetry), futures
// (cme_equity_snapshots/cme_positions) and crypto (coinarb_telemetry) via
// /api/algorithms/overview. "Active Strategies" stays server-computed by
// the parent page (cheap, already correct) and is passed in as a prop
// rather than refetched here.

import { useEffect, useState } from "react";

interface MarketBreakdown {
  marketType: "forex" | "futures" | "crypto";
  algorithmCount: number;
  equityUsd: number;
  pnlUsd: number;
  openPositions: number;
}

interface Overview {
  totals: { algorithmCount: number; equityUsd: number; pnlUsd: number; openPositions: number };
  byMarket: MarketBreakdown[];
}

function fmt$(v: number): string {
  const sign = v > 0 ? "+" : "";
  return `${sign}$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const MARKET_LABEL: Record<MarketBreakdown["marketType"], string> = {
  forex: "Forex",
  futures: "Futures",
  crypto: "Crypto",
};

function Tile({ label, value, color, hint }: { label: string; value: string; color: string; hint: string }) {
  return (
    <div className="bg-[#151b28] border border-[#1f2937] rounded-lg p-3">
      <div className="text-xs text-[#475569] mb-1">{label}</div>
      <div className="text-lg font-bold font-mono" style={{ color }}>{value}</div>
      <p className="text-[10px] text-[#2d3748] mt-1 leading-snug">{hint}</p>
    </div>
  );
}

export function CrossMarketOverviewStats({ activeStrategies }: { activeStrategies: number }) {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/algorithms/overview", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => { if (!cancelled) setOverview(data); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, []);

  const breakdown = (overview?.byMarket ?? [])
    .filter((m) => m.algorithmCount > 0)
    .map((m) => `${MARKET_LABEL[m.marketType]} ${fmt$(m.pnlUsd)}`)
    .join(" · ");

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      <Tile
        label="Active Strategies"
        value={activeStrategies.toString()}
        color="#34d399"
        hint="Algoritmos en status running o live."
      />
      <Tile
        label="Total Equity"
        value={overview ? `$${overview.totals.equityUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : error ? "—" : "…"}
        color="#22d3ee"
        hint="Suma de equity cross-market (forex + futures + crypto)."
      />
      <Tile
        label="P&L"
        value={overview ? fmt$(overview.totals.pnlUsd) : error ? "—" : "…"}
        color={(overview?.totals.pnlUsd ?? 0) >= 0 ? "#34d399" : "#f87171"}
        hint={breakdown || "Forex/futures: P&L no realizado de posiciones abiertas. Crypto: P&L acumulado total (no hay campo 'hoy' separado)."}
      />
      <Tile
        label="Open Positions"
        value={overview ? overview.totals.openPositions.toString() : error ? "—" : "…"}
        color="#94a3b8"
        hint="Posiciones abiertas cross-market, sumadas de las 3 fuentes."
      />
    </div>
  );
}
