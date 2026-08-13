"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X, Key, Copy, Check, RefreshCw, Cloud, AlertCircle, Save, Play, Inbox, Radio, Files, Download } from "lucide-react";
import { toast } from "sonner";
import PairingInstructionsModal from "@/components/tradehub/PairingInstructionsModal.client";
import QualityGatesPanel from "./QualityGatesPanel.client";
import AuditTrailTimeline from "./AuditTrailTimeline.client";
import { AlgorithmShadowInbox } from "./AlgorithmShadowInbox.client";
import TradovateConnectModal from "./TradovateConnectModal.client";
import { InfoBanner } from "./InfoBanner.client";
import { ResearchModeBanner } from "./ResearchModeBanner.client";

type ConnectionStatus = "live" | "stale" | "synced" | "pending";

interface AlgorithmRow {
  id: string;
  name: string;
  market_type: "forex" | "futures" | "options" | "crypto";
  platform: string;
  status: string;
  parameters: Record<string, unknown> | null;
  engine_config: Record<string, unknown> | null;
  // Research mode: when this is null the algorithm has no cuenta vinculada
  // and the modal surfaces a "Deploy to account" section. Once linked, the
  // existing Mt5/Cme/Options Section takes over.
  linked_bot_account_id?: string | null;
  // Sprint E — dispatcher telemetry (server cron writes these every minute
  // for Tradovate/IBKR algos; null on EA-driven MT4/MT5 since the EA polls
  // a different endpoint).
  last_dispatch_at?:     string | null;
  last_signal_bar_ts?:   string | null;
  last_dispatch_action?: string | null;
  last_dispatch_reason?: string | null;
}

interface BotAccountOption {
  id: string;
  label: string;
  account_id: string;
}

interface CmeAccountOption {
  id: string;
  account_type: "propfirm" | "broker";
  provider_name: string;
  account_number: string;
  label: string | null;
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
  const router = useRouter();
  const [algorithm, setAlgorithm] = useState<AlgorithmRow | null>(null);
  const [data, setData]           = useState<ConnectionsResponse | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [pairing, setPairing]     = useState<{ token: string; expiresAt: string } | null>(null);
  const [duplicating, setDuplicating] = useState(false);
  const [activating, setActivating]   = useState(false);

