// src/lib/validation/schemas.ts
import { z } from "zod";

/**
 * Strict payload validation schemas for API endpoints
 * Ensures data integrity and protects against injection attacks
 */

// Trade creation/update schemas
export const tradeCreateSchema = z.object({
  account_id: z.string().uuid({ message: "account_id must be a valid UUID" }),
  symbol: z.string().min(1).max(20, { message: "symbol must be 1-20 characters" }),
  direction: z.enum(["BUY", "SELL"], { message: "direction must be BUY or SELL" }),
  status: z.enum(["open", "closed"], { message: "status must be open or closed" }),
  entry_date: z.string().date({ message: "entry_date must be a valid date (YYYY-MM-DD)" }),
  exit_date: z.string().date({ message: "exit_date must be a valid date (YYYY-MM-DD)" }).nullable(),
  entry_price: z.number().positive({ message: "entry_price must be a positive number" }),
  exit_price: z.number().positive({ message: "exit_price must be a positive number" }),
  lots: z.number().positive({ message: "lots must be a positive number" }),
  stop_loss_price: z.number().nonnegative({ message: "stop_loss_price must be non-negative" }),
  take_profit_price: z.number().nonnegative({ message: "take_profit_price must be non-negative" }),
  pnl: z.number().nullable().optional(),
  pnl_percent: z.number().nullable().optional(),
  notes: z.string().max(5000, { message: "notes must be max 5000 characters" }).optional(),
  setup_id: z.string().uuid({ message: "setup_id must be a valid UUID" }).nullable().optional(),
  is_featured_in_report: z.boolean().optional(),
});

export const tradeUpdateSchema = z.object({
  account_id: z.string().uuid().optional(),
  symbol: z.string().min(1).max(20).optional(),
  direction: z.enum(["BUY", "SELL"]).optional(),
  status: z.enum(["open", "closed"]).optional(),
  entry_date: z.string().date().optional(),
  exit_date: z.string().date().nullable().optional(),
  entry_price: z.number().positive().optional(),
  exit_price: z.number().positive().optional(),
  lots: z.number().positive().optional(),
  stop_loss_price: z.number().nonnegative().optional(),
  take_profit_price: z.number().nonnegative().optional(),
  pnl: z.number().nullable().optional(),
  pnl_percent: z.number().nullable().optional(),
  notes: z.string().max(5000).optional(),
  setup_id: z.string().uuid().nullable().optional(),
  is_featured_in_report: z.boolean().optional(),
  restore: z.boolean().optional(),
});

// Journal entry schema
export const journalEntrySchema = z.object({
  text: z.string().min(10, { message: "text must be at least 10 characters" }).max(50000),
  mood: z.enum(["terrible", "bad", "neutral", "good", "excellent"]).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  mood_score: z.number().min(1).max(10).optional(),
  market_conditions: z.string().max(500).optional(),
  focus_areas: z.array(z.string().max(100)).max(10).optional(),
  lessons_learned: z.string().max(2000).optional(),
  action_items: z.array(z.string().max(200)).max(10).optional(),
  trade_id: z.string().uuid().nullable().optional(),
  is_private: z.boolean().optional(),
});

// Secure email schemas
export const sendEmailSchema = z.object({
  mailbox_id: z.string().uuid({ message: "mailbox_id must be a valid UUID" }),
  to_email: z.string().email({ message: "to_email must be a valid email" }),
  subject_ciphertext: z.string().min(10, { message: "subject_ciphertext must be at least 10 chars" }).max(10000),
  body_ciphertext: z.string().min(10, { message: "body_ciphertext must be at least 10 chars" }).max(100000),
  attachments: z.array(z.object({
    filename: z.string().max(255),
    content_base64: z.string().max(10485760), // 10MB
    content_type: z.string().max(100),
  })).max(10).optional(),
});

// Export/archive schema
export const exportRequestSchema = z.object({
  resource_type: z.enum(["trades", "journal", "accounts", "setups", "all"]),
  format: z.enum(["csv", "json", "pdf"]),
  date_from: z.string().date().optional(),
  date_to: z.string().date().optional(),
  filters: z.record(z.string(), z.any()).optional(),
  include_deleted: z.boolean().optional(),
});

// Goal/progress schema
export const goalCreateSchema = z.object({
  title: z.string().min(5).max(200),
  description: z.string().max(1000).optional(),
  goal_value: z.number().positive(),
  current_value: z.number().nonnegative().optional(),
  metrics_type: z.enum(["count", "percentage", "currency"]),
  start_date: z.string().date(),
  end_date: z.string().date(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  category: z.string().max(50).optional(),
});

// Pagination schema
export const paginationSchema = z.object({
  limit: z.number().min(1).max(1000).optional(),
  offset: z.number().min(0).optional(),
});

// Filter schema (flexible, for dynamic filtering)
export const filterSchema = z.object({
  field: z.string().max(50),
  operator: z.enum(["eq", "neq", "gt", "gte", "lt", "lte", "like", "in"]),
  value: z.any(),
});

const tradeResponseBaseSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  account_id: z.string().uuid(),
  symbol: z.string().min(1),
  direction: z.enum(["BUY", "SELL"]),
  status: z.enum(["open", "closed"]),
  entry_date: z.string().min(1),
  exit_date: z.string().nullable(),
  entry_price: z.number(),
  exit_price: z.number(),
  lots: z.number(),
  stop_loss_price: z.number(),
  take_profit_price: z.number(),
  pnl: z.number().nullable().optional(),
  pnl_percent: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
  setup_id: z.string().uuid().nullable().optional(),
  is_featured_in_report: z.boolean().optional(),
});

