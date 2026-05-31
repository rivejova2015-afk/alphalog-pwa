"use client";

import { useState, useEffect } from "react";
import { X, Key, Copy, Check, RefreshCw, Cloud, Lock, ExternalLink, AlertCircle, Save, Bitcoin, Pause, Play, Activity, Wifi, WifiOff, Inbox, Radio } from "lucide-react";
import { toast } from "sonner";
import PairingInstructionsModal from "@/components/tradehub/PairingInstructionsModal.client";
import QualityGatesPanel from "./QualityGatesPanel.client";
import { AlgorithmShadowInbox } from "./AlgorithmShadowInbox.client";
import TradovateConnectModal from "./TradovateConnectModal.client";

type ConnectionStatus = "live" | "stale" | "synced" | "pending";

interface AlgorithmRow {
  id: string;
  name: string;
  market_type: "forex" | "futures" | "options" | "crypto";
  platform: string;
  status: string;
  parameters: Record<string, unknown> | null;
  engine_config: Record<string, unknown> | null;
  // Sprint E — dispatcher telemetry (server cron writes these every minute
  // for Tradovate/IBKR algos; null on EA-driven MT4/MT5 since the EA polls
  // a different endpoint).
  last_dispatch_at?:     string | null;
  last_signal_bar_ts?:   string | null;
  last_dispatch_action?: string | null;
  last_dispatch_reason?: string | null;
}

interface ConnectionsResponse {
  algorithm: {
    id: string;
    name: string;
    market_type: "forex" | "futures" | "options";
    instrument: string;
    platform: "MT4" | "MT5";
  };
  mt5: {
    bot_account_id: string | null;
    account_id: string | null;
    label: string | null;
    platform: string | null;
    paired: boolean;
    last_heartbeat_at: string | null;
    instance_status: string | null;
    connection_status: ConnectionStatus;
    webhook_url: string;
  } | null;
  cme: {
    cme_account_id: string | null;
    provider_name: string | null;
    account_number: string | null;
    account_type: "propfirm" | "broker" | null;
    broker_type: string | null;
    connection_status: string | null;
    token_expires_at: string | null;
    last_connected_at: string | null;
    funded_amount: number | null;
    max_daily_loss: number | null;
    max_trailing_dd: number | null;
    is_paper: boolean | null;
  } | null;
  options: { available: boolean } | null;
}

interface Props {
  algorithmId: string;
  algorithmName: string;
  onClose: () => void;
}

