/**
 * AlphaShield Integration
 * Logging, Safe Mode, and debugging utilities for AlphaCore mutations
 */

import { createClient } from '@/lib/supabase/browser';
import type { ErrorDetail, MutationMetadata } from './types';

export interface SafeModeState {
  enabled: boolean;
  errorCount: number;
  lastErrorTime: number;
  errors: Array<{
    code: string;
    message: string;
    table: string;
    timestamp: number;
    mutationId: string;
  }>;
}

export interface DebugBundle {
  timestamp: string;
  userAgent: string;
  userId?: string;
  errors: ErrorDetail[];
  recentMutations: MutationMetadata[];
  systemLogs: Array<{
    id: string;
    title: string;
    type: string;
    created_at: string;
  }>;
}

// ============================================================================
// SAFE MODE MANAGER
// ============================================================================

const SAFE_MODE_THRESHOLD = 3; // errors
const SAFE_MODE_WINDOW = 60 * 1000; // 60 seconds

class SafeModeManager {
  private state: SafeModeState = {
    enabled: false,
    errorCount: 0,
    lastErrorTime: 0,
    errors: [],
  };
  
  private cleanupTimer: NodeJS.Timeout | null = null;

  addError(error: SafeModeState['errors'][0]) {
    this.state.errors.push(error);
    this.state.errorCount += 1;
    this.state.lastErrorTime = Date.now();
    
    // Check if safe mode should be enabled
    if (this.state.errorCount >= SAFE_MODE_THRESHOLD) {
      const oldestError = this.state.errors[this.state.errors.length - SAFE_MODE_THRESHOLD];
      const timeSinceOldest = Date.now() - oldestError.timestamp;
      
      if (timeSinceOldest <= SAFE_MODE_WINDOW) {
        this.enableSafeMode();
      }
    }
    
    // Schedule cleanup
    if (this.cleanupTimer) clearTimeout(this.cleanupTimer);
    this.cleanupTimer = setTimeout(() => this.resetIfNeeded(), SAFE_MODE_WINDOW);
  }

  private enableSafeMode() {
    this.state.enabled = true;
    console.error('[AlphaShield] Safe Mode ENABLED - 3+ errors in 60s');
  }

  private resetIfNeeded() {
    const now = Date.now();
    this.state.errors = this.state.errors.filter(
      (e) => now - e.timestamp < SAFE_MODE_WINDOW
    );
    this.state.errorCount = this.state.errors.length;
    
    if (this.state.errors.length < SAFE_MODE_THRESHOLD) {
      this.state.enabled = false;
      console.log('[AlphaShield] Safe Mode DISABLED - error window cleared');
    }
  }

  getState(): SafeModeState {
    return { ...this.state };
  }

  clearErrors() {
    this.state.errors = [];
    this.state.errorCount = 0;
    this.state.enabled = false;
    if (this.cleanupTimer) clearTimeout(this.cleanupTimer);
  }
}

export const safeModeManager = new SafeModeManager();

// ============================================================================
// MUTATION ERROR LOGGER
// ============================================================================

export interface MutationErrorOptions {
  code?: string;
  message: string;
  stack?: string;
  table: string;
  operation: 'create' | 'update' | 'delete' | 'restore';
  context?: Record<string, unknown>;
  fingerprint: string;
  mutationId: string;
}

/**
 * Log mutation error with categorization and Safe Mode tracking
 */
export async function logMutationError(options: MutationErrorOptions) {
  const error: ErrorDetail = {
    code: options.code,
    message: options.message,
    stack: options.stack,
    area: options.table,
    context: sanitizeContext(options.context || {}),
    fingerprint: options.fingerprint,
    timestamp: Date.now(),
  };
  
  // Add to Safe Mode tracking
  safeModeManager.addError({
    code: options.code || 'UNKNOWN',
    message: options.message,
    table: options.table,
    timestamp: Date.now(),
    mutationId: options.mutationId,
  });
  
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    
    // Categorize error for UI
    const category = categorizeError(options.code || '');
    
    // Log to app_logs
    const { error: logError } = await supabase.from('app_logs').insert({
      user_id: user?.id,
      title: `${options.operation.toUpperCase()} ERROR on ${options.table}`,
      notes: `${options.message}\n\nMutation: ${options.mutationId}\nFingerprint: ${options.fingerprint}`,
      category_id: category, // 'system' or specific category
      type: `mutation_error_${options.code || 'unknown'}`,
      fingerprint: options.fingerprint,
    });
    
    if (logError) {
      console.error('[AlphaShield] Failed to log error:', logError);
    } else {
      console.error('[AlphaShield] Error logged:', options.message);
    }
  } catch (err) {
    console.error('[AlphaShield] Failed to log mutation error:', err);
  }
}