export const tradeResponseSchema = tradeResponseBaseSchema.passthrough();

export const tradeUpdateResponseSchema = tradeResponseBaseSchema.extend({
  progress_update: z.any().optional(),
}).passthrough();

export const journalEntryResponseSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  text: z.string(),
  mood: z.enum(["terrible", "bad", "neutral", "good", "excellent"]),
  tags: z.array(z.string()),
  mood_score: z.number().nullable(),
  market_conditions: z.string().nullable(),
  focus_areas: z.array(z.string()).nullable(),
  lessons_learned: z.string().nullable(),
  action_items: z.array(z.string()).nullable(),
  trade_id: z.string().uuid().nullable(),
  is_private: z.boolean(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
  deleted_at: z.string().nullable(),
}).passthrough();

export const sendEmailResponseSchema = z.object({
  success: z.boolean(),
  message_id: z.string().uuid(),
  provider_message_id: z.string(),
}).passthrough();

// ─── Sprint 3: Response schemas for the 6 critical endpoints ───────────────

/**
 * accountResponseSchema
 * Shape returned by GET /api/accounts (array of mapped account rows)
 * The `category` field is a flattened join of account_categories.
 */
export const accountResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  category_id: z.string(),
  account_size: z.number().nullable(),
  current_balance: z.number().nullable(),
  operation_state: z.string().nullable(),
  phase_status: z.string().nullable(),
  role: z.string().nullable(),
  withdrawals_enabled: z.boolean().nullable(),
  currency: z.string(),
  status: z.string(),
  sort_index: z.number().nullable(),
  category: z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable().optional(),
  }).nullable(),
}).passthrough();

/**
 * setupResponseSchema
 * Shape returned by GET /api/tradehub/setups (select("*"))
 */
export const setupResponseSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  name: z.string(),
  name_lower: z.string().optional(),
  description: z.string().nullable().optional(),
  sort_index: z.number().nullable().optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
  deleted_at: z.string().nullable().optional(),
}).passthrough();

/**
 * goalResponseSchema
 * Shape returned by GET /api/tradermap/goals
 * Includes joined account and quarters sub-arrays, title is decrypted.
 */
export const goalResponseSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  account_id: z.string().uuid(),
  year: z.number(),
  title: z.string(),
  active_quarter: z.string(),
  sort_index: z.number().nullable().optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
  deleted_at: z.string().nullable().optional(),
  account: z.object({
    id: z.string().uuid(),
    name: z.string(),
    currency: z.string().optional(),
  }).nullable().optional(),
  quarters: z.array(z.object({
    id: z.string().uuid(),
    user_id: z.string().uuid(),
    goal_id: z.string().uuid(),
    quarter: z.string(),
    start_date: z.string(),
    end_date: z.string(),
    start_balance: z.number(),
    target_balance: z.number(),
    current_balance: z.number().nullable(),
    sort_index: z.number().nullable().optional(),
    created_at: z.string().nullable().optional(),
    updated_at: z.string().nullable().optional(),
  }).passthrough()).optional(),
}).passthrough();

/**
 * capitalTargetResponseSchema
 * Shape returned by GET /api/intelligence/capital-targets
 * Based on TARGET_COLUMNS selected explicitly in the handler.
 */
export const capitalTargetResponseSchema = z.object({
  id: z.string().uuid(),
  account_type: z.string(),
  target_name: z.string(),
  target_capital: z.number(),
  capital_account_id: z.string().uuid().nullable(),
  manual_monthly_pct: z.number().nullable(),
  manual_quarterly_pct: z.number().nullable(),
  manual_semiannual_pct: z.number().nullable(),
  manual_annual_pct: z.number().nullable(),
  manual_updated_at: z.string().nullable(),
  custom_current_capital: z.number().nullable(),
  custom_current_updated_at: z.string().nullable(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
}).passthrough();

/**
 * newsItemResponseSchema
 * Shape returned by GET /api/terminal/news (select("*") + decrypted fields)
 */
export const newsItemResponseSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  instrument_id: z.string().uuid(),
  title: z.string(),
  url: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
  relevancy_score: z.number().nullable().optional(),
  impact_label: z.string().nullable().optional(),
  timestamp_utc: z.string().nullable().optional(),
  sort_index: z.number().nullable().optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
  deleted_at: z.string().nullable().optional(),
}).passthrough();

/**
 * eventItemResponseSchema
 * Shape returned by GET /api/terminal/events (select("*") + decrypted name)
 */
export const eventItemResponseSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  instrument_id: z.string().uuid(),
  name: z.string(),
  impact: z.string().nullable().optional(),
  timestamp_utc: z.string(),
  sort_index: z.number().nullable().optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
  deleted_at: z.string().nullable().optional(),
}).passthrough();

// ────────────────────────────────────────────────────────────────────────────

/**
 * Parse and validate payload, throwing ZodError if invalid
 */
export function validatePayload<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}

/**
 * Safe validation that returns errors instead of throwing
 */
export function validatePayloadSafe<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; errors: Record<string, string> } {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors: Record<string, string> = {};
    result.error.issues.forEach((issue) => {
      const path = issue.path.join(".");
      errors[path || "root"] = issue.message;
    });
    return { success: false, errors };
  }
  return { success: true, data: result.data };
}

/**
 * Helper to create error response for validation failures
 */
export function validationErrorResponse(errors: Record<string, string>) {
  return {
    error: "Validation failed",
    details: errors,
  };
}
