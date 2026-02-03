// src/components/tradermap/GoalsPanel.client.tsx
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import GoalCard from "./GoalCard.client";
import { createClient } from "@/lib/supabase/browser";
import { logger } from "@/lib/alphashield/logger";

interface Account {
  id: string;
  name: string;
  currency?: string;
}

interface GoalQuarter {
  id: string;
  goal_id: string;
  quarter: number; // 1-4
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
  active_quarter: number;
  sort_index: number;
  quarters: GoalQuarter[];
  account?: Account;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface GoalForm {
  title: string;
  accountId: string;
  year: number;
}

export default function GoalsPanel() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const realtimeLock = useRef(false);

  const [formData, setFormData] = useState<GoalForm>({
    title: "",
    accountId: "",
    year: new Date().getFullYear(),
  });

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
    } catch (err: any) {
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
    fetchAccounts();
    fetchGoals();
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
      channels.forEach((ch) => {
        try {
          supabase.removeChannel(ch);
        } catch {}
      });
    };
  }, [fetchGoals]);

  const handleCreateGoal = async () => {
    try {
      if (!formData.title.trim()) {
        setError("Título es requerido");
        return;
      }

      if (!formData.accountId) {
        setError("Selecciona una cuenta");
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
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create goal");
      }

      await fetchGoals();
      setFormData({
        title: "",
        accountId: "",
        year: new Date().getFullYear(),
      });
      setShowForm(false);
    } catch (err: any) {
      await logger.error(
        "tradermap",
        "Error creating goal",
        err instanceof Error ? err : undefined
      );
      setError(err.message || "Error al crear meta");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">🎯 Metas Anuales</h2>
        <button
          onClick={() => {
            setShowForm(!showForm);
            setEditingGoal(null);
          }}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold"
        >
          {showForm ? "Cancelar" : "+ Nueva Meta"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-4 bg-red-900/20 border border-red-700 text-red-200 rounded">
          {error}
        </div>
      )}

      {/* Create Form */}
      {showForm && (
        <div className="mb-6 p-6 bg-slate-700/50 border border-slate-600 rounded-lg">
          <h3 className="text-lg font-semibold text-white mb-4">Nueva Meta</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Título *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Ej: Alcanzar $10k con ruta SAFE"
                className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white placeholder-slate-400"
              />
            </div>

            {/* Account */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Cuenta *
              </label>
              <select
                value={formData.accountId}
                onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
                className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white"
              >
                <option value="">Selecciona una cuenta...</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Year */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Año
              </label>
              <select
                value={formData.year}
                onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white"
              >
                {[2024, 2025, 2026].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Create Button */}
          <button
            onClick={handleCreateGoal}
            disabled={creating}
            className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 text-white rounded font-semibold"
          >
            {creating ? "Creando..." : "Crear Meta"}
          </button>
        </div>
      )}

      {/* Goals List */}
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