/**
 * Categorize error code for logging
 */
function categorizeError(code: string): string {
  // Map error codes to categories
  const categoryMap: Record<string, string> = {
    '23505': 'duplicate_key', // Unique constraint violation
    '23503': 'foreign_key', // FK violation
    '42P01': 'undefined_table',
    '42703': 'undefined_column',
    'UNAUTH': 'authentication',
    'FORBIDDEN': 'authorization',
    'TIMEOUT': 'timeout',
    'NETWORK': 'network',
  };
  
  return categoryMap[code] || 'system';
}

/**
 * Sanitize context for logging (remove PII)
 */
function sanitizeContext(context: Record<string, unknown>): Record<string, unknown> {
  const sanitized = { ...context };
  const sensitiveFields = [
    'password',
    'token',
    'secret',
    'apiKey',
    'api_key',
    'email',
    'phone',
    'ssn',
    'creditCard',
  ];
  
  sensitiveFields.forEach((field) => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  });
  
  return sanitized;
}

// ============================================================================
// DEBUG BUNDLE GENERATION
// ============================================================================

/**
 * Generate debug bundle for error reporting
 */
export async function generateDebugBundle(): Promise<DebugBundle | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    
    // Fetch recent system logs
    const { data: logs } = await supabase
      .from('app_logs')
      .select('id, title, type, created_at')
      .match({ type: 'mutation_error' })
      .order('created_at', { ascending: false })
      .limit(20);
    
    const safeMode = safeModeManager.getState();
    
    const bundle: DebugBundle = {
      timestamp: new Date().toISOString(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      userId: user?.id,
      errors: safeMode.errors.map((e) => ({
        code: e.code,
        message: e.message,
        stack: undefined,
        area: e.table,
        context: { mutationId: e.mutationId },
        fingerprint: e.code + ':' + e.table,
        timestamp: Date.now(),
      })),
      recentMutations: [],
      systemLogs: logs || [],
    };
    
    return bundle;
  } catch (err) {
    console.error('[AlphaShield] Failed to generate debug bundle:', err);
    return null;
  }
}

/**
 * Copy debug bundle to clipboard as JSON
 */
export async function copyDebugBundleToClipboard(): Promise<boolean> {
  try {
    const bundle = await generateDebugBundle();
    if (!bundle) return false;
    
    const json = JSON.stringify(bundle, null, 2);
    
    if (navigator?.clipboard) {
      await navigator.clipboard.writeText(json);
      return true;
    }
    
    return false;
  } catch (err) {
    console.error('[AlphaShield] Failed to copy debug bundle:', err);
    return false;
  }
}

/**
 * Generate AI-friendly error prompt for copying to Claude
 */
export async function generateErrorPrompt(): Promise<string> {
  try {
    const bundle = await generateDebugBundle();
    if (!bundle) return '';
    
    const prompt = `
## AlphaLog Error Report
**Timestamp:** ${bundle.timestamp}
**User ID:** ${bundle.userId || 'unknown'}

### Recent Errors (Safe Mode: ${bundle.errors.length >= 3 ? 'ENABLED' : 'disabled'})
${bundle.errors.map((e) => `- **${e.code}** on ${e.area}: ${e.message}`).join('\n')}

### System Logs
${bundle.systemLogs.map((l) => `- ${l.title} (${l.type}) at ${l.created_at}`).join('\n')}

### Debug Data (JSON)
\`\`\`json
${JSON.stringify(bundle, null, 2)}
\`\`\`

Please help diagnose this issue.
    `.trim();
    
    return prompt;
  } catch (err) {
    console.error('[AlphaShield] Failed to generate error prompt:', err);
    return '';
  }
}

// ============================================================================
// DUPLICATE KEY DETECTION
// ============================================================================

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  existingId?: string;
  fingerprintMatch?: boolean;
  reason?: string;
}

/**
 * Check if a record likely exists (dedupe check)
 * Uses fingerprinting to find potential duplicates
 */
export async function checkForDuplicate(
  table: string,
  fingerprint: string,
  excludeId?: string
): Promise<DuplicateCheckResult> {
  try {
    const supabase = await createClient();
    
    // Query app_logs for recent entries with this fingerprint
    const { data: logs, error } = await supabase
      .from('app_logs')
      .select('id, notes')
      .match({ fingerprint, type: `mutation_success` })
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (error) {
      return { isDuplicate: false, reason: 'check_failed' };
    }
    
    if (logs && logs.length > 0) {
      // Extract entity ID from notes if possible
      const notes = logs[0].notes || '';
      const idMatch = notes.match(/ID:\s*([a-f0-9-]+)/i);
      
      return {
        isDuplicate: true,
        existingId: idMatch ? idMatch[1] : undefined,
        fingerprintMatch: true,
        reason: 'found_recent_fingerprint_match',
      };
    }
    
    return { isDuplicate: false, reason: 'no_match_found' };
  } catch (err) {
    console.error('[AlphaShield] Duplicate check failed:', err);
    return { isDuplicate: false, reason: 'check_error' };
  }
}

