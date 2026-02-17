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
  custom_current_capital: number | string | null;
  custom_current_updated_at: string | null;
  manual_monthly_pct: number | string | null;
  manual_quarterly_pct: number | string | null;
  manual_semiannual_pct: number | string | null;
  manual_annual_pct: number | string | null;
  manual_updated_at: string | null;
  created_at: string;
  updated_at: string;
};

type SimulationSummary = {
  sampleSize: number;
  p50Months: number | null;
  p10Months: number | null;
  p90Months: number | null;
  successByHorizon: Array<{ months: number; probability: number }>;
  residualProbability: number;
};

type ManualInputState = {
  monthly: string;
  quarterly: string;
  semiannual: string;
  annual: string;
};

type CustomCurrentCapitalState = {
  amount: string;
};

type ManualScenarioResult = {
  id: "monthly" | "quarterly" | "semiannual" | "annual";
  label: string;
  enteredPercent: number;
  monthlyEquivalent: number;
  monthsToTarget: number | null;
  simulation: SimulationSummary;
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

const CHART_MONTHS = 36;
const SIMULATION_SAMPLES = 3000;
const SIMULATION_MAX_MONTHS = 120;
const HORIZON_MONTHS = [6, 12, 24, 36] as const;
const BASE_HORIZONS = [1, 3, 6, 12, 24, 36] as const;

const EMPTY_MANUAL_INPUTS: ManualInputState = {
  monthly: "",
  quarterly: "",
  semiannual: "",
  annual: "",
};

const EMPTY_CUSTOM_CURRENT: CustomCurrentCapitalState = {
  amount: "",
};

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

const parsePercentInput = (value: string): { value: number | null; error?: string } => {
  const normalized = value.replace(/%/g, "").replace(/,/g, "").trim();
  if (!normalized) return { value: null };
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return { value: null, error: "Debe ser un numero valido." };
  }
  if (parsed <= -100 || parsed >= 10000) {
    return { value: null, error: "Debe ser > -100 y < 10000." };
  }
  return { value: parsed };
};

const asPercentInputValue = (value: number | string | null | undefined) => {
  if (value === null || value === undefined) return "";
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return "";
  return parsed.toFixed(2);
};

const toRate = (percent: number) => percent / 100;

const clampRate = (value: number) => Math.max(-0.95, Math.min(5, value));

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

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return "-";
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

