"use client";

// Multi-config sandbox (Wave 5 item 25) — lets you define 2-4 named
// variants of slPoints/tpPoints/position size and compare their backtest
// results side by side in one request, via POST .../backtest/sandbox.
// Deliberately minimal: no full rule-builder UI (that's BacktestPanel's
// job) — this varies only the 3 fields that most directly answer "which
// SL/TP/size combo works best for the SAME entry logic", the exact kind of
// manual A/B loop done by hand while tuning Strategy DD.

import { useState } from "react";
import { FlaskConical, Play, Trophy } from "lucide-react";
import { toast } from "sonner";

interface Variant {
  label: string;
  slPoints: string;
  tpPoints: string;
  sizingValue: string;
}

interface VariantResult {
  label: string;
  metrics: {
    totalTrades: number;
    winRate: number;
    totalPnl: number;
    profitFactor: number;
    maxDrawdownPct: number;
    sharpe: number;
  };
}

function newVariant(n: number): Variant {
  return { label: `Variante ${n}`, slPoints: "100", tpPoints: "100", sizingValue: "0.1" };
}

export function BacktestSandboxPanel({ algorithmId, defaultSymbol }: { algorithmId: string; defaultSymbol: string }) {
  const [showForm, setShowForm] = useState(false);
  const [symbol, setSymbol] = useState(defaultSymbol);
  const [variants, setVariants] = useState<Variant[]>([newVariant(1), newVariant(2)]);
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<{ results: VariantResult[]; best: string; barsUsed: number } | null>(null);

  function updateVariant(idx: number, patch: Partial<Variant>) {
    setVariants((vs) => vs.map((v, i) => (i === idx ? { ...v, ...patch } : v)));
  }

  function addVariant() {
    if (variants.length >= 8) return;
    setVariants((vs) => [...vs, newVariant(vs.length + 1)]);
  }

  function removeVariant(idx: number) {
    if (variants.length <= 2) return;
    setVariants((vs) => vs.filter((_, i) => i !== idx));
  }

  async function handleRun() {
    setSubmitting(true);
    setResults(null);
    try {
      const to = new Date().toISOString().slice(0, 10);
      const from = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const isXau = symbol.toUpperCase().includes("XAU");

      const res = await fetch(`/api/algorithms/${algorithmId}/backtest/sandbox`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: {
            symbol,
            timeframe: "H1",
            from,
            to,
            initialBalance: 10000,
            contractSize: isXau ? 100 : 100000,
            pointValue: isXau ? 1 : 10,
            spreadPoints: 5,
            commissionPerLot: 7,
            slippagePoints: 2,
            direction: "both",
            rules: { sizing: { mode: "fixed_lot", value: 0.1 } },
          },
          variants: variants.map((v) => ({
            label: v.label,
            rulesOverrides: {
              slPoints: Number(v.slPoints),
              tpPoints: Number(v.tpPoints),
              sizing: { value: Number(v.sizingValue) },
            },
          })),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error ?? `HTTP ${res.status}`);
        return;
      }
      setResults(json);
      toast.success(`${variants.length} variantes evaluadas — mejor: ${json.best}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error de conexión");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-[#0a0e1a] border border-[#1f2937] rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[#475569] uppercase tracking-wider font-medium flex items-center gap-2">
          <FlaskConical size={12} className="text-[#f472b6]" /> Sandbox multi-config
        </p>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-[#f472b6]/10 text-[#f472b6] hover:bg-[#f472b6]/20 transition-colors"
        >
          {showForm ? "Cerrar" : "Comparar variantes"}
        </button>
      </div>

      {showForm && (
        <div className="space-y-3">
          <p className="text-[10px] text-[#475569] leading-relaxed">
            Compará hasta 8 combinaciones de SL/TP/tamaño de posición sobre el mismo símbolo y ventana
            (último año, H1). Cada variante corre un backtest completo en la misma request.
          </p>

          <div>
            <label className="text-[10px] text-[#475569] uppercase tracking-wider block mb-1">Símbolo</label>
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              className="w-full rounded-lg bg-[#111827] border border-[#1f2937] text-[#e2e8f0] text-sm px-3 py-1.5 focus:outline-none focus:border-[#475569]"
            />
          </div>

          <div className="space-y-2">
            {variants.map((v, i) => (
              <div key={i} className="grid grid-cols-5 gap-2 items-end p-2 rounded bg-[#0f1322] border border-[#1f2937]">
                <input
                  type="text"
                  value={v.label}
                  onChange={(e) => updateVariant(i, { label: e.target.value })}
                  className="col-span-2 rounded bg-[#111827] border border-[#1f2937] text-[#e2e8f0] text-xs px-2 py-1"
                  placeholder="Nombre"
                />
                <input
                  type="number"
                  value={v.slPoints}
                  onChange={(e) => updateVariant(i, { slPoints: e.target.value })}
                  className="rounded bg-[#111827] border border-[#1f2937] text-[#e2e8f0] text-xs px-2 py-1"
                  placeholder="SL pts"
                  title="SL (puntos)"
                />
                <input
                  type="number"
                  value={v.tpPoints}
                  onChange={(e) => updateVariant(i, { tpPoints: e.target.value })}
                  className="rounded bg-[#111827] border border-[#1f2937] text-[#e2e8f0] text-xs px-2 py-1"
                  placeholder="TP pts"
                  title="TP (puntos)"
                />
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="0.01"
                    value={v.sizingValue}
                    onChange={(e) => updateVariant(i, { sizingValue: e.target.value })}
                    className="flex-1 rounded bg-[#111827] border border-[#1f2937] text-[#e2e8f0] text-xs px-2 py-1"
                    placeholder="Lotes"
                    title="Tamaño (lotes)"
                  />
                  <button
                    onClick={() => removeVariant(i)}
                    disabled={variants.length <= 2}
                    className="text-[#475569] hover:text-red-400 disabled:opacity-30 text-xs px-1"
                    aria-label={`Quitar ${v.label}`}
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={addVariant}
              disabled={variants.length >= 8}
              className="text-xs px-2 py-1 rounded border border-[#1f2937] text-[#94a3b8] hover:border-[#475569] disabled:opacity-40 transition-colors"
            >
              + Agregar variante
            </button>
            <button
              onClick={handleRun}
              disabled={submitting}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded bg-[#f472b6] text-black font-semibold hover:bg-[#f9a8d4] disabled:opacity-50 transition-colors ml-auto"
            >
              <Play size={11} /> {submitting ? "Corriendo…" : "Correr sandbox"}
            </button>
          </div>

          {results && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] text-[#475569] border-b border-[#1f2937]">
                    <th className="text-left py-1.5 pr-3">Variante</th>
                    <th className="text-right py-1.5 pr-3">Trades</th>
                    <th className="text-right py-1.5 pr-3">Win rate</th>
                    <th className="text-right py-1.5 pr-3">P&L</th>
                    <th className="text-right py-1.5 pr-3">PF</th>
                    <th className="text-right py-1.5">Max DD</th>
                  </tr>
                </thead>
                <tbody>
                  {results.results.map((r) => (
                    <tr key={r.label} className="border-b border-[#151b28]">
                      <td className="py-1.5 pr-3 text-[#e2e8f0] flex items-center gap-1">
                        {r.label === results.best && <Trophy size={10} className="text-amber-400" />}
                        {r.label}
                      </td>
                      <td className="py-1.5 pr-3 text-right text-[#94a3b8]">{r.metrics.totalTrades}</td>
                      <td className="py-1.5 pr-3 text-right text-[#94a3b8]">{(r.metrics.winRate * 100).toFixed(1)}%</td>
                      <td className={`py-1.5 pr-3 text-right font-mono ${r.metrics.totalPnl >= 0 ? "text-[#34d399]" : "text-red-400"}`}>
                        {r.metrics.totalPnl >= 0 ? "+" : ""}{r.metrics.totalPnl.toFixed(2)}
                      </td>
                      <td className="py-1.5 pr-3 text-right text-[#94a3b8]">{r.metrics.profitFactor.toFixed(2)}</td>
                      <td className="py-1.5 text-right text-[#94a3b8]">{r.metrics.maxDrawdownPct.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[10px] text-[#2d3748] mt-1.5">{results.barsUsed} barras usadas.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
