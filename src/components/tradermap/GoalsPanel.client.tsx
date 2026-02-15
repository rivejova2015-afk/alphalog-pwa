"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { logger } from "@/lib/alphashield/logger";
import GoalCard from "./GoalCard.client";
import { formatMoney, parseMoneyInput } from "./money";

type QuarterKey = "Q1" | "Q2" | "Q3" | "Q4";

const QUARTERS: QuarterKey[] = ["Q1", "Q2", "Q3", "Q4"];

const QUARTER_MONTHS: Record<QuarterKey, [number, number]> = {
  Q1: [0, 2],
  Q2: [3, 5],
  Q3: [6, 8],
  Q4: [9, 11],
};

interface Account {
  id: string;
  name: string;
  currency?: string;
}

interface GoalQuarter {
  id: string;
  goal_id: string;
  quarter: QuarterKey | number | string;
  start_date: string;
  end_date: string;
  start_balance: number;
  target_balance: number;
  current_balance?: number | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface Goal {
  id: string;
  user_id: string;
  account_id: string;
  year: number;
  title: string;
  active_quarter: QuarterKey | number | string;
  sort_index: number;
  quarters: GoalQuarter[];
  account?: Account;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

type QuarterForm = {
  start_date: string;
  end_date: string;
  start_balance: string;
  target_balance: string;
  current_balance: string;
};

interface GoalForm {
  title: string;
  accountId: string;
  year: number;
  active_quarter: QuarterKey;
  quarters: Record<QuarterKey, QuarterForm>;
}

const toIsoDate = (date: Date) => date.toISOString().slice(0, 10);

const normalizeQuarterKey = (value: unknown): QuarterKey => {
  if (typeof value === "string") {
    const normalized = value.trim().toUpperCase();
    if (normalized === "Q1" || normalized === "Q2" || normalized === "Q3" || normalized === "Q4") {
      return normalized;
    }
    if (normalized === "1") return "Q1";
    if (normalized === "2") return "Q2";
    if (normalized === "3") return "Q3";
    if (normalized === "4") return "Q4";
  }
  if (typeof value === "number" && value >= 1 && value <= 4) {
    return `Q${value}` as QuarterKey;
  }
  return "Q1";
};

const createInitialForm = (year: number): GoalForm => {
  const quarters = QUARTERS.reduce((acc, quarter) => {
    const [startMonth, endMonth] = QUARTER_MONTHS[quarter];
    const startDate = new Date(year, startMonth, 1);
    const endDate = new Date(year, endMonth + 1, 0);
    acc[quarter] = {
      start_date: toIsoDate(startDate),
      end_date: toIsoDate(endDate),
      start_balance: "0",
      target_balance: "1",
      current_balance: "",
    };
    return acc;
  }, {} as Record<QuarterKey, QuarterForm>);

  return {
    title: "",
    accountId: "",
    year,
    active_quarter: "Q1",
    quarters,
  };
};

async function parseApiError(response: Response, fallback: string) {
  try {
    const data = (await response.json()) as { error?: string; details?: string | Record<string, string> };
    if (data.details && typeof data.details === "object") {
      const details = Object.entries(data.details)
        .map(([key, value]) => `${key}: ${value}`)
        .join("; ");
      return data.error ? `${data.error}. ${details}` : details;
    }
    if (typeof data.details === "string" && data.details.trim().length > 0) {
      return data.error ? `${data.error}. ${data.details}` : data.details;
    }
    if (data.error) return data.error;
  } catch {
    // ignore
  }
  return fallback;
}

export default function GoalsPanel() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const realtimeLock = useRef(false);

  const currentYear = new Date().getFullYear();
  const [formData, setFormData] = useState<GoalForm>(createInitialForm(currentYear));

  const fetchAccounts = useCallback(async () => {
    try {
      const response = await fetch("/api/accounts");
      if (response.ok) {
        const data: Account[] = await response.json();
        setAccounts(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      await logger.error(
        "tradermap",
        "Error fetching accounts",
        err instanceof Error ? err : undefined
      );
    }
  }, []);

  const fetchGoals = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const response = await fetch("/api/tradermap/goals");

      if (!response.ok) {
        if (response.status === 401) {
          window.location.href = "/auth";
          return;
        }
        await logger.error("tradermap", "Fetch goals failed", undefined, {
          endpoint: "/api/tradermap/goals",
          status: response.status,
        });
        setGoals([]);
        return;
      }

      const data = await response.json();
      setGoals(Array.isArray(data) ? data : []);
    } catch (err) {
      await logger.error(
        "tradermap",
        "Fetch goals error",
        err instanceof Error ? err : undefined
      );
      setGoals([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAccounts();
    void fetchGoals();
  }, [fetchAccounts, fetchGoals]);

  useEffect(() => {
    const supabase = createClient();
    const tables = ["tradermap_goals", "tradermap_goal_quarters", "trades"];

    const channels = tables.map((table) =>
      supabase
        .channel(`tradermap:${table}`)
        .on("postgres_changes", { event: "*", schema: "public", table }, () => {
          if (realtimeLock.current) return;
          realtimeLock.current = true;
          setTimeout(async () => {
            try {
              await fetchGoals();
            } finally {
              realtimeLock.current = false;
            }
          }, 300);
        })
        .subscribe()
    );

    return () => {
      channels.forEach((channel) => {
        try {
          supabase.removeChannel(channel);
        } catch {
          // no-op
        }
      });
    };
  }, [fetchGoals]);

  const selectedAccountCurrency = useMemo(() => {
    return accounts.find((account) => account.id === formData.accountId)?.currency || "USD";
  }, [accounts, formData.accountId]);

  const validateQuarterPayload = useCallback(() => {
    const quarterPayload: Array<{
      quarter: QuarterKey;
      start_date: string;
      end_date: string;
      start_balance: number;
      target_balance: number;
      current_balance: number | null;
    }> = [];

    for (const quarter of QUARTERS) {
      const quarterData = formData.quarters[quarter];
      if (!quarterData.start_date || !quarterData.end_date) {
        return { ok: false, message: `Fechas requeridas en ${quarter}` } as const;
      }

      const startBalance = parseMoneyInput(quarterData.start_balance);
      const targetBalance = parseMoneyInput(quarterData.target_balance);
      const hasCurrent = quarterData.current_balance.trim().length > 0;
      const currentBalance = hasCurrent ? parseMoneyInput(quarterData.current_balance) : null;

      if (startBalance === null) {
        return { ok: false, message: `Monto inicial requerido en ${quarter}` } as const;
      }
      if (targetBalance === null) {
        return { ok: false, message: `Monto objetivo requerido en ${quarter}` } as const;
      }
      if (startBalance < 0 || targetBalance < 0) {
        return { ok: false, message: `Montos negativos no permitidos en ${quarter}` } as const;
      }
      if (targetBalance <= startBalance) {
        return { ok: false, message: `Objetivo debe ser mayor que inicial en ${quarter}` } as const;
      }

      if (hasCurrent && currentBalance === null) {
        return { ok: false, message: `Monto actual invalido en ${quarter}` } as const;
      }
      if (currentBalance !== null && currentBalance < 0) {
        return { ok: false, message: `Monto actual no puede ser negativo en ${quarter}` } as const;
      }

      const startDate = new Date(quarterData.start_date);
      const endDate = new Date(quarterData.end_date);
      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate > endDate) {
        return { ok: false, message: `Rango de fechas invalido en ${quarter}` } as const;
      }

      quarterPayload.push({
        quarter,
        start_date: quarterData.start_date,
        end_date: quarterData.end_date,
        start_balance: startBalance,
        target_balance: targetBalance,
        current_balance: currentBalance,
      });
    }

    const ranges = quarterPayload.map((item) => ({
      quarter: item.quarter,
      start: new Date(item.start_date).getTime(),
      end: new Date(item.end_date).getTime(),
    }));

    for (let i = 0; i < ranges.length; i += 1) {
      for (let j = i + 1; j < ranges.length; j += 1) {
        const left = ranges[i];
        const right = ranges[j];
        const overlaps = left.start <= right.end && right.start <= left.end;
        if (overlaps) {
          return {
            ok: false,
            message: `Fechas solapadas entre ${left.quarter} y ${right.quarter}`,
          } as const;
        }
      }
    }

    return { ok: true, quarterPayload } as const;
  }, [formData.quarters]);

  const handleCreateGoal = async () => {
    try {
      if (!formData.title.trim()) {
        setError("Titulo es requerido");
        return;
      }

      if (!formData.accountId) {
        setError("Selecciona una cuenta");
        return;
      }

      const validation = validateQuarterPayload();
      if (!validation.ok) {
        setError(validation.message);
        return;
      }

      setCreating(true);
      setError("");

      const response = await fetch("/api/tradermap/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title.trim(),
          account_id: formData.accountId,
          year: formData.year,
          active_quarter: formData.active_quarter,
          quarters: validation.quarterPayload,
        }),
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response, "No se pudo crear la meta"));
      }

