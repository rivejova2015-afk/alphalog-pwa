"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type ScenarioKey = "conservative" | "base" | "aggressive";

type ScenarioConfig = {
  key: ScenarioKey;
  label: string;
  monthlyRate: number;
  color: string;
};

type SeriesPoint = {
  month: number;
  capital: number;
};

type CapitalType = "real" | "propfirm";

type CapitalTypeMetrics = {
  totalAccounts: number;
  totalCapital: number;
  totalBalance: number;
  closedTrades30d: number;
  netPnl30d: number;
  winRate30d: number;
};

type CapitalTargetRecord = {
  id: string;
  account_type: CapitalType;
  target_name: string;
  target_capital: number | string;
  created_at: string;
};

type SimulationSummary = {
  sampleSize: number;
  medianMonths: number | null;
  p10Months: number | null;
  p90Months: number | null;
  successByHorizon: Array<{ months: number; probability: number }>;
};

interface CapitalTargetPlannerProps {
  currentCapital: number;
  netPnl30d: number;
  closedTrades30d: number;
  capitalByType?: {
    real: CapitalTypeMetrics;
    propfirm: CapitalTypeMetrics;
  };
}

const CHART_MONTHS = 24;
const SIMULATION_SAMPLES = 2500;
const SIMULATION_MAX_MONTHS = 120;

const toPercent = (value: number) => `${(value * 100).toFixed(2)}%`;

const formatMoney = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const formatCompact = (value: number) =>
  new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
    notation: "compact",
  }).format(value);

const parseNumber = (value: string) => {
  const normalized = value.replace(/,/g, "").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
};

const clampRate = (value: number) => Math.max(-0.25, Math.min(0.4, value));

const EMPTY_METRICS: CapitalTypeMetrics = {
  totalAccounts: 0,
  totalCapital: 0,
  totalBalance: 0,
  closedTrades30d: 0,
  netPnl30d: 0,
  winRate30d: 0,
};

const TYPE_LABEL: Record<CapitalType, string> = {
  real: "Capital real",
  propfirm: "Capital propfirm",
};

const defaultTypeFromMetrics = (
  metrics?: {
    real: CapitalTypeMetrics;
    propfirm: CapitalTypeMetrics;
  }
) => {
  if (!metrics) return "real" as const;
  if (metrics.real.totalAccounts === 0 && metrics.propfirm.totalAccounts > 0) {
    return "propfirm" as const;
  }
  return "real" as const;
};

const buildDefaultTarget = (current: number) =>
  Math.max(current * 1.25, current + 1000, 1000).toFixed(2);

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("es-PR", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const monthsToTarget = (start: number, target: number, monthlyRate: number, maxMonths = 240) => {
  if (target <= 0 || start <= 0) return null;
  if (start >= target) return 0;

  let capital = start;
  for (let month = 1; month <= maxMonths; month += 1) {
    capital *= 1 + monthlyRate;
    if (capital >= target) return month;
  }
  return null;
};

const buildSeries = (start: number, monthlyRate: number, totalMonths: number) => {
  const points: SeriesPoint[] = [{ month: 0, capital: start }];
  let capital = start;
  for (let month = 1; month <= totalMonths; month += 1) {
    capital *= 1 + monthlyRate;
    points.push({ month, capital });
  }
  return points;
};

const quantile = (values: number[], q: number) => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (sorted.length - 1) * q;
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  const weight = idx - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
};