export default function AlgorithmDetailsModal({ algorithmId, algorithmName, onClose }: Props) {
  const [algorithm, setAlgorithm] = useState<AlgorithmRow | null>(null);
  const [data, setData]           = useState<ConnectionsResponse | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [pairing, setPairing]     = useState<{ token: string; expiresAt: string } | null>(null);

  async function fetchAll() {
    setLoading(true);
    setError(null);
    try {
      // Always fetch the canonical algorithm row to decide which section to render.
      // For crypto we skip the connections endpoint (it normalizes market_type to
      // forex|futures|options and doesn't know about Fly bots).
      const algoRes = await fetch(`/api/algorithms/${algorithmId}`, { cache: "no-store" });
      if (!algoRes.ok) {
        const body = await algoRes.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${algoRes.status}`);
      }
      const algoJson = await algoRes.json();
      const algo = algoJson.algorithm as AlgorithmRow;
      setAlgorithm(algo);

      if (algo.market_type === "crypto") {
        setData(null);  // crypto section pulls everything from the algorithm row directly
        return;
      }

      const res = await fetch(`/api/algorithms/${algorithmId}/connections`, { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAll();
  }, [algorithmId]);

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        role="dialog"
        aria-modal="true"
        aria-label={`Detalles de conexión de ${algorithmName}`}
        onClick={onClose}
      >
        <div
          className="w-full max-w-2xl rounded-lg bg-[#0a0e1a] border border-[#1f2937] shadow-2xl max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-5 border-b border-[#1f2937]">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-cyan-400" />
              <h2 className="text-base font-semibold text-slate-100">Detalles de conexión</h2>
              <span className="text-xs text-slate-500">· {algorithmName}</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-500 hover:text-slate-200 transition"
              aria-label="Cerrar"
            >
              <X size={18} />
            </button>
          </div>

          <div className="p-5">
            {loading && <SkeletonBlock />}

            {error && !loading && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-950/40 border border-red-900/60 text-red-300 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {!loading && !error && algorithm?.market_type === "crypto" && (
              <CoinarbSection algorithm={algorithm} onSaved={fetchAll} />
            )}

            {!loading && !error && data && algorithm?.market_type !== "crypto" && (
              <>
                {data.algorithm.market_type === "forex" && data.mt5 && (
                  <Mt5Section
                    data={data.mt5}
                    algorithmId={algorithmId}
                    defaultPlatform={data.algorithm.platform}
                    onTokenGenerated={(t) => setPairing(t)}
                    onRefresh={fetchAll}
                  />
                )}
                {data.algorithm.market_type === "futures" && data.cme && (
                  <CmeSection data={data.cme} onRefresh={fetchAll} />
                )}
                {data.algorithm.market_type === "options" && (
                  <OptionsSection />
                )}

                {/* Sprint E — server-side dispatcher panel. Visible only for
                    Tradovate/IBKR algos (futures/options) since those are the
                    ones the dispatcher cron processes. EA-driven MT5 algos use
                    a different path (signal polling) and don't write
                    last_dispatch_*. */}
                {algorithm && (algorithm.platform === "Tradovate" || algorithm.platform === "IBKR") && (
                  <DispatcherSection algorithm={algorithm} />
                )}

                <div className="mt-6 pt-5 border-t border-[#1f2937]">
                  <h3 className="text-xs uppercase tracking-wider text-slate-500 font-medium mb-3">Quality Gates Tier-1</h3>
                  <QualityGatesPanel algorithmId={algorithmId} />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {pairing && (
        <PairingInstructionsModal
          token={pairing.token}
          expiresAt={pairing.expiresAt}
          expiresInMinutes={10}
          onClose={() => {
            setPairing(null);
            fetchAll();
          }}
        />
      )}
    </>
  );
}

function SkeletonBlock() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-4 bg-slate-800 rounded w-1/3" />
      <div className="h-20 bg-slate-800/60 rounded" />
      <div className="h-4 bg-slate-800 rounded w-1/4" />
      <div className="h-12 bg-slate-800/60 rounded" />
    </div>
  );
}

// ─── MT5 / Forex section ────────────────────────────────────────────────────
function Mt5Section({
  data,
  algorithmId,
  defaultPlatform,
  onTokenGenerated,
  onRefresh,
}: {
  data: NonNullable<ConnectionsResponse["mt5"]>;
  algorithmId: string;
  defaultPlatform: "MT4" | "MT5";
  onTokenGenerated: (t: { token: string; expiresAt: string }) => void;
  onRefresh: () => void;
}) {
  const [generating, setGenerating] = useState(false);
  const [copiedUrl, setCopiedUrl]   = useState(false);

  async function generateToken() {
    setGenerating(true);
    try {
      const res = await fetch(`/api/algorithms/${algorithmId}/pairing-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: data.platform ?? defaultPlatform }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body?.error ?? "Error al generar token");
        return;
      }
      const json = await res.json();
      onTokenGenerated({ token: json.token, expiresAt: json.expires_at });
      onRefresh();
      toast.success("Token generado · expira en 10 min");
    } catch (e) {
      toast.error(`Error: ${e instanceof Error ? e.message : "desconocido"}`);
    } finally {
      setGenerating(false);
    }
  }

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(data.webhook_url);
      setCopiedUrl(true);
      toast.success("URL copiada");
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch {
      toast.error("No se pudo copiar");
    }
  }

  const hasInstance = Boolean(data.bot_account_id);
  const isPending = data.account_id?.startsWith("pending-") ?? false;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-500 font-medium">
        <Cloud className="w-3 h-3" />
        Plataforma · {data.platform ?? defaultPlatform}
      </div>

      {hasInstance ? (
        <div className="rounded-lg bg-[#151b28] border border-[#1f2937] p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-slate-100">Cuenta vinculada</span>
            <StatusBadge status={data.connection_status} />
          </div>
          <dl className="grid grid-cols-2 gap-y-2 text-xs">
            <Row label="Etiqueta"        value={data.label ?? "—"} />
            <Row label="Cuenta MT5/MT4"  value={isPending ? "Pendiente de pairing" : (data.account_id ?? "—")} mono />
            <Row label="Plataforma"      value={data.platform ?? "—"} />
            <Row label="Estado pairing"  value={data.paired ? "Vinculado" : "Token sin usar"} />
            <Row label="Último heartbeat" value={data.last_heartbeat_at ? formatRelative(data.last_heartbeat_at) : "—"} />
            <Row label="Estado instance" value={data.instance_status ?? "—"} />
          </dl>
        </div>
      ) : (
        <div className="rounded-lg bg-[#151b28] border border-dashed border-[#1f2937] p-4 text-center">
          <p className="text-sm text-slate-400 mb-1">Sin cuenta vinculada todavía</p>
          <p className="text-xs text-slate-600">Genera un token de pairing para conectar tu MT5/MT4.</p>
        </div>
      )}

      <button
        type="button"
        onClick={generateToken}
        disabled={generating}
        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-cyan-700 hover:bg-cyan-600 text-white text-sm font-semibold transition disabled:opacity-50"
      >
        <RefreshCw className={`w-4 h-4 ${generating ? "animate-spin" : ""}`} />
        {hasInstance ? "Generar nuevo token de pairing" : "Generar token de conexión"}
      </button>

      <div className="rounded-lg bg-[#0f1422] border border-[#1f2937] p-3">
        <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">Webhook URL (telemetría)</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 px-2 py-1.5 rounded bg-slate-800 text-cyan-300 text-xs font-mono overflow-x-auto">
            {data.webhook_url}
          </code>
          <button
            type="button"
            onClick={copyUrl}
            className="px-2 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-xs flex items-center gap-1"
            aria-label="Copiar URL"
          >
            {copiedUrl ? <Check size={12} /> : <Copy size={12} />}
          </button>
        </div>
        <p className="text-[10px] text-slate-600 mt-1.5">El EA usa esta URL + el secret entregado al pairear.</p>
      </div>
    </div>
  );
}