  async function handleActivate() {
    setActivating(true);
    try {
      const res = await fetch(`/api/algorithms/${algorithmId}`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ status: "draft" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error || `HTTP ${res.status}`);
        return;
      }
      toast.success("Estrategia activada — corré un engine-backtest para promoverla a paper.");
      await fetchAll();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error de conexión");
    } finally {
      setActivating(false);
    }
  }

  async function handleDuplicate() {
    setDuplicating(true);
    try {
      const res = await fetch(`/api/algorithms/${algorithmId}/duplicate`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error || `HTTP ${res.status}`);
        return;
      }
      toast.success(`Duplicado: "${json.algorithm?.name ?? "copia"}"`);
      router.refresh();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error de conexión");
    } finally {
      setDuplicating(false);
    }
  }

  async function fetchAll() {
    setLoading(true);
    setError(null);
    try {
      // Always fetch the canonical algorithm row to decide which section to render.
      const algoRes = await fetch(`/api/algorithms/${algorithmId}`, { cache: "no-store" });
      if (!algoRes.ok) {
        const body = await algoRes.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${algoRes.status}`);
      }
      const algoJson = await algoRes.json();
      const algo = algoJson.algorithm as AlgorithmRow;
      setAlgorithm(algo);

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
          <div className="flex items-center justify-between gap-2 flex-wrap p-4 sm:p-5 border-b border-[#1f2937]">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-cyan-400" />
              <h2 className="text-base font-semibold text-slate-100">Detalles de conexión</h2>
              <span className="text-xs text-slate-500">· {algorithmName}</span>
            </div>
            <div className="flex items-center gap-1">
              {algorithm?.status === "paused" && (
                <button
                  type="button"
                  onClick={handleActivate}
                  disabled={activating || loading}
                  className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-emerald-900/40 border border-emerald-700/50 text-emerald-300 hover:bg-emerald-800/60 transition disabled:opacity-40"
                  aria-label="Activar estrategia"
                  title="Mover paused → draft. El engine-backtest la auto-promoverá a paper si pasa las gates."
                >
                  <Play size={11} /> {activating ? "Activando…" : "Activar"}
                </button>
              )}
              <button
                type="button"
                onClick={handleDuplicate}
                disabled={duplicating || loading}
                className="text-slate-500 hover:text-[#a78bfa] transition disabled:opacity-40 disabled:cursor-not-allowed p-1 rounded"
                aria-label="Duplicar estrategia"
                title="Duplicar como nueva estrategia draft"
              >
                <Files size={16} />
              </button>
              {algorithm && algorithm.market_type !== "options" && (
                <a
                  href={`/api/algorithms/${algorithmId}/trades/export`}
                  className="text-slate-500 hover:text-cyan-400 transition p-1 rounded"
                  aria-label="Exportar trades (CSV)"
                  title="Exportar historial de trades como CSV"
                >
                  <Download size={16} />
                </a>
              )}
              <button
                type="button"
                onClick={onClose}
                className="text-slate-500 hover:text-slate-200 transition p-1 rounded"
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="p-4 sm:p-5">
            {loading && <SkeletonBlock />}

            {error && !loading && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-950/40 border border-red-900/60 text-red-300 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Research mode banner: surfaces "Deploy to account" when a forex
                algorithm has no cuenta vinculada. */}
            {!loading && !error && algorithm && algorithm.market_type === "forex" && !algorithm.linked_bot_account_id && (
              <DeployToAccountSection
                algorithmId={algorithmId}
                currentStatus={algorithm.status}
                onDeployed={fetchAll}
              />
            )}

            {/* CME equivalent (Wave 4 item 15) — links parameters.cme_account_id
                instead of linked_bot_account_id, since CME has no
                algorithm_deployments-based deploy path. IBKR/options has no
                equivalent (options hidden — Wave 4 item 16, no real backend). */}
            {!loading && !error && algorithm && algorithm.market_type === "futures" && !(algorithm.parameters as Record<string, unknown> | null)?.cme_account_id && (
              <CmeDeployToAccountSection
                algorithmId={algorithmId}
                currentStatus={algorithm.status}
                onDeployed={fetchAll}
              />
            )}

            {!loading && !error && data && (
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
                {data.algorithm.market_type === "futures" && algorithm && (
                  <KellySection algorithm={algorithm} onSaved={fetchAll} />
                )}
                {/* 'options' market_type has no display section — hidden
                    (Wave 4 item 16, owner decision 2026-07): OptionsSection
                    was a static "coming soon" banner with no real backend.
                    Restorable from git history once IBKR execution exists. */}

                {/* Sprint E — server-side dispatcher panel. Visible only for
                    Tradovate/IBKR algos (futures/options) since those are the
                    ones the dispatcher cron processes. EA-driven MT5 algos use
                    a different path (signal polling) and don't write
                    last_dispatch_*. */}
                {algorithm && (algorithm.platform === "Tradovate" || algorithm.platform === "IBKR") && (
                  <DispatcherSection algorithm={algorithm} />
                )}

                <div className="mt-6 pt-5 border-t border-[#1f2937] space-y-3">
                  <h3 className="text-xs uppercase tracking-wider text-slate-500 font-medium">Quality Gates Tier-1</h3>
                  <InfoBanner>
                    Tests cuantitativos que el algoritmo debe pasar para promover de paper → approved → live automáticamente.
                    Si una gate falla, el cron de promoción la deja en paper y loggea la causa.
                  </InfoBanner>
                  <QualityGatesPanel algorithmId={algorithmId} />
                </div>

                <div className="mt-6 pt-5 border-t border-[#1f2937] space-y-3">
                  <h3 className="text-xs uppercase tracking-wider text-slate-500 font-medium">Historial de actividad</h3>
                  <AuditTrailTimeline algorithmId={algorithmId} />
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

      <InfoBanner>
        El token de pairing autoriza a tu EA a recibir signals. Cada N segundos el EA pollea el endpoint
        de signal y obtiene BUY/SELL/HOLD para ejecutar localmente en MT5. El servidor nunca coloca órdenes en forex.
      </InfoBanner>

      {hasInstance ? (
        <div className="rounded-lg bg-[#151b28] border border-[#1f2937] p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-slate-100">Cuenta vinculada</span>
            <StatusBadge status={data.connection_status} />
          </div>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 sm:gap-x-4 text-xs">
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

      {/* Research mode banner: a futures algo with no cuenta CME vinculada is
          in research mode — it can backtest but won't place real orders until
          a CME/Tradovate account is linked. We reuse the existing CME account
          wizard flow for the CTA (same /intelligence/algorithms wizard the
          empty-state below already linked to) — no inline deploy endpoint. */}
      {!linked && (
        <ResearchModeBanner
          title="Modo research — sin cuenta vinculada"
          description={
            <>
              Esta estrategia de futuros está en modo research: podés correr backtests, pero no colocará órdenes
              reales hasta que vincules una cuenta CME (propfirm o broker real) y conectes Tradovate. Creá o vinculá
              la cuenta en el wizard de nueva estrategia para que el dispatcher empiece a operar.
            </>
          }
          cta={{ href: "/intelligence/algorithms", label: "Crear cuenta CME en el wizard" }}
        />
      )}

      {connected ? (
        <InfoBanner tone="emerald">
          Conexión Tradovate activa. El token vence en {data.token_expires_at ? formatRelative(data.token_expires_at) : "—"} y se renueva
          automáticamente antes de cada ejecución. Si ves error de auth, re-conectá manualmente con el botón de abajo.
        </InfoBanner>
      ) : (
        <InfoBanner>
          Conectá tus credenciales de Tradovate para que el cron del servidor coloque órdenes en tu cuenta cuando el engine emita signal.
          Los datos se cifran en el vault — la password nunca se persiste en texto plano.
        </InfoBanner>
      )}

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
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 sm:gap-x-4 text-xs">
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
      {/* CTA moved to the ResearchModeBanner above to avoid duplicate links. */}

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

// ─── Kelly position sizing section (futures only) ───────────────────────────
//
// Surfaces the 3 auto-populated stats (kelly_win_rate / kelly_avg_win_usd /
// kelly_avg_loss_usd) that engine-backtest writes into algorithm.parameters,
// plus the user-tunable knobs (enabled, fraction, min/max contracts).
//
// When the algo has no auto-populated stats yet, the section explains how to
// trigger them (run an engine-backtest with ≥30 trades).
//
function KellySection({ algorithm, onSaved }: { algorithm: AlgorithmRow; onSaved: () => void }) {
  const params = (algorithm.parameters ?? {}) as Record<string, unknown>;

  // Auto-populated by engine-backtest. Read-only here.
  const autoWinRate    = typeof params.kelly_win_rate           === "number" ? params.kelly_win_rate    : null;
  const autoAvgWin     = typeof params.kelly_avg_win_usd        === "number" ? params.kelly_avg_win_usd : null;
  const autoAvgLoss    = typeof params.kelly_avg_loss_usd       === "number" ? params.kelly_avg_loss_usd : null;
  const sampleSize     = typeof params.kelly_inputs_sample_size === "number" ? params.kelly_inputs_sample_size : null;
  const updatedAt      = typeof params.kelly_inputs_updated_at  === "string" ? params.kelly_inputs_updated_at : null;
  const sourceTag      = typeof params.kelly_inputs_source      === "string" ? params.kelly_inputs_source : null;
  const hasStats       = autoWinRate != null && autoAvgWin != null && autoAvgLoss != null;

  // User-tunable.
  const [enabled, setEnabled]     = useState<boolean>(params.kelly_enabled === true);
  const [fraction, setFraction]   = useState<string>(num(params.kelly_fraction, 0.5));
  const [minK, setMinK]           = useState<string>(num(params.kelly_min_contracts, 1));
  const [maxK, setMaxK]           = useState<string>(num(params.kelly_max_contracts, 10));
  const [saving, setSaving]       = useState(false);

  async function save() {
    if (!hasStats && enabled) {
      toast.error("Kelly necesita stats del backtest — corré un engine-backtest con ≥30 trades primero.");
      return;
    }
    const fracNum = Number(fraction);
    if (!Number.isFinite(fracNum) || fracNum <= 0 || fracNum > 1) {
      toast.error("kelly_fraction debe estar entre 0 y 1 (recomendado 0.25–0.5).");
      return;
    }
    const minNum = Math.max(0, Math.round(Number(minK)));
    const maxNum = Math.max(minNum, Math.round(Number(maxK)));
    if (!Number.isFinite(minNum) || !Number.isFinite(maxNum)) {
      toast.error("min/max contracts deben ser enteros válidos.");
      return;
    }

    setSaving(true);
    try {
      const merged: Record<string, unknown> = {
        ...params,
        kelly_enabled:       enabled,
        kelly_fraction:      fracNum,
        kelly_min_contracts: minNum,
        kelly_max_contracts: maxNum,
      };
      const res = await fetch(`/api/algorithms/${algorithm.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parameters: merged }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error ?? `Error ${res.status}`);
        return;
      }
      toast.success(enabled
        ? `Kelly activado (fraction=${fracNum}, ${minNum}–${maxNum} contratos)`
        : "Kelly desactivado — el dispatcher usa contracts_per_trade manual.");
      onSaved();
    } catch (e) {
      toast.error(`Error: ${e instanceof Error ? e.message : "desconocido"}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-6 pt-5 border-t border-[#1f2937] space-y-3">
      <h3 className="text-xs uppercase tracking-wider text-slate-500 font-medium">Position Sizing — Kelly Criterion</h3>
      <InfoBanner>
        Calcula contratos por trade con la fórmula de Kelly: <code className="text-slate-300">f* = p − (1−p)/R</code>.
        Multiplica por fractional Kelly (recomendado 0.25–0.5 por estabilidad), aplica como riesgo USD,
        y divide por el riesgo por contrato (SL ticks × tick value). Failure-open: si los inputs faltan
        o el equity no se puede leer, cae al <code className="text-slate-300">contracts_per_trade</code> manual.
      </InfoBanner>

      {/* Auto-populated stats — read-only display. */}
      <div className="rounded-lg bg-[#151b28] border border-[#1f2937] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-100">Stats del backtest</span>
          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
            hasStats
              ? "bg-emerald-950 text-emerald-400 border-emerald-800"
              : "bg-amber-950 text-amber-400 border-amber-800"
          }`}>
            {hasStats ? "Auto-poblado" : "Sin datos"}
          </span>
        </div>

        {hasStats ? (
          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-y-2 text-xs">
            <Row label="Win rate"   value={`${(autoWinRate! * 100).toFixed(1)}%`} />
            <Row label="Avg win"    value={`$${autoAvgWin!.toFixed(2)}`} />
            <Row label="Avg loss"   value={`$${autoAvgLoss!.toFixed(2)}`} />
            <Row label="Sample"     value={sampleSize != null ? `${sampleSize} trades` : "—"} />
            <Row label="Actualizado" value={updatedAt ? formatRelative(updatedAt) : "—"} />
            <Row label="Fuente"     value={sourceTag ?? "—"} mono />
          </dl>
        ) : (
          <p className="text-xs text-slate-400 leading-relaxed">
            Aún no hay stats. Corré un engine-backtest con ≥30 trades y edge positivo —
            el endpoint <code className="text-slate-300">/api/algorithms/[id]/engine-backtest</code> persiste
            win_rate, avg_win y avg_loss en <code className="text-slate-300">parameters</code> automáticamente.
          </p>
        )}
      </div>

      {/* User-tunable knobs. */}
      <div className="rounded-lg bg-[#151b28] border border-[#1f2937] p-4 space-y-3">
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-sm font-semibold text-slate-100">Activar Kelly sizing</span>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            disabled={saving}
            className="h-4 w-4 accent-emerald-600 cursor-pointer"
            aria-label="Activar Kelly sizing"
          />
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <NumField label="Fractional Kelly" value={fraction} onChange={setFraction} step="0.05" hint="0.5 = half-Kelly (recomendado)" />
          <NumField label="Min contratos"    value={minK}     onChange={setMinK}     step="1"    hint="Default 1" />
          <NumField label="Max contratos"    value={maxK}     onChange={setMaxK}     step="1"    hint="Default 10" />
        </div>

        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors disabled:opacity-40 flex items-center gap-1.5"
          >
            <Save size={11} />
            {saving ? "Guardando…" : "Guardar Kelly config"}
          </button>
        </div>
      </div>
    </div>
  );
}

