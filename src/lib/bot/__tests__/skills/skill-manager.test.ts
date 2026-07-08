import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies BEFORE importing skill-manager
const mockRunLearningCycle = vi.fn();
const mockCreateEmptyQTable = vi.fn();
const mockExtractTradingRules = vi.fn();
const mockLogError = vi.fn();
const mockCreateClient = vi.fn();

vi.mock("../../skills/rl-engine", () => ({
  runLearningCycle: (...args: unknown[]) => mockRunLearningCycle(...args),
  createEmptyQTable: (...args: unknown[]) => mockCreateEmptyQTable(...args),
}));
vi.mock("../../skills/llm-rules", () => ({
  extractTradingRules: (...args: unknown[]) => mockExtractTradingRules(...args),
}));
vi.mock("@/lib/log", () => ({
  logError: (...args: unknown[]) => mockLogError(...args),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => mockCreateClient(),
}));

// `paper_trades` + `bot_skills` are in-scope (own Postgres) — the paper
// trades fetch, the existing/new-skill lookup and the final bot_skills
// update now go through getPgClient() instead of the injected Supabase
// client. `bot_regime_states`, `bot_signal_engine_state`,
// `bot_skill_audit_log` and Storage stay on Supabase (out of scope for this
// migration). Both mocks read/write the same `state` object so the existing
// fixtures/assertions keep working unchanged.
vi.mock("@/lib/pg/client", () => ({
  getPgClient: () => ({ from: (table: string) => makePgChain(table) }),
}));

import { runSkillLearningCycle } from "../../skills/skill-manager";

interface MockState {
  paperTrades: Array<{ pnl: number | null; symbol: string }> | null;
  paperTradesError: { message: string } | null;
  existingSkill: { id: string; model_blob_path: string | null; epsilon_current: number; performance_before: unknown } | null;
  newSkillId: string | null;
  newSkillError: { message: string } | null;
  storageDownload: { ok: boolean; text?: string };
  storageUploadError: { message: string } | null;
  regimeHistory: Array<{ regime_code: string }>;
  sessionHistory: Array<{ session_date: string }>;
  updateSkillError: { message: string } | null;
  auditError: { message: string } | null;
  insertedAuditEntries: unknown[];
  updatedSkillPayloads: unknown[];
}

let state: MockState;

// pg.from('paper_trades' | 'bot_skills') — mode-aware chain: select (default),
// insert() or update() switch the resolved shape, mirroring how the real
// getPgClient() QueryBuilder tracks a single `mode` per `.from()` call.
function makePgChain(table: string) {
  let mode: "select" | "insert" | "update" = "select";
  const chain: Record<string, unknown> = { _table: table };
  chain.select = function () { return chain; };
  chain.eq = function () { return chain; };
  chain.is = function () { return chain; };
  chain.order = function () { return chain; };
  chain.single = function () { return chain; };
  chain.insert = function () {
    mode = "insert";
    return chain;
  };
  chain.update = function (payload: unknown) {
    mode = "update";
    if (table === "bot_skills") state.updatedSkillPayloads.push(payload);
    return chain;
  };
  chain.then = function (resolve: (v: unknown) => unknown) {
    if (mode === "insert") {
      if (table === "bot_skills") {
        if (state.newSkillError) return resolve({ data: null, error: state.newSkillError });
        return resolve({ data: { id: state.newSkillId }, error: null });
      }
      return resolve({ data: null, error: null });
    }
    if (mode === "update") {
      if (table === "bot_skills") return resolve({ data: null, error: state.updateSkillError });
      return resolve({ data: null, error: null });
    }
    // select mode
    if (table === "paper_trades") return resolve({ data: state.paperTrades, error: state.paperTradesError });
    if (table === "bot_skills") return resolve({ data: state.existingSkill, error: null });
    return resolve({ data: null, error: null });
  };
  return chain;
}

function makeMockSupabase() {
  return {
    from(table: string) {
      const chain: Record<string, unknown> = { _table: table };
      chain.select = function () { return chain; };
      chain.eq = function () { return chain; };
      chain.is = function () { return chain; };
      chain.gt = function () { return chain; };
      chain.order = function () { return chain; };
      chain.limit = function () { return chain; };
      chain.insert = function (payload: unknown) {
        if (table === "bot_skill_audit_log") {
          state.insertedAuditEntries.push(payload);
          return Promise.resolve({ error: state.auditError });
        }
        return Promise.resolve({ error: null });
      };
      chain.then = function (resolve: (v: unknown) => unknown) {
        if (table === "bot_regime_states") return resolve({ data: state.regimeHistory });
        if (table === "bot_signal_engine_state") return resolve({ data: state.sessionHistory });
        return resolve({ data: null, error: null });
      };
      return chain;
    },
    storage: {
      from(_bucket: string) {
        return {
          async download() {
            if (state.storageDownload.ok) {
              return {
                data: { async text() { return state.storageDownload.text ?? ""; } },
                error: null,
              };
            }
            return { data: null, error: { message: "not found" } };
          },
          async upload() {
            return { error: state.storageUploadError };
          },
        };
      },
    },
  };
}

function makeManyTrades(n: number): Array<{ pnl: number; symbol: string; created_at: string }> {
  // created_at must be within the last 24h: runSkillLearningCycle now fetches
  // paper_trades via getPgClient() (whose shim has no `.gt()`) and filters
  // the 24h cutoff in JS against this field instead of at the query level.
  const now = new Date().toISOString();
  return Array.from({ length: n }, (_, i) => ({
    pnl: i % 3 === 0 ? -50 : 100, // mezcla pérdidas/ganancias
    symbol: "XAUUSD",
    created_at: now,
  }));
}

