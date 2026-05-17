import "server-only";

import { decryptText } from "@/lib/security/encryption";

// ─── Tipos compartidos ───────────────────────────────────────────────────────

export type MaybeNumber = number | string | null | undefined;

export type AccountLike = {
  role?: string | null;
};

export type JournalLike = {
  id?: string;
  mood?: string | null;
  tags?: string[] | null;
  content?: string | null;
  created_at?: string | null;
};

export type TradeLike = {
  id?: string;
  status?: string | null;
  pnl?: MaybeNumber;
  created_at?: string | null;
  exit_date?: string | null;
};

export type MoodOutcomeCorrelation = {
  highMoodAvgPnl: number | null;
  lowMoodAvgPnl: number | null;
  biasSignal: "positive" | "negative" | "neutral";
  correlationSampleSize: number;
};

export type ConstraintStatus = "ok" | "warning" | "critical";

export type ConstraintItem = {
  id: string;
  title: string;
  metric: string;
  target: string;
  status: ConstraintStatus;
  suggestion: string;
};

// ─── Constantes ──────────────────────────────────────────────────────────────

export const MOOD_SCORE_MAP: Record<string, number> = {
  terrible: 1,
  bad: 3,
  neutral: 5,
  good: 7,
  excellent: 9,
};

export const DAY_MS = 24 * 60 * 60 * 1000;

// ─── Primitivos puros ────────────────────────────────────────────────────────

/**
 * Coerce a MaybeNumber to a finite number, defaulting to 0 for invalid input.
 */
export const asNumber = (value: MaybeNumber): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

/**
 * Normalize trade status; anything other than "open" is treated as "closed".
 */
export const normalizeStatus = (value: string | null | undefined): "open" | "closed" => {
  const text = (value || "").trim().toLowerCase();
  return text === "open" ? "open" : "closed";
};

/**
 * Lowercase + trim string, empty for null/undefined.
 */
export const normalizeText = (value: string | null | undefined): string =>
  (value || "").trim().toLowerCase();

/**
 * Heuristic: classify an account as "propfirm" if the role or category name
 * contains common propfirm tokens; otherwise "real".
 */
export const classifyAccountType = (
  account: AccountLike,
  categoryName?: string | null
): "real" | "propfirm" => {
  const role = normalizeText(account.role);
  const category = normalizeText(categoryName);
  const source = `${role} ${category}`;

  if (
    source.includes("propfirm") ||
    source.includes("prop firm") ||
    source.includes("funded") ||
    source.includes("challenge")
  ) {
    return "propfirm";
  }

  return "real";
};

/**
 * True iff value is a parseable ISO date within the last `days` days.
 */
export const isWithinLastDays = (
  value: string | null | undefined,
  days: number
): boolean => {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() >= Date.now() - days * DAY_MS;
};

/**
 * Collapse whitespace and clamp to `max` characters, adding ellipsis if needed.
 */