// OptionsSection (placeholder) removed — Wave 4 item 16, owner decision
// 2026-07. Restorable from git history once IBKR execution exists.

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

      <div className="mb-3">
        <InfoBanner>
          El cron del servidor evalúa esta estrategia cada minuto y actualiza estos campos. Si la última ejecución queda
          vieja (más de 5 min) revisar logs de <span className="font-mono">/api/cron/algorithms/tradovate-poll</span> en Fly.
        </InfoBanner>
      </div>

      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 text-xs">
        <Row label="Última ejecución" value={lastAt ? `${formatRelative(lastAt)} · ${new Date(lastAt).toLocaleString()}` : "(nunca)"} mono />
        <Row label="Bar más reciente" value={lastBarTs ? new Date(lastBarTs).toLocaleString() : "—"} mono />
        <dt className="text-slate-500">Última decisión</dt>
        <dd className={`text-right font-mono ${actionColor}`}>{action ?? "—"}</dd>
        <Row label="Motivo" value={reason ?? "—"} mono />
      </dl>

      <p className="mt-2 text-[10px] text-[#475569] leading-relaxed">
        <span className="text-emerald-400 font-mono">placed</span> = orden colocada en live ·
        <span className="text-amber-400 font-mono ml-1">shadow_logged</span> = decisión registrada sin ejecutar (shadow mode) ·
        <span className="text-slate-400 font-mono ml-1">skipped</span> = sin signal o gate bloqueó ·
        <span className="text-red-400 font-mono ml-1">failed</span> = error técnico.
      </p>

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

