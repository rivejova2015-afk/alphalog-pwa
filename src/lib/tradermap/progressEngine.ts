import type { SupabaseClient } from "@supabase/supabase-js";
import { XP_VALUES } from "./xpConfig";

export type ProgressMetricMap = {
  closed_trades: number;
  satellite_trades: number;
  winrate: number;
  consistency_score: number;
  confidence_score: number;
  streak_days: number;
  integrity_score: number;
  drawdown_score: number;
  flow_score: number;
  precision_score: number;
  resilience_score: number;
  capital_score: number;
  discipline_score: number;
  mastery_score: number;
  sustain_score: number;
  validation_score: number;
};

export type ProgressLevelDef = {
  level: number;
  title: string;
  subtitle: string | null;
  is_boss: boolean;
  missions_json: Array<{
    id: string;
    label: string;
    metric: keyof ProgressMetricMap | string;
    threshold_key: string;
    operator: ">=" | ">" | "<=" | "<";
  }>;
  rewards_json: Record<string, unknown> | null;
};

export type ProgressMapConfig = {
  id: string;
  user_id: string;
  core_account_id: string | null;
  satellite_account_ids: string[];
  applied_at: string;
  version_int: number;
};

export type ProgressMapState = {
  user_id: string;
  config_version_int: number;
  current_level: number;
  xp_total: number;
  map_heat_state: string | null;
  fail_safe_active: boolean;
  rebuild_active: boolean;
};

export type ProgressLevelState = {
  id?: string;
  user_id: string;
  config_version_int: number;
  level: number;
  status: "locked" | "active" | "completed" | "fail_safe" | "rebuild";
  progress_pct: number;
  milestones_json: Record<string, boolean>;
};

export type ProgressThresholdRow = {
  key: string;
  value_numeric: number | null;
  value_json: Record<string, unknown> | null;
};

export type ProgressMapResult = {
  config: ProgressMapConfig | null;
  mapState: ProgressMapState | null;
  levels: ProgressLevelDef[];
  levelStates: ProgressLevelState[];
  thresholdsRequired: boolean;
  missingThresholdKeys: string[];
  metrics: ProgressMetricMap | null;
  widgets: Record<string, unknown> | null;
  recoveryActive: boolean;
  rebuildActive: boolean;
  failSafeActive: boolean;
  pendingSyncCount: number;
  setupRequired: boolean;
};

const GLOBAL_THRESHOLD_KEYS = [
  "recovery_streak_min",
  "recovery_consistency_min",
  "rebuild_consistency_min",
];

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const toNumber = (value: unknown, fallback = 0) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
};

const normalizeAccountIds = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map(String).filter(Boolean);
  }
  return [];
};

const toDateOnly = (value: string) => value.slice(0, 10);

const countStreakDays = (dates: string[]): number => {
  if (dates.length === 0) return 0;
  const unique = Array.from(new Set(dates)).sort().reverse();
  let streak = 1;
  for (let i = 1; i < unique.length; i += 1) {
    const prev = new Date(unique[i - 1]);
    const next = new Date(unique[i]);
    const diff = (prev.getTime() - next.getTime()) / (1000 * 60 * 60 * 24);
    if (diff === 1) {
      streak += 1;
    } else {
      break;
    }
  }
  return streak;
};