const monthsToTarget = (start: number, target: number, monthlyRate: number, maxMonths = 120) => {
  if (target <= 0 || start <= 0) return null;
  if (start >= target) return 0;
  if (monthlyRate <= 0) return null;

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

const requiredMonthlyRate = (current: number, target: number, months: number) => {
  if (current <= 0 || target <= 0 || months <= 0) return 0;
  if (current >= target) return 0;
  return Math.pow(target / current, 1 / months) - 1;
};

const monthlyFromPeriodPercent = (
  period: "monthly" | "quarterly" | "semiannual" | "annual",
  enteredPercent: number
) => {
  const periodRate = toRate(enteredPercent);
  if (periodRate <= -1) return null;
  if (period === "monthly") return periodRate;
  if (period === "quarterly") return Math.pow(1 + periodRate, 1 / 3) - 1;
  if (period === "semiannual") return Math.pow(1 + periodRate, 1 / 6) - 1;
  return Math.pow(1 + periodRate, 1 / 12) - 1;
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
      p50Months: null,
      p10Months: null,
      p90Months: null,
      successByHorizon: HORIZON_MONTHS.map((months) => ({ months, probability: 0 })),
      residualProbability: 1,
    };
  }

  if (start >= target) {
    return {
      sampleSize: samples,
      p50Months: 0,
      p10Months: 0,
      p90Months: 0,
      successByHorizon: HORIZON_MONTHS.map((months) => ({ months, probability: 1 })),
      residualProbability: 0,
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
  const success36 = results.filter((value) => value !== null && value <= 36).length;

  return {
    sampleSize: samples,
    p50Months: quantile(validHits, 0.5),
    p10Months: quantile(validHits, 0.1),
    p90Months: quantile(validHits, 0.9),
    successByHorizon: HORIZON_MONTHS.map((months) => {
      const success = results.filter((value) => value !== null && value <= months).length;
      return { months, probability: success / samples };
    }),
    residualProbability: Math.max(0, 1 - success36 / samples),
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

        {[0, 6, 12, 18, 24, 30, 36].map((month) => (
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
  const [activeTargetId, setActiveTargetId] = useState<string | null>(null);
  const [targetName, setTargetName] = useState(`Objetivo ${TYPE_LABEL[initialType]}`);
  const [targetInput, setTargetInput] = useState(
    buildDefaultTarget(metricsByType[initialType].totalBalance)
  );
  const [customCurrentInput, setCustomCurrentInput] = useState<CustomCurrentCapitalState>(EMPTY_CUSTOM_CURRENT);
  const [manualInputs, setManualInputs] = useState<ManualInputState>(EMPTY_MANUAL_INPUTS);
  const [showDetails, setShowDetails] = useState(false);
  const [savedTargets, setSavedTargets] = useState<CapitalTargetRecord[]>([]);
  const [loadingTargets, setLoadingTargets] = useState(true);
  const [targetsError, setTargetsError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [manualError, setManualError] = useState<string | null>(null);
  const [customCurrentError, setCustomCurrentError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [isSavingTarget, setIsSavingTarget] = useState(false);
  const [isSavingManual, setIsSavingManual] = useState(false);
  const [isDeletingManual, setIsDeletingManual] = useState(false);
  const [isSavingCustomCurrent, setIsSavingCustomCurrent] = useState(false);
  const [isDeletingCustomCurrent, setIsDeletingCustomCurrent] = useState(false);

  const activeMetrics = metricsByType[selectedType];
  const customCurrentCapital = useMemo(() => parseNumber(customCurrentInput.amount), [customCurrentInput.amount]);
  const activeCurrentCapital =
    customCurrentCapital !== null && customCurrentCapital > 0
      ? customCurrentCapital
      : activeMetrics.totalBalance;
  const usingCustomCurrentCapital = customCurrentCapital !== null && customCurrentCapital > 0;
  const activeNetPnl30d = activeMetrics.netPnl30d;
  const targetCapital = useMemo(() => parseNumber(targetInput), [targetInput]);
  const invalidTarget = targetCapital === null || targetCapital <= 0;
  const currentTypeTargets = useMemo(
    () => savedTargets.filter((target) => target.account_type === selectedType),
    [savedTargets, selectedType]
  );
  const activeTargetRecord = useMemo(
    () => (activeTargetId ? savedTargets.find((target) => target.id === activeTargetId) ?? null : null),
    [activeTargetId, savedTargets]
  );

  const clearMessages = useCallback(() => {
    setSaveError(null);
    setManualError(null);
    setCustomCurrentError(null);
    setSaveSuccess(null);
  }, []);

  const applyTargetToForm = useCallback((target: CapitalTargetRecord) => {
    setActiveTargetId(target.id);
    setTargetName(target.target_name);
    setTargetInput(Number(target.target_capital).toFixed(2));
    const parsedCustomCurrent = Number(target.custom_current_capital);
    setCustomCurrentInput({
      amount: Number.isFinite(parsedCustomCurrent) && parsedCustomCurrent > 0 ? parsedCustomCurrent.toFixed(2) : "",
    });
    setManualInputs({
      monthly: asPercentInputValue(target.manual_monthly_pct),
      quarterly: asPercentInputValue(target.manual_quarterly_pct),
      semiannual: asPercentInputValue(target.manual_semiannual_pct),
      annual: asPercentInputValue(target.manual_annual_pct),
    });
  }, []);

  const resetToNewTarget = useCallback(
    (type: CapitalType) => {
      setActiveTargetId(null);
      setTargetName(`Objetivo ${TYPE_LABEL[type]}`);
      setTargetInput(buildDefaultTarget(metricsByType[type].totalBalance));
      setCustomCurrentInput(EMPTY_CUSTOM_CURRENT);
      setManualInputs(EMPTY_MANUAL_INPUTS);
    },
    [metricsByType]
  );

  const applyTargetPreset = useCallback(
    (type: CapitalType, targets: CapitalTargetRecord[]) => {
      const latest = targets.find((target) => target.account_type === type);
      if (latest) {
        applyTargetToForm(latest);
        return;
      }

      resetToNewTarget(type);
    },
    [applyTargetToForm, resetToNewTarget]
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
    clearMessages();
    applyTargetPreset(type, savedTargets);
  };

  const handleLoadSavedTarget = (target: CapitalTargetRecord) => {
    applyTargetToForm(target);
    setShowDetails(true);
    clearMessages();
  };

  const upsertTarget = useCallback((record: CapitalTargetRecord) => {
    setSavedTargets((prev) => {
      const exists = prev.some((target) => target.id === record.id);
      if (!exists) {
        return [record, ...prev];
      }
      return prev.map((target) => (target.id === record.id ? record : target));
    });
  }, []);

  const handleSaveTarget = async () => {
    clearMessages();
    const parsedTarget = parseNumber(targetInput);
    const parsedCustomCurrent = parseNumber(customCurrentInput.amount);
    if (parsedTarget === null || parsedTarget <= 0) {
      setSaveError("Ingresa un capital objetivo valido y mayor a 0.");
      return;
    }

    if (customCurrentInput.amount.trim().length > 0 && (parsedCustomCurrent === null || parsedCustomCurrent <= 0)) {
      setSaveError("El capital actual custom debe ser un numero valido y mayor a 0.");
      return;
    }

    if (!targetName.trim()) {
      setSaveError("Asigna un nombre para guardar el objetivo.");
      return;
    }

    setIsSavingTarget(true);
    try {
      const endpoint = activeTargetId
        ? `/api/intelligence/capital-targets/${activeTargetId}`
        : "/api/intelligence/capital-targets";
      const method = activeTargetId ? "PATCH" : "POST";

      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          account_type: selectedType,
          target_name: targetName.trim(),
          target_capital: parsedTarget,
          custom_current_capital: parsedCustomCurrent,
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "No se pudo guardar el objetivo.");
      }

      const created = payload as CapitalTargetRecord;
      upsertTarget(created);
      applyTargetToForm(created);
      setSaveSuccess(activeTargetId ? "Objetivo actualizado correctamente." : "Objetivo guardado correctamente.");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "No se pudo guardar el objetivo.");
    } finally {
      setIsSavingTarget(false);
    }
  };

  const handleSaveManualSimulation = async () => {
    clearMessages();
    if (!activeTargetId) {
      setManualError("Guarda o carga un objetivo antes de guardar la simulacion manual.");
      return;
    }

    const parsedValues = {
      monthly: parsePercentInput(manualInputs.monthly),
      quarterly: parsePercentInput(manualInputs.quarterly),
      semiannual: parsePercentInput(manualInputs.semiannual),
      annual: parsePercentInput(manualInputs.annual),
    };

    if (parsedValues.monthly.error) {
      setManualError(`Mensual: ${parsedValues.monthly.error}`);
      return;
    }
    if (parsedValues.quarterly.error) {
      setManualError(`Trimestral: ${parsedValues.quarterly.error}`);
      return;
    }
    if (parsedValues.semiannual.error) {
      setManualError(`Semestral: ${parsedValues.semiannual.error}`);
      return;
    }
    if (parsedValues.annual.error) {
      setManualError(`Anual: ${parsedValues.annual.error}`);
      return;
    }

    if (!manualInputs.monthly && !manualInputs.quarterly && !manualInputs.semiannual && !manualInputs.annual) {
      setManualError("Ingresa al menos un porcentaje o usa Eliminar simulacion manual.");
      return;
    }

    setIsSavingManual(true);
    try {
      const response = await fetch(`/api/intelligence/capital-targets/${activeTargetId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          manual_monthly_pct: parsedValues.monthly.value,
          manual_quarterly_pct: parsedValues.quarterly.value,
          manual_semiannual_pct: parsedValues.semiannual.value,
          manual_annual_pct: parsedValues.annual.value,
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "No se pudo guardar la simulacion manual.");
      }

      const updated = payload as CapitalTargetRecord;
      upsertTarget(updated);
      applyTargetToForm(updated);
      setSaveSuccess("Simulacion manual guardada.");
    } catch (error) {
      setManualError(error instanceof Error ? error.message : "No se pudo guardar la simulacion manual.");
    } finally {
      setIsSavingManual(false);
    }
  };

  const handleDeleteManualSimulation = async () => {
    clearMessages();
    if (!activeTargetId) {
      setManualError("No hay objetivo activo para eliminar simulacion manual.");
      return;
    }

    setIsDeletingManual(true);
    try {
      const response = await fetch(
        `/api/intelligence/capital-targets/${activeTargetId}/manual-simulation`,
        {
          method: "DELETE",
        }
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "No se pudo eliminar la simulacion manual.");
      }

      const updated = payload as CapitalTargetRecord;
      upsertTarget(updated);
      applyTargetToForm(updated);
      setSaveSuccess("Simulacion manual eliminada.");
    } catch (error) {
      setManualError(error instanceof Error ? error.message : "No se pudo eliminar la simulacion manual.");
    } finally {
      setIsDeletingManual(false);
    }
  };

  const handleSaveCustomCurrent = async () => {
    clearMessages();
    if (!activeTargetId) {
      setCustomCurrentError("Guarda o carga un objetivo antes de crear capital actual custom.");
      return;
    }

    const parsedAmount = parseNumber(customCurrentInput.amount);
    if (parsedAmount === null || parsedAmount <= 0) {
      setCustomCurrentError("Ingresa un capital actual custom valido y mayor a 0.");
      return;
    }

    setIsSavingCustomCurrent(true);
    try {
      const response = await fetch(`/api/intelligence/capital-targets/${activeTargetId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          custom_current_capital: parsedAmount,
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "No se pudo guardar el capital actual custom.");
      }

      const updated = payload as CapitalTargetRecord;
      upsertTarget(updated);
      applyTargetToForm(updated);
      setSaveSuccess("Capital actual custom guardado.");
    } catch (error) {
      setCustomCurrentError(error instanceof Error ? error.message : "No se pudo guardar el capital actual custom.");
    } finally {
      setIsSavingCustomCurrent(false);
    }
  };

  const handleDeleteCustomCurrent = async () => {
    clearMessages();
    if (!activeTargetId) {
      setCustomCurrentError("No hay objetivo activo para eliminar capital actual custom.");
      return;
    }

    setIsDeletingCustomCurrent(true);
    try {
      const response = await fetch(`/api/intelligence/capital-targets/${activeTargetId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          custom_current_capital: null,
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "No se pudo eliminar el capital actual custom.");
      }

      const updated = payload as CapitalTargetRecord;
      upsertTarget(updated);
      applyTargetToForm(updated);
      setSaveSuccess("Capital actual custom eliminado.");
    } catch (error) {
      setCustomCurrentError(error instanceof Error ? error.message : "No se pudo eliminar el capital actual custom.");
    } finally {
      setIsDeletingCustomCurrent(false);
    }
  };

  const progress = useMemo(() => {
    if (!targetCapital || targetCapital <= 0) return 0;
    return Math.max(0, Math.min(100, (activeCurrentCapital / targetCapital) * 100));
  }, [activeCurrentCapital, targetCapital]);

  const remaining = useMemo(() => {
    if (!targetCapital) return null;
    return targetCapital - activeCurrentCapital;
  }, [activeCurrentCapital, targetCapital]);

  const autoRate = useMemo(() => {
    if (activeCurrentCapital <= 0) return 0.01;
    const observed = activeNetPnl30d / activeCurrentCapital;
    return observed > 0 ? observed : 0.01;
  }, [activeCurrentCapital, activeNetPnl30d]);

  const scenarioConfigs = useMemo(() => {
    const base = clampRate(autoRate);
    const conservativeRate = clampRate(Math.max(base * 0.65, 0.004));
    const aggressiveRate = clampRate(Math.max(base + 0.006, base * 1.35));

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
        monthlyRate: base,
        color: "#38bdf8",
      },
      {
        key: "aggressive",
        label: "Agresivo",
        monthlyRate: aggressiveRate,
        color: "#22c55e",
      },
    ] as ScenarioConfig[];
  }, [autoRate]);

  const scenarioRows = useMemo(() => {
    if (!showDetails || !targetCapital || targetCapital <= 0) return [];

    return scenarioConfigs.map((config) => {
      const points = buildSeries(activeCurrentCapital, config.monthlyRate, CHART_MONTHS);
      const months = monthsToTarget(
        activeCurrentCapital,
        targetCapital,
        config.monthlyRate,
        SIMULATION_MAX_MONTHS
      );
      const peak = Math.max(...points.map((point) => point.capital));
      const low = Math.min(...points.map((point) => point.capital));

      return { config, points, months, peak, low };
    });
  }, [activeCurrentCapital, scenarioConfigs, showDetails, targetCapital]);

  const simulation = useMemo(() => {
    if (!showDetails || !targetCapital || targetCapital <= 0) {
      return {
        sampleSize: SIMULATION_SAMPLES,
        p50Months: null,
        p10Months: null,
        p90Months: null,
        successByHorizon: HORIZON_MONTHS.map((months) => ({ months, probability: 0 })),
        residualProbability: 1,
      };
    }
    return runSimulation(
      activeCurrentCapital,
      targetCapital,
      autoRate,
      SIMULATION_SAMPLES,
      SIMULATION_MAX_MONTHS
    );
  }, [activeCurrentCapital, autoRate, showDetails, targetCapital]);

  const milestoneRows = useMemo(() => {
    if (!showDetails || !targetCapital || targetCapital <= 0 || activeCurrentCapital <= 0) return [];
    const months = Array.from(new Set([
      ...BASE_HORIZONS,
      ...Array.from(
        {
          length: Math.max(
            0,
            Math.floor(
              (Math.min(
                SIMULATION_MAX_MONTHS,
                Math.max(36, Math.ceil((simulation.p50Months ?? SIMULATION_MAX_MONTHS) / 12) * 12)
              ) - 36) / 12
            )
          ),
        },
        (_, index) => 48 + index * 12
      ),
    ]))
      .filter((value) => value <= SIMULATION_MAX_MONTHS)
      .sort((a, b) => a - b);

    return months.map((monthCount) => {
      const monthly = requiredMonthlyRate(activeCurrentCapital, targetCapital, monthCount);
      return {
        months: monthCount,
        monthly,
        quarterly: Math.pow(1 + monthly, 3) - 1,
        semiannual: Math.pow(1 + monthly, 6) - 1,
        annual: Math.pow(1 + monthly, 12) - 1,
      };
    });
  }, [activeCurrentCapital, showDetails, simulation.p50Months, targetCapital]);

  const manualScenarioResults = useMemo<ManualScenarioResult[]>(() => {
    if (!showDetails || !targetCapital || targetCapital <= 0 || activeCurrentCapital <= 0) return [];

    const definitions: Array<{ id: ManualScenarioResult["id"]; label: string; input: string }> = [
      { id: "monthly", label: "% mensual", input: manualInputs.monthly },
      { id: "quarterly", label: "% trimestral", input: manualInputs.quarterly },
      { id: "semiannual", label: "% semestral", input: manualInputs.semiannual },
      { id: "annual", label: "% anual", input: manualInputs.annual },
    ];

    const rows: ManualScenarioResult[] = [];
    for (const definition of definitions) {
      const parsed = parsePercentInput(definition.input);
      if (parsed.error || parsed.value === null) continue;
      const monthlyEquivalent = monthlyFromPeriodPercent(definition.id, parsed.value);
      if (monthlyEquivalent === null) continue;

      rows.push({
        id: definition.id,
        label: definition.label,
        enteredPercent: parsed.value,
        monthlyEquivalent,
        monthsToTarget: monthsToTarget(
          activeCurrentCapital,
          targetCapital,
          monthlyEquivalent,
          SIMULATION_MAX_MONTHS
        ),
        simulation: runSimulation(
          activeCurrentCapital,
          targetCapital,
          monthlyEquivalent,
          SIMULATION_SAMPLES,
          SIMULATION_MAX_MONTHS
        ),
      });
    }

    return rows;
  }, [
    activeCurrentCapital,
    manualInputs.annual,
    manualInputs.monthly,
    manualInputs.quarterly,
    manualInputs.semiannual,
    showDetails,
    targetCapital,
  ]);

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
            Selecciona tipo de capital (real o propfirm), crea multiples objetivos y abre detalles
            para ver pronosticos.
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
          <div className="flex gap-2 flex-wrap">
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
              disabled={isSavingTarget}
              className="rounded border border-sky-500/60 bg-sky-900/40 px-4 py-2 text-sm font-semibold text-sky-100 hover:bg-sky-900/60 disabled:opacity-60"
            >
              {isSavingTarget ? "Guardando..." : activeTargetId ? "Actualizar objetivo" : "Guardar objetivo"}
            </button>
            <button
              type="button"
              onClick={() => resetToNewTarget(selectedType)}
              className="rounded border border-slate-600/70 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-slate-400"
            >
              Nuevo objetivo
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
      {manualError && (
        <div className="mt-3 rounded border border-red-800/70 bg-red-950/30 px-3 py-2 text-sm text-red-200">
          {manualError}
        </div>
      )}
      {customCurrentError && (
        <div className="mt-3 rounded border border-red-800/70 bg-red-950/30 px-3 py-2 text-sm text-red-200">
          {customCurrentError}
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
                className={`flex flex-col gap-2 rounded border p-2 sm:flex-row sm:items-center sm:justify-between ${
                  target.id === activeTargetId
                    ? "border-sky-500/60 bg-sky-950/30"
                    : "border-slate-700/60 bg-slate-950/50"
                }`}
              >
                <div>
                  <p className="text-sm font-medium text-slate-100">{target.target_name}</p>
                  <p className="text-xs text-slate-400">
                    {formatMoney(Number(target.target_capital))} | {formatDateTime(target.created_at)}
                  </p>
                  <p className="text-xs text-slate-500">
                    Simulacion manual: {target.manual_updated_at ? formatDateTime(target.manual_updated_at) : "Sin guardar"}
                  </p>
                  <p className="text-xs text-slate-500">
                    Capital actual custom:{" "}
                    {target.custom_current_capital === null || target.custom_current_capital === undefined
                      ? "Sin guardar"
                      : `${formatMoney(Number(target.custom_current_capital))} (${formatDateTime(target.custom_current_updated_at)})`}
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
              <p className="mt-1 text-xs text-slate-500">
                {usingCustomCurrentCapital ? "Fuente: custom vinculado al objetivo" : "Fuente: balance consolidado"}
              </p>
            </div>
            <div className="rounded border border-slate-700/70 bg-slate-900/60 p-3">
              <p className="text-xs text-slate-400">Capital objetivo</p>
              <p className="text-lg font-semibold text-white">{formatMoney(targetCapital)}</p>
            </div>
            <div className="rounded border border-slate-700/70 bg-slate-900/60 p-3">
              <p className="text-xs text-slate-400">Faltante planificado</p>
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
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h4 className="text-sm font-semibold text-slate-100">Capital actual custom vinculado</h4>
                <p className="text-xs text-slate-400">
                  Crea/edita un capital actual custom para este objetivo. Se usa en simulaciones automaticas y manuales.
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Base actual por tipo: {formatMoney(activeMetrics.totalBalance)}
                </p>
              </div>
              {!activeTargetId && (
                <span className="text-xs text-amber-300">
                  Guarda o carga un objetivo para persistir capital actual custom.
                </span>
              )}
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_auto]">
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wide text-slate-400">Capital actual custom</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={customCurrentInput.amount}
                  onChange={(event) => setCustomCurrentInput({ amount: event.target.value })}
                  placeholder="Ej. 12500"
                  className="w-full rounded border border-slate-700/70 bg-slate-900/60 px-3 py-2 text-sm text-slate-100"
                />
              </label>
              <button
                type="button"
                onClick={handleSaveCustomCurrent}
                disabled={isSavingCustomCurrent}
                className="rounded border border-sky-500/60 bg-sky-900/40 px-4 py-2 text-sm font-semibold text-sky-100 hover:bg-sky-900/60 disabled:opacity-60"
              >
                {isSavingCustomCurrent ? "Guardando..." : "Guardar capital actual"}
              </button>
              <button
                type="button"
                onClick={handleDeleteCustomCurrent}
                disabled={isDeletingCustomCurrent}
                className="rounded border border-red-700/70 bg-red-950/35 px-4 py-2 text-sm font-semibold text-red-200 hover:bg-red-950/50 disabled:opacity-60"
              >
                {isDeletingCustomCurrent ? "Eliminando..." : "Eliminar capital custom"}
              </button>
            </div>

            <p className="mt-3 text-xs text-slate-500">
              Estado actual:{" "}
              {activeTargetRecord?.custom_current_capital === null || activeTargetRecord?.custom_current_capital === undefined
                ? "Sin capital custom guardado"
                : `${formatMoney(Number(activeTargetRecord.custom_current_capital))} (${formatDateTime(activeTargetRecord.custom_current_updated_at)})`}
            </p>
          </div>

          <div className="rounded border border-slate-700/70 bg-slate-900/60 p-4">
            <h4 className="text-sm font-semibold text-slate-100">Guia para lograr el objetivo</h4>
            <ul className="mt-2 space-y-2 text-sm text-slate-300">
              <li>
                Ritmo automatico base: {toPercent(autoRate)} mensual compuesto (fallback 1% mensual).
              </li>
              <li>
                Tiempo estimado: {simulation.p50Months === null ? `>${SIMULATION_MAX_MONTHS} meses` : `${simulation.p50Months.toFixed(1)} meses`} (mediana 3k).
              </li>
              <li>
                Pronostico rapido/mediana/lento:{" "}
                {simulation.p10Months === null ? "N/A" : `${simulation.p10Months.toFixed(1)}m`} /{" "}
                {simulation.p50Months === null ? "N/A" : `${simulation.p50Months.toFixed(1)}m`} /{" "}
                {simulation.p90Months === null ? "N/A" : `${simulation.p90Months.toFixed(1)}m`}.
              </li>
              <li>
                Probabilidad residual (&gt;36m): {(simulation.residualProbability * 100).toFixed(1)}%.
              </li>
            </ul>
          </div>

          <div className="rounded border border-slate-700/70 bg-slate-900/60 p-4">
            <h4 className="text-sm font-semibold text-slate-100">Tabla de hitos (% requeridos)</h4>
            <div className="mt-3 max-w-full overflow-x-auto">
              <table className="table-mobile-cards w-full text-sm text-slate-200">
                <thead>
                  <tr>
                    <th className="py-2 text-left">Horizonte</th>
                    <th className="py-2 text-right">% mensual requerido</th>
                    <th className="py-2 text-right">% trimestral requerido</th>
                    <th className="py-2 text-right">% semestral requerido</th>
                    <th className="py-2 text-right">% anual requerido</th>
                  </tr>
                </thead>
                <tbody>
                  {milestoneRows.map((row) => (
                    <tr key={row.months} className="border-t border-slate-800/70">
                      <td data-label="Horizonte" className="py-2">{row.months} meses</td>
                      <td data-label="% mensual" className="py-2 text-right">{toPercent(row.monthly)}</td>
                      <td data-label="% trimestral" className="py-2 text-right">{toPercent(row.quarterly)}</td>
                      <td data-label="% semestral" className="py-2 text-right">{toPercent(row.semiannual)}</td>
                      <td data-label="% anual" className="py-2 text-right">{toPercent(row.annual)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
                  {simulation.p50Months === null ? "No estimable" : `${simulation.p50Months.toFixed(1)} meses`}
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
                  <tr className="border-t border-slate-800/70">
                    <td data-label="Horizonte" className="py-2">Residual (&gt;36 meses)</td>
                    <td data-label="Probabilidad" className="py-2 text-right">
                      {(simulation.residualProbability * 100).toFixed(1)}%
                    </td>
                  </tr>
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
                    <th className="py-2 text-right">Pico alto 36m</th>
                    <th className="py-2 text-right">Pico bajo 36m</th>
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
                        {row.months === null ? `>${SIMULATION_MAX_MONTHS}m` : `${row.months} meses`}
                      </td>
                      <td data-label="Pico alto 36m" className="py-2 text-right">
                        {formatMoney(row.peak)}
                      </td>
                      <td data-label="Pico bajo 36m" className="py-2 text-right">
                        {formatMoney(row.low)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded border border-slate-700/70 bg-slate-900/60 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h4 className="text-sm font-semibold text-slate-100">Simulacion manual editable</h4>
                <p className="text-xs text-slate-400">
                  Personaliza porcentajes por periodo y guarda en el mismo objetivo.
                </p>
              </div>
              {!activeTargetId && (
                <span className="text-xs text-amber-300">
                  Guarda o carga un objetivo para persistir la simulacion manual.
                </span>
              )}
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label>
                <span className="mb-1 block text-xs uppercase tracking-wide text-slate-400">% mensual</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={manualInputs.monthly}
                  onChange={(event) =>
                    setManualInputs((current) => ({ ...current, monthly: event.target.value }))
                  }
                  className="w-full rounded border border-slate-700/70 bg-slate-900/60 px-3 py-2 text-sm text-slate-100"
                />
              </label>
              <label>
                <span className="mb-1 block text-xs uppercase tracking-wide text-slate-400">% trimestral</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={manualInputs.quarterly}
                  onChange={(event) =>
                    setManualInputs((current) => ({ ...current, quarterly: event.target.value }))
                  }
                  className="w-full rounded border border-slate-700/70 bg-slate-900/60 px-3 py-2 text-sm text-slate-100"
                />
              </label>
              <label>
                <span className="mb-1 block text-xs uppercase tracking-wide text-slate-400">% semestral</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={manualInputs.semiannual}
                  onChange={(event) =>
                    setManualInputs((current) => ({ ...current, semiannual: event.target.value }))
                  }
                  className="w-full rounded border border-slate-700/70 bg-slate-900/60 px-3 py-2 text-sm text-slate-100"
                />
              </label>
              <label>
                <span className="mb-1 block text-xs uppercase tracking-wide text-slate-400">% anual</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={manualInputs.annual}
                  onChange={(event) =>
                    setManualInputs((current) => ({ ...current, annual: event.target.value }))
                  }
                  className="w-full rounded border border-slate-700/70 bg-slate-900/60 px-3 py-2 text-sm text-slate-100"
                />
              </label>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleSaveManualSimulation}
                disabled={isSavingManual}
                className="rounded border border-sky-500/60 bg-sky-900/40 px-4 py-2 text-sm font-semibold text-sky-100 hover:bg-sky-900/60 disabled:opacity-60"
              >
                {isSavingManual ? "Guardando..." : "Guardar simulacion manual"}
              </button>
              <button
                type="button"
                onClick={handleDeleteManualSimulation}
                disabled={isDeletingManual}
                className="rounded border border-red-700/70 bg-red-950/35 px-4 py-2 text-sm font-semibold text-red-200 hover:bg-red-950/50 disabled:opacity-60"
              >
                {isDeletingManual ? "Eliminando..." : "Eliminar simulacion manual"}
              </button>
            </div>

            {manualScenarioResults.length > 0 && (
              <div className="mt-3 max-w-full overflow-x-auto">
                <table className="table-mobile-cards w-full text-sm text-slate-200">
                  <thead>
                    <tr>
                      <th className="py-2 text-left">Escenario manual</th>
                      <th className="py-2 text-right">% ingresado</th>
                      <th className="py-2 text-right">% mensual equivalente</th>
                      <th className="py-2 text-right">Tiempo estimado</th>
                      <th className="py-2 text-right">Rapido / Mediana / Lento</th>
                      <th className="py-2 text-right">Prob. &lt;=36m</th>
                    </tr>
                  </thead>
                  <tbody>
                    {manualScenarioResults.map((row) => {
                      const hit36 = row.simulation.successByHorizon.find((item) => item.months === 36);
                      return (
                        <tr key={row.id} className="border-t border-slate-800/70">
                          <td data-label="Escenario" className="py-2">{row.label}</td>
                          <td data-label="% ingresado" className="py-2 text-right">
                            {row.enteredPercent.toFixed(2)}%
                          </td>
                          <td data-label="% mensual eq" className="py-2 text-right">
                            {toPercent(row.monthlyEquivalent)}
                          </td>
                          <td data-label="Tiempo estimado" className="py-2 text-right">
                            {row.monthsToTarget === null ? `>${SIMULATION_MAX_MONTHS}m` : `${row.monthsToTarget} meses`}
                          </td>
                          <td data-label="Forecast" className="py-2 text-right">
                            {row.simulation.p10Months === null ? "N/A" : row.simulation.p10Months.toFixed(1)} /{" "}
                            {row.simulation.p50Months === null ? "N/A" : row.simulation.p50Months.toFixed(1)} /{" "}
                            {row.simulation.p90Months === null ? "N/A" : row.simulation.p90Months.toFixed(1)}
                          </td>
                          <td data-label="Prob <=36m" className="py-2 text-right">
                            {((hit36?.probability ?? 0) * 100).toFixed(1)}% (residual{" "}
                            {(row.simulation.residualProbability * 100).toFixed(1)}%)
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