const normalRandom = () => {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

const runSimulation = (
  start: number,
  target: number,
  baseRate: number,
  samples: number,
  maxMonths: number
): SimulationSummary => {
  if (start <= 0 || target <= 0) {
    return {
      sampleSize: samples,
      medianMonths: null,
      p10Months: null,
      p90Months: null,
      successByHorizon: [6, 12, 24, 36].map((months) => ({ months, probability: 0 })),
    };
  }

  if (start >= target) {
    return {
      sampleSize: samples,
      medianMonths: 0,
      p10Months: 0,
      p90Months: 0,
      successByHorizon: [6, 12, 24, 36].map((months) => ({ months, probability: 1 })),
    };
  }

  const volatility = Math.max(Math.abs(baseRate) * 0.75, 0.015);
  const results: Array<number | null> = [];

  for (let i = 0; i < samples; i += 1) {
    let capital = start;
    let hit: number | null = null;
    for (let month = 1; month <= maxMonths; month += 1) {
      const randomRate = clampRate(baseRate + normalRandom() * volatility);
      capital *= 1 + randomRate;
      if (capital >= target) {
        hit = month;
        break;
      }
      if (capital <= 0) {
        capital = 0;
        break;
      }
    }
    results.push(hit);
  }

  const validHits = results.filter((value): value is number => value !== null);

  return {
    sampleSize: samples,
    medianMonths: quantile(validHits, 0.5),
    p10Months: quantile(validHits, 0.1),
    p90Months: quantile(validHits, 0.9),
    successByHorizon: [6, 12, 24, 36].map((months) => {
      const success = results.filter((value) => value !== null && value <= months).length;
      return { months, probability: success / samples };
    }),
  };
};

function ProjectionChart({
  scenarios,
  target,
  current,
}: {
  scenarios: Array<{ config: ScenarioConfig; points: SeriesPoint[] }>;
  target: number;
  current: number;
}) {
  const width = 920;
  const height = 280;
  const padding = 36;
  const maxMonth = CHART_MONTHS;
  const allValues = scenarios.flatMap((scenario) => scenario.points.map((point) => point.capital));
  allValues.push(target);
  allValues.push(current);

  const minValue = Math.min(...allValues);
  const maxValue = Math.max(...allValues);
  const span = Math.max(maxValue - minValue, 1);

  const xForMonth = (month: number) =>
    padding + (month / maxMonth) * (width - padding * 2);
  const yForValue = (value: number) =>
    height - padding - ((value - minValue) / span) * (height - padding * 2);

  const targetY = yForValue(target);

  return (
    <div className="rounded-lg border border-slate-700/60 bg-slate-900/60 p-3">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img" aria-label="Linear performance chart">
        <rect x={0} y={0} width={width} height={height} fill="transparent" />

        {[0, 6, 12, 18, 24].map((month) => (
          <line
            key={`v-${month}`}
            x1={xForMonth(month)}
            y1={padding}
            x2={xForMonth(month)}
            y2={height - padding}
            stroke="rgba(148,163,184,0.2)"
            strokeWidth={1}
          />
        ))}

        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = padding + (height - padding * 2) * ratio;
          return (
            <line
              key={`h-${ratio}`}
              x1={padding}
              y1={y}
              x2={width - padding}
              y2={y}
              stroke="rgba(148,163,184,0.15)"
              strokeWidth={1}
            />
          );
        })}

        <line
          x1={padding}
          y1={targetY}
          x2={width - padding}
          y2={targetY}
          stroke="rgba(250,204,21,0.8)"
          strokeDasharray="5 5"
          strokeWidth={1.5}
        />

        {scenarios.map(({ config, points }) => {
          const path = points
            .map((point, index) => `${index === 0 ? "M" : "L"} ${xForMonth(point.month)} ${yForValue(point.capital)}`)
            .join(" ");
          return (
            <path
              key={config.key}
              d={path}
              fill="none"
              stroke={config.color}
              strokeWidth={2.25}
              strokeLinecap="round"
            />
          );
        })}
      </svg>

      <div className="mt-3 flex flex-wrap gap-3 text-xs">
        <span className="text-amber-300">Target</span>
        {scenarios.map(({ config }) => (
          <span key={config.key} style={{ color: config.color }}>
            {config.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function CapitalTargetPlanner({
  currentCapital,
  netPnl30d,
  closedTrades30d,
  capitalByType,
}: CapitalTargetPlannerProps) {
  const initialType = defaultTypeFromMetrics(capitalByType);
  const fallbackMetrics = useMemo<CapitalTypeMetrics>(
    () => ({
      totalAccounts: 0,
      totalCapital: currentCapital,
      totalBalance: currentCapital,
      closedTrades30d,
      netPnl30d,
      winRate30d: 0,
    }),
    [closedTrades30d, currentCapital, netPnl30d]
  );

  const metricsByType = useMemo(
    () => ({
      real: capitalByType?.real ?? fallbackMetrics,
      propfirm: capitalByType?.propfirm ?? EMPTY_METRICS,
    }),
    [capitalByType, fallbackMetrics]
  );

  const [selectedType, setSelectedType] = useState<CapitalType>(initialType);
  const [targetName, setTargetName] = useState(`Objetivo ${TYPE_LABEL[initialType]}`);
  const [targetInput, setTargetInput] = useState(
    buildDefaultTarget(metricsByType[initialType].totalBalance)
  );
  const [showDetails, setShowDetails] = useState(false);
  const [savedTargets, setSavedTargets] = useState<CapitalTargetRecord[]>([]);
  const [loadingTargets, setLoadingTargets] = useState(true);
  const [targetsError, setTargetsError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const activeMetrics = metricsByType[selectedType];
  const activeCurrentCapital = activeMetrics.totalBalance;
  const activeNetPnl30d = activeMetrics.netPnl30d;
  const activeClosedTrades30d = activeMetrics.closedTrades30d;

  const applyTargetPreset = useCallback(
    (type: CapitalType, targets: CapitalTargetRecord[]) => {
      const latest = targets.find((target) => target.account_type === type);
      if (latest) {
        setTargetName(latest.target_name);
        setTargetInput(Number(latest.target_capital).toFixed(2));
        return;
      }

      setTargetName(`Objetivo ${TYPE_LABEL[type]}`);
      setTargetInput(buildDefaultTarget(metricsByType[type].totalBalance));
    },
    [metricsByType]
  );

  useEffect(() => {
    let cancelled = false;

    const loadTargets = async () => {
      setLoadingTargets(true);
      setTargetsError(null);
      try {
        const response = await fetch("/api/intelligence/capital-targets", {
          cache: "no-store",
        });
        const payload = await response.json().catch(() => []);
        if (!response.ok) {
          throw new Error(payload?.error || "No se pudieron cargar los objetivos guardados.");
        }
        if (!cancelled) {
          const records = Array.isArray(payload) ? (payload as CapitalTargetRecord[]) : [];
          setSavedTargets(records);
          applyTargetPreset(initialType, records);
        }
      } catch (error) {
        if (!cancelled) {
          setTargetsError(
            error instanceof Error ? error.message : "No se pudieron cargar los objetivos guardados."
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingTargets(false);
        }
      }
    };

    void loadTargets();

    return () => {
      cancelled = true;
    };
  }, [applyTargetPreset, initialType]);

  const handleTypeChange = (type: CapitalType) => {
    setSelectedType(type);
    setShowDetails(false);
    setSaveError(null);
    setSaveSuccess(null);
    applyTargetPreset(type, savedTargets);
  };

  const handleLoadSavedTarget = (target: CapitalTargetRecord) => {
    setTargetName(target.target_name);
    setTargetInput(Number(target.target_capital).toFixed(2));
    setShowDetails(true);
    setSaveError(null);
    setSaveSuccess(null);
  };

  const handleSaveTarget = async () => {
    setSaveError(null);
    setSaveSuccess(null);

    if (!showDetails) {
      setSaveError("Abre Detalles para guardar el objetivo.");
      return;
    }

    const parsedTarget = parseNumber(targetInput);
    if (parsedTarget === null || parsedTarget <= 0) {
      setSaveError("Ingresa un capital objetivo valido y mayor a 0.");
      return;
    }

    if (!targetName.trim()) {
      setSaveError("Asigna un nombre para guardar el objetivo.");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/intelligence/capital-targets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          account_type: selectedType,
          target_name: targetName.trim(),
          target_capital: parsedTarget,
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "No se pudo guardar el objetivo.");
      }

      const created = payload as CapitalTargetRecord;
      setSavedTargets((prev) => [created, ...prev]);
      setSaveSuccess("Objetivo guardado correctamente.");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "No se pudo guardar el objetivo.");
    } finally {
      setIsSaving(false);
    }
  };

  const targetCapital = useMemo(() => parseNumber(targetInput), [targetInput]);
  const invalidTarget = targetCapital === null || targetCapital <= 0;
  const currentTypeTargets = useMemo(
    () => savedTargets.filter((target) => target.account_type === selectedType),
    [savedTargets, selectedType]
  );

  const progress = useMemo(() => {
    if (!targetCapital || targetCapital <= 0) return 0;
    return Math.max(0, Math.min(100, (activeCurrentCapital / targetCapital) * 100));
  }, [activeCurrentCapital, targetCapital]);

  const remaining = useMemo(() => {
    if (!targetCapital) return null;
    return targetCapital - activeCurrentCapital;
  }, [activeCurrentCapital, targetCapital]);

  const scenarioConfigs = useMemo(() => {
    const observedRate = activeCurrentCapital > 0 ? activeNetPnl30d / activeCurrentCapital : 0;
    const baseRate = clampRate(observedRate > 0 ? observedRate : 0.01);
    const conservativeRate = clampRate(Math.max(0.004, baseRate * 0.6));
    const aggressiveRate = clampRate(Math.max(baseRate + 0.01, baseRate * 1.4));

    return [
      {
        key: "conservative",
        label: "Conservador",
        monthlyRate: conservativeRate,
        color: "#f59e0b",
      },
      {
        key: "base",
        label: "Base",
        monthlyRate: baseRate,
        color: "#38bdf8",
      },
      {
        key: "aggressive",
        label: "Agresivo",
        monthlyRate: aggressiveRate,
        color: "#22c55e",
      },
    ] as ScenarioConfig[];
  }, [activeCurrentCapital, activeNetPnl30d]);

  const scenarioRows = useMemo(() => {
    if (!showDetails || !targetCapital || targetCapital <= 0) return [];

    return scenarioConfigs.map((config) => {
      const points = buildSeries(activeCurrentCapital, config.monthlyRate, CHART_MONTHS);
      const months = monthsToTarget(activeCurrentCapital, targetCapital, config.monthlyRate);
      const peak = Math.max(...points.map((point) => point.capital));
      const low = Math.min(...points.map((point) => point.capital));
      const final = points[points.length - 1]?.capital ?? activeCurrentCapital;

      return { config, points, months, peak, low, final };
    });
  }, [activeCurrentCapital, scenarioConfigs, showDetails, targetCapital]);

  const baseRate = scenarioConfigs.find((scenario) => scenario.key === "base")?.monthlyRate ?? 0.01;
  const simulation = useMemo(() => {
    if (!showDetails || !targetCapital || targetCapital <= 0) {
      return {
        sampleSize: SIMULATION_SAMPLES,
        medianMonths: null,
        p10Months: null,
        p90Months: null,
        successByHorizon: [6, 12, 24, 36].map((months) => ({ months, probability: 0 })),
      };
    }
    return runSimulation(
      activeCurrentCapital,
      targetCapital,
      baseRate,
      SIMULATION_SAMPLES,
      SIMULATION_MAX_MONTHS
    );
  }, [activeCurrentCapital, baseRate, showDetails, targetCapital]);

  const requiredRates = useMemo(() => {
    if (!targetCapital || targetCapital <= activeCurrentCapital || activeCurrentCapital <= 0) {
      return {
        in6: 0,
        in12: 0,
        in24: 0,
      };
    }
    const ratio = targetCapital / activeCurrentCapital;
    return {
      in6: Math.pow(ratio, 1 / 6) - 1,
      in12: Math.pow(ratio, 1 / 12) - 1,
      in24: Math.pow(ratio, 1 / 24) - 1,
    };
  }, [activeCurrentCapital, targetCapital]);

  const avgTradePnl = activeClosedTrades30d > 0 ? activeNetPnl30d / activeClosedTrades30d : null;
  const requiredMonthlyProfit = remaining !== null ? remaining / 12 : null;
  const tradesNeededPerMonth =
    avgTradePnl && avgTradePnl > 0 && requiredMonthlyProfit !== null && requiredMonthlyProfit > 0
      ? Math.ceil(requiredMonthlyProfit / avgTradePnl)
      : null;

  return (
    <div className="premium-card">
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {(["real", "propfirm"] as CapitalType[]).map((type) => {
          const metrics = metricsByType[type];
          const active = selectedType === type;
          return (
            <button
              key={type}
              type="button"
              onClick={() => handleTypeChange(type)}
              className={`rounded border p-3 text-left transition ${
                active
                  ? "border-sky-500/70 bg-sky-900/20"
                  : "border-slate-700/70 bg-slate-900/40 hover:border-slate-500/70"
              }`}
            >
              <p className="text-xs uppercase tracking-wide text-slate-400">{TYPE_LABEL[type]}</p>
              <p className="mt-1 text-lg font-semibold text-white">{formatMoney(metrics.totalBalance)}</p>
              <p className="text-xs text-slate-400">
                {metrics.totalAccounts} cuentas | Win rate 30d: {metrics.winRate30d.toFixed(1)}%
              </p>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-white">Capital objetivo</h3>
          <p className="text-sm text-slate-400">
            Selecciona tipo de capital (real o propfirm), crea multiples objetivos y abre detalles para ver pronosticos.
          </p>
        </div>
        <div className="w-full lg:w-auto flex flex-col sm:flex-row gap-2 sm:items-end">
          <label className="flex-1 sm:min-w-56">
            <span className="mb-1 block text-xs uppercase tracking-wide text-slate-400">
              Nombre del objetivo
            </span>
            <input
              type="text"
              value={targetName}
              onChange={(event) => setTargetName(event.target.value)}
              className="w-full rounded border border-slate-700/70 bg-slate-900/60 px-3 py-2 text-sm text-slate-100"
            />
          </label>
          <label className="flex-1 sm:min-w-64">
            <span className="mb-1 block text-xs uppercase tracking-wide text-slate-400">
              Capital objetivo ({TYPE_LABEL[selectedType]})
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={targetInput}
              onChange={(event) => setTargetInput(event.target.value)}
              className="w-full rounded border border-slate-700/70 bg-slate-900/60 px-3 py-2 text-sm text-slate-100"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowDetails((prev) => !prev)}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Detalles
            </button>
            <button
              type="button"
              onClick={handleSaveTarget}
              disabled={isSaving}
              className="rounded border border-sky-500/60 bg-sky-900/40 px-4 py-2 text-sm font-semibold text-sky-100 hover:bg-sky-900/60 disabled:opacity-60"
            >
              {isSaving ? "Guardando..." : "Guardar objetivo"}
            </button>
          </div>
        </div>
      </div>

      {invalidTarget && (
        <div className="mt-3 rounded border border-red-800/70 bg-red-950/30 px-3 py-2 text-sm text-red-200">
          Ingresa un capital objetivo valido y mayor a 0.
        </div>
      )}
      {targetsError && (
        <div className="mt-3 rounded border border-amber-700/70 bg-amber-950/25 px-3 py-2 text-sm text-amber-200">
          {targetsError}
        </div>
      )}
      {saveError && (
        <div className="mt-3 rounded border border-red-800/70 bg-red-950/30 px-3 py-2 text-sm text-red-200">
          {saveError}
        </div>
      )}
      {saveSuccess && (
        <div className="mt-3 rounded border border-emerald-800/70 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-200">
          {saveSuccess}
        </div>
      )}

      <div className="mt-4 rounded border border-slate-700/70 bg-slate-900/40 p-3">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-100">
            Objetivos guardados ({TYPE_LABEL[selectedType]})
          </h4>
          {loadingTargets && <span className="text-xs text-slate-400">Cargando...</span>}
        </div>
        {currentTypeTargets.length === 0 ? (
          <p className="text-sm text-slate-400">No hay objetivos guardados para este tipo de capital.</p>
        ) : (
          <div className="space-y-2">
            {currentTypeTargets.slice(0, 6).map((target) => (
              <div
                key={target.id}
                className="flex flex-col gap-2 rounded border border-slate-700/60 bg-slate-950/50 p-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-medium text-slate-100">{target.target_name}</p>
                  <p className="text-xs text-slate-400">
                    {formatMoney(Number(target.target_capital))} | {formatDateTime(target.created_at)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleLoadSavedTarget(target)}
                  className="rounded border border-slate-600/70 px-3 py-1 text-xs text-slate-200 hover:border-slate-400"
                >
                  Cargar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showDetails && !invalidTarget && targetCapital !== null && (
        <div className="mt-5 space-y-5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="rounded border border-slate-700/70 bg-slate-900/60 p-3">
              <p className="text-xs text-slate-400">Capital actual</p>
              <p className="text-lg font-semibold text-white">{formatMoney(activeCurrentCapital)}</p>
            </div>
            <div className="rounded border border-slate-700/70 bg-slate-900/60 p-3">
              <p className="text-xs text-slate-400">Capital objetivo</p>
              <p className="text-lg font-semibold text-white">{formatMoney(targetCapital)}</p>
            </div>
            <div className="rounded border border-slate-700/70 bg-slate-900/60 p-3">
              <p className="text-xs text-slate-400">Falta por cubrir</p>
              <p className={`text-lg font-semibold ${remaining !== null && remaining < 0 ? "text-green-400" : "text-white"}`}>
                {formatMoney(remaining ?? 0)}
              </p>
            </div>
            <div className="rounded border border-slate-700/70 bg-slate-900/60 p-3">
              <p className="text-xs text-slate-400">Progreso</p>
              <p className="text-lg font-semibold text-white">{progress.toFixed(1)}%</p>
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
              <span>Barra de progreso del objetivo</span>
              <span>{progress.toFixed(1)}%</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full bg-gradient-to-r from-sky-500 to-green-500 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="rounded border border-slate-700/70 bg-slate-900/60 p-4">
            <h4 className="text-sm font-semibold text-slate-100">Guia para lograr el objetivo</h4>
            <ul className="mt-2 space-y-2 text-sm text-slate-300">
              <li>
                Manteniendo ritmo base ({toPercent(baseRate)} mensual), la mediana proyectada llega en{" "}
                {simulation.medianMonths === null ? "mas de 120 meses" : `${simulation.medianMonths.toFixed(1)} meses`}.
              </li>
              <li>
                Retorno requerido: 6m {toPercent(requiredRates.in6)}, 12m {toPercent(requiredRates.in12)}, 24m{" "}
                {toPercent(requiredRates.in24)}.
              </li>
              <li>
                Objetivo mensual sugerido (12 meses):{" "}
                {requiredMonthlyProfit === null ? "-" : formatMoney(Math.max(requiredMonthlyProfit, 0))}.
              </li>
              <li>
                {tradesNeededPerMonth
                  ? `Con tu promedio reciente por trade (${formatMoney(avgTradePnl || 0)}), necesitas ~${tradesNeededPerMonth} trades ganadores/mes.`
                  : "Primero estabiliza un promedio positivo por trade para convertir este plan en ejecucion predecible."}
              </li>
            </ul>
          </div>

          <div className="rounded border border-slate-700/70 bg-slate-900/60 p-4">
            <h4 className="text-sm font-semibold text-slate-100">
              Pronostico por miles de posibilidades ({formatCompact(simulation.sampleSize)} simulaciones)
            </h4>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded border border-slate-700/70 bg-slate-950/40 p-3">
                <p className="text-xs text-slate-400">P10 (rapido)</p>
                <p className="text-base font-semibold text-white">
                  {simulation.p10Months === null ? "No estimable" : `${simulation.p10Months.toFixed(1)} meses`}
                </p>
              </div>
              <div className="rounded border border-slate-700/70 bg-slate-950/40 p-3">
                <p className="text-xs text-slate-400">Mediana</p>
                <p className="text-base font-semibold text-white">
                  {simulation.medianMonths === null ? "No estimable" : `${simulation.medianMonths.toFixed(1)} meses`}
                </p>
              </div>
              <div className="rounded border border-slate-700/70 bg-slate-950/40 p-3">
                <p className="text-xs text-slate-400">P90 (lento)</p>
                <p className="text-base font-semibold text-white">
                  {simulation.p90Months === null ? "No estimable" : `${simulation.p90Months.toFixed(1)} meses`}
                </p>
              </div>
            </div>
            <div className="mt-3 max-w-full overflow-x-auto">
              <table className="table-mobile-cards w-full text-sm text-slate-200">
                <thead>
                  <tr>
                    <th className="py-2 text-left">Horizonte</th>
                    <th className="py-2 text-right">Probabilidad de llegar</th>
                  </tr>
                </thead>
                <tbody>
                  {simulation.successByHorizon.map((row) => (
                    <tr key={row.months} className="border-t border-slate-800/70">
                      <td data-label="Horizonte" className="py-2">{row.months} meses</td>
                      <td data-label="Probabilidad" className="py-2 text-right">{(row.probability * 100).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded border border-slate-700/70 bg-slate-900/60 p-4">
            <h4 className="text-sm font-semibold text-slate-100 mb-3">
              Tabla grafica de rendimiento lineal (picos altos y bajos)
            </h4>
            <ProjectionChart
              scenarios={scenarioRows.map((row) => ({ config: row.config, points: row.points }))}
              target={targetCapital}
              current={activeCurrentCapital}
            />

            <div className="mt-3 max-w-full overflow-x-auto">
              <table className="table-mobile-cards w-full text-sm text-slate-200">
                <thead>
                  <tr>
                    <th className="py-2 text-left">Escenario</th>
                    <th className="py-2 text-right">Ritmo mensual</th>
                    <th className="py-2 text-right">Tiempo estimado</th>
                    <th className="py-2 text-right">Pico alto 24m</th>
                    <th className="py-2 text-right">Pico bajo 24m</th>
                  </tr>
                </thead>
                <tbody>
                  {scenarioRows.map((row) => (
                    <tr key={row.config.key} className="border-t border-slate-800/70">
                      <td data-label="Escenario" className="py-2" style={{ color: row.config.color }}>
                        {row.config.label}
                      </td>
                      <td data-label="Ritmo mensual" className="py-2 text-right">
                        {toPercent(row.config.monthlyRate)}
                      </td>
                      <td data-label="Tiempo estimado" className="py-2 text-right">
                        {row.months === null ? "No alcanzable" : `${row.months} meses`}
                      </td>
                      <td data-label="Pico alto 24m" className="py-2 text-right">
                        {formatMoney(row.peak)}
                      </td>
                      <td data-label="Pico bajo 24m" className="py-2 text-right">
                        {formatMoney(row.low)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
