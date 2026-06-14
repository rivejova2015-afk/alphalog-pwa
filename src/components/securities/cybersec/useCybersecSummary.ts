"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  XpResult, ProgressStats, Achievement, Milestone, StreakResult,
} from "@/lib/securities/cybersec";

export interface CybersecSummary {
  xp: XpResult;
  stats: ProgressStats;
  achievements: Achievement[];
  streak: StreakResult;
  xpToday: number;
  dailyGoal: number;
  notifyStreak: boolean;
  placementDone: boolean;
  sectionExams: Record<string, { bestPct: number; passed: boolean }>;
  milestones: Milestone[];
  mastery: Record<number, number>;
}

// Single aggregated read of the gamification layer (server-computed). Used by the
// progress hub, the path and the achievements page, replacing the per-page
// 4-fetch + client-compute pattern.
export function useCybersecSummary() {
  const [summary, setSummary] = useState<CybersecSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/securities/cybersec/summary");
        if (res.ok && !cancelled) setSummary((await res.json()) as CybersecSummary);
      } catch {
        // silent — leaves summary null
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const updateGoal = useCallback(async (goal: number) => {
    setSummary((s) => (s ? { ...s, dailyGoal: goal } : s)); // optimistic
    try {
      await fetch("/api/securities/cybersec/user-state", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ daily_goal: goal }),
      });
    } catch {
      // optimistic only; next load reconciles
    }
  }, []);

  const updateNotify = useCallback(async (on: boolean) => {
    setSummary((s) => (s ? { ...s, notifyStreak: on } : s)); // optimistic
    try {
      await fetch("/api/securities/cybersec/user-state", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notify_streak: on }),
      });
    } catch {
      // optimistic only
    }
  }, []);

  return { summary, loading, updateGoal, updateNotify };
}