// ─── Deploy to account section (forex MVP) ─────────────────────────────────
// Renders when the algorithm has no cuenta vinculada. Loads the user's
// bot_accounts, lets them pick one, and orchestrates the two-step approve
// + deploy flow on the backend. After success, refreshes the modal so the
// normal Mt5Section takes over and this banner disappears.
function DeployToAccountSection({
  algorithmId,
  currentStatus,
  onDeployed,
}: {
  algorithmId: string;
  currentStatus: string;
  onDeployed: () => void;
}) {
  const [accounts, setAccounts]       = useState<BotAccountOption[]>([]);
  const [loadingAccs, setLoadingAccs] = useState(true);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [notes, setNotes]             = useState("");
  const [deploying, setDeploying]     = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Same shape the wizard uses (id, label, account_id). We hit Supabase
        // directly via the browser client to skip a server round-trip — the
        // values are non-secret and already gated by RLS.
        const { createClient } = await import("@/lib/supabase/browser");
        const sb = createClient();
        const { data } = await sb.from("bot_accounts").select("id, label, account_id");
        if (!cancelled) setAccounts((data ?? []) as BotAccountOption[]);
      } finally {
        if (!cancelled) setLoadingAccs(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function handleDeploy() {
    if (!selectedAccountId) {
      toast.error("Elegí una cuenta para vincular");
      return;
    }
    setDeploying(true);
    try {
      // Step 1: promote to "approved" if we're still on draft/paper.
      // The deploy endpoint rejects anything other than approved/live, so
      // this orquesta el upgrade transparentemente para el usuario.
      if (currentStatus === "draft" || currentStatus === "paper") {
        const approveRes = await fetch(`/api/algorithms/${algorithmId}/approve`, { method: "POST" });
        if (!approveRes.ok) {
          const body = await approveRes.json().catch(() => ({}));
          toast.error(`Approve falló: ${body.error ?? approveRes.status}`);
          return;
        }
      }

      // Step 2: deploy with the selected bot_account(s). Endpoint marks the
      // algorithm as "live" and inserts an algorithm_deployments row.
      const res = await fetch(`/api/algorithms/${algorithmId}/deploy`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          bot_account_ids: [selectedAccountId],
          notes:           notes.trim() || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error || `Deploy falló: HTTP ${res.status}`);
        return;
      }
      toast.success("Estrategia vinculada y desplegada");
      onDeployed();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error de conexión");
    } finally {
      setDeploying(false);
    }
  }

  return (
    <div className="rounded-xl border border-[#a78bfa]/30 bg-[#a78bfa]/5 p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-[#a78bfa] font-mono uppercase tracking-wider flex items-center gap-2">
          <Cloud className="w-4 h-4" />
          Vincular a una cuenta
        </h3>
        <p className="text-xs text-[#94a3b8] mt-1 leading-relaxed">
          Esta estrategia está en modo research (sin cuenta vinculada). Elegí una cuenta MT4/MT5 para desplegarla.
          Internamente se hace approve + deploy en un solo paso.
        </p>
      </div>

      {loadingAccs ? (
        <div className="h-20 bg-slate-800/40 rounded animate-pulse" />
      ) : accounts.length === 0 ? (
        <div className="text-xs text-[#94a3b8] py-3 px-4 rounded-lg border border-[#1f2937] bg-[#0a0e1a]">
          No tenés cuentas MT4/MT5 cargadas todavía. Agregalas desde el wizard de nueva estrategia o desde Bot Control.
        </div>
      ) : (
        <>
          <div>
            <label className="text-[10px] text-[#475569] uppercase tracking-wider block mb-1.5">Cuenta destino</label>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="w-full rounded-lg bg-[#0a0e1a] border border-[#a78bfa]/40 text-[#e2e8f0] text-sm px-3 py-2 focus:outline-none focus:border-[#a78bfa]"
            >
              <option value="">— Elegí una cuenta —</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.label} ({a.account_id})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] text-[#475569] uppercase tracking-wider block mb-1.5">Notas (opcional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={300}
              placeholder="ej. live tras 30d paper trading OK"
              className="w-full rounded-lg bg-[#0a0e1a] border border-[#1f2937] text-[#e2e8f0] text-xs px-3 py-2 focus:outline-none focus:border-[#475569] placeholder:text-[#2d3748]"
            />
          </div>

          <button
            type="button"
            onClick={handleDeploy}
            disabled={deploying || !selectedAccountId}
            className="w-full py-2.5 rounded-lg bg-[#a78bfa] hover:bg-[#c4b5fd] text-[#0a0e1a] text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {deploying ? "Vinculando…" : "Deploy to account"}
          </button>
        </>
      )}
    </div>
  );
}