const computeMetrics = (trades: Array<Record<string, unknown>>, appliedAt: string) => {
  const closedTrades = trades.filter((trade) => trade.exit_date);
  const totalClosed = closedTrades.length;
  const wins = closedTrades.filter((trade) => toNumber(trade.pnl) > 0).length;
  const winrate = totalClosed > 0 ? (wins / totalClosed) * 100 : 0;

  const appliedDate = new Date(appliedAt);
  const daysSinceApplied = Math.max(
    1,
    Math.ceil((Date.now() - appliedDate.getTime()) / (1000 * 60 * 60 * 24))
  );
  const tradesPerDay = totalClosed / daysSinceApplied;

  const streakDates = closedTrades
    .map((trade) => trade.exit_date as string)
    .filter(Boolean)
    .map(toDateOnly);
  const streakDays = countStreakDays(streakDates);

  const consistencyScore = clamp(winrate * 0.6 + Math.min(100, tradesPerDay * 10) * 0.4, 0, 100);
  const confidenceScore = clamp((winrate + consistencyScore + streakDays * 2) / 3, 0, 100);
  const totalPnl = trades.reduce((sum, trade) => sum + toNumber(trade.pnl), 0);

  return {
    closed_trades: totalClosed,
    satellite_trades: closedTrades.filter((trade) => trade.account_role === "satellite").length,
    winrate,
    consistency_score: consistencyScore,
    confidence_score: confidenceScore,
    streak_days: streakDays,
    integrity_score: clamp(100 - (totalClosed === 0 ? 40 : 0), 0, 100),
    drawdown_score: clamp(100 - Math.min(50, Math.abs(totalPnl)), 0, 100),
    flow_score: clamp(consistencyScore + tradesPerDay * 2, 0, 100),
    precision_score: clamp(winrate + tradesPerDay * 1.5, 0, 100),
    resilience_score: clamp((consistencyScore + streakDays * 3) / 2, 0, 100),
    capital_score: clamp(winrate + totalPnl / 100, 0, 100),
    discipline_score: clamp(consistencyScore + streakDays * 1.5, 0, 100),
    mastery_score: clamp((consistencyScore + confidenceScore) / 2, 0, 100),
    sustain_score: clamp(consistencyScore + tradesPerDay * 1.2, 0, 100),
    validation_score: clamp((confidenceScore + consistencyScore) / 2, 0, 100),
  } as ProgressMetricMap;
};

