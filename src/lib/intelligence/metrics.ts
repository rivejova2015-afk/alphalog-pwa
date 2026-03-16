import "server-only";

import { createClient } from "@/lib/supabase/server";
import { decryptText } from "@/lib/security/encryption";

type MaybeNumber = number | string | null | undefined;

type AccountRow = {
  id: string;
  name: string;
  category_id: string | null;
  role: string | null;
  account_size: MaybeNumber;
  current_balance: MaybeNumber;
  currency: string | null;
};

type CategoryRow = {
  id: string;
  name: string | null;
};

type TradeRow = {
  id: string;
  account_id: string;
  status: string | null;
  pnl: MaybeNumber;
  created_at: string | null;
  exit_date: string | null;
};

type JournalRow = {
  id: string;
  mood: string | null;
  tags: string[] | null;
  content: string | null;
  created_at: string | null;
};

type WeeklyReportRow = {
  id: string;
  title: string | null;
  content_md: string | null;
  created_at: string | null;
};

type EvidenceRow = {
  id: string;
  title: string | null;
  report_text: string | null;
  created_at: string | null;
};

type TerminalEvidenceRow = {
  id: string;
  title: string | null;
  content: string | null;
  created_at: string | null;
};

export type InsightItem = {
  id: string;
  source: "weekly_report" | "trade_evidence" | "terminal_report" | "journal";
  title: string;
  summary: string;
  createdAt: string | null;
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

export type CapitalLevelsData = {
  authenticated: boolean;
  totalAccounts: number;
  totalCapital: number;
  totalBalance: number;
  closedTrades30d: number;
  netPnl30d: number;
  winRate30d: number;
  reports30d: number;
  evidence30d: number;
  capitalByType: {
    real: {
      totalAccounts: number;
      totalCapital: number;
      totalBalance: number;
      closedTrades30d: number;
      netPnl30d: number;
      winRate30d: number;
    };
    propfirm: {
      totalAccounts: number;
      totalCapital: number;
      totalBalance: number;
      closedTrades30d: number;
      netPnl30d: number;
      winRate30d: number;
    };
  };
  topAccounts: Array<{
    id: string;
    name: string;
    balance: number;
    capital: number;
    pnl30d: number;
    currency: string;
  }>;
};

export type ConstraintSolverData = {
  authenticated: boolean;
  constraints: ConstraintItem[];
  blockedCount: number;
};

export type MoodOutcomeCorrelation = {
  highMoodAvgPnl: number | null;
  lowMoodAvgPnl: number | null;
  biasSignal: "positive" | "negative" | "neutral";
  correlationSampleSize: number;
};

export type MindOpsData = {
  authenticated: boolean;
  entries7d: number;
  entries30d: number;
  moodScore7d: number;
  moodScore30d: number;
  topTags: Array<{ tag: string; count: number }>;
  actionItems: string[];
  moodBreakdown: Array<{ mood: string; count: number }>;
  moodOutcomeCorrelation: MoodOutcomeCorrelation;
};

export type KnowledgeFactoryData = {
  authenticated: boolean;
  reports30d: number;
  evidence30d: number;
  journalLessons30d: number;
  insights: InsightItem[];
};

const MOOD_SCORE_MAP: Record<string, number> = {
  terrible: 1,
  bad: 3,
  neutral: 5,
  good: 7,
  excellent: 9,
};

const DAY_MS = 24 * 60 * 60 * 1000;

const asNumber = (value: MaybeNumber): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const normalizeStatus = (value: string | null | undefined): "open" | "closed" => {
  const text = (value || "").trim().toLowerCase();
  return text === "open" ? "open" : "closed";
};

const normalizeText = (value: string | null | undefined) =>
  (value || "").trim().toLowerCase();

const classifyAccountType = (account: AccountRow, categoryName?: string | null): "real" | "propfirm" => {
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

const isWithinLastDays = (value: string | null | undefined, days: number) => {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() >= Date.now() - days * DAY_MS;
};

const shortText = (value: string, max = 180) => {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1)}...`;
};

const isMissingTableError = (error: unknown) => {
  const maybe = error as { code?: string; message?: string } | null;
  return (
    maybe?.code === "42P01" ||
    (typeof maybe?.message === "string" &&
      maybe.message.toLowerCase().includes("does not exist"))
  );
};

const safeDecrypt = (value: string | null | undefined) => {
  if (!value) return "";
  try {
    return decryptText(value) || "";
  } catch {
    return value;
  }
};

const parseJournalContent = (value: string | null | undefined) => {
  const decrypted = safeDecrypt(value);
  if (!decrypted) {
    return {
      text: "",
      mood_score: null as number | null,
      action_items: [] as string[],
      lessons_learned: "",
    };
  }
  try {
    const parsed = JSON.parse(decrypted) as Record<string, unknown>;
    const text = typeof parsed.text === "string" ? parsed.text : decrypted;
    const moodScore =
      typeof parsed.mood_score === "number" && Number.isFinite(parsed.mood_score)
        ? parsed.mood_score
        : null;
    const actionItems = Array.isArray(parsed.action_items)
      ? parsed.action_items.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
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
      mood_score: null as number | null,
      action_items: [] as string[],
      lessons_learned: "",
    };
  }
};

const withFallback = async <T>(
  query: PromiseLike<{ data: T | null; error: unknown }>,
  fallback: T
): Promise<T> => {
  const { data, error } = await query;
  if (error) {
    if (isMissingTableError(error)) return fallback;
    throw error;
  }
  return (data ?? fallback) as T;
};

async function getAuthenticatedClient() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    return { supabase, userId: null as string | null };
  }
  return { supabase, userId: data.user.id };
}

async function getBaseRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
) {
  const [accounts, categories, trades, journalEntries] = await Promise.all([
    withFallback(
      supabase
        .from("accounts")
        .select("id, name, category_id, role, account_size, current_balance, currency")
        .eq("user_id", userId)
        .is("deleted_at", null),
      [] as AccountRow[]
    ),
    withFallback(
      supabase
        .from("account_categories")
        .select("id, name")
        .eq("user_id", userId)
        .is("deleted_at", null),
      [] as CategoryRow[]
    ),
    withFallback(
      supabase
        .from("trades")
        .select("id, account_id, status, pnl, created_at, exit_date")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(1000),
      [] as TradeRow[]
    ),
    withFallback(
      supabase
        .from("journal_entries")
        .select("id, mood, tags, content, created_at")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(200),
      [] as JournalRow[]
    ),
  ]);

  return { supabase, accounts, categories, trades, journalEntries };
}

/**
 * Extracts the date portion (YYYY-MM-DD) from an ISO datetime string.
 */
const toDateKey = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

/**
 * Computes the mood-outcome correlation for the last 30 days.
 *
 * For each day that has BOTH a journal entry with a mood score AND at least
 * one closed trade (by exit_date), it computes the average PnL for high-mood
 * days (score >= 7) vs low-mood days (score <= 4).
 *
 * The biasSignal indicates whether high mood correlates with better or worse
 * trading performance:
 * - 'positive': high mood days have higher avg PnL (good mood = better trading)
 * - 'negative': high mood days have lower avg PnL (possible overconfidence)
 * - 'neutral': insufficient data (< 5 days with both) or difference < 10%
 */
function computeMoodOutcomeCorrelation(
  journalEntries30d: JournalRow[],
  trades30d: TradeRow[],
  scoreFromEntry: (entry: JournalRow) => number
): MoodOutcomeCorrelation {
  const neutralResult: MoodOutcomeCorrelation = {
    highMoodAvgPnl: null,
    lowMoodAvgPnl: null,
    biasSignal: "neutral",
    correlationSampleSize: 0,
  };

  // Group journal entries by date, using the best mood score per day
  const moodByDate = new Map<string, number>();
  for (const entry of journalEntries30d) {
    const dateKey = toDateKey(entry.created_at);
    if (!dateKey) continue;
    const score = scoreFromEntry(entry);
    const existing = moodByDate.get(dateKey);
    // If multiple entries in a day, keep the latest (first in desc order from query)
    if (existing === undefined) {
      moodByDate.set(dateKey, score);
    }
  }

  // Group closed trades by exit_date, computing avg PnL per day
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

  // Find days with BOTH mood and trades
  const highMoodPnls: number[] = [];
  const lowMoodPnls: number[] = [];
  let sampleSize = 0;

  for (const [dateKey, moodScore] of moodByDate) {
    const dayPnl = pnlByDate.get(dateKey);
    if (!dayPnl) continue;

    sampleSize += 1;
    const avgDayPnl = dayPnl.total / dayPnl.count;

    if (moodScore >= 7) {
      highMoodPnls.push(avgDayPnl);
    } else if (moodScore <= 4) {
      lowMoodPnls.push(avgDayPnl);
    }
    // Scores 5-6 are "mid-range" and excluded from high/low buckets
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

  // Determine bias signal
  let biasSignal: "positive" | "negative" | "neutral" = "neutral";

  if (highMoodAvgPnl !== null && lowMoodAvgPnl !== null) {
    // Need at least 2 days in each bucket for a meaningful signal
    if (highMoodPnls.length >= 2 && lowMoodPnls.length >= 2) {
      const diff = highMoodAvgPnl - lowMoodAvgPnl;
      const avgMagnitude = (Math.abs(highMoodAvgPnl) + Math.abs(lowMoodAvgPnl)) / 2;
      // Only signal if the difference is > 10% of the average magnitude
      if (avgMagnitude > 0 && Math.abs(diff) / avgMagnitude > 0.1) {
        biasSignal = diff > 0 ? "positive" : "negative";
      }
    }
  } else if (highMoodAvgPnl !== null && highMoodPnls.length >= 2) {
    // Only high mood data available
    biasSignal = highMoodAvgPnl > 0 ? "positive" : "neutral";
  } else if (lowMoodAvgPnl !== null && lowMoodPnls.length >= 2) {
    // Only low mood data available
    biasSignal = lowMoodAvgPnl < 0 ? "positive" : "neutral";
  }

  return {
    highMoodAvgPnl: highMoodAvgPnl !== null ? Math.round(highMoodAvgPnl * 100) / 100 : null,
    lowMoodAvgPnl: lowMoodAvgPnl !== null ? Math.round(lowMoodAvgPnl * 100) / 100 : null,
    biasSignal,
    correlationSampleSize: sampleSize,
  };
}

export async function getCapitalLevelsData(): Promise<CapitalLevelsData> {
  const { supabase, userId } = await getAuthenticatedClient();
  if (!userId) {
    return {
      authenticated: false,
      totalAccounts: 0,
      totalCapital: 0,
      totalBalance: 0,
      closedTrades30d: 0,
      netPnl30d: 0,
      winRate30d: 0,
      reports30d: 0,
      evidence30d: 0,
      capitalByType: {
        real: {
          totalAccounts: 0,
          totalCapital: 0,
          totalBalance: 0,
          closedTrades30d: 0,
          netPnl30d: 0,
          winRate30d: 0,
        },
        propfirm: {
          totalAccounts: 0,
          totalCapital: 0,
          totalBalance: 0,
          closedTrades30d: 0,
          netPnl30d: 0,
          winRate30d: 0,
        },
      },
      topAccounts: [],
    };
  }

  const { accounts, categories, trades } = await getBaseRows(supabase, userId);
  const categoryById = new Map<string, string>();
  categories.forEach((category) => {
    if (category.name) {
      categoryById.set(category.id, category.name);
    }
  });

  const accountTypeById = new Map<string, "real" | "propfirm">();
  accounts.forEach((account) => {
    accountTypeById.set(
      account.id,
      classifyAccountType(account, account.category_id ? categoryById.get(account.category_id) : null)
    );
  });

  const trades30d = trades.filter(
    (trade) =>
      normalizeStatus(trade.status) === "closed" &&
      isWithinLastDays(trade.exit_date || trade.created_at, 30)
  );

  const closedTrades30d = trades30d.length;
  const wins = trades30d.filter((trade) => asNumber(trade.pnl) > 0).length;
  const netPnl30d = trades30d.reduce((sum, trade) => sum + asNumber(trade.pnl), 0);
  const winRate30d = closedTrades30d > 0 ? (wins / closedTrades30d) * 100 : 0;

  const pnlByAccount = new Map<string, number>();
  trades30d.forEach((trade) => {
    const current = pnlByAccount.get(trade.account_id) || 0;
    pnlByAccount.set(trade.account_id, current + asNumber(trade.pnl));
  });

  const totalCapital = accounts.reduce((sum, account) => sum + asNumber(account.account_size), 0);
  const totalBalance = accounts.reduce((sum, account) => sum + asNumber(account.current_balance), 0);

  const calculateByType = (type: "real" | "propfirm") => {
    const filteredAccounts = accounts.filter((account) => accountTypeById.get(account.id) === type);
    const accountIds = new Set(filteredAccounts.map((account) => account.id));
    const filteredTrades = trades30d.filter((trade) => accountIds.has(trade.account_id));
    const winsByType = filteredTrades.filter((trade) => asNumber(trade.pnl) > 0).length;
    const netPnlByType = filteredTrades.reduce((sum, trade) => sum + asNumber(trade.pnl), 0);

    return {
      totalAccounts: filteredAccounts.length,
      totalCapital: filteredAccounts.reduce((sum, account) => sum + asNumber(account.account_size), 0),
      totalBalance: filteredAccounts.reduce((sum, account) => sum + asNumber(account.current_balance), 0),
      closedTrades30d: filteredTrades.length,
      netPnl30d: netPnlByType,
      winRate30d: filteredTrades.length > 0 ? (winsByType / filteredTrades.length) * 100 : 0,
    };
  };

  const capitalByType = {
    real: calculateByType("real"),
    propfirm: calculateByType("propfirm"),
  };

  const topAccounts = accounts
    .map((account) => ({
      id: account.id,
      name: account.name || "Cuenta sin nombre",
      balance: asNumber(account.current_balance),
      capital: asNumber(account.account_size),
      pnl30d: pnlByAccount.get(account.id) || 0,
      currency: account.currency || "USD",
    }))
    .sort((left, right) => right.balance - left.balance)
    .slice(0, 5);

  const [weeklyReports30d, tradeEvidence30d] = await Promise.all([
    supabase
      .from("weekly_reports")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("deleted_at", null)
      .gte("created_at", new Date(Date.now() - 30 * DAY_MS).toISOString()),
    supabase
      .from("trade_evidence")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("deleted_at", null)
      .gte("created_at", new Date(Date.now() - 30 * DAY_MS).toISOString()),
  ]);

  if (weeklyReports30d.error && !isMissingTableError(weeklyReports30d.error)) {
    throw weeklyReports30d.error;
  }
  if (tradeEvidence30d.error && !isMissingTableError(tradeEvidence30d.error)) {
    throw tradeEvidence30d.error;
  }

  const weeklyReportsCount = weeklyReports30d.error ? 0 : weeklyReports30d.count || 0;
  const tradeEvidenceCount = tradeEvidence30d.error ? 0 : tradeEvidence30d.count || 0;

  return {
    authenticated: true,
    totalAccounts: accounts.length,
    totalCapital,
    totalBalance,
    closedTrades30d,
    netPnl30d,
    winRate30d,
    reports30d: weeklyReportsCount,
    evidence30d: tradeEvidenceCount,
    capitalByType,
    topAccounts,
  };
}

export async function getConstraintSolverData(): Promise<ConstraintSolverData> {
  const { supabase, userId } = await getAuthenticatedClient();
  if (!userId) return { authenticated: false, constraints: [], blockedCount: 0 };

  const { trades, journalEntries } = await getBaseRows(supabase, userId);

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
  const journal7d = journalEntries.filter((entry) => isWithinLastDays(entry.created_at, 7)).length;

  const constraints: ConstraintItem[] = [
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

  return {
    authenticated: true,
    constraints,
    blockedCount: constraints.filter((item) => item.status === "critical").length,
  };
}

export async function getMindOpsData(): Promise<MindOpsData> {
  const { supabase, userId } = await getAuthenticatedClient();
  if (!userId) {
    return {
      authenticated: false,
      entries7d: 0,
      entries30d: 0,
      moodScore7d: 0,
      moodScore30d: 0,
      topTags: [],
      actionItems: [],
      moodBreakdown: [],
      moodOutcomeCorrelation: {
        highMoodAvgPnl: null,
        lowMoodAvgPnl: null,
        biasSignal: "neutral",
        correlationSampleSize: 0,
      },
    };
  }

  const { journalEntries, trades } = await getBaseRows(supabase, userId);

  const entries7dRows = journalEntries.filter((entry) => isWithinLastDays(entry.created_at, 7));
  const entries30dRows = journalEntries.filter((entry) => isWithinLastDays(entry.created_at, 30));

  const scoreFromEntry = (entry: JournalRow) => {
    const parsed = parseJournalContent(entry.content);
    if (typeof parsed.mood_score === "number" && Number.isFinite(parsed.mood_score)) {
      return parsed.mood_score;
    }
    const moodKey = (entry.mood || "").toLowerCase();
    return MOOD_SCORE_MAP[moodKey] ?? 5;
  };

  const average = (items: JournalRow[]) => {
    if (items.length === 0) return 0;
    const total = items.reduce((sum, entry) => sum + scoreFromEntry(entry), 0);
    return total / items.length;
  };

  const tagCounts = new Map<string, number>();
  entries30dRows.forEach((entry) => {
    (entry.tags || []).forEach((tag: string) => {
      const normalized = tag.trim().toLowerCase();
      if (!normalized) return;
      tagCounts.set(normalized, (tagCounts.get(normalized) || 0) + 1);
    });
  });

  const actionItems = entries30dRows
    .flatMap((entry) => parseJournalContent(entry.content).action_items || [])
    .filter((item, index, source) => source.indexOf(item) === index)
    .slice(0, 6);

  const moodCounts = new Map<string, number>();
  entries30dRows.forEach((entry) => {
    const mood = (entry.mood || "neutral").toLowerCase();
    moodCounts.set(mood, (moodCounts.get(mood) || 0) + 1);
  });

  // Compute mood-outcome correlation using 30d journal entries and trades
  const trades30d = trades.filter(
    (trade) => isWithinLastDays(trade.exit_date || trade.created_at, 30)
  );

  const moodOutcomeCorrelation = computeMoodOutcomeCorrelation(
    entries30dRows,
    trades30d,
    scoreFromEntry
  );

  return {
    authenticated: true,
    entries7d: entries7dRows.length,
    entries30d: entries30dRows.length,
    moodScore7d: average(entries7dRows),
    moodScore30d: average(entries30dRows),
    topTags: Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 8),
    actionItems,
    moodBreakdown: Array.from(moodCounts.entries())
      .map(([mood, count]) => ({ mood, count }))
      .sort((left, right) => right.count - left.count),
    moodOutcomeCorrelation,
  };
}

export async function getKnowledgeFactoryData(): Promise<KnowledgeFactoryData> {
  const { supabase, userId } = await getAuthenticatedClient();
  if (!userId) {
    return {
      authenticated: false,
      reports30d: 0,
      evidence30d: 0,
      journalLessons30d: 0,
      insights: [],
    };
  }

  const since = new Date(Date.now() - 30 * DAY_MS).toISOString();

  const [weeklyReports, tradeEvidence, terminalReports, journalEntries] = await Promise.all([
    withFallback(
      supabase
        .from("weekly_reports")
        .select("id, title, content_md, created_at")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(8),
      [] as WeeklyReportRow[]
    ),
    withFallback(
      supabase
        .from("trade_evidence")
        .select("id, title, report_text, created_at")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(8),
      [] as EvidenceRow[]
    ),
    withFallback(
      supabase
        .from("terminal_evidence_reports")
        .select("id, title, content, created_at")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(8),
      [] as TerminalEvidenceRow[]
    ),
    withFallback(
      supabase
        .from("journal_entries")
        .select("id, content, created_at")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(20),
      [] as Array<{ id: string; content: string | null; created_at: string | null }>
    ),
  ]);

  const journalLessons = journalEntries
    .map((entry) => ({
      id: entry.id,
      createdAt: entry.created_at,
      lessons: parseJournalContent(entry.content).lessons_learned || "",
      text: parseJournalContent(entry.content).text || "",
    }))
    .filter((entry) => entry.lessons.trim().length > 0 || entry.text.trim().length > 0);

  const insights: InsightItem[] = [
    ...weeklyReports.map((report) => ({
      id: report.id,
      source: "weekly_report" as const,
      title: report.title || "Weekly report",
      summary: shortText(safeDecrypt(report.content_md)),
      createdAt: report.created_at,
    })),
    ...tradeEvidence.map((item) => ({
      id: item.id,
      source: "trade_evidence" as const,
      title: item.title || "Trade evidence",
      summary: shortText(item.report_text || "No details"),
      createdAt: item.created_at,
    })),
    ...terminalReports.map((item) => ({
      id: item.id,
      source: "terminal_report" as const,
      title: item.title || "Terminal report",
      summary: shortText(item.content || "No details"),
      createdAt: item.created_at,
    })),
    ...journalLessons.map((item) => ({
      id: item.id,
      source: "journal" as const,
      title: "Journal learning",
      summary: shortText(item.lessons || item.text || "No details"),
      createdAt: item.createdAt,
    })),
  ]
    .filter((item) => item.summary.trim().length > 0)
    .sort((left, right) => {
      const leftDate = left.createdAt ? new Date(left.createdAt).getTime() : 0;
      const rightDate = right.createdAt ? new Date(right.createdAt).getTime() : 0;
      return rightDate - leftDate;
    })
    .slice(0, 10);

  return {
    authenticated: true,
    reports30d: weeklyReports.length + terminalReports.length,
    evidence30d: tradeEvidence.length,
    journalLessons30d: journalLessons.length,
    insights,
  };
}
