"use client";

import { useEffect, useState } from "react";
import { Circle } from "lucide-react";

type LivePrice = {
  last: number;
  bid: number;
  ask: number;
  change_pct?: number;
  source: string;
  stale: boolean;
};

type Props = {
  symbol: "XAUUSD" | "US500";
  pollIntervalMs?: number;
};

export function LivePriceBadge({ symbol, pollIntervalMs = 30_000 }: Props) {
  const [price, setPrice] = useState<LivePrice | null>(null);

  useEffect(() => {
    let mounted = true;

    const fetch_ = async () => {
      try {
        const res = await fetch(`/api/terminal/live-price?symbol=${symbol}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as LivePrice;
        if (mounted) setPrice(data);
      } catch {
        // ignore — badge simply stays empty
      }
    };

    fetch_();
    const interval = setInterval(fetch_, pollIntervalMs);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [symbol, pollIntervalMs]);

  if (!price) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-slate-500 font-mono">
        <Circle size={6} className="fill-slate-400 text-slate-400" />
        {symbol}
      </span>
    );
  }

  const isUp = (price.change_pct ?? 0) >= 0;
  const colorClass = price.stale
    ? "text-slate-400"
    : isUp
    ? "text-emerald-400"
    : "text-red-400";
  const dotClass = price.stale
    ? "fill-slate-400 text-slate-400"
    : isUp
    ? "fill-emerald-400 text-emerald-400"
    : "fill-red-400 text-red-400";

  const arrow = price.stale ? "" : isUp ? "↑" : "↓";
  const changePct =
    price.change_pct != null ? `${arrow}${Math.abs(price.change_pct).toFixed(2)}%` : "";

  const minutesAgo = price.stale
    ? " · precio desactualizado"
    : "";

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-mono ${colorClass}`}
      title={`Bid: $${price.bid.toFixed(2)} · Ask: $${price.ask.toFixed(2)} · Fuente: ${price.source}${minutesAgo}`}
    >
      <Circle size={6} className={dotClass} />
      {symbol} ${price.last.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      {changePct && <span className="opacity-80">{changePct}</span>}
    </span>
  );
}