const buildWidgets = (
  metrics: ProgressMetricMap,
  trades: Array<Record<string, unknown>>,
  appliedAt: string,
  currentLevel: number,
  levelProgressPct: number,
  thresholds: Record<string, ProgressThresholdRow>
) => {
  const goalGps = {
    current_level: currentLevel,
    progress_pct: levelProgressPct,
    next_checkpoint: Math.min(100, Math.ceil(levelProgressPct / 25) * 25),
    recommended_step: levelProgressPct < 50 ? "Increase trade cadence" : "Maintain consistency",
  };

  const appliedDate = new Date(appliedAt);
  const daysSinceApplied = Math.max(
    1,
    Math.ceil((Date.now() - appliedDate.getTime()) / (1000 * 60 * 60 * 24))
  );
  const tradesPerDay = metrics.closed_trades / daysSinceApplied;
  const bufferDays = tradesPerDay > 0 ? Math.floor(2 / tradesPerDay) : 0;

  const winrateClassifier =
    metrics.winrate <= 30
      ? "ineficiente"
      : metrics.winrate <= 45
      ? "inestable"
      : metrics.winrate <= 55
      ? "competente"
      : metrics.winrate <= 65
      ? "consistente"
      : metrics.winrate <= 75
      ? "avanzado"
      : metrics.winrate <= 85
      ? "elite"
      : "dominante";

  const forecast = {
    optimistic_days: Math.max(1, Math.round((100 - levelProgressPct) / Math.max(5, tradesPerDay * 25))),
    realistic_days: Math.max(1, Math.round((100 - levelProgressPct) / Math.max(3, tradesPerDay * 18))),
    pessimistic_days: Math.max(2, Math.round((100 - levelProgressPct) / Math.max(2, tradesPerDay * 10))),
  };

  const topSources = trades.reduce<Record<string, number>>((acc, trade) => {
    const tradeRecord = trade as Record<string, unknown>;
    const key = String(tradeRecord.symbol ?? tradeRecord.account_id ?? "unknown");
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const profitSources = Object.entries(topSources)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([key, count]) => ({ key, count }));

  return {
    goal_gps: goalGps,
    buffer_days: bufferDays,
    winrate_classifier: winrateClassifier,
    edge_consistency_score: metrics.consistency_score,
    milestone_ladder: [25, 50, 75, 100],
    forecast_range: forecast,
    streak_intelligence: {
      streak_days: metrics.streak_days,
      risk_degradation: metrics.streak_days < toNumber(thresholds.recovery_streak_min?.value_numeric, 0),
    },
    profit_source_map: profitSources,
    confidence_meter: metrics.confidence_score,
    goal_to_treasury_bridge: levelProgressPct >= 75,
  };
};

const getThresholdMap = (rows: ProgressThresholdRow[]) => {
  return rows.reduce<Record<string, ProgressThresholdRow>>((acc, row) => {
    acc[row.key] = row;
    return acc;
  }, {});
};

const collectRequiredThresholds = (levelDef: ProgressLevelDef | null) => {
  const missionKeys = levelDef ? levelDef.missions_json.map((m) => m.threshold_key) : [];
  return Array.from(new Set([...missionKeys, ...GLOBAL_THRESHOLD_KEYS]));
};

const computeMissionProgress = (
  levelDef: ProgressLevelDef,
  metrics: ProgressMetricMap,
  thresholds: Record<string, ProgressThresholdRow>
) => {
  const missing: string[] = [];
  const missionProgress = levelDef.missions_json.map((mission) => {
    const threshold = thresholds[mission.threshold_key];
    const value = toNumber(threshold?.value_numeric, NaN);
    if (!Number.isFinite(value)) {
      missing.push(mission.threshold_key);
      return { mission, progress: 0, completed: false };
    }
    const metricValue = toNumber((metrics as Record<string, unknown>)[mission.metric], 0);
    const progress = value > 0 ? clamp((metricValue / value) * 100, 0, 100) : 0;
    const completed = metricValue >= value;
    return { mission, progress, completed };
  });

  const avgProgress =
    missionProgress.length > 0
      ? missionProgress.reduce((sum, item) => sum + item.progress, 0) / missionProgress.length
      : 0;

  const completed = missionProgress.every((item) => item.completed);

  return {
    progressPct: clamp(avgProgress, 0, 100),
    completed,
    missing,
    missionProgress,
  };
};

const buildMilestones = (progressPct: number, previous: Record<string, boolean> | null) => {
  const next = { ...(previous || {}) } as Record<string, boolean>;
  [25, 50, 75, 100].forEach((step) => {
    const key = String(step);
    if (progressPct >= step) {
      next[key] = true;
    } else if (next[key] === undefined) {
      next[key] = false;
    }
  });
  return next;
};

export const recomputeProgress = async (supabase: SupabaseClient, userId: string) => {
  const { data: config } = await supabase
    .from("progress_ecosystem_config")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const levelsResult = await supabase
    .from("progress_map_levels")
    .select("*")
    .order("level", { ascending: true });

  const levels = (levelsResult.data || []) as ProgressLevelDef[];

  if (!config || !config.core_account_id) {
    return {
      config: (config as ProgressMapConfig) || null,
      mapState: null,
      levels,
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
    } satisfies ProgressMapResult;
  }

  const normalizedConfig: ProgressMapConfig = {
    ...config,
    satellite_account_ids: normalizeAccountIds(config.satellite_account_ids),
  };

  const { data: mapStateRaw } = await supabase
    .from("progress_map_state")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const currentLevel = mapStateRaw?.current_level || 1;

  const thresholdsResult = await supabase
    .from("progress_map_thresholds")
    .select("key, value_numeric, value_json")
    .eq("user_id", userId);

  const thresholdRows = (thresholdsResult.data || []) as ProgressThresholdRow[];
  const thresholds = getThresholdMap(thresholdRows);

  const currentLevelDef = levels.find((level) => level.level === currentLevel) || null;

  const requiredKeys = collectRequiredThresholds(currentLevelDef);
  const missingThresholdKeys = requiredKeys.filter((key) => {
    const threshold = thresholds[key];
    return !threshold || threshold.value_numeric === null;
  });

  const thresholdsRequired = missingThresholdKeys.length > 0;

  const accountIds = [
    normalizedConfig.core_account_id,
    ...normalizedConfig.satellite_account_ids,
  ].filter(Boolean) as string[];

  const { data: tradesRaw, error: tradesError } = await supabase
    .from("trades")
    .select("id, account_id, status, exit_date, pnl, pnl_percent, symbol, setup_id, created_at")
    .eq("user_id", userId)
    .in("account_id", accountIds)
    .is("deleted_at", null)
    .not("exit_date", "is", null)
    .gte("exit_date", normalizedConfig.applied_at);

  if (tradesError) {
    await supabase.from("progress_pending_sync").insert({
      user_id: userId,
      entity_type: "progress_recompute",
      entity_id: null,
      reason: tradesError.message,
    });

    await supabase
      .from("progress_map_state")
      .upsert({
        user_id: userId,
        config_version_int: normalizedConfig.version_int,
        current_level: 1,
        xp_total: 0,
        fail_safe_active: true,
        rebuild_active: false,
        map_heat_state: "red",
      });

    return {
      config: normalizedConfig,
      mapState: null,
      levels,
      levelStates: [],
      thresholdsRequired,
      missingThresholdKeys,
      metrics: null,
      widgets: null,
      recoveryActive: false,
      rebuildActive: false,
      failSafeActive: true,
      pendingSyncCount: 1,
      setupRequired: false,
    } satisfies ProgressMapResult;
  }

  const trades = (tradesRaw || []).map((trade) => ({
    ...trade,
    account_role: trade.account_id === normalizedConfig.core_account_id ? "core" : "satellite",
  }));

  const metrics = computeMetrics(trades, normalizedConfig.applied_at);

  const pendingSyncCount = (await supabase
    .from("progress_pending_sync")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("resolved_at", null)).count || 0;

  const consistencyGate = toNumber(thresholds.recovery_consistency_min?.value_numeric, 0);
  const streakGate = toNumber(thresholds.recovery_streak_min?.value_numeric, 0);
  const rebuildGate = toNumber(thresholds.rebuild_consistency_min?.value_numeric, 0);

  const recoveryActive =
    metrics.streak_days <= streakGate || metrics.consistency_score <= consistencyGate || pendingSyncCount > 0;
  const rebuildActive = recoveryActive && metrics.consistency_score <= rebuildGate;

  const mapHeatState = metrics.consistency_score >= 70 ? "green" : metrics.consistency_score >= 45 ? "amber" : "red";

  const activeLevelDef = levels.find((level) => level.level === currentLevel) || currentLevelDef;

  let progressPct = 0;
  let completed = false;
  let missing = missingThresholdKeys;

  if (!thresholdsRequired && activeLevelDef) {
    const computed = computeMissionProgress(activeLevelDef, metrics, thresholds);
    progressPct = computed.progressPct;
    completed = computed.completed;
    missing = Array.from(new Set([...missingThresholdKeys, ...computed.missing]));
  }

  const finalThresholdsRequired = missing.length > 0;

  const levelStatesResult = await supabase
    .from("progress_level_state")
    .select("*")
    .eq("user_id", userId)
    .eq("config_version_int", normalizedConfig.version_int);

  const existingLevelStates = (levelStatesResult.data || []) as ProgressLevelState[];
  const stateByLevel = new Map(existingLevelStates.map((state) => [state.level, state]));

  const updatedLevelStates: ProgressLevelState[] = levels.map((levelDef) => {
    const existing = stateByLevel.get(levelDef.level);
    let status: ProgressLevelState["status"] = "locked";

    if (levelDef.level < currentLevel) {
      status = "completed";
    } else if (levelDef.level === currentLevel) {
      if (pendingSyncCount > 0) {
        status = "fail_safe";
      } else if (rebuildActive) {
        status = "rebuild";
      } else {
        status = "active";
      }
    }

    const progressValue = levelDef.level === currentLevel ? progressPct : levelDef.level < currentLevel ? 100 : 0;
    const milestones = buildMilestones(progressValue, existing?.milestones_json || null);

    return {
      id: existing?.id,
      user_id: userId,
      config_version_int: normalizedConfig.version_int,
      level: levelDef.level,
      status,
      progress_pct: progressValue,
      milestones_json: milestones,
    };
  });

  const mapState: ProgressMapState = {
    user_id: userId,
    config_version_int: normalizedConfig.version_int,
    current_level: completed && !finalThresholdsRequired && !rebuildActive && pendingSyncCount === 0
      ? Math.min(15, currentLevel + 1)
      : currentLevel,
    xp_total: metrics.closed_trades * 10,
    map_heat_state: mapHeatState,
    fail_safe_active: pendingSyncCount > 0,
    rebuild_active: rebuildActive,
  };

  await supabase.from("progress_map_state").upsert(mapState, { onConflict: "user_id" });

  for (const levelState of updatedLevelStates) {
    await supabase.from("progress_level_state").upsert(levelState, {
      onConflict: "user_id,config_version_int,level",
    });
  }

  if (pendingSyncCount === 0) {
    await supabase
      .from("progress_pending_sync")
      .update({ resolved_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("resolved_at", null);
  }

  const widgets = buildWidgets(metrics, trades, normalizedConfig.applied_at, currentLevel, progressPct, thresholds);

  return {
    config: normalizedConfig,
    mapState,
    levels,
    levelStates: updatedLevelStates,
    thresholdsRequired: finalThresholdsRequired,
    missingThresholdKeys: missing,
    metrics,
    widgets,
    recoveryActive,
    rebuildActive,
    failSafeActive: pendingSyncCount > 0,
    pendingSyncCount,
    setupRequired: false,
  } satisfies ProgressMapResult;
};

export const onTradeClosedSaved = async (
  supabase: SupabaseClient,
  userId: string,
  trade: {
    id: string;
    account_id: string;
    status: string | null;
    exit_date: string | null;
  }
) => {
  const statusValue = (trade.status || "").toLowerCase();
  const isClosed = statusValue === "closed" || Boolean(trade.exit_date);
  if (!isClosed || !trade.exit_date) {
    return null;
  }

  const { data: config } = await supabase
    .from("progress_ecosystem_config")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!config || !config.core_account_id) {
    return null;
  }

  const satelliteIds = normalizeAccountIds(config.satellite_account_ids);
  const accountIds = [config.core_account_id, ...satelliteIds].filter(Boolean) as string[];

  if (!accountIds.includes(trade.account_id)) {
    return null;
  }

  if (new Date(trade.exit_date).getTime() < new Date(config.applied_at).getTime()) {
    return null;
  }

  const { data: existingEvent } = await supabase
    .from("progress_events")
    .select("id")
    .eq("user_id", userId)
    .eq("event_type", "trade")
    .eq("ref_table", "trades")
    .eq("ref_id", trade.id)
    .maybeSingle();

  if (!existingEvent) {
    await supabase.from("progress_events").insert({
      user_id: userId,
      event_type: "trade",
      ref_table: "trades",
      ref_id: trade.id,
      xp_delta: XP_VALUES.trade_complete,
      metadata: { source: "progress_map" },
      occurred_at: trade.exit_date,
      config_version_int: config.version_int,
      payload_json: { xp_delta: XP_VALUES.trade_complete },
    });
  }

  try {
    return await recomputeProgress(supabase, userId);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "recompute_failed";
    await supabase.from("progress_pending_sync").insert({
      user_id: userId,
      entity_type: "trade",
      entity_id: trade.id,
      reason: errorMessage,
    });

    await supabase.from("progress_map_state").upsert({
      user_id: userId,
      config_version_int: config.version_int,
      current_level: 1,
      xp_total: 0,
      fail_safe_active: true,
      rebuild_active: false,
      map_heat_state: "red",
    });

    return null;
  }
};