// ─── CME / Futures section ──────────────────────────────────────────────────
function CmeSection({ data, onRefresh }: { data: NonNullable<ConnectionsResponse["cme"]>; onRefresh: () => void }) {
  const linked = Boolean(data.cme_account_id);
  const connected = data.connection_status === "connected";
  const [showConnectModal, setShowConnectModal] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-500 font-medium">
        <Cloud className="w-3 h-3" />
        Plataforma · Futuros (CME)
      </div>

      {linked ? (
        <div className="rounded-lg bg-[#151b28] border border-[#1f2937] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-100">{data.provider_name ?? "Proveedor"}</span>
            <div className="flex items-center gap-1.5">
              {data.is_paper !== null && (
                <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${
                  data.is_paper
                    ? "bg-amber-950 text-amber-400 border-amber-800"
                    : "bg-red-950 text-red-400 border-red-800"
                }`}>
                  {data.is_paper ? "Paper" : "Live"}
                </span>
              )}
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                data.account_type === "propfirm"
                  ? "bg-amber-950 text-amber-400 border-amber-800"
                  : "bg-emerald-950 text-emerald-400 border-emerald-800"
              }`}>
                {data.account_type === "propfirm" ? "Propfirm" : "Broker Real"}
              </span>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-y-2 text-xs">
            <Row label="Número de cuenta"     value={data.account_number ?? "—"} mono />
            <Row label="Broker"               value={data.broker_type ?? "—"} />
            <Row label="Estado conexión"      value={data.connection_status ?? "no conectado"} />
            <Row label="Último connect"       value={data.last_connected_at ? formatRelative(data.last_connected_at) : "—"} />
            <Row label="Token expira"         value={data.token_expires_at ? formatRelative(data.token_expires_at) : "—"} />
            <Row label="Capital financiado"   value={data.funded_amount !== null ? `$${data.funded_amount.toLocaleString()}` : "—"} mono />
            <Row label="Pérdida diaria max"   value={data.max_daily_loss !== null ? `$${data.max_daily_loss.toLocaleString()}` : "—"} mono />
            <Row label="Trailing drawdown"    value={data.max_trailing_dd !== null ? `$${data.max_trailing_dd.toLocaleString()}` : "—"} mono />
          </dl>
        </div>
      ) : (
        <div className="rounded-lg bg-[#151b28] border border-dashed border-[#1f2937] p-4 text-center">
          <p className="text-sm text-slate-400 mb-1">Sin cuenta CME vinculada</p>
          <p className="text-xs text-slate-600 mb-3">
            Esta estrategia requiere una cuenta CME (propfirm o broker real). Creala en el wizard de nueva estrategia.
          </p>
        </div>
      )}

      {linked && (
        <button
          type="button"
          onClick={() => setShowConnectModal(true)}
          disabled={!data.cme_account_id}
          className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-semibold transition disabled:opacity-40 ${
            connected ? "bg-emerald-700 hover:bg-emerald-600" : "bg-amber-600 hover:bg-amber-500"
          }`}
        >
          {connected ? <Check className="w-4 h-4" /> : <Cloud className="w-4 h-4" />}
          {connected ? "Re-conectar Tradovate (renovar token)" : "Conectar Tradovate"}
        </button>
      )}
      {!linked && (
        <a
          href="/intelligence/algorithms"
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-amber-700 hover:bg-amber-600 text-white text-sm font-semibold transition"
        >
          <ExternalLink className="w-4 h-4" />
          Crear cuenta CME en el wizard
        </a>
      )}

      {showConnectModal && data.cme_account_id && (
        <TradovateConnectModal
          cmeAccountId={data.cme_account_id}
          providerName={data.provider_name}
          accountNumber={data.account_number}
          isPaper={data.is_paper ?? true}
          onClose={() => setShowConnectModal(false)}
          onSuccess={onRefresh}
        />
      )}
    </div>
  );
}

// ─── Options section (placeholder) ──────────────────────────────────────────
function OptionsSection() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-500 font-medium">
        <Cloud className="w-3 h-3" />
        Plataforma · Opciones
      </div>

      <div className="rounded-lg bg-[#151b28] border border-violet-900/40 p-6 text-center">
        <Lock className="w-8 h-8 text-violet-400 mx-auto mb-3" />
        <p className="text-sm font-semibold text-slate-100 mb-1">Próximamente</p>
        <p className="text-xs text-slate-500 leading-relaxed">
          La integración con Interactive Brokers (IBKR) está en desarrollo. Las estrategias de opciones
          podrán conectarse vía API cuando esté disponible.
        </p>
      </div>
    </div>
  );
}

// ─── Coinarb / Crypto section ───────────────────────────────────────────────
//
// Edits the 4 scalar tunables + 3 per-symbol arb gap thresholds that live in
// `algorithms.parameters`. PUT to /api/algorithms/[id] validates against
// CoinarbParametersSchema.partial() and inserts a bot_commands row so the
// running Fly bot picks up the change within ~30s (no restart).
//
function CoinarbSection({ algorithm, onSaved }: { algorithm: AlgorithmRow; onSaved: () => void }) {
  const initial = (algorithm.parameters ?? {}) as Record<string, unknown>;
  const initialGap = (initial.arb_gap_min ?? {}) as Record<string, number>;

  const [mtfMin, setMtfMin]     = useState<string>(num(initial.mtf_confidence_min, 0.30));
  const [pdMacro, setPdMacro]   = useState<string>(num(initial.pd_macro_band, 0.005));
  const [pdMicro, setPdMicro]   = useState<string>(num(initial.pd_micro_band, 0.005));
  const [sweep, setSweep]       = useState<string>(num(initial.sweep_confirm_body_ratio, 0.40));
  const [gapBtc, setGapBtc]     = useState<string>(num(initialGap['BTC-USD'], 0.0005));
  const [gapEth, setGapEth]     = useState<string>(num(initialGap['ETH-USD'], 0.0008));
  const [gapSol, setGapSol]     = useState<string>(num(initialGap['SOL-USD'], 0.0010));
  const [saving, setSaving]     = useState(false);

  async function save() {
    setSaving(true);
    try {
      const parameters: Record<string, unknown> = {
        mtf_confidence_min:        Number(mtfMin),
        pd_macro_band:             Number(pdMacro),
        pd_micro_band:             Number(pdMicro),
        sweep_confirm_body_ratio:  Number(sweep),
        arb_gap_min: {
          'BTC-USD': Number(gapBtc),
          'ETH-USD': Number(gapEth),
          'SOL-USD': Number(gapSol),
        },
      };

      const res = await fetch(`/api/algorithms/${algorithm.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parameters }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const issues = json.issues ? `: ${JSON.stringify(json.issues)}` : '';
        toast.error(`${json.error ?? 'Error'}${issues}`);
        return;
      }
      toast.success('Parámetros guardados — el bot los aplica en ≤30s');
      onSaved();
    } catch (e) {
      toast.error(`Error: ${e instanceof Error ? e.message : 'desconocido'}`);
    } finally {
      setSaving(false);
    }
  }

  const engine = (algorithm.engine_config ?? {}) as Record<string, unknown>;
  const pairs = (engine.spot_pairs ?? ['BTC-USD','ETH-USD','SOL-USD']) as string[];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-500 font-medium">
        <Bitcoin className="w-3 h-3" />
        Plataforma · Coinbase Spot · Fly.io
      </div>

      <div className="rounded-lg bg-[#151b28] border border-[#1f2937] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-100">Bot status</span>
          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
            algorithm.status === 'live'
              ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
              : 'bg-amber-950 text-amber-400 border-amber-800'
          }`}>
            {algorithm.status}
          </span>
        </div>
        <dl className="grid grid-cols-2 gap-y-2 text-xs">
          <Row label="Pares"           value={pairs.join(', ')} />
          <Row label="Tick (ms)"       value={String(engine.tick_ms ?? '—')} mono />
          <Row label="Cap diario"      value={`${engine.daily_trade_cap_total ?? '—'} (max ${engine.daily_trade_cap_per_symbol ?? '—'}/símbolo)`} />
          <Row label="Capital inicial" value={`$${String(engine.starting_capital_usd ?? '—')}`} mono />
        </dl>
        <ControlButton algorithmId={algorithm.id} currentStatus={algorithm.status} onChanged={onSaved} />
      </div>

      <TelemetryPanel algorithmId={algorithm.id} pairs={pairs} />

      <div className="rounded-lg bg-[#151b28] border border-[#1f2937] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-100">Tunables (hot-reload ≤30s)</span>
          <span className="text-[10px] text-slate-500 font-mono">algorithms.parameters</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <NumField label="MTF confidence min" value={mtfMin} onChange={setMtfMin} step="0.01" hint="0.20–0.50 típico" />
          <NumField label="Sweep body ratio"   value={sweep}  onChange={setSweep}  step="0.01" hint="0.30–0.50 típico" />
          <NumField label="PD macro band"      value={pdMacro} onChange={setPdMacro} step="0.001" hint="0.005 default" />
          <NumField label="PD micro band"      value={pdMicro} onChange={setPdMicro} step="0.001" hint="0.005 default" />
        </div>

        <div className="pt-3 border-t border-[#1f2937]">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Arb gap min (Coinbase vs Binance)</p>
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
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Guardando…' : 'Guardar y propagar al bot'}
        </button>
      </div>
    </div>
  );
}

interface CommandLifecycle {
  id: string;
  command_type: string;
  status: string;  // 'PENDING' | 'pending' | 'DONE' | 'FAILED'
  ack: { status: string; message: string | null; acked_at: string | null } | null;
}

function ControlButton({ algorithmId, currentStatus, onChanged }: {
  algorithmId: string; currentStatus: string; onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [awaitingAck, setAwaitingAck] = useState(false);
  const isPaused = currentStatus !== 'live';

  // After POST /control, the bot has up to ~30s to pick the command up.
  // Poll bot_commands.status every 5s until DONE/FAILED or 60s timeout, so
  // the user sees real ack state instead of an optimistic "Comando enviado"
  // that may hide a dead poller. Returns the message the bot wrote.
  async function pollAck(commandId: string, label: string): Promise<void> {
    const startedAt = Date.now();
    const TIMEOUT_MS = 60_000;
    const INTERVAL_MS = 5_000;

    setAwaitingAck(true);
    try {
      while (Date.now() - startedAt < TIMEOUT_MS) {
        await new Promise((r) => setTimeout(r, INTERVAL_MS));
        try {
          const res = await fetch(`/api/algorithms/${algorithmId}/commands/recent?limit=10`, { cache: 'no-store' });
          if (!res.ok) continue;
          const json = await res.json();
          const cmd = (json.commands ?? []).find((c: CommandLifecycle) => c.id === commandId);
          if (!cmd) continue;
          // Lifecycle status is what we wait on. ack row carries the message.
          const lifecycleDone = cmd.status === 'DONE' || cmd.status === 'FAILED';
          if (!lifecycleDone) continue;

          if (cmd.status === 'DONE') {
            toast.success(cmd.ack?.message ?? `${label} aplicado`);
          } else {
            toast.error(cmd.ack?.message ?? `${label} falló en el bot`);
          }
          onChanged();
          return;
        } catch { /* keep polling on transient errors */ }
      }
      toast.warning(`${label} enviado pero sin ack en 60s — verificar logs de Fly`);
      onChanged();
    } finally {
      setAwaitingAck(false);
    }
  }

  async function dispatch(action: 'pause' | 'resume') {
    const label = action === 'pause' ? 'Pause' : 'Resume';
    setBusy(true);
    try {
      const res = await fetch(`/api/algorithms/${algorithmId}/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error ?? `Error ${res.status}`);
        return;
      }
      const commandId = json.command?.id as string | undefined;
      if (!commandId) {
        toast.warning(`${label} enviado, pero respuesta sin command id — no se puede verificar ack`);
        setTimeout(onChanged, 35_000);
        return;
      }
      toast.info(`${label} enviado — esperando ack del bot (≤60s)…`);
      // Don't await — let the user keep using the UI while the poll runs.
      void pollAck(commandId, label);
    } catch (e) {
      toast.error(`Error: ${e instanceof Error ? e.message : 'desconocido'}`);
    } finally {
      setBusy(false);
    }
  }

  const disabled = busy || awaitingAck;
  const labelBusy = busy ? 'Enviando…' : awaitingAck ? 'Esperando ack…' : null;

  return (
    <button
      type="button"
      onClick={() => dispatch(isPaused ? 'resume' : 'pause')}
      disabled={disabled}
      className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-semibold transition disabled:opacity-50 ${
        isPaused
          ? 'bg-emerald-700 hover:bg-emerald-600'
          : 'bg-amber-700 hover:bg-amber-600'
      }`}
    >
      {disabled ? <RefreshCw className="w-4 h-4 animate-spin" /> : isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
      {labelBusy ?? (isPaused ? 'Reanudar bot' : 'Pausar bot')}
    </button>
  );
}

// Live telemetry — pulls /api/algorithms/[id]/telemetry every 15s and renders
// per-symbol capacity, WS connectivity, heartbeat age, and equity/positions.
// The endpoint reads the latest coinarb_telemetry row that the Fly bot upserts
// each tick, so this panel mirrors the bot's runtime state at ~bot-tick cadence.
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

function TelemetryPanel({ algorithmId, pairs }: { algorithmId: string; pairs: string[] }) {
  const [tele, setTele] = useState<Telemetry | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function fetchTele() {
      try {
        const res = await fetch(`/api/algorithms/${algorithmId}/telemetry`, { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) setTele(json.telemetry);
      } catch { /* network blip — keep last good values */ }
      finally { if (!cancelled) setLoaded(true); }
    }
    fetchTele();
    const id = setInterval(fetchTele, 15_000);
    return () => { cancelled = true; clearInterval(id); };
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

  const hbAge = tele.lastHeartbeatAt ? Date.now() - new Date(tele.lastHeartbeatAt).getTime() : null;
  const hbStale = hbAge !== null && hbAge > 60_000;  // >1min counts as stale at 15s tick cadence

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
          <div className={`text-sm font-mono font-bold ${hbStale ? 'text-amber-400' : 'text-emerald-400'}`}>
            {hbAge === null ? '—' : hbAge < 60_000 ? `${Math.round(hbAge / 1000)}s` : `${Math.round(hbAge / 60_000)}m`}
          </div>
        </div>
        <WsTile label="Coinbase" connected={tele.wsCoinbaseConnected} />
        <WsTile label="Binance"  connected={tele.wsBinanceConnected} />
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
              pct >= 90 ? 'bg-red-500' :
              pct >= 70 ? 'bg-amber-500' :
              pct > 0   ? 'bg-emerald-500' :
                          'bg-slate-700';
            return (
              <div key={sym} className="flex items-center gap-2">
                <span className="w-16 text-[11px] font-mono text-slate-400">{sym.split('-')[0]}</span>
                <div className="flex-1 h-2 bg-[#0a0e1a] rounded overflow-hidden">
                  <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
                </div>
                <span className="w-12 text-[11px] font-mono text-slate-400 text-right">{used}/{tele.perSymbolCap}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Equity + positions + phase */}
      <dl className="grid grid-cols-2 gap-y-2 text-xs pt-2 border-t border-[#1f2937]">
        <Row label="Equity"          value={fmt$(tele.equityUsd)} mono />
        <Row label="Open positions"  value={String(tele.openPositionsCount ?? 0)} mono />
        <Row label="Pnl hoy"         value={fmt$(tele.totalPnlUsd, true)} mono />
        <Row label="Win rate"        value={tele.winRate !== null ? `${(tele.winRate * 100).toFixed(1)}%` : '—'} mono />
        <Row label="Fase"            value={tele.phaseCurrent ?? '—'} />
        <Row label="Pérdidas seguidas" value={String(tele.consecutiveLosses ?? 0)} mono />
      </dl>
    </div>
  );
}

function WsTile({ label, connected }: { label: string; connected: boolean }) {
  return (
    <div className="bg-[#0a0e1a] rounded p-2">
      <div className="text-[10px] text-slate-500 mb-0.5">{label} WS</div>
      <div className={`text-sm font-mono font-bold flex items-center gap-1 ${connected ? 'text-emerald-400' : 'text-red-400'}`}>
        {connected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
        {connected ? 'OK' : 'DOWN'}
      </div>
    </div>
  );
}

function fmt$(v: number | null, signed = false): string {
  if (v === null) return '—';
  const sign = signed && v > 0 ? '+' : '';
  return `${sign}$${v.toFixed(2)}`;
}

function NumField({ label, value, onChange, step, hint, mono }: {
  label: string; value: string; onChange: (v: string) => void; step: string; hint?: string; mono?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">{label}</span>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full px-2 py-1.5 rounded bg-[#0a0e1a] border border-[#1f2937] text-slate-100 text-sm focus:border-cyan-700 focus:outline-none ${mono ? 'font-mono' : ''}`}
      />
      {hint && <span className="block text-[10px] text-slate-600 mt-0.5">{hint}</span>}
    </label>
  );
}