// ─── CME deploy-to-account (Wave 4 item 15) ─────────────────────────────────
//
// Renders when a futures algorithm has no CME account linked. Unlike forex,
// there's no /deploy endpoint for CME — CME/Tradovate dispatch is a
// server-side cron reading live algos with parameters.cme_account_id set
// (see /api/cron/algorithms/tradovate-poll), not an algorithm_deployments
// row. So this section's job is narrower: link an existing algo_cme_accounts
// row into parameters (same shape the wizard writes) and promote
// draft/paper → approved. The subsequent approved → live promotion is
// handled uniformly for every algorithm by the existing QualityGatesPanel
// (rendered below regardless of market_type) — no need to duplicate that
// logic here.
export function CmeDeployToAccountSection({
  algorithmId,
  currentStatus,
  onDeployed,
}: {
  algorithmId: string;
  currentStatus: string;
  onDeployed: () => void;
}) {
  const [accounts, setAccounts]       = useState<CmeAccountOption[]>([]);
  const [loadingAccs, setLoadingAccs] = useState(true);
  const [selectedId, setSelectedId]   = useState("");
  const [linking, setLinking]         = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/intelligence/algorithms/cme-accounts");
        const body = await res.json();
        if (!cancelled) setAccounts((body.data ?? []) as CmeAccountOption[]);
      } finally {
        if (!cancelled) setLoadingAccs(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function handleLink() {
    const selected = accounts.find((a) => a.id === selectedId);
    if (!selected) { toast.error("Elegí una cuenta CME"); return; }
    setLinking(true);
    try {
      // Mirrors the shape NewStrategyWizard writes for a linked CME account
      // (handleCreate's futures branch) — the connections/quality-gates
      // endpoints read cme_account_num from parameters to resolve the row.
      const putRes = await fetch(`/api/algorithms/${algorithmId}`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          parameters: {
            cme_account_id:  selected.id,
            cme_provider:    selected.provider_name,
            cme_account_num: selected.account_number,
            cme_type:        selected.account_type,
          },
        }),
      });
      if (!putRes.ok) {
        const body = await putRes.json().catch(() => ({}));
        toast.error(`No se pudo vincular la cuenta: ${body.error ?? putRes.status}`);
        return;
      }

      if (currentStatus === "draft" || currentStatus === "paper") {
        const approveRes = await fetch(`/api/algorithms/${algorithmId}/approve`, { method: "POST" });
        if (!approveRes.ok) {
          const body = await approveRes.json().catch(() => ({}));
          toast.error(`Cuenta vinculada, pero approve falló: ${body.error ?? approveRes.status}`);
          return;
        }
      }

      toast.success("Cuenta CME vinculada");
      onDeployed();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error de conexión");
    } finally {
      setLinking(false);
    }
  }

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-amber-400 font-mono uppercase tracking-wider flex items-center gap-2">
          <Cloud className="w-4 h-4" />
          Vincular cuenta CME
        </h3>
        <p className="text-xs text-[#94a3b8] mt-1 leading-relaxed">
          Elegí una cuenta CME existente para vincularla a esta estrategia. Internamente guarda
          la referencia y promueve a Aprobado si estaba en draft/paper.
        </p>
      </div>

      {loadingAccs ? (
        <div className="h-20 bg-slate-800/40 rounded animate-pulse" />
      ) : accounts.length === 0 ? (
        <div className="text-xs text-[#94a3b8] py-3 px-4 rounded-lg border border-[#1f2937] bg-[#0a0e1a]">
          No tenés cuentas CME cargadas todavía. Creá una desde el wizard de nueva estrategia.
        </div>
      ) : (
        <>
          <div>
            <label className="text-[10px] text-[#475569] uppercase tracking-wider block mb-1.5">Cuenta destino</label>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full rounded-lg bg-[#0a0e1a] border border-amber-500/40 text-[#e2e8f0] text-sm px-3 py-2 focus:outline-none focus:border-amber-500"
            >
              <option value="">— Elegí una cuenta —</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label ?? a.provider_name} ({a.account_number}) — {a.account_type === "propfirm" ? "Propfirm" : "Broker"}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleLink}
            disabled={linking || !selectedId}
            className="w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-[#0a0e1a] text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {linking ? "Vinculando…" : "Vincular cuenta"}
          </button>
        </>
      )}
    </div>
  );
}
