// Canonical table registry — single source of truth.
// When two tables overlap conceptually, declare which one is canonical here.
// The audit script (scripts/audit-db-tables.mjs) and the canonical-tables.test.ts
// enforce that code references the canonical table, not deprecated/orphan ones.
//
// To extend: add a new entry to CANONICAL_TABLES, and (if it replaces a legacy
// table) add the legacy name to DEPRECATED_TABLES with the migration target.

export const CANONICAL_TABLES = {
  // Algorithmic trading strategies (used by the algorithms page, wizard, crons)
  algorithms: "algorithms",
  algorithmDeployments: "algorithm_deployments",
  algorithmTrades: "algorithm_trades",

  // Backtest infrastructure
  backtestJobs: "backtest_jobs",
  backtestResults: "backtest_results",
  backtestPaperSignals: "backtest_paper_signals",
  backtestDaemonState: "backtest_daemon_state",
  historicalBars: "historical_bars",

  // Trading core
  trades: "trades",
  accounts: "accounts",
  setups: "setups",

  // Bot
  bots: "bots",
  botAccounts: "bot_accounts",
  botInstances: "bot_instances",
  botCommands: "bot_commands",
  botTelemetry: "bot_telemetry",
} as const;

// Tables that exist in the DB but are NOT the canonical version anymore.
// Code MUST NOT reference these — the audit script will flag any usage.
export const DEPRECATED_TABLES: Record<string, string> = {
  // 058 created `trading_algorithms` but the rest of the app standardized on
  // `algorithms` (044). Migration completed in 2026-06: the page, wizard,
  // and all endpoints now read/write `algorithms`. The legacy table was
  // never populated in production (0 rows) so dropping it is safe — kept
  // here as a guard against accidental new references.
  trading_algorithms: "algorithms",
};

export type CanonicalTableKey = keyof typeof CANONICAL_TABLES;
