// src/components/tradermap/GoalCard.client.tsx
"use client";

import { useState, useCallback } from "react";
import QuarterEditor from "./QuarterEditor.client";

interface Account {
  id: string;
  name: string;
}

interface GoalQuarter {
  id: string;
  goal_id: string;
  quarter: number;
  start_date: string;
  end_date: string;
  start_balance: number;
  target_balance: number;
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

interface GoalCardProps {
  goal: Goal;
  onRefresh: () => Promise<void>;
  onError: (error: string) => void;
}

export default function GoalCard({ goal, onRefresh, onError }: GoalCardProps) {
  const [editingQuarterId, setEditingQuarterId] = useState<string | null>(null);
  const [completingQuarter, setCompletingQuarter] = useState(false);

  // Sort quarters by quarter number
  const sortedQuarters = [...(goal.quarters || [])].sort((a, b) => a.quarter - b.quarter);

  const handleCompleteQuarter = async (quarter: GoalQuarter) => {
    try {
      setCompletingQuarter(true);
      onError("");

      const response = await fetch(`/api/tradermap/quarters/${quarter.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          completed_at: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to complete quarter");
      }

      await onRefresh();
    } catch (err: any) {
      console.error("Error completing quarter:", err);
      onError(err.message || "Error al completar trimestre");
    } finally {
      setCompletingQuarter(false);
    }
  };

  // Calculate goal progress percentage
  const calculateGoalProgress = () => {
    const completedQuarters = sortedQuarters.filter((q) => q.completed_at).length;
    return Math.round((completedQuarters / 4) * 100);
  };

  const goalProgress = calculateGoalProgress();

  return (
    <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-lg font-bold text-white">{goal.title}</h3>
            <p className="text-sm text-slate-400 mt-1">
              {goal.account?.name} • {goal.year}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-blue-400">{goalProgress}%</p>
            <p className="text-xs text-slate-400">completado</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="relative w-full h-2 bg-slate-600 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-green-500 to-blue-500 transition-all duration-300"
            style={{ width: `${goalProgress}%` }}
          />
        </div>
      </div>

      {/* Quarters Grid */}
      <div className="space-y-4">
        {sortedQuarters.map((quarter) => (
          <div key={quarter.id}>
            {editingQuarterId === quarter.id ? (
              <QuarterEditor
                quarter={quarter}
                onSave={async () => {
                  setEditingQuarterId(null);
                  await onRefresh();
                }}
                onCancel={() => setEditingQuarterId(null)}
                onError={onError}
              />
            ) : (
              <div className="bg-slate-800/50 border border-slate-600 rounded p-4">
                {/* Quarter Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-700 border border-slate-500">
                      <span className="text-sm font-bold text-slate-300">Q{quarter.quarter}</span>
                    </span>
                    <span className="text-sm text-slate-400">
                      {new Date(quarter.start_date).toLocaleDateString("es-ES", {
                        month: "short",
                        day: "numeric",
                      })}{" "}
                      -{" "}
                      {new Date(quarter.end_date).toLocaleDateString("es-ES", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                  {quarter.completed_at && (
                    <span className="text-sm text-green-400">✅ Completado</span>
                  )}
                </div>

                {/* Quarter Details */}
                <div className="grid grid-cols-3 gap-2 text-xs text-slate-400 mb-3">
                  <div>
                    <p className="text-slate-500">Balance Inicial</p>
                    <p className="text-white font-semibold">
                      ${quarter.start_balance.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Meta</p>
                    <p className="text-white font-semibold">
                      ${quarter.target_balance.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Necesario</p>
                    <p className="text-white font-semibold">
                      ${(quarter.target_balance - quarter.start_balance).toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingQuarterId(quarter.id)}
                    className="flex-1 px-3 py-1 bg-slate-700 hover:bg-slate-600 text-xs text-slate-300 rounded"
                  >
                    Editar
                  </button>
                  {!quarter.completed_at && (
                    <button
                      onClick={() => handleCompleteQuarter(quarter)}
                      disabled={completingQuarter}
                      className="flex-1 px-3 py-1 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 text-xs text-white rounded"
                    >
                      {completingQuarter ? "..." : "Completar"}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
