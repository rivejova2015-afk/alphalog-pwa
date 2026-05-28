"use client";

import { useEffect, useState } from "react";
import { Eye, Radio } from "lucide-react";

type Mode = "shadow" | "live" | "unknown";

interface ModeStyle {
  label:  string;
  color:  string;
  bg:     string;
  border: string;
  icon:   React.ReactNode;
  title:  string;
}

const STYLE: Record<Mode, ModeStyle> = {
  shadow: {
    label:  "SHADOW",
    color:  "#f59e0b",
    bg:     "rgba(245,158,11,0.10)",
    border: "rgba(245,158,11,0.40)",
    icon:   <Eye size={11} />,
    title:  "El dispatcher evalúa el engine y persiste decisiones en cme_signals, pero NO coloca órdenes reales en Tradovate. Flippear DISPATCH_MODE=live en el deploy para ejecutar.",
  },
  live: {
    label:  "LIVE",
    color:  "#ef4444",
    bg:     "rgba(239,68,68,0.10)",
    border: "rgba(239,68,68,0.40)",
    icon:   <Radio size={11} />,
    title:  "El dispatcher coloca órdenes reales en Tradovate. Cada signal del engine que cumpla los gates (no position-skip, no engine HOLD) genera un trade.",
  },
  unknown: {
    label:  "—",
    color:  "#475569",
    bg:     "transparent",
    border: "rgba(71,85,105,0.40)",
    icon:   null,
    title:  "Cargando…",
  },
};

const REFRESH_MS = 30_000;

export function DispatchModeChip() {
  const [mode, setMode] = useState<Mode>("unknown");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const r = await fetch("/api/algorithms/runtime-config", { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json();
        if (cancelled) return;
        const m = j.dispatch_mode === "live" ? "live" : j.dispatch_mode === "shadow" ? "shadow" : "unknown";
        setMode(m);
      } catch {
        // Silent — the chip just shows "unknown" if the endpoint is unreachable.
      }
    }
    void load();
    const interval = setInterval(load, REFRESH_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const s = STYLE[mode];

  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded border"
      style={{ color: s.color, background: s.bg, borderColor: s.border }}
      title={s.title}
    >
      {s.icon}
      <span>Dispatch: {s.label}</span>
    </span>
  );
}
