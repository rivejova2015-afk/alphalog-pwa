/**
 * AlphaCore Deduplication Engine
 * 
 * Implements 3-tier deduplication:
 * 1. UNIQUE_CONSTRAINT - Database UNIQUE indexes
 * 2. DERIVED_FROM_UI_DB - App-level detection via fingerprinting
 * 3. UNDETERMINED - Uncertain deduplication rules
 * 
 * Error 23505: Unique constraint violation
 * Error 23503: Foreign key constraint violation
 */

import type { DedupeConfig } from './types';

// ============================================================================
// DEDUPLICATION CONFIGURATION BY TABLE
// ============================================================================

export const DEDUPE_SCHEMAS: Record<string, DedupeConfig> = {
  // ========== LOGS MODULE ==========
  categories: {
    enabled: true,
    fields: ['user_id', 'name_lower'],
    source: 'UNIQUE_CONSTRAINT',
    strictMode: true,
    description: 'UNIQUE(user_id, name_lower) WHERE deleted_at IS NULL',
  },
  
  tags: {
    enabled: true,
    fields: ['user_id', 'name_lower'],
    source: 'UNIQUE_CONSTRAINT',
    strictMode: true,
    description: 'UNIQUE(user_id, name_lower) WHERE deleted_at IS NULL',
  },
  
  logs: {
    enabled: false, // Logs allow duplicates (different dates, content)
    fields: [],
    source: 'UNDETERMINED',
    strictMode: false,
  },
  
  log_attachments: {
    enabled: false,
    fields: [],
    source: 'UNDETERMINED',
    strictMode: false,
  },
  
  // ========== TRADEHUB MODULE ==========
  account_categories: {
    enabled: true,
    fields: ['user_id', 'name_lower'],
    source: 'UNIQUE_CONSTRAINT',
    strictMode: true,
    description: 'UNIQUE(user_id, name_lower) WHERE deleted_at IS NULL',
  },
  
  accounts: {
    enabled: true,
    fields: ['user_id', 'name', 'category_id'],
    source: 'DERIVED_FROM_UI_DB',
    strictMode: false, // User might have 2 accounts with same name in different categories
    description: 'App-level: check user + category before creating',
  },
  
  trades: {
    enabled: false,
    fields: [],
    source: 'UNDETERMINED',
    strictMode: false,
    description: 'Multiple trades per setup allowed; dates differentiate',
  },
  
  setups: {
    enabled: true,
    fields: ['user_id', 'name_lower'],
    source: 'UNIQUE_CONSTRAINT',
    strictMode: true,
    description: 'UNIQUE(user_id, name_lower) WHERE deleted_at IS NULL',
  },
  
  tv_analysis_evidence: {
    enabled: false,
    fields: [],
    source: 'UNDETERMINED',
    strictMode: false,
  },
  
  weekly_reports: {
    enabled: true,
    fields: ['user_id', 'week_start'],
    source: 'UNIQUE_CONSTRAINT',
    strictMode: true,
    description: 'UNIQUE(user_id, week_start)',
  },
  
  // ========== TERMINAL MODULE ==========
  instruments: {
    enabled: true,
    fields: ['symbol'],
    source: 'UNIQUE_CONSTRAINT',
    strictMode: true,
    description: 'UNIQUE(symbol) - global, not per-user',
  },
  
  terminal_news: {
    enabled: false,
    fields: [],
    source: 'UNDETERMINED',
    strictMode: false,
  },
  
  terminal_events: {
    enabled: false,
    fields: [],
    source: 'UNDETERMINED',
    strictMode: false,
  },
  
  // ========== JOURNAL MODULE ==========
  journal_entries: {
    enabled: false, // Each entry is unique by design (timestamp + content)
    fields: [],
    source: 'UNDETERMINED',
    strictMode: false,
  },
  
  journal_tags: {
    enabled: true,
    fields: ['user_id', 'name_lower'],
    source: 'UNIQUE_CONSTRAINT',
    strictMode: true,
    description: 'UNIQUE(user_id, name_lower) WHERE deleted_at IS NULL',
  },
  
  // ========== TRADERMAP MODULE ==========
  traders: {
    enabled: true,
    fields: ['user_id', 'username'],
    source: 'UNIQUE_CONSTRAINT',
    strictMode: true,
    description: 'UNIQUE(user_id, username)',
  },
  
  trader_follows: {
    enabled: true,
    fields: ['user_id', 'trader_id'],
    source: 'UNIQUE_CONSTRAINT',
    strictMode: true,
    description: 'UNIQUE(user_id, trader_id) - prevent duplicate follows',
  },
  
  // ========== TREASURY MODULE ==========
  treasury_configs: {
    enabled: true,
    fields: ['user_id', 'account_id'],
    source: 'UNIQUE_CONSTRAINT',
    strictMode: true,
    description: 'UNIQUE(user_id, account_id) - one config per account',
  },
  
  payouts: {
    enabled: false,
    fields: [],
    source: 'UNDETERMINED',
    strictMode: false,
  },
  
  payout_wallet_mapping: {
    enabled: true,
    fields: ['user_id', 'account_id'],
    source: 'UNIQUE_CONSTRAINT',
    strictMode: true,
    description: 'UNIQUE(user_id, account_id) - one wallet per account',
  },
  
  // ========== BUSINESS MODULE ==========
  business_costs: {
    enabled: false,
    fields: [],
    source: 'UNDETERMINED',
    strictMode: false,
  },
};

// ============================================================================
// DEDUPLICATION CHECKER
// ============================================================================

export interface DedupeCheckOptions {
  table: string;
  payload: Record<string, any>;
  excludeId?: string; // ID to exclude from check (for updates)
  userId?: string;
}

