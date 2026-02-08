"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { subscribeTradeUpdates } from "@/lib/metrics/tradeUpdates";
import { logger } from "@/lib/alphashield/logger";

interface Account {
  id: string;
  name: string;
}

interface ProgressLevelDef {
  level: number;
  title: string;
  subtitle: string | null;
  is_boss: boolean;
  missions_json: Array<{ id: string; label: string; metric?: string; threshold_key?: string }>;
}

interface ProgressLevelState {
  level: number;
  status: "locked" | "active" | "completed" | "fail_safe" | "rebuild";
  progress_pct: number;
  milestones_json: Record<string, boolean>;
}

interface ProgressMapState {
  current_level: number;
  xp_total: number;
  map_heat_state: string | null;
  fail_safe_active: boolean;
  rebuild_active: boolean;
}

interface ProgressMapConfig {
  core_account_id: string | null;
  satellite_account_ids: string[];
  applied_at: string;
  version_int: number;
}

interface ProgressMapResponse {
  config: ProgressMapConfig | null;
  mapState: ProgressMapState | null;
  levels: ProgressLevelDef[];
  levelStates: ProgressLevelState[];
  thresholdsRequired: boolean;
  missingThresholdKeys: string[];
  metrics: Record<string, unknown> | null;
  widgets: Record<string, unknown> | null;
  recoveryActive: boolean;
  rebuildActive: boolean;
  failSafeActive: boolean;
  pendingSyncCount: number;
  setupRequired: boolean;
}

const emptyMap = {
  config: null,
  mapState: null,
  levels: [],
  levelStates: [],
  thresholdsRequired: false,
  missingThresholdKeys: [],
  metrics: null,
  widgets: null,
  recoveryActive: false,
  rebuildActive: false,
  failSafeActive: false,
  pendingSyncCount: 0,
  setupRequired: true,
} as ProgressMapResponse;