// ============================================================================
// UI HELPERS
// ============================================================================

/**
 * Get Safe Mode status badge for UI
 */
export function getSafeModeBadge(): {
  enabled: boolean;
  errorCount: number;
  message: string;
} {
  const state = safeModeManager.getState();
  
  return {
    enabled: state.enabled,
    errorCount: state.errorCount,
    message: state.enabled
      ? `Safe Mode ACTIVE (${state.errorCount} errors in 60s)`
      : `Nominal (${state.errorCount} errors)`,
  };
}

/**
 * Clear error state (for manual recovery)
 */
export function clearSafeModeErrors() {
  safeModeManager.clearErrors();
  console.log('[AlphaShield] Safe Mode errors cleared by user');
}
/**
 * Get Top 5 most common errors for dashboard display
 */
export function getTopBugs(limit: number = 5): Array<{
  code: string;
  message: string;
  count: number;
  lastOccurred: Date;
}> {
  const state = safeModeManager.getState();
  
  // Group errors by code and count occurrences
  const errorMap = new Map<string, {
    code: string;
    message: string;
    count: number;
    lastOccurred: number;
  }>();

  state.errors.forEach(err => {
    const key = err.code;
    const existing = errorMap.get(key);
    
    if (existing) {
      existing.count++;
      existing.lastOccurred = Math.max(existing.lastOccurred, err.timestamp);
    } else {
      errorMap.set(key, {
        code: err.code,
        message: err.message,
        count: 1,
        lastOccurred: err.timestamp
      });
    }
  });

  // Sort by frequency and return top N
  return Array.from(errorMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map(err => ({
      ...err,
      lastOccurred: new Date(err.lastOccurred)
    }));
}

/**
 * Get formatted error log for display
 */
export function getFormattedErrorLog(): Array<{
  timestamp: string;
  code: string;
  message: string;
  table: string;
  id: string;
}> {
  const state = safeModeManager.getState();
  
  return state.errors.map(err => ({
    timestamp: new Date(err.timestamp).toISOString(),
    code: err.code,
    message: err.message,
    table: err.table,
    id: err.mutationId
  }));
}

/**
 * Check if Safe Mode is currently active
 */
export function isSafeModeActive(): boolean {
  return safeModeManager.getState().enabled;
}

/**
 * Get Safe Mode time remaining (in seconds)
 */
export function getSafeModeTimeRemaining(): number {
  const state = safeModeManager.getState();
  if (!state.enabled) return 0;
  
  const elapsed = Date.now() - state.lastErrorTime;
  const remaining = Math.max(0, SAFE_MODE_WINDOW - elapsed);
  return Math.ceil(remaining / 1000); // Return seconds
}

/**
 * Generate user-friendly error message from error code
 */
export function getErrorExplanation(code: string): string {
  const explanations: Record<string, string> = {
    '23505': 'A record with this information already exists. Please check your data and try again.',
    '23503': 'A referenced record was not found. Please verify all relationships are correct.',
    '23514': 'The data does not match the required format. Please review your input.',
    '23502': 'A required field is missing. Please fill in all mandatory fields.',
    'NETWORK_ERROR': 'Unable to connect to the server. Please check your internet connection.',
    'TIMEOUT': 'The operation took too long. Please try again.',
    'AUTH_ERROR': 'Authentication failed. Please log in again.',
  };

  return explanations[code] || 'An unexpected error occurred. Please try again later.';
}

/**
 * Get recovery action suggestion
 */
type SuggestionContext = { table?: string; field?: string };
export function getSuggestedAction(code: string, context?: SuggestionContext): string {
  const actions: Record<string, (ctx?: SuggestionContext) => string> = {
    '23505': (ctx) => `A duplicate entry was found in ${ctx?.table || 'the system'}. Try using different values or updating the existing record.`,
    '23503': (ctx) => `Check that all required references in ${ctx?.table || 'your data'} are correct.`,
    '23514': (ctx) => `Verify the data format for ${ctx?.field || 'the field'} matches the required type.`,
    'NETWORK_ERROR': () => 'Check your internet connection and try again.',
    'TIMEOUT': () => 'The server was busy. Please try your operation again in a moment.',
    'AUTH_ERROR': () => 'Please log out and log back in to refresh your session.',
  };

  const actionFn = actions[code];
  return actionFn ? actionFn(context) : 'Please review your data and try again.';
}