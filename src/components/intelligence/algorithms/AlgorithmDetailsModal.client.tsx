"use client";

import { useState, useEffect } from "react";
import { X, Key, Copy, Check, RefreshCw, Cloud, Lock, ExternalLink, AlertCircle, Save, Bitcoin } from "lucide-react";
import { toast } from "sonner";
import PairingInstructionsModal from "@/components/tradehub/PairingInstructionsModal.client";
import QualityGatesPanel from "./QualityGatesPanel.client";

type ConnectionStatus = "live" | "stale" | "synced" | "pending";

interface AlgorithmRow {
  id: string;
  name: string;
  market_type: "forex" | "futures" | "options" | "crypto";
  platform: string;
  status: string;
  parameters: Record<string, unknown> | null;
  engine_config: Record<string, unknown> | null;
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
                  <CmeSection data={data.cme} />
                )}
                {data.algorithm.market_type === "options" && (
                  <OptionsSection />
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
function CmeSection({ data }: { data: NonNullable<ConnectionsResponse["cme"]> }) {
  const linked = Boolean(data.cme_account_id);
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
            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
              data.account_type === "propfirm"
                ? "bg-amber-950 text-amber-400 border-amber-800"
                : "bg-emerald-950 text-emerald-400 border-emerald-800"
            }`}>
              {data.account_type === "propfirm" ? "Propfirm" : "Broker Real"}
            </span>
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
            Esta estrategia requiere una cuenta CME (propfirm o broker real) para conectarse.
          </p>
        </div>
      )}

      <a
        href="/intelligence/algorithms"
        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-amber-700 hover:bg-amber-600 text-white text-sm font-semibold transition"
      >
        <ExternalLink className="w-4 h-4" />
        {linked ? "Gestionar conexión Tradovate" : "Conectar cuenta CME"}
      </a>
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
          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border bg-emerald-950 text-emerald-400 border-emerald-800">
            {algorithm.status}
          </span>
        </div>
        <dl className="grid grid-cols-2 gap-y-2 text-xs">
          <Row label="Pares"           value={pairs.join(', ')} />
          <Row label="Tick (ms)"       value={String(engine.tick_ms ?? '—')} mono />
          <Row label="Cap diario"      value={`${engine.daily_trade_cap_total ?? '—'} (max ${engine.daily_trade_cap_per_symbol ?? '—'}/símbolo)`} />
          <Row label="Capital inicial" value={`$${String(engine.starting_capital_usd ?? '—')}`} mono />
        </dl>
      </div>

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