describe("skill-manager", () => {
  beforeEach(() => {
    mockRunLearningCycle.mockReset().mockReturnValue({
      updatedQTable: { table: [], epsilon: 0.28, version: 2, instrument: "XAUUSD" },
      episodeCount: 60,
      avgReward: 0.15,
      improvedActions: 12,
    });
    mockCreateEmptyQTable.mockReset().mockReturnValue({
      table: [], epsilon: 0.3, version: 1, instrument: "XAUUSD",
    });
    mockExtractTradingRules.mockReset().mockResolvedValue([]);
    mockLogError.mockReset();
    mockCreateClient.mockReset().mockImplementation(async () => makeMockSupabase());
    state = {
      paperTrades: makeManyTrades(60),
      paperTradesError: null,
      existingSkill: null,
      newSkillId: "skill-new-1",
      newSkillError: null,
      storageDownload: { ok: false },
      storageUploadError: null,
      regimeHistory: [],
      sessionHistory: [],
      updateSkillError: null,
      auditError: null,
      insertedAuditEntries: [],
      updatedSkillPayloads: [],
    };
  });

  describe("runSkillLearningCycle", () => {
    it("happy path: 60 trades + crear skill nueva + subir Q-table + audit", async () => {
      const r = await runSkillLearningCycle("XAUUSD", "test-user-1");

      expect(r.success).toBe(true);
      expect(r.tradesProcessed).toBe(60);
      expect(r.skillId).toBe("skill-new-1");
      expect(r.skillVersion).toBe(2);
      expect(mockRunLearningCycle).toHaveBeenCalledOnce();
      expect(state.updatedSkillPayloads).toHaveLength(1);
      expect(state.insertedAuditEntries).toHaveLength(1);
    });

    it("retorna success=false cuando hay <50 paper trades", async () => {
      state.paperTrades = makeManyTrades(20);
      const r = await runSkillLearningCycle("XAUUSD", "test-user-1");

      expect(r.success).toBe(false);
      expect(r.tradesProcessed).toBe(20);
      expect(mockRunLearningCycle).not.toHaveBeenCalled();
      expect(mockLogError).toHaveBeenCalled();
    });

    it("retorna error cuando falla la query a paper_trades", async () => {
      state.paperTradesError = { message: "RLS denied" };
      state.paperTrades = null;
      const r = await runSkillLearningCycle("XAUUSD", "test-user-1");

      expect(r.success).toBe(false);
      expect(r.error).toContain("RLS denied");
    });

    it("usa skill existente cuando hay uno con model_blob_path", async () => {
      state.existingSkill = {
        id: "skill-existing-7",
        model_blob_path: "skills/XAUUSD/skill-existing-7_v3.json",
        epsilon_current: 0.25,
        performance_before: { sharpe: 0.5, winRate: 0.55, avg_pnl: 30 },
      };
      state.storageDownload = {
        ok: true,
        text: JSON.stringify({ table: [], epsilon: 0.25, version: 3, instrument: "XAUUSD" }),
      };

      const r = await runSkillLearningCycle("XAUUSD", "test-user-1");
      expect(r.success).toBe(true);
      expect(r.skillId).toBe("skill-existing-7");
      // No debe haber intentado crear una nueva
      expect(mockCreateEmptyQTable).not.toHaveBeenCalled();
    });

    it("usa createEmptyQTable cuando download de storage falla", async () => {
      state.existingSkill = {
        id: "skill-existing-7",
        model_blob_path: "skills/XAUUSD/missing.json",
        epsilon_current: 0.3,
        performance_before: null,
      };
      state.storageDownload = { ok: false }; // download falla
      const r = await runSkillLearningCycle("XAUUSD", "test-user-1");
      expect(r.success).toBe(true);
      expect(mockCreateEmptyQTable).toHaveBeenCalledWith("XAUUSD");
    });

    it("retorna error cuando falla creación de nueva skill", async () => {
      state.newSkillError = { message: "INSERT failed" };
      const r = await runSkillLearningCycle("XAUUSD", "test-user-1");
      expect(r.success).toBe(false);
      expect(r.error).toContain("INSERT failed");
    });

    it("retorna error cuando falla update bot_skills", async () => {
      state.updateSkillError = { message: "Update conflict" };
      const r = await runSkillLearningCycle("XAUUSD", "test-user-1");
      expect(r.success).toBe(false);
      expect(r.error).toContain("Update conflict");
    });

    it("continúa exitosamente aunque falle el audit log (solo warning)", async () => {
      state.auditError = { message: "audit table missing" };
      const r = await runSkillLearningCycle("XAUUSD", "test-user-1");
      expect(r.success).toBe(true);
      expect(mockLogError).toHaveBeenCalled();
    });

    it("audit log incluye episode count + epsilon + LLM rules count", async () => {
      mockExtractTradingRules.mockResolvedValue([{ id: "r1" }, { id: "r2" }]);
      await runSkillLearningCycle("XAUUSD", "test-user-1");

      const audit = state.insertedAuditEntries[0] as { event_type: string; parameters: Record<string, unknown> };
      expect(audit.event_type).toBe("LEARNING_CYCLE");
      expect(audit.parameters.rl_episode_count).toBe(60);
      expect(audit.parameters.llm_rules_generated).toBe(2);
      expect(audit.parameters.epsilon_after).toBe(0.28);
    });

    it("audit log usa el userId pasado por parámetro (no hardcoded)", async () => {
      await runSkillLearningCycle("XAUUSD", "custom-user-42");
      const audit = state.insertedAuditEntries[0] as { user_id: string };
      expect(audit.user_id).toBe("custom-user-42");
    });
  });
});
