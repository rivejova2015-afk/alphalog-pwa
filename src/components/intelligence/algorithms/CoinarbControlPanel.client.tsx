"use client";

import { useState, useEffect } from "react";
import {
  Activity,
  Bitcoin,
  Pause,
  Play,
  RefreshCw,
  Save,
  Wifi,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AlgorithmRow {
  id: string;
  name: string;
  market_type: string;
  platform: string;
  status: string;
  parameters: Record<string, unknown> | null;
  engine_config: Record<string, unknown> | null;
}

interface CommandLifecycle {
  id: string;
  command_type: string;
  status: string; // 'PENDING' | 'pending' | 'DONE' | 'FAILED'
  ack: { status: string; message: string | null; acked_at: string | null } | null;
}

interface Telemetry {
  equityUsd: number | null;
  availableBalanceUsd: number | null;
  openPositionsCount: number | null;
  totalPnlUsd: number | null;
  winRate: number | null;
  wsCoinbaseConnected: boolean;
  wsBinanceConnected: boolean;
  btcSpotPrice: number | null;
  consecutiveLosses: number | null;
  dailyTradesCount: number | null;
  dailyWins: number | null;
  dailyLosses: number | null;
  phaseCurrent: string | null;
  capitalCurrent: number | null;
  lastHeartbeatAt: string | null;
  tradesBySymbol: Record<string, number>;
  totalCap: number;
  perSymbolCap: number;
}

// ─── Local primitive helpers (copies from AlgorithmDetailsModal) ─────────────

function NumField({
  label,
  value,
  onChange,
  step,
  hint,
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  step: string;
  hint?: string;
  mono?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">{label}</span>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full px-2 py-1.5 rounded bg-[#0a0e1a] border border-[#1f2937] text-slate-100 text-sm focus:border-cyan-700 focus:outline-none ${mono ? "font-mono" : ""}`}
      />
      {hint && <span className="block text-[10px] text-slate-600 mt-0.5">{hint}</span>}
    </label>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <>
      <dt className="text-slate-500">{label}</dt>
      <dd className={`text-slate-200 text-right ${mono ? "font-mono" : ""}`}>{value}</dd>
    </>
  );
}

function num(v: unknown, fallback: number): string {
  return typeof v === "number" ? String(v) : String(fallback);
}

function fmt$(v: number | null, signed = false): string {
  if (v === null) return "—";
  const sign = signed && v > 0 ? "+" : "";
  return `${sign}$${v.toFixed(2)}`;
}

// ─── WsTile ──────────────────────────────────────────────────────────────────

function WsTile({ label, connected }: { label: string; connected: boolean }) {
  return (
    <div className="bg-[#0a0e1a] rounded p-2">
      <div className="text-[10px] text-slate-500 mb-0.5">{label} WS</div>
      <div
        className={`text-sm font-mono font-bold flex items-center gap-1 ${
          connected ? "text-emerald-400" : "text-red-400"
        }`}
      >
        {connected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
        {connected ? "OK" : "DOWN"}
      </div>
    </div>
  );
}

// ─── ControlButton ───────────────────────────────────────────────────────────

function ControlButton({
  algorithmId,
  currentStatus,
  onChanged,
}: {
  algorithmId: string;
  currentStatus: string;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [awaitingAck, setAwaitingAck] = useState(false);
  const isPaused = currentStatus !== "live";

  async function pollAck(commandId: string, label: string): Promise<void> {
    const startedAt = Date.now();
    const TIMEOUT_MS = 60_000;
    const INTERVAL_MS = 5_000;

    setAwaitingAck(true);
    try {
      while (Date.now() - startedAt < TIMEOUT_MS) {
        await new Promise((r) => setTimeout(r, INTERVAL_MS));
        try {
          const res = await fetch(
            `/api/algorithms/${algorithmId}/commands/recent?limit=10`,
            { cache: "no-store" }
          );
          if (!res.ok) continue;
          const json = await res.json();
          const cmd = (json.commands ?? []).find(
            (c: CommandLifecycle) => c.id === commandId
          );
          if (!cmd) continue;
          const lifecycleDone = cmd.status === "DONE" || cmd.status === "FAILED";
          if (!lifecycleDone) continue;
          if (cmd.status === "DONE") {
            toast.success(cmd.ack?.message ?? `${label} aplicado`);
          } else {
            toast.error(cmd.ack?.message ?? `${label} falló en el bot`);
          }
          onChanged();
          return;
        } catch {
          /* keep polling on transient errors */
        }
      }
      toast.warning(
        `${label} enviado pero sin ack en 60s — verificar logs de Fly`
      );
      onChanged();
    } finally {
      setAwaitingAck(false);
    }
  }

  async function dispatch(action: "pause" | "resume") {
    const label = action === "pause" ? "Pause" : "Resume";
    setBusy(true);
    try {
      const res = await fetch(`/api/algorithms/${algorithmId}/control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error ?? `Error ${res.status}`);
        return;
      }
      const commandId = json.command?.id as string | undefined;
      if (!commandId) {
        toast.warning(
          `${label} enviado, pero respuesta sin command id — no se puede verificar ack`
        );
        setTimeout(onChanged, 35_000);
        return;
      }
      toast.info(`${label} enviado — esperando ack del bot (≤60s)…`);
      void pollAck(commandId, label);
    } catch (e) {
      toast.error(`Error: ${e instanceof Error ? e.message : "desconocido"}`);
    } finally {
      setBusy(false);
    }
  }

  const disabled = busy || awaitingAck;
  const labelBusy = busy ? "Enviando…" : awaitingAck ? "Esperando ack…" : null;

  return (
    <button
      type="button"
      onClick={() => dispatch(isPaused ? "resume" : "pause")}
      disabled={disabled}
      className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-semibold transition disabled:opacity-50 ${
        isPaused
          ? "bg-emerald-700 hover:bg-emerald-600"
          : "bg-amber-700 hover:bg-amber-600"
      }`}
    >
      {disabled ? (
        <RefreshCw className="w-4 h-4 animate-spin" />
      ) : isPaused ? (
        <Play className="w-4 h-4" />
      ) : (
        <Pause className="w-4 h-4" />
      )}
      {labelBusy ?? (isPaused ? "Reanudar bot" : "Pausar bot")}
    </button>
  );
}

// ─── TelemetryPanel ──────────────────────────────────────────────────────────

function TelemetryPanel({
  algorithmId,
  pairs,
}: {
  algorithmId: string;
  pairs: string[];
}) {
  const [tele, setTele] = useState<Telemetry | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function fetchTele() {
      try {
        const res = await fetch(
          `/api/algorithms/${algorithmId}/telemetry`,
          { cache: "no-store" }
        );
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) setTele(json.telemetry);
      } catch {
        /* network blip — keep last good values */
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }
    fetchTele();
    const id = setInterval(fetchTele, 15_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [algorithmId]);

  if (!loaded) {
    return (
      <div className="rounded-lg bg-[#151b28] border border-[#1f2937] p-4">
        <div className="h-3 bg-slate-800 rounded w-1/3 animate-pulse" />
      </div>
    );
  }
  if (!tele) {
    return (
      <div className="rounded-lg bg-[#151b28] border border-dashed border-[#1f2937] p-4 text-center">
        <p className="text-xs text-slate-500">Esperando primer heartbeat del bot…</p>
      </div>
    );
  }

  const hbAge = tele.lastHeartbeatAt
    ? Date.now() - new Date(tele.lastHeartbeatAt).getTime()
    : null;
  const hbStale = hbAge !== null && hbAge > 60_000;

  return (
    <div className="rounded-lg bg-[#151b28] border border-[#1f2937] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-100 flex items-center gap-1.5">
          <Activity className="w-4 h-4 text-cyan-400" /> Live telemetry
        </span>
        <span className="text-[10px] text-slate-500 font-mono">refresh 15s</span>
      </div>

      {/* Top row: heartbeat + WS */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="bg-[#0a0e1a] rounded p-2">
          <div className="text-[10px] text-slate-500 mb-0.5">Heartbeat</div>
          <div
            className={`text-sm font-mono font-bold ${
              hbStale ? "text-amber-400" : "text-emerald-400"
            }`}
          >
            {hbAge === null
              ? "—"
              : hbAge < 60_000
              ? `${Math.round(hbAge / 1000)}s`
              : `${Math.round(hbAge / 60_000)}m`}
          </div>
        </div>
        <WsTile label="Coinbase" connected={tele.wsCoinbaseConnected} />
        <WsTile label="Binance" connected={tele.wsBinanceConnected} />
      </div>

      {/* Per-symbol capacity bars */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">
          Capacidad diaria · {tele.dailyTradesCount ?? 0}/{tele.totalCap} total
        </p>
        <div className="space-y-1.5">
          {pairs.map((sym) => {
            const used = tele.tradesBySymbol[sym] ?? 0;
            const pct = Math.min(100, (used / tele.perSymbolCap) * 100);
            const color =
              pct >= 90
                ? "bg-red-500"
                : pct >= 70
                ? "bg-amber-500"
                : pct > 0
                ? "bg-emerald-500"
                : "bg-slate-700";
            return (
              <div key={sym} className="flex items-center gap-2">
                <span className="w-16 text-[11px] font-mono text-slate-400">
                  {sym.split("-")[0]}
                </span>
                <div className="flex-1 h-2 bg-[#0a0e1a] rounded overflow-hidden">
                  <div
                    className={`h-full ${color} transition-all`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-12 text-[11px] font-mono text-slate-400 text-right">
                  {used}/{tele.perSymbolCap}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Equity + positions + phase */}
      <dl className="grid grid-cols-2 gap-y-2 text-xs pt-2 border-t border-[#1f2937]">
        <Row label="Equity" value={fmt$(tele.equityUsd)} mono />
        <Row label="Open positions" value={String(tele.openPositionsCount ?? 0)} mono />
        <Row label="Pnl hoy" value={fmt$(tele.totalPnlUsd, true)} mono />
        <Row
          label="Win rate"
          value={
            tele.winRate !== null ? `${(tele.winRate * 100).toFixed(1)}%` : "—"
          }
          mono
        />
        <Row label="Fase" value={tele.phaseCurrent ?? "—"} />
        <Row label="Pérdidas seguidas" value={String(tele.consecutiveLosses ?? 0)} mono />
      </dl>
    </div>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function PanelSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-4 bg-slate-800 rounded w-1/3" />
      <div className="h-20 bg-slate-800/60 rounded" />
      <div className="h-4 bg-slate-800 rounded w-1/4" />
      <div className="h-12 bg-slate-800/60 rounded" />
    </div>
  );
}

// ─── CoinarbControlPanel (default export) ────────────────────────────────────
//
// Self-contained panel that fetches the algorithm row by id, then renders
// status badge + ControlButton + TelemetryPanel + tunables form.
// Pass `algorithmId` (the crypto algo id from /api/algorithms/lite) and an
// optional `onSaved` callback to react to parameter changes.

export default function CoinarbControlPanel({
  algorithmId,
  onSaved,
}: {
  algorithmId: string;
  onSaved?: () => void;
}) {
  const [algorithm, setAlgorithm] = useState<AlgorithmRow | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);

  async function fetchAlgorithm() {
    try {
      const res = await fetch(`/api/algorithms/${algorithmId}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setLoadError(json.error ?? `HTTP ${res.status}`);
        return;
      }
      const json = await res.json();
      // The endpoint may return the row directly or under an `algorithm` key
      setAlgorithm((json.algorithm ?? json) as AlgorithmRow);
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Error de red");
    } finally {
      setFetching(false);
    }
  }

  useEffect(() => {
    void fetchAlgorithm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [algorithmId]);

  function handleSaved() {
    void fetchAlgorithm();
    onSaved?.();
  }

  if (fetching) return <PanelSkeleton />;

  if (loadError || !algorithm) {
    return (
      <div className="rounded-lg bg-[#151b28] border border-dashed border-[#1f2937] p-4 text-center">
        <p className="text-xs text-slate-500">
          {loadError ?? "No se pudo cargar el algoritmo."}
        </p>
      </div>
    );
  }

  const initial = (algorithm.parameters ?? {}) as Record<string, unknown>;
  const initialGap = (initial.arb_gap_min ?? {}) as Record<string, number>;
  const engine = (algorithm.engine_config ?? {}) as Record<string, unknown>;
  const pairs = (engine.spot_pairs ?? ["BTC-USD", "ETH-USD", "SOL-USD"]) as string[];

  return (
    <CoinarbSectionInner
      algorithm={algorithm}
      pairs={pairs}
      engine={engine}
      initial={initial}
      initialGap={initialGap}
      onSaved={handleSaved}
    />
  );
}

// Inner component so we can keep form state local and reset it when algorithm
// reloads (key prop on the parent re-mounts this).
function CoinarbSectionInner({
  algorithm,
  pairs,
  engine,
  initial,
  initialGap,
  onSaved,
}: {
  algorithm: AlgorithmRow;
  pairs: string[];
  engine: Record<string, unknown>;
  initial: Record<string, unknown>;
  initialGap: Record<string, number>;
  onSaved: () => void;
}) {
  const [mtfMin, setMtfMin] = useState<string>(num(initial.mtf_confidence_min, 0.3));
  const [pdMacro, setPdMacro] = useState<string>(num(initial.pd_macro_band, 0.005));
  const [pdMicro, setPdMicro] = useState<string>(num(initial.pd_micro_band, 0.005));
  const [sweep, setSweep] = useState<string>(num(initial.sweep_confirm_body_ratio, 0.4));
  const [gapBtc, setGapBtc] = useState<string>(num(initialGap["BTC-USD"], 0.0005));
  const [gapEth, setGapEth] = useState<string>(num(initialGap["ETH-USD"], 0.0008));
  const [gapSol, setGapSol] = useState<string>(num(initialGap["SOL-USD"], 0.001));
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const parameters: Record<string, unknown> = {
        mtf_confidence_min: Number(mtfMin),
        pd_macro_band: Number(pdMacro),
        pd_micro_band: Number(pdMicro),
        sweep_confirm_body_ratio: Number(sweep),
        arb_gap_min: {
          "BTC-USD": Number(gapBtc),
          "ETH-USD": Number(gapEth),
          "SOL-USD": Number(gapSol),
        },
      };

      const res = await fetch(`/api/algorithms/${algorithm.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parameters }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const issues = json.issues ? `: ${JSON.stringify(json.issues)}` : "";
        toast.error(`${json.error ?? "Error"}${issues}`);
        return;
      }
      toast.success("Parámetros guardados — el bot los aplica en ≤30s");
      onSaved();
    } catch (e) {
      toast.error(`Error: ${e instanceof Error ? e.message : "desconocido"}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-500 font-medium">
        <Bitcoin className="w-3 h-3" />
        Plataforma · Coinbase Spot · Fly.io
      </div>

      <div className="rounded-lg bg-[#151b28] border border-[#1f2937] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-100">Bot status</span>
          <span
            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
              algorithm.status === "live"
                ? "bg-emerald-950 text-emerald-400 border-emerald-800"
                : "bg-amber-950 text-amber-400 border-amber-800"
            }`}
          >
            {algorithm.status}
          </span>
        </div>
        <dl className="grid grid-cols-2 gap-y-2 text-xs">
          <Row label="Pares" value={pairs.join(", ")} />
          <Row label="Tick (ms)" value={String(engine.tick_ms ?? "—")} mono />
          <Row
            label="Cap diario"
            value={`${engine.daily_trade_cap_total ?? "—"} (max ${engine.daily_trade_cap_per_symbol ?? "—"}/símbolo)`}
          />
          <Row
            label="Capital inicial"
            value={`$${String(engine.starting_capital_usd ?? "—")}`}
            mono
          />
        </dl>
        <ControlButton
          algorithmId={algorithm.id}
          currentStatus={algorithm.status}
          onChanged={onSaved}
        />
      </div>

      <TelemetryPanel algorithmId={algorithm.id} pairs={pairs} />

      <div className="rounded-lg bg-[#151b28] border border-[#1f2937] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-100">
            Tunables (hot-reload ≤30s)
          </span>
          <span className="text-[10px] text-slate-500 font-mono">
            algorithms.parameters
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <NumField
            label="MTF confidence min"
            value={mtfMin}
            onChange={setMtfMin}
            step="0.01"
            hint="0.20–0.50 típico"
          />
          <NumField
            label="Sweep body ratio"
            value={sweep}
            onChange={setSweep}
            step="0.01"
            hint="0.30–0.50 típico"
          />
          <NumField
            label="PD macro band"
            value={pdMacro}
            onChange={setPdMacro}
            step="0.001"
            hint="0.005 default"
          />
          <NumField
            label="PD micro band"
            value={pdMicro}
            onChange={setPdMicro}
            step="0.001"
            hint="0.005 default"
          />
        </div>

        <div className="pt-3 border-t border-[#1f2937]">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">
            Arb gap min (Coinbase vs Binance)
          </p>
          <div className="grid grid-cols-3 gap-3">
            <NumField label="BTC-USD" value={gapBtc} onChange={setGapBtc} step="0.0001" mono />
            <NumField label="ETH-USD" value={gapEth} onChange={setGapEth} step="0.0001" mono />
            <NumField label="SOL-USD" value={gapSol} onChange={setGapSol} step="0.0001" mono />
          </div>
        </div>

        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-cyan-700 hover:bg-cyan-600 text-white text-sm font-semibold transition disabled:opacity-50"
        >
          {saving ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saving ? "Guardando…" : "Guardar y propagar al bot"}
        </button>
      </div>
    </div>
  );
}