export default function ProgressMapPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [state, setState] = useState<ProgressMapResponse>(emptyMap);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [corePickerOpen, setCorePickerOpen] = useState(false);
  const [satellitePickerOpen, setSatellitePickerOpen] = useState(false);
  const [thresholdsOpen, setThresholdsOpen] = useState(false);
  const [coreSelection, setCoreSelection] = useState<string>("");
  const [satelliteSelection, setSatelliteSelection] = useState<string[]>([]);
  const [thresholdInputs, setThresholdInputs] = useState<Record<string, string>>({});
  const [xpPop, setXpPop] = useState(false);
  const [lastXp, setLastXp] = useState(0);
  const [selectedLevel, setSelectedLevel] = useState<ProgressLevelDef | null>(null);

  const fetchAccounts = useCallback(async () => {
    try {
      const response = await fetch("/api/accounts", { cache: "no-store" });
      if (response.ok) {
        const data = await response.json();
        setAccounts(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      await logger.error("tradermap", "Progress Map accounts fetch failed", err as Error | undefined);
    }
  }, []);

  const fetchState = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/tradermap/progress-map/state", { cache: "no-store" });
      if (!response.ok) {
        if (response.status === 401) {
          window.location.href = "/auth";
          return;
        }
        setError("No se pudo cargar el mapa");
        return;
      }
      const data = (await response.json()) as ProgressMapResponse;
      setState(data);
      setCoreSelection(data.config?.core_account_id || "");
      setSatelliteSelection(data.config?.satellite_account_ids || []);

      if (data.mapState) {
        if (data.mapState.xp_total > lastXp) {
          setXpPop(true);
          setTimeout(() => setXpPop(false), 1200);
        }
        setLastXp(data.mapState.xp_total);
      }

      if (data.thresholdsRequired && data.missingThresholdKeys.length > 0) {
        const nextInputs: Record<string, string> = {};
        data.missingThresholdKeys.forEach((key) => {
          nextInputs[key] = thresholdInputs[key] || "";
        });
        setThresholdInputs(nextInputs);
      }
    } catch (err) {
      setError("Error al cargar progreso");
    } finally {
      setLoading(false);
    }
  }, [lastXp, thresholdInputs]);

  useEffect(() => {
    fetchAccounts();
    fetchState();
  }, [fetchAccounts, fetchState]);

  useEffect(() => {
    return subscribeTradeUpdates(() => {
      fetchState();
    });
  }, [fetchState]);

  const handleApplyConfig = async () => {
    setError("");
    if (!coreSelection) {
      setError("Core es obligatorio");
      return;
    }
    if (satelliteSelection.length > 39) {
      setError("limite alcanzado (39) desmarca uno para continuar");
      return;
    }
    if (satelliteSelection.includes(coreSelection)) {
      setError("Core no puede ser satelite");
      return;
    }

    const response = await fetch("/api/tradermap/progress-map/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        core_account_id: coreSelection,
        satellite_account_ids: satelliteSelection,
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data?.error || "No se pudo aplicar configuracion");
      return;
    }

    setCorePickerOpen(false);
    setSatellitePickerOpen(false);
    await fetchState();
  };

  const handleSaveThresholds = async () => {
    setError("");
    const items = Object.entries(thresholdInputs)
      .filter(([key]) => key)
      .map(([key, value]) => ({
        key,
        value_numeric: value.trim() ? Number(value) : null,
      }));

    const response = await fetch("/api/tradermap/progress-map/thresholds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data?.error || "No se pudieron guardar umbrales");
      return;
    }

    setThresholdsOpen(false);
    await fetchState();
  };

  const handleResolvePending = async () => {
    await fetch("/api/tradermap/progress-map/pending-sync/resolve", { method: "POST" });
    await fetchState();
  };

  const handleRecompute = async () => {
    await fetch("/api/tradermap/progress-map/recompute", { method: "POST" });
    await fetchState();
  };

  const levelStateMap = useMemo(() => {
    const map = new Map<number, ProgressLevelState>();
    state.levelStates.forEach((lvl) => map.set(lvl.level, lvl));
    return map;
  }, [state.levelStates]);

  const mapHeatClass = state.mapState?.map_heat_state === "green"
    ? "bg-emerald-500/5"
    : state.mapState?.map_heat_state === "amber"
    ? "bg-amber-500/5"
    : "bg-rose-500/5";

  const blockMap = state.setupRequired || state.thresholdsRequired || state.failSafeActive;

  const metrics = (state.metrics || {}) as Record<string, unknown>;
  const widgets = (state.widgets || {}) as Record<string, unknown>;
  const goalGps = (widgets.goal_gps || {}) as Record<string, unknown>;
  const forecastRange = (widgets.forecast_range || {}) as Record<string, unknown>;
  const profitSourceMap = (widgets.profit_source_map || []) as Array<Record<string, unknown>>;

  const thresholdMeta: Record<
    string,
    { label: string; hint: string; suffix?: string }
  > = {
    recovery_streak_min: {
      label: "Recovery streak minimo",
      hint: "Dias de racha necesarios para salir de recovery",
      suffix: "dias",
    },
    recovery_consistency_min: {
      label: "Recovery consistencia minima",
      hint: "Score de consistencia minimo para recuperar",
      suffix: "%",
    },
    rebuild_consistency_min: {
      label: "Rebuild consistencia minima",
      hint: "Score minimo para salir de rebuild",
      suffix: "%",
    },
    l1_closed_trades_min: {
      label: "L1 Trades cerrados",
      hint: "Primeros trades cerrados en el core",
    },
    l1_consistency_min: {
      label: "L1 Consistencia base",
      hint: "Score de consistencia minimo",
      suffix: "%",
    },
    l2_satellite_trades_min: {
      label: "L2 Trades en satelites",
      hint: "Trades cerrados en cuentas satelite",
    },
    l2_winrate_min: {
      label: "L2 Winrate minimo",
      hint: "Winrate minimo requerido",
      suffix: "%",
    },
    l3_integrity_min: {
      label: "L3 Integridad de datos",
      hint: "Score de integridad requerido",
      suffix: "%",
    },
    l3_confidence_min: {
      label: "L3 Confidence gate",
      hint: "Score de confianza requerido",
      suffix: "%",
    },
    l4_closed_trades_min: {
      label: "L4 Volumen sostenido",
      hint: "Numero de trades cerrados",
    },
    l4_consistency_min: {
      label: "L4 Edge consistency",
      hint: "Consistencia minima",
      suffix: "%",
    },
    l5_drawdown_min: {
      label: "L5 Drawdown control",
      hint: "Score de control de drawdown",
      suffix: "%",
    },
    l5_winrate_min: {
      label: "L5 Winrate estable",
      hint: "Winrate minimo",
      suffix: "%",
    },
    l6_flow_min: {
      label: "L6 Flow score",
      hint: "Score de flow requerido",
      suffix: "%",
    },
    l6_confidence_min: {
      label: "L6 Confidence gate",
      hint: "Score de confianza requerido",
      suffix: "%",
    },
    l7_precision_min: {
      label: "L7 Precision",
      hint: "Score de precision requerido",
      suffix: "%",
    },
    l7_closed_trades_min: {
      label: "L7 Cadencia",
      hint: "Trades cerrados requeridos",
    },
    l8_streak_min: {
      label: "L8 Racha saludable",
      hint: "Dias de racha requeridos",
      suffix: "dias",
    },
    l8_consistency_min: {
      label: "L8 Consistencia",
      hint: "Score de consistencia",
      suffix: "%",
    },
    l9_resilience_min: {
      label: "L9 Resiliencia",
      hint: "Score de resiliencia",
      suffix: "%",
    },
    l9_confidence_min: {
      label: "L9 Confidence gate",
      hint: "Score de confianza requerido",
      suffix: "%",
    },
    l10_capital_min: {
      label: "L10 Capital lift",
      hint: "Score de capital requerido",
      suffix: "%",
    },
    l10_winrate_min: {
      label: "L10 Winrate",
      hint: "Winrate minimo",
      suffix: "%",
    },
    l11_discipline_min: {
      label: "L11 Disciplina",
      hint: "Score de disciplina requerido",
      suffix: "%",
    },
    l11_consistency_min: {
      label: "L11 Consistencia",
      hint: "Score de consistencia",
      suffix: "%",
    },
    l12_mastery_min: {
      label: "L12 Mastery",
      hint: "Score de mastery requerido",
      suffix: "%",
    },
    l12_confidence_min: {
      label: "L12 Confidence gate",
      hint: "Score de confianza requerido",
      suffix: "%",
    },
    l13_consistency_min: {
      label: "L13 Edge fuerte",
      hint: "Consistencia minima",
      suffix: "%",
    },
    l13_closed_trades_min: {
      label: "L13 Cadencia alta",
      hint: "Trades cerrados requeridos",
    },
    l14_sustain_min: {
      label: "L14 Sustain",
      hint: "Score de sustain",
      suffix: "%",
    },
    l14_winrate_min: {
      label: "L14 Winrate elite",
      hint: "Winrate minimo",
      suffix: "%",
    },
    l15_validation_min: {
      label: "L15 Validacion final",
      hint: "Score de validacion",
      suffix: "%",
    },
    l15_confidence_min: {
      label: "L15 Confidence gate",
      hint: "Score de confianza requerido",
      suffix: "%",
    },
  };

  const thresholdMetricMap = useMemo(() => {
    const map: Record<string, string> = {
      recovery_streak_min: "streak_days",
      recovery_consistency_min: "consistency_score",
      rebuild_consistency_min: "consistency_score",
    };

    state.levels.forEach((level) => {
      level.missions_json?.forEach((mission) => {
        if (mission.threshold_key && mission.metric) {
          map[mission.threshold_key] = mission.metric;
        }
      });
    });

    return map;
  }, [state.levels]);

  const getMetricValue = (key: string) => {
    const metricKey = thresholdMetricMap[key];
    if (!metricKey) return null;
    return toNumber(metrics[metricKey], NaN);
  };

  const toNumber = (value: unknown, fallback = 0) => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    }
    return fallback;
  };

  const formatNumber = (value: unknown, suffix = "") =>
    `${toNumber(value).toFixed(0)}${suffix}`;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <header className="px-6 py-4 border-b border-slate-800 bg-slate-900/80 backdrop-blur-xl flex items-center justify-between">
        <div>
          <h1 className="display-font text-2xl text-slate-50">Progress Map</h1>
          <p className="text-sm text-slate-400">Mapa gamificado de progreso (15 niveles)</p>
        </div>
        <Link className="text-sm text-blue-300 hover:text-blue-200" href="/dashboard/tradermap">
          ← Volver a TraderMap
        </Link>
      </header>

      <div className="sticky top-0 z-20 border-b border-slate-800 bg-slate-900/90 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-6 py-4 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-sm text-slate-400">Configuracion del ecosistema</div>
              <div className="text-slate-100 text-sm">
                Core seleccionado: {coreSelection ? accounts.find((a) => a.id === coreSelection)?.name || "Cuenta" : "(sin core)"}
              </div>
              <button
                className="mt-2 text-xs text-blue-300 hover:text-blue-200"
                onClick={() => setCorePickerOpen((prev) => !prev)}
              >
                Elegir/Cambiar Core
              </button>
            </div>
            <div>
              <div className="text-sm text-slate-400">Satelites seleccionados</div>
              <div className="text-xs text-slate-200">
                {satelliteSelection.length === 0
                  ? "(ninguno)"
                  : satelliteSelection
                      .map((id) => accounts.find((a) => a.id === id)?.name || "Cuenta")
                      .join(", ")}
              </div>
              <button
                className="mt-2 text-xs text-blue-300 hover:text-blue-200"
                onClick={() => setSatellitePickerOpen((prev) => !prev)}
              >
                Gestionar satelites
              </button>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleApplyConfig}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-500"
              >
                Aplicar cambios
              </button>
              <p className="text-xs text-slate-400">Cambiar Core recalculara el progreso del mapa basado en el nuevo Core</p>
            </div>
          </div>

          {corePickerOpen && (
            <div className="rounded-lg border border-slate-800 bg-slate-900 p-3 text-sm">
              <select
                className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm"
                value={coreSelection}
                onChange={(e) => setCoreSelection(e.target.value)}
              >
                <option value="">Selecciona un Core</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {satellitePickerOpen && (
            <div className="rounded-lg border border-slate-800 bg-slate-900 p-3 space-y-2 text-sm">
              <div className="text-xs text-slate-400">Selecciona hasta 39</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {accounts.map((acc) => {
                  const checked = satelliteSelection.includes(acc.id);
                  const disabled = acc.id === coreSelection;
                  return (
                    <label key={acc.id} className="flex items-center gap-2 text-slate-200">
                      <input
                        type="checkbox"
                        disabled={disabled}
                        checked={checked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSatelliteSelection((prev) => [...prev, acc.id]);
                          } else {
                            setSatelliteSelection((prev) => prev.filter((id) => id !== acc.id));
                          }
                        }}
                      />
                      {acc.name} {disabled && <span className="text-xs text-slate-500">(Core)</span>}
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {error && <div className="text-xs text-rose-400">{error}</div>}
        </div>
      </div>

      {state.thresholdsRequired && (
        <div className="max-w-5xl mx-auto px-6 mt-4">
          <div className="rounded-2xl border border-amber-600/60 bg-amber-900/20 p-4 text-sm text-amber-100">
            Thresholds required: configura umbrales para activar el mapa.
            <button
              className="ml-4 text-xs underline text-amber-200"
              onClick={() => setThresholdsOpen(true)}
            >
              Configurar umbrales
            </button>
          </div>
        </div>
      )}

      {state.setupRequired && (
        <div className="max-w-5xl mx-auto px-6 mt-4">
          <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4 text-sm text-slate-300">
            Setup required: selecciona un Core para activar el mapa.
          </div>
        </div>
      )}

      {state.failSafeActive && (
        <div className="max-w-5xl mx-auto px-6 mt-4">
          <div className="rounded-2xl border border-rose-600/60 bg-rose-900/20 p-4 text-sm text-rose-100">
            Fail-safe activo. Progreso bloqueado hasta resolver sincronizacion.
            <button className="ml-4 text-xs underline" onClick={handleResolvePending}>
              Reintentar sync
            </button>
          </div>
        </div>
      )}

      {state.rebuildActive && (
        <div className="max-w-5xl mx-auto px-6 mt-4">
          <div className="rounded-2xl border border-indigo-600/60 bg-indigo-900/20 p-4 text-sm text-indigo-100">
            Rebuild activo. El mapa esta recalculando consistencia.
            <button className="ml-4 text-xs underline" onClick={handleRecompute}>
              Forzar recompute
            </button>
          </div>
        </div>
      )}

      {state.recoveryActive && (
        <div className="max-w-5xl mx-auto px-6 mt-4">
          <div className="rounded-2xl border border-amber-600/60 bg-amber-900/20 p-4 text-sm text-amber-100">
            Recovery activo. Completa el streak de recuperacion para desbloquear.
          </div>
        </div>
      )}

      {state.pendingSyncCount > 0 && (
        <div className="max-w-5xl mx-auto px-6 mt-4">
          <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4 text-sm text-slate-300">
            Sync pendiente: {state.pendingSyncCount} evento(s).
            <button className="ml-4 text-xs underline" onClick={handleResolvePending}>
              Reintentar
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-slate-400">Cargando Progress Map...</div>
      ) : (
        <div className="relative max-w-5xl mx-auto px-6 py-8">
          <div className={`absolute inset-0 rounded-3xl ${mapHeatClass}`} />
          <div
            className={`relative z-10 space-y-8 ${blockMap ? "opacity-40 pointer-events-none" : ""}`}
          >
            <div className="flex items-center gap-3 text-sm text-slate-300">
              <div className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-emerald-400" /> Completado
              </div>
              <div className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-blue-400" /> Activo
              </div>
              <div className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-slate-600" /> Bloqueado
              </div>
            </div>

            <div className="space-y-6">
              {state.levels.map((level) => {
                const levelState = levelStateMap.get(level.level);
                const status = levelState?.status || "locked";
                const progressPct = levelState?.progress_pct || 0;
                const isActive = status === "active";
                const isCompleted = status === "completed";
                const isBoss = level.is_boss;
                const isFailSafe = status === "fail_safe";
                const isRebuild = status === "rebuild";
                const ringColor = isCompleted
                  ? "#34d399"
                  : isActive
                  ? "#60a5fa"
                  : "#334155";

                return (
                  <div key={level.level} className="relative flex items-start gap-4">
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-14 h-14 rounded-full p-1 ${isBoss ? "shadow-[0_0_20px_rgba(251,191,36,0.6)]" : ""}`}
                        style={{
                          background: `conic-gradient(${ringColor} ${progressPct}%, #1f2937 ${progressPct}% 100%)`,
                        }}
                      >
                        <button
                          onClick={() => setSelectedLevel(level)}
                          className={`w-full h-full rounded-full flex items-center justify-center text-sm font-semibold ${
                            isCompleted
                              ? "bg-emerald-500/20 text-emerald-100"
                              : isActive
                              ? "bg-blue-500/20 text-blue-100"
                              : "bg-slate-900 text-slate-300"
                          }`}
                        >
                          L{level.level}
                        </button>
                      </div>
                      <div className="w-px h-10 bg-slate-700" />
                    </div>
                    <div className="flex-1 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-sm text-slate-400">{isBoss ? "Boss" : "Nivel"}</div>
                          <div className="text-lg text-slate-100 font-semibold">{level.title}</div>
                          {level.subtitle && <div className="text-xs text-slate-500">{level.subtitle}</div>}
                        </div>
                        <div className="text-xs text-slate-400 text-right">
                          {isFailSafe && "fail_safe"}
                          {isRebuild && "rebuild"}
                          {!isFailSafe && !isRebuild && status}
                        </div>
                      </div>
                      <div className="mt-3 text-xs text-slate-400">Progreso: {progressPct.toFixed(0)}%</div>
                      <div className="mt-2 h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-blue-500"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {blockMap && (
            <div className="absolute inset-0 rounded-3xl bg-slate-950/40 flex items-center justify-center text-sm text-slate-200">
              Configura el Core/umbrales para desbloquear el mapa.
            </div>
          )}

          {xpPop && (
            <div className="fixed bottom-6 right-6 bg-emerald-600 text-white px-4 py-2 rounded-full shadow-lg text-sm">
              +10 XP
            </div>
          )}
        </div>
      )}

      {!loading && !state.setupRequired && (
        <div className="max-w-5xl mx-auto px-6 pb-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="text-sm text-slate-400">Indicadores base</div>
              <div className="mt-3 space-y-2 text-sm text-slate-200">
                <div className="flex items-center justify-between">
                  <span>Trades cerrados</span>
                  <span>{formatNumber(metrics.closed_trades)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Winrate</span>
                  <span>{formatNumber(metrics.winrate, "%")}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Consistencia</span>
                  <span>{formatNumber(metrics.consistency_score, "%")}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Streak dias</span>
                  <span>{formatNumber(metrics.streak_days)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Satellites activos</span>
                  <span>{formatNumber(metrics.satellite_trades)}</span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="text-sm text-slate-400">Forecast & confianza</div>
              <div className="mt-3 space-y-2 text-sm text-slate-200">
                <div className="flex items-center justify-between">
                  <span>Confianza</span>
                  <span>{formatNumber(widgets.confidence_meter, "%")}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Clasificacion</span>
                  <span className="capitalize">{String(widgets.winrate_classifier || "-")}</span>
                </div>
                <div className="text-xs text-slate-400 mt-2">Proyeccion a siguiente checkpoint</div>
                <div className="grid grid-cols-3 gap-2 text-xs text-slate-300">
                  <div className="rounded-lg bg-slate-800/70 p-2 text-center">
                    <div className="text-slate-400">Opt</div>
                    <div>{formatNumber(forecastRange.optimistic_days)}d</div>
                  </div>
                  <div className="rounded-lg bg-slate-800/70 p-2 text-center">
                    <div className="text-slate-400">Real</div>
                    <div>{formatNumber(forecastRange.realistic_days)}d</div>
                  </div>
                  <div className="rounded-lg bg-slate-800/70 p-2 text-center">
                    <div className="text-slate-400">Pes</div>
                    <div>{formatNumber(forecastRange.pessimistic_days)}d</div>
                  </div>
                </div>
                <div className="mt-2 text-xs text-slate-400">
                  GPS: checkpoint {formatNumber(goalGps.next_checkpoint, "%")} · {String(goalGps.recommended_step || "-")}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="text-sm text-slate-400">Fuentes top</div>
              <div className="mt-3 space-y-2 text-sm text-slate-200">
                {profitSourceMap.length === 0 && (
                  <div className="text-xs text-slate-400">Sin datos aun</div>
                )}
                {profitSourceMap.map((item, index) => (
                  <div key={`${String(item.key)}-${index}`} className="flex items-center justify-between">
                    <span className="truncate">{String(item.key)}</span>
                    <span>{formatNumber(item.count)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {thresholdsOpen && (
        <div className="fixed inset-0 z-30 bg-black/60 flex items-center justify-center px-6">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 w-full max-w-lg">
            <div className="text-lg text-slate-100 font-semibold">Configurar umbrales</div>
            <div className="mt-4 space-y-3">
              {Object.keys(thresholdInputs).map((key) => {
                const meta = thresholdMeta[key];
                const currentValue = getMetricValue(key);
                const requiredRaw = thresholdInputs[key] || "";
                const requiredValue = toNumber(requiredRaw, NaN);
                const hasRequired = Number.isFinite(requiredValue);
                const hasCurrent = Number.isFinite(currentValue);
                const meetsRequired = hasRequired && hasCurrent
                  ? (currentValue as number) >= requiredValue
                  : false;
                return (
                  <label key={key} className="block text-sm text-slate-300">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-100">
                        {meta?.label || key}
                      </span>
                      <div className="flex items-center gap-2">
                        {meta?.suffix && (
                          <span className="text-xs text-slate-500">{meta.suffix}</span>
                        )}
                        <span
                          className={`text-[11px] px-2 py-1 rounded-full border ${
                            meetsRequired
                              ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-200"
                              : "border-slate-700 bg-slate-800/70 text-slate-300"
                          }`}
                        >
                          Actual {hasCurrent ? formatNumber(currentValue) : "-"} / Req {hasRequired ? formatNumber(requiredValue) : "-"}
                        </span>
                      </div>
                    </div>
                    <div className="text-xs text-slate-500">{meta?.hint || key}</div>
                    <input
                      className="mt-2 w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm"
                      placeholder={meta?.suffix ? `Valor en ${meta.suffix}` : "Valor"}
                      value={thresholdInputs[key] || ""}
                      onChange={(e) =>
                        setThresholdInputs((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                    />
                  </label>
                );
              })}
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={handleSaveThresholds}
                className="flex-1 px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm"
              >
                Guardar
              </button>
              <button
                onClick={() => setThresholdsOpen(false)}
                className="flex-1 px-3 py-2 rounded-lg bg-slate-700 text-slate-200 text-sm"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedLevel && (
        <div className="fixed inset-x-0 bottom-0 z-30 bg-slate-900 border-t border-slate-700 rounded-t-3xl p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs text-slate-400">Nivel {selectedLevel.level}</div>
              <div className="text-lg text-slate-100 font-semibold">{selectedLevel.title}</div>
            </div>
            <button className="text-slate-400" onClick={() => setSelectedLevel(null)}>
              ✕
            </button>
          </div>
          <div className="mt-3 text-sm text-slate-300">Misiones</div>
          <ul className="mt-2 space-y-2 text-xs text-slate-400">
            {selectedLevel.missions_json?.map((mission) => (
              <li key={mission.id} className="flex items-center gap-2">
                <span>•</span>
                <span>{mission.label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