export interface DedupeCheckResult {
  isDuplicate: boolean;
  field?: string;
  value?: any;
  existingId?: string;
  message?: string;
}

/**
 * Check if payload might be duplicate based on schema config
 * This is app-level checking; database UNIQUE constraints still enforce at DB level
 */
export function checkDuplicate(options: DedupeCheckOptions): DedupeCheckResult {
  const config = DEDUPE_SCHEMAS[options.table];
  
  if (!config || !config.enabled) {
    return { isDuplicate: false };
  }
  
  // Prepare payload for checking (lowercase for comparison)
  const preparedPayload = { ...options.payload };
  
  // For name fields, create lowercased version for comparison
  if (preparedPayload.name && !preparedPayload.name_lower) {
    preparedPayload.name_lower = preparedPayload.name.toLowerCase();
  }
  
  // Check each deduped field
  for (const field of config.fields) {
    if (field === 'user_id' && options.userId) {
      // Skip user_id field check (handled by RLS)
      continue;
    }
    
    const value = preparedPayload[field];
    if (value === undefined || value === null) {
      // Missing deduped field - skip check
      continue;
    }
    
    // In a real implementation, would query database here
    // For now, this is structural validation
    // Actual DB check happens on INSERT (constraint violation)
  }
  
  return { isDuplicate: false };
}

// ============================================================================
// ERROR CODE INTERPRETER
// ============================================================================

export interface DedupeErrorInfo {
  code: string;
  isDuplicateError: boolean;
  field?: string;
  message: string;
  recoveryAction: 'RETRY' | 'SHOW_DIALOG' | 'MANUAL_MERGE' | 'SKIP';
}

/**
 * Interpret Postgres error code to determine if deduplication error
 */
export function interpretDedupeError(
  code: string,
  message: string,
  table: string
): DedupeErrorInfo {
  const config = DEDUPE_SCHEMAS[table];
  
  switch (code) {
    case '23505': // Unique constraint violation
      return {
        code,
        isDuplicateError: true,
        field: extractFieldFromError(message, config),
        message: `This ${config?.description || table} already exists. Check your input.`,
        recoveryAction: 'SHOW_DIALOG',
      };
    
    case '23503': // Foreign key constraint violation
      return {
        code,
        isDuplicateError: false, // Not a duplicate; missing FK
        message: `Referenced item doesn't exist. Create it first.`,
        recoveryAction: 'SHOW_DIALOG',
      };
    
    case '42P01': // Undefined table
      return {
        code,
        isDuplicateError: false,
        message: `Table schema error. Contact support.`,
        recoveryAction: 'SKIP',
      };
    
    default:
      return {
        code,
        isDuplicateError: false,
        message: message || 'Unknown database error',
        recoveryAction: 'SKIP',
      };
  }
}

/**
 * Extract field name from Postgres error message
 */
function extractFieldFromError(
  message: string,
  config?: DedupeConfig
): string | undefined {
  // Postgres error format: Key (field)=(value) already exists
  const match = message.match(/Key\s+\(([^)]+)\)/i);
  if (match) {
    return match[1];
  }
  
  // Fallback: use first deduped field
  return config?.fields[0];
}

// ============================================================================
// MIGRATION HELPERS
// ============================================================================

/**
 * Get deduplication requirements for API endpoint
 * Used to document expected behavior in endpoint implementations
 */
export function getDedupeRequirementsForTable(table: string): string[] {
  const config = DEDUPE_SCHEMAS[table];
  if (!config || !config.enabled) {
    return [];
  }
  
  return [
    `Check for duplicates: ${config.fields.join(', ')}`,
    `Source: ${config.source}`,
    `Strict Mode: ${config.strictMode ? 'Block on duplicate' : 'Warn on duplicate'}`,
    `Description: ${config.description || 'See schema'}`,
  ];
}

/**
 * Generate SQL index verification query
 * Used in testing to verify database state
 */
export function generateIndexVerificationSQL(table: string): string {
  const config = DEDUPE_SCHEMAS[table];
  if (!config || !config.enabled) {
    return `-- No deduplication for ${table}`;
  }
  
  // This is a template; actual index name depends on Postgres
  return `
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = '${table}'
  AND (indexname ILIKE '%${config.fields[0]}%'
    OR indexname ILIKE '%uq%'
    OR indexname ILIKE '%unique%');
  `.trim();
}

// ============================================================================
// DEDUP DOCUMENTATION EXPORT
// ============================================================================

/**
 * Generate markdown documentation of deduplication rules
 */
export function generateDedupeDocumentation(): string {
  const lines: string[] = [
    '# Deduplication Rules by Table',
    '',
    '## Overview',
    'Three-tier deduplication strategy:',
    '1. **UNIQUE_CONSTRAINT** - Database UNIQUE indexes (enforced at DB)',
    '2. **DERIVED_FROM_UI_DB** - App-level checks via fingerprinting',
    '3. **UNDETERMINED** - No deduplication (multiple allowed)',
    '',
    '## Configuration',
    '',
  ];
  
  for (const [table, config] of Object.entries(DEDUPE_SCHEMAS)) {
    lines.push(`### ${table}`);
    lines.push(`- **Enabled**: ${config.enabled}`);
    lines.push(`- **Source**: ${config.source}`);
    lines.push(`- **Strict Mode**: ${config.strictMode}`);
    lines.push(`- **Fields**: ${config.fields.join(', ') || '(none)'}`);
    if (config.description) {
      lines.push(`- **Description**: ${config.description}`);
    }
    lines.push('');
  }
  
  return lines.join('\n');
}