export const shortText = (value: string, max = 180): string => {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1)}...`;
};

/**
 * Detect Postgres "relation does not exist" (42P01) errors so callers can
 * gracefully fall back to empty arrays during migrations.
 */
export const isMissingTableError = (error: unknown): boolean => {
  const maybe = error as { code?: string; message?: string } | null;
  return (
    maybe?.code === "42P01" ||
    (typeof maybe?.message === "string" &&
      maybe.message.toLowerCase().includes("does not exist"))
  );
};

// ─── Decryption + parsing (server-only) ──────────────────────────────────────

/**
 * Decrypt safely: returns "" for null/empty, original value if decrypt throws.
 */
export const safeDecrypt = (value: string | null | undefined): string => {
  if (!value) return "";
  try {
    return decryptText(value) || "";
  } catch {
    return value;
  }
};

export interface ParsedJournalContent {
  text: string;
  mood_score: number | null;
  action_items: string[];
  lessons_learned: string;
}

/**
 * Parse the encrypted JSON content of a journal entry. Returns sensible
 * defaults for any field that's missing or malformed.
 */
export const parseJournalContent = (
  value: string | null | undefined
): ParsedJournalContent => {
  const decrypted = safeDecrypt(value);
  if (!decrypted) {
    return { text: "", mood_score: null, action_items: [], lessons_learned: "" };
  }
  try {
    const parsed = JSON.parse(decrypted) as Record<string, unknown>;
    const text = typeof parsed.text === "string" ? parsed.text : decrypted;
    const moodScore =
      typeof parsed.mood_score === "number" && Number.isFinite(parsed.mood_score)
        ? parsed.mood_score
        : null;
    const actionItems = Array.isArray(parsed.action_items)
      ? parsed.action_items.filter(
          (item): item is string => typeof item === "string" && item.trim().length > 0
        )
      : [];
    const lessons =
      typeof parsed.lessons_learned === "string" ? parsed.lessons_learned : "";
    return {
      text,
      mood_score: moodScore,
      action_items: actionItems,
      lessons_learned: lessons,
    };
  } catch {
    return {
      text: decrypted,
      mood_score: null,
      action_items: [],
      lessons_learned: "",
    };
  }
};

// ─── Date helpers ────────────────────────────────────────────────────────────

/**
 * Extracts the date portion (YYYY-MM-DD) from an ISO datetime string.
 */
export const toDateKey = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

/**
 * Compute mood score for a journal entry, preferring the explicit mood_score
 * inside the encrypted content over the legacy `mood` enum column.
 */
export const scoreFromJournalEntry = (entry: JournalLike): number => {
  const parsed = parseJournalContent(entry.content);
  if (parsed.mood_score !== null) return parsed.mood_score;
  const moodText = normalizeText(entry.mood);
  return MOOD_SCORE_MAP[moodText] ?? 5;
};

// ─── Mood ↔ Outcome correlation ──────────────────────────────────────────────

/**
 * Computes the mood-outcome correlation for the last 30 days.
 *
 * For each day that has BOTH a journal entry with a mood score AND at least
 * one closed trade (by exit_date), computes the average PnL for high-mood
 * days (score >= 7) vs low-mood days (score <= 4).
 *
 * biasSignal:
 * - 'positive': high mood days have higher avg PnL (good mood → better trading)
 * - 'negative': high mood days have lower avg PnL (possible overconfidence)
 * - 'neutral': insufficient data (< 5 days with both) or difference < 10%
 */
export function computeMoodOutcomeCorrelation(
  journalEntries30d: JournalLike[],
  trades30d: TradeLike[],
  scoreFromEntry: (entry: JournalLike) => number = scoreFromJournalEntry
): MoodOutcomeCorrelation {
  const neutralResult: MoodOutcomeCorrelation = {
    highMoodAvgPnl: null,
    lowMoodAvgPnl: null,
    biasSignal: "neutral",
    correlationSampleSize: 0,
  };

  const moodByDate = new Map<string, number>();
  for (const entry of journalEntries30d) {
    const dateKey = toDateKey(entry.created_at);
    if (!dateKey) continue;
    const score = scoreFromEntry(entry);
    if (!moodByDate.has(dateKey)) {
      moodByDate.set(dateKey, score);
    }
  }

  const pnlByDate = new Map<string, { total: number; count: number }>();
  for (const trade of trades30d) {
    if (normalizeStatus(trade.status) !== "closed") continue;
    const dateKey = toDateKey(trade.exit_date || trade.created_at);
    if (!dateKey) continue;
    const pnl = asNumber(trade.pnl);
    const existing = pnlByDate.get(dateKey);
    if (existing) {
      existing.total += pnl;
      existing.count += 1;
    } else {
      pnlByDate.set(dateKey, { total: pnl, count: 1 });
    }
  }

  const highMoodPnls: number[] = [];
  const lowMoodPnls: number[] = [];
  let sampleSize = 0;

  for (const [dateKey, moodScore] of moodByDate) {
    const dayPnl = pnlByDate.get(dateKey);
    if (!dayPnl) continue;

    sampleSize += 1;
    const avgDayPnl = dayPnl.total / dayPnl.count;

    if (moodScore >= 7) highMoodPnls.push(avgDayPnl);
    else if (moodScore <= 4) lowMoodPnls.push(avgDayPnl);
    // Scores 5-6 are mid-range, excluded from buckets.
  }

  if (sampleSize < 5) return neutralResult;

  const highMoodAvgPnl =
    highMoodPnls.length > 0
      ? highMoodPnls.reduce((sum, v) => sum + v, 0) / highMoodPnls.length
      : null;
  const lowMoodAvgPnl =
    lowMoodPnls.length > 0
      ? lowMoodPnls.reduce((sum, v) => sum + v, 0) / lowMoodPnls.length
      : null;

  let biasSignal: "positive" | "negative" | "neutral" = "neutral";

  if (highMoodAvgPnl !== null && lowMoodAvgPnl !== null) {
    if (highMoodPnls.length >= 2 && lowMoodPnls.length >= 2) {
      const diff = highMoodAvgPnl - lowMoodAvgPnl;
      const avgMagnitude = (Math.abs(highMoodAvgPnl) + Math.abs(lowMoodAvgPnl)) / 2;
      if (avgMagnitude > 0 && Math.abs(diff) / avgMagnitude > 0.1) {
        biasSignal = diff > 0 ? "positive" : "negative";
      }
    }
  } else if (highMoodAvgPnl !== null && highMoodPnls.length >= 2) {
    biasSignal = highMoodAvgPnl > 0 ? "positive" : "neutral";
  } else if (lowMoodAvgPnl !== null && lowMoodPnls.length >= 2) {
    biasSignal = lowMoodAvgPnl < 0 ? "positive" : "neutral";
  }

  return {
    highMoodAvgPnl: highMoodAvgPnl !== null ? Math.round(highMoodAvgPnl * 100) / 100 : null,
    lowMoodAvgPnl: lowMoodAvgPnl !== null ? Math.round(lowMoodAvgPnl * 100) / 100 : null,
    biasSignal,
    correlationSampleSize: sampleSize,
  };
}

// ─── Constraint Monitor (pure) ───────────────────────────────────────────────

/**
 * Build the 4 hardcoded constraint items from already-fetched trade + journal
 * data. Pure function — separated from `getConstraintMonitorData` so it can be
 * unit-tested without mocking Supabase.
 */
export function buildConstraintItems(
  trades: TradeLike[],
  journalEntries: JournalLike[]
): ConstraintItem[] {
  const closed7d = trades.filter(
    (trade) =>
      normalizeStatus(trade.status) === "closed" &&
      isWithinLastDays(trade.exit_date || trade.created_at, 7)
  );
  const closed30d = trades.filter(
    (trade) =>
      normalizeStatus(trade.status) === "closed" &&
      isWithinLastDays(trade.exit_date || trade.created_at, 30)
  );

  const wins30d = closed30d.filter((trade) => asNumber(trade.pnl) > 0).length;
  const winRate30d = closed30d.length > 0 ? (wins30d / closed30d.length) * 100 : 0;
  const netPnl30d = closed30d.reduce((sum, trade) => sum + asNumber(trade.pnl), 0);
  const journal7d = journalEntries.filter((entry) =>
    isWithinLastDays(entry.created_at, 7)
  ).length;

  return [
    {
      id: "cadence",
      title: "Cadencia operativa",
      metric: `${closed7d.length} trades cerrados / 7 dias`,
      target: ">= 5 trades",
      status: closed7d.length >= 5 ? "ok" : closed7d.length >= 3 ? "warning" : "critical",
      suggestion: "Reserva bloques fijos de ejecucion y revision para sostener volumen.",
    },
    {
      id: "winrate",
      title: "Win rate reciente",
      metric: `${winRate30d.toFixed(1)}% en 30 dias`,
      target: ">= 45%",
      status: winRate30d >= 45 ? "ok" : winRate30d >= 35 ? "warning" : "critical",
      suggestion: "Revisa setups con mayor drawdown y reduce exposicion en los de menor edge.",
    },
    {
      id: "pnl",
      title: "PnL neto mensual",
      metric: `${netPnl30d.toFixed(2)} en 30 dias`,
      target: "> 0",
      status: netPnl30d > 0 ? "ok" : netPnl30d > -250 ? "warning" : "critical",
      suggestion: "Prioriza preservacion de capital hasta recuperar curva positiva.",
    },
    {
      id: "journal",
      title: "Disciplina de journaling",
      metric: `${journal7d} entradas / 7 dias`,
      target: ">= 3 entradas",
      status: journal7d >= 3 ? "ok" : journal7d >= 1 ? "warning" : "critical",
      suggestion: "Documenta contexto, sesgo y plan de mejora en cada sesion cerrada.",
    },
  ];
}

/**
 * Wraps a Supabase-style query that returns `{ data, error }` and returns
 * `data` (or fallback) instead of throwing for missing-table errors.
 */
export async function withFallback<T>(
  query: PromiseLike<{ data: T | null; error: unknown }>,
  fallback: T
): Promise<T> {
  const { data, error } = await query;
  if (error) {
    if (isMissingTableError(error)) return fallback;
    throw error;
  }
  return (data ?? fallback) as T;
}