      await fetchGoals();
      setFormData(createInitialForm(currentYear));
      setShowForm(false);
    } catch (err) {
      await logger.error(
        "tradermap",
        "Error creating goal",
        err instanceof Error ? err : undefined
      );
      setError(err instanceof Error ? err.message : "Error al crear meta");
    } finally {
      setCreating(false);
    }
  };

  const updateQuarterField = (quarter: QuarterKey, field: keyof QuarterForm, value: string) => {
    setFormData((prev) => ({
      ...prev,
      quarters: {
        ...prev.quarters,
        [quarter]: {
          ...prev.quarters[quarter],
          [field]: value,
        },
      },
    }));
  };

  const resetForm = () => {
    setFormData(createInitialForm(currentYear));
    setError("");
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">Metas Anuales</h2>
        <button
          onClick={() => {
            if (showForm) {
              resetForm();
            }
            setShowForm((prev) => !prev);
          }}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold"
        >
          {showForm ? "Cancelar" : "+ Nueva Meta"}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-900/20 border border-red-700 text-red-200 rounded">
          {error}
        </div>
      )}

      {showForm && (
        <div className="mb-6 rounded-lg border border-slate-600 bg-slate-700/50 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-white">Nueva Meta</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-2">
              <label className="block text-sm font-medium text-slate-300 mb-2">Titulo *</label>
              <input
                type="text"
                value={formData.title}
                onChange={(event) => setFormData((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="Ej: Ruta de crecimiento 2026"
                className="w-full rounded border border-slate-500 bg-slate-600 px-3 py-2 text-white placeholder-slate-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Cuenta *</label>
              <select
                value={formData.accountId}
                onChange={(event) => setFormData((prev) => ({ ...prev, accountId: event.target.value }))}
                className="w-full rounded border border-slate-500 bg-slate-600 px-3 py-2 text-white"
              >
                <option value="">Selecciona una cuenta...</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Anio</label>
              <input
                type="number"
                min={2020}
                max={2100}
                value={formData.year}
                onChange={(event) => {
                  const nextYear = Number(event.target.value) || currentYear;
                  const nextForm = createInitialForm(nextYear);
                  setFormData((prev) => ({
                    ...nextForm,
                    title: prev.title,
                    accountId: prev.accountId,
                    active_quarter: prev.active_quarter,
                  }));
                }}
                className="w-full rounded border border-slate-500 bg-slate-600 px-3 py-2 text-white"
              />
            </div>
          </div>

          <div className="max-w-sm">
            <label className="block text-sm font-medium text-slate-300 mb-2">Trimestre activo</label>
            <select
              value={formData.active_quarter}
              onChange={(event) =>
                setFormData((prev) => ({ ...prev, active_quarter: normalizeQuarterKey(event.target.value) }))
              }
              className="w-full rounded border border-slate-500 bg-slate-600 px-3 py-2 text-white"
            >
              {QUARTERS.map((quarter) => (
                <option key={quarter} value={quarter}>
                  {quarter}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {QUARTERS.map((quarter) => {
              const quarterData = formData.quarters[quarter];
              const startBalance = parseMoneyInput(quarterData.start_balance);
              const targetBalance = parseMoneyInput(quarterData.target_balance);
              const currentBalance =
                quarterData.current_balance.trim().length > 0
                  ? parseMoneyInput(quarterData.current_balance)
                  : null;
              const missing =
                startBalance !== null && targetBalance !== null ? targetBalance - startBalance : null;
              const progress =
                currentBalance !== null && targetBalance && targetBalance > 0
                  ? (currentBalance / targetBalance) * 100
                  : null;

              return (
                <div key={quarter} className="rounded border border-slate-600 bg-slate-800/60 p-4 space-y-3">
                  <h4 className="text-sm font-semibold text-white">{quarter}</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Fecha inicio *</label>
                      <input
                        type="date"
                        value={quarterData.start_date}
                        onChange={(event) =>
                          updateQuarterField(quarter, "start_date", event.target.value)
                        }
                        className="w-full rounded border border-slate-500 bg-slate-700 px-2 py-2 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Fecha fin *</label>
                      <input
                        type="date"
                        value={quarterData.end_date}
                        onChange={(event) => updateQuarterField(quarter, "end_date", event.target.value)}
                        className="w-full rounded border border-slate-500 bg-slate-700 px-2 py-2 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Monto inicial *</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={quarterData.start_balance}
                        onChange={(event) =>
                          updateQuarterField(quarter, "start_balance", event.target.value)
                        }
                        className="w-full rounded border border-slate-500 bg-slate-700 px-2 py-2 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Monto objetivo *</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={quarterData.target_balance}
                        onChange={(event) =>
                          updateQuarterField(quarter, "target_balance", event.target.value)
                        }
                        className="w-full rounded border border-slate-500 bg-slate-700 px-2 py-2 text-white"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs text-slate-400 mb-1">Monto actual (opcional)</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={quarterData.current_balance}
                        onChange={(event) =>
                          updateQuarterField(quarter, "current_balance", event.target.value)
                        }
                        className="w-full rounded border border-slate-500 bg-slate-700 px-2 py-2 text-white"
                      />
                    </div>
                  </div>

                  <div className="text-xs text-slate-400 space-y-1">
                    <p>
                      Faltan:{" "}
                      <span className="text-white font-semibold">
                        {missing === null ? "--" : formatMoney(missing, selectedAccountCurrency)}
                      </span>
                    </p>
                    {currentBalance !== null && targetBalance !== null && (
                      <p>
                        Progreso real:{" "}
                        <span className="text-white font-semibold">
                          {formatMoney(currentBalance, selectedAccountCurrency)}
                        </span>{" "}
                        / {formatMoney(targetBalance, selectedAccountCurrency)}
                        {progress !== null && (
                          <span className="text-slate-300"> ({progress.toFixed(1)}%)</span>
                        )}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={handleCreateGoal}
            disabled={creating}
            className="w-full rounded bg-green-600 px-4 py-2 font-semibold text-white hover:bg-green-700 disabled:bg-slate-600"
          >
            {creating ? "Creando..." : "Crear Meta"}
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-slate-400 text-center py-8">Cargando metas...</div>
      ) : goals.length === 0 ? (
        <div className="text-center text-slate-400 py-8 bg-slate-700/50 border border-slate-600 rounded-lg">
          <p>No hay metas. Crea tu primera meta anual para empezar.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {goals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              onRefresh={fetchGoals}
              onError={setError}
            />
          ))}
        </div>
      )}
    </div>
  );
}
