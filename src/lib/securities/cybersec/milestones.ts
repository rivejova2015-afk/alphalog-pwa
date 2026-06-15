// Detecta "hitos recién logrados" comparando un snapshot anterior (persistido en
// localStorage) con el actual, para disparar una celebración. Puro → testeable.

import type { ProgressContent } from "./progressStats";
import { computeProgress } from "./progressStats";
import { computeXp, type XpData } from "./xp";
import { computeAchievements } from "./achievements";
import { streakWithFreeze, activityDays } from "./habit";

export interface MilestoneSnapshot {
  level: number;
  crowns: number; // suma de coronas de maestría de todos los módulos
  earned: string[]; // ids de logros desbloqueados
  examPassed: boolean;
}

export type MilestoneKind = "level" | "crown" | "achievement" | "exam";

export interface Milestone {
  kind: MilestoneKind;
  title: string;
  detail: string;
}

export function buildSnapshot(
  level: number,
  mastery: Record<number, number>,
  earned: string[],
  examPassed: boolean,
): MilestoneSnapshot {
  const crowns = Object.values(mastery).reduce((a, b) => a + b, 0);
  return { level, crowns, earned: [...earned].sort(), examPassed };
}

export function detectMilestones(
  prev: MilestoneSnapshot | null,
  next: MilestoneSnapshot,
  names: Record<string, string> = {},
): Milestone[] {
  if (!prev) return []; // primera carga: solo se fija la baseline, no se celebra
  const out: Milestone[] = [];

  if (next.level > prev.level) {
    out.push({ kind: "level", title: `¡Nivel ${next.level}!`, detail: "Subiste de nivel" });
  }
  if (next.crowns > prev.crowns) {
    const d = next.crowns - prev.crowns;
    out.push({ kind: "crown", title: d === 1 ? "¡Nueva corona!" : `¡${d} coronas nuevas!`, detail: "Ganaste maestría" });
  }
  const prevSet = new Set(prev.earned);
  for (const id of next.earned) {
    if (!prevSet.has(id)) out.push({ kind: "achievement", title: "¡Logro desbloqueado!", detail: names[id] ?? id });
  }
  if (!prev.examPassed && next.examPassed) {
    out.push({ kind: "exam", title: "¡Graduado!", detail: "Aprobaste el examen final" });
  }
  return out;
}

// Builds the canonical snapshot + achievement names from raw data, so every page
// that celebrates produces an identical snapshot (no drift across the shared key).
export function snapshotFromData(content: ProgressContent, data: XpData): { snapshot: MilestoneSnapshot; names: Record<string, string> } {
  const xp = computeXp(content, data);
  const stats = computeProgress(content, data);
  const streak = streakWithFreeze(activityDays(data)).streak;
  const ach = computeAchievements(content, data, xp, stats, streak);
  const earned = ach.filter((a) => a.earned).map((a) => a.id);
  const names = Object.fromEntries(ach.map((a) => [a.id, a.name]));
  return { snapshot: buildSnapshot(xp.level.level, xp.mastery, earned, stats.examPassed), names };
}
