import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";
import { runLearningCycle, createEmptyQTable } from "./rl-engine";
import { extractTradingRules } from "./llm-rules";
import type { PerformanceMetrics, PaperTrade, QTable } from "./types";

export interface SkillLearningOutput {
  success: boolean;
  skillId?: string;
  tradesProcessed: number;
  skillVersion?: number;
  error?: string;
}

function calculateSharpe(trades: PaperTrade[]): number {
  if (trades.length < 2) return 0;

  const returns = trades
    .filter((t) => t.pnl !== null && t.pnl !== undefined)
    .map((t) => t.pnl!);

  if (returns.length === 0) return 0;

  const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length;
  const std = Math.sqrt(variance);

  if (std === 0) return 0;
  return (mean / std) * Math.sqrt(252); // Annualize (assuming daily)
}

function calculatePerformance(trades: PaperTrade[]): PerformanceMetrics {
  const wins = trades.filter((t) => (t.pnl ?? 0) > 0).length;
  const totalPnl = trades.reduce((s, t) => s + (t.pnl ?? 0), 0);
  const avgPnl = trades.length > 0 ? totalPnl / trades.length : 0;

  return {
    sharpe: calculateSharpe(trades),
    winRate: trades.length > 0 ? wins / trades.length : 0,
    avgPnl,
    totalTrades: trades.length,
    totalPnl,
  };
}

async function uploadQTableToStorage(
  bucket: string,
  path: string,
  qTable: QTable
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.storage.from(bucket).upload(path, JSON.stringify(qTable), {
    contentType: "application/json",
    upsert: true,
  });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }
}

async function downloadQTableFromStorage(
  bucket: string,
  path: string
): Promise<QTable | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(bucket).download(path);

  if (error || !data) {
    return null;
  }

  try {
    const text = await data.text();
    return JSON.parse(text) as QTable;
  } catch {
    return null;
  }
}

export async function runSkillLearningCycle(instrument: "XAUUSD"): Promise<SkillLearningOutput> {
  try {
    const supabase = await createClient();

    // 1. Fetch closed paper trades from last 24h
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: trades, error: tradesErr } = await supabase
      .from("paper_trades")
      .select("*")
      .eq("symbol", instrument)
      .is("deleted_at", null)
      .is("exit_date", null) // Only closed trades
      .gt("created_at", oneDayAgo)
      .order("created_at", { ascending: true });

    if (tradesErr) {
      throw new Error(`Failed to fetch paper trades: ${tradesErr.message}`);
    }

    const paperTrades = (trades ?? []) as PaperTrade[];

    // 2. Minimum trades for meaningful learning
    if (paperTrades.length < 50) {
      await logError("SkillManager", {
        component: "skill-manager",
        message: `Insufficient paper trades for learning: ${paperTrades.length} (need >=50)`,
      });
      return { success: false, tradesProcessed: paperTrades.length };
    }

    // 3. Get or create active skill
    const { data: existingSkill } = await supabase
      .from("bot_skills")
      .select("id, model_blob_path, epsilon_current, performance_before")
      .eq("instrument", instrument)
      .eq("environment", "paper")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let skillId = existingSkill?.id;
    const performanceBefore = existingSkill?.performance_before;

    if (!skillId) {
      // Create new skill
      const { data: newSkill, error: createErr } = await supabase
        .from("bot_skills")
        .insert({
          user_id: "381e268e-a042-4612-8b39-7a120ace17d6", // hardcoded default user
          instrument,
          skill_type: "HYBRID",
          environment: "paper",
          status: "learning",
          epsilon_current: 0.3,
        })
        .select("id")
        .single();

      if (createErr || !newSkill) {
        throw new Error(`Failed to create skill: ${createErr?.message}`);
      }
      skillId = newSkill.id;
    }

    // 4. Download or create Q-table
    const modelPath = existingSkill?.model_blob_path;
    let qTable: QTable;
    if (modelPath) {
      const downloaded = await downloadQTableFromStorage("skills", modelPath);
      qTable = downloaded ?? createEmptyQTable(instrument);
    } else {
      qTable = createEmptyQTable(instrument);
    }

    // 5. Get regime and session history
    const { data: regimeHistory } = await supabase
      .from("bot_regime_states")
      .select("regime_code")
      .gt("detected_at", oneDayAgo)
      .order("detected_at", { ascending: true });

    const { data: sessionHistory } = await supabase
      .from("bot_signal_engine_state")
      .select("session_date") // Would need to derive session from this, for now use CLOSED
      .gt("updated_at", oneDayAgo)
      .order("updated_at", { ascending: true });

    const regimes = (regimeHistory ?? []).map((r: { regime_code: string }) => r.regime_code);
    const sessions = (sessionHistory ?? []).map(() => "CLOSED");

    // 6. Run RL learning cycle
    const learningResult = runLearningCycle({
      closedTrades: paperTrades,
      currentQTable: qTable,
      regimeHistory: regimes,
      sessionHistory: sessions,
    });

    // 7. Extract LLM rules
    const llmRules = await extractTradingRules(paperTrades, []);

    // 8. Upload updated model
    const newModelPath = `skills/${instrument}/${skillId}_v${learningResult.updatedQTable.version}.json`;
    await uploadQTableToStorage("skills", newModelPath, learningResult.updatedQTable);

    // 9. Calculate performance
    const performanceAfter = calculatePerformance(paperTrades);

    // 10. Update bot_skills
    const performanceDelta = performanceBefore
      ? {
          sharpe_delta: performanceAfter.sharpe - (performanceBefore.sharpe ?? 0),
          win_rate_delta: performanceAfter.winRate - (performanceBefore.winRate ?? 0),
          avg_pnl_delta: performanceAfter.avgPnl - (performanceBefore.avg_pnl ?? 0),
        }
      : null;

    const { error: updateErr } = await supabase
      .from("bot_skills")
      .update({
        model_blob_path: newModelPath,
        model_version: learningResult.updatedQTable.version,
        epsilon_current: learningResult.updatedQTable.epsilon,
        performance_before: performanceAfter,
        status: "pending_approval",
        updated_at: new Date().toISOString(),
      })
      .eq("id", skillId);

    if (updateErr) {
      throw new Error(`Failed to update skill: ${updateErr.message}`);
    }

    // 11. Insert audit log
    const { error: auditErr } = await supabase.from("bot_skill_audit_log").insert({
      user_id: "381e268e-a042-4612-8b39-7a120ace17d6",
      skill_id: skillId,
      event_type: "LEARNING_CYCLE",
      parameters: {
        rl_episode_count: learningResult.episodeCount,
        rl_avg_reward: learningResult.avgReward,
        rl_improved_actions: learningResult.improvedActions,
        epsilon_before: qTable.epsilon,
        epsilon_after: learningResult.updatedQTable.epsilon,
        llm_rules_generated: llmRules.length,
        performance_delta: performanceDelta,
      },
    });

    if (auditErr) {
      logError("SkillManager", {
        component: "skill-manager",
        message: `Audit log insertion warning: ${auditErr.message}`,
      });
    }

    return {
      success: true,
      skillId,
      tradesProcessed: paperTrades.length,
      skillVersion: learningResult.updatedQTable.version,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logError("SkillManager", {
      component: "skill-manager",
      action: "runSkillLearningCycle",
      message,
    });
    return { success: false, tradesProcessed: 0, error: message };
  }
}