function num(v: unknown, fallback: number): string {
  return typeof v === 'number' ? String(v) : String(fallback);
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: ConnectionStatus }) {
  const map: Record<ConnectionStatus, { label: string; className: string; dot: string }> = {
    live:    { label: "Live",       className: "bg-emerald-950 text-emerald-400 border-emerald-800", dot: "bg-emerald-400 animate-pulse" },
    synced:  { label: "Sincronizado", className: "bg-blue-950 text-blue-400 border-blue-800",       dot: "bg-blue-400" },
    stale:   { label: "Stale",      className: "bg-orange-950 text-orange-400 border-orange-800",   dot: "bg-orange-400" },
    pending: { label: "Pendiente",  className: "bg-slate-800 text-slate-400 border-slate-700",      dot: "bg-slate-500" },
  };
  const m = map[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${m.className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
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

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) {
    const future = Math.abs(ms);
    const mins = Math.floor(future / 60000);
    if (mins < 60) return `en ${mins}m`;
    return `en ${Math.floor(mins / 60)}h`;
  }
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "hace segundos";
  if (mins < 60) return `hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  return `hace ${Math.floor(hrs / 24)}d`;
}

// Sprint E — Dispatcher telemetry + Shadow Inbox section. Renders the
// `last_dispatch_*` columns the cron writes every minute, plus the audit
// trail of all signals the dispatcher produced. Only mounted for platforms
// the server-side dispatcher handles (Tradovate, IBKR stub).
function DispatcherSection({ algorithm }: { algorithm: AlgorithmRow }) {
  const lastAt    = algorithm.last_dispatch_at ?? null;
  const lastBarTs = algorithm.last_signal_bar_ts ?? null;
  const action    = algorithm.last_dispatch_action ?? null;
  const reason    = algorithm.last_dispatch_reason ?? null;

  // Stale check: a dispatcher polling every minute should have a fresh
  // last_dispatch_at. Re-evaluate every 30s so the banner appears even with
  // the modal open. React Compiler forbids Date.now() during render → keep
  // the time stamp in state.
  const [now, setNow] = useState<number>(0);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const isStale = !lastAt || (now > 0 && now - new Date(lastAt).getTime() > 5 * 60 * 1000);
  const shouldWarn = isStale && (algorithm.status === "live" || algorithm.status === "running" || algorithm.status === "paper");

  const actionColor = (() => {
    if (!action) return "text-slate-500";
    if (action === "placed")        return "text-emerald-400";
    if (action === "shadow_logged") return "text-amber-400";
    if (action === "skipped")       return "text-slate-400";
    if (action === "failed")        return "text-red-400";
    return "text-slate-300";
  })();

  return (
    <div className="mt-6 pt-5 border-t border-[#1f2937]">
      <h3 className="text-xs uppercase tracking-wider text-slate-500 font-medium mb-3 flex items-center gap-2">
        <Radio size={12} className="text-cyan-400" />
        Dispatcher Telemetry
      </h3>

      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 text-xs">
        <Row label="Última ejecución" value={lastAt ? `${formatRelative(lastAt)} · ${new Date(lastAt).toLocaleString()}` : "(nunca)"} mono />
        <Row label="Bar más reciente" value={lastBarTs ? new Date(lastBarTs).toLocaleString() : "—"} mono />
        <dt className="text-slate-500">Última decisión</dt>
        <dd className={`text-right font-mono ${actionColor}`}>{action ?? "—"}</dd>
        <Row label="Motivo" value={reason ?? "—"} mono />
      </dl>

      {shouldWarn && (
        <div className="mt-3 flex items-start gap-2 p-3 rounded-lg bg-red-950/40 border border-red-900/60 text-red-300 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Dispatcher stale</p>
            <p className="mt-0.5">
              El cron debería actualizar este algoritmo cada ~60s. La última actualización fue {lastAt ? formatRelative(lastAt) : "nunca"}.
              Verificar `/api/cron/algorithms/tradovate-poll` en Fly logs.
            </p>
          </div>
        </div>
      )}

      <div className="mt-5">
        <h4 className="text-xs uppercase tracking-wider text-slate-500 font-medium mb-3 flex items-center gap-2">
          <Inbox size={12} className="text-cyan-400" />
          Shadow Inbox
        </h4>
        <AlgorithmShadowInbox algorithmId={algorithm.id} />
      </div>
    </div>
  );
}
