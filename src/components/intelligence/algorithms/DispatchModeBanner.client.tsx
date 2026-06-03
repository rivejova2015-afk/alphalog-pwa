"use client";

import { useEffect, useState } from "react";
import { InfoBanner } from "./InfoBanner.client";

type Mode = "shadow" | "live" | "unknown";

// Sprint I — visible banner explaining shadow mode. Companion to DispatchModeChip:
// the chip is glanceable, this is the discoverable explanation. Only renders when
// mode === 'shadow' so live mode keeps the page clean.

export function DispatchModeBanner() {
  const [mode, setMode] = useState<Mode>("unknown");

  useEffect(() => {
    const ctrl = new AbortController();
    async function load() {
      try {
        const r = await fetch("/api/algorithms/runtime-config", { cache: "no-store", signal: ctrl.signal });
        if (!r.ok) return;
        const j = await r.json();
        const m = j.dispatch_mode === "live" ? "live" : j.dispatch_mode === "shadow" ? "shadow" : "unknown";
        setMode(m);
      } catch {
        // silent — banner just won't render (includes abort)
      }
    }
    void load();
    return () => ctrl.abort();
  }, []);

  if (mode !== "shadow") return null;

  return (
    <InfoBanner tone="amber">
      <strong className="text-amber-300">Modo shadow activo:</strong>{" "}
      el dispatcher evalúa y registra todas las decisiones, pero NO coloca órdenes reales en Tradovate. Para ejecutar live,
      flippear <span className="font-mono">DISPATCH_MODE=live</span> en el deploy de Fly (después de validar shadow signals).
    </InfoBanner>
  );
}
