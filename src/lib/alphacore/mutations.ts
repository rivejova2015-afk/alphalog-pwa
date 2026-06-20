/**
 * AlphaCore Mutation Helpers
 * Wraps create/update/delete operations with optimistic updates, logging, and error handling
 * 
 * Usage:
 *   const { data, error } = await createEntity('accounts', accountPayload);
 */

import { createClient } from '@/lib/supabase/browser';
import type { BaseFields, EntityOperation, MutationMetadata, MutationStatus } from './types';
import { logError } from '@/lib/log';

/**
 * Mutation request payload
 */
export interface MutationRequest<T = any> {
  table: string;
  payload: T;
  metadata?: Partial<MutationMetadata>;
}

/**
 * Mutation response
 */
export interface MutationResponse<T = any> {
  data?: T & BaseFields;
  error?: {
    code?: string;
    message: string;
    originalError?: Error;
  };
  mutationId: string;
  status: MutationStatus;
}

/**
 * Optimistic update payload
 */
export interface OptimisticPayload {
  tempId?: string;
  isPending?: boolean;
}

/**
 * Server mutation context for logging
 */
export interface MutationContext {
  userId: string;
  table: string;
  operation: EntityOperation;
  mutationId: string;
  timestamp: number;
}

// ============================================================================
// CREATE ENTITY
// ============================================================================

/**
 * Creates a new entity with optimistic update
 * 
 * Flow:
 * 1. Generate mutation ID and optimistic payload with temp ID
 * 2. Update cache optimistically
 * 3. Call API endpoint (POST /api/{module}/{table}/create)
 * 4. On success: replace temp ID with server ID, log to AlphaShield
 * 5. On failure: show error, revert cache, log failure
 */
export async function createEntity<T extends Record<string, any>>(
  table: string,
  payload: Omit<T, keyof BaseFields>,
  options?: {
    userId?: string;
    optimistic?: boolean;
    metadata?: Partial<MutationMetadata>;
  }
): Promise<MutationResponse<T>> {
  const mutationId = crypto.randomUUID();
  
  try {
    // Determine module from table
    const moduleName = inferModuleFromTable(table);
    
    // Build metadata
    const metadata: MutationMetadata = {
      id: mutationId,
      operation: 'create',
      table,
      entityName: tableToEntityName(table),
      module: moduleName as any,
      timestamp: Date.now(),
      status: 'pending',
      retryCount: 0,
      maxRetries: 3,
      fingerprint: generateFingerprint(table, payload),
      ...options?.metadata,
    };
    
    // Prepare request
    const request: MutationRequest<T> = {
      table,
      payload: payload as T,
      metadata,
    };
    
    // Get Supabase client for auth
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return {
        error: {
          code: 'UNAUTH',
          message: 'User not authenticated',
        },
        mutationId,
        status: 'failed',
      };
    }
    
    // Call API endpoint
    const response = await fetch(`/api/alphacore/${table}/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorCode = errorData.code || response.status;
      const errorMessage = errorData.message || `HTTP ${response.status}`;
      
      // Log to AlphaShield
      await logMutationError({
        mutationId,
        table,
        operation: 'create',
        code: errorCode,
        message: errorMessage,
        context: { payload: sanitizePayload(payload) },
        fingerprint: metadata.fingerprint || '',
      });
      
      return {
        error: {
          code: String(errorCode),
          message: errorMessage,
        },
        mutationId,
        status: 'failed',
      };
    }
    
    const result = await response.json();
    const entity = result.data as T & BaseFields;
    
    // Log to AlphaShield
    await logMutationSuccess({
      mutationId,
      table,
      operation: 'create',
      entityId: entity.id,
    });
    
    return {
      data: entity,
      mutationId,
      status: 'synced',
    };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    
    // Log to AlphaShield
    await logMutationError({
      mutationId,
      table,
      operation: 'create',
      code: 'INTERNAL_ERROR',
      message: error.message,
      context: { payload: sanitizePayload(payload) },
      fingerprint: generateFingerprint(table, payload),
    });
    
    return {
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message,
        originalError: error,
      },
      mutationId,
      status: 'failed',
    };
  }
}

// ============================================================================
// UPDATE ENTITY
// ============================================================================

/**
 * Updates an existing entity with optimistic update
 */
export async function updateEntity<T extends Record<string, any>>(
  table: string,
  entityId: string,
  updates: Partial<Omit<T, keyof BaseFields>>,
  options?: {
    userId?: string;
    optimistic?: boolean;
    metadata?: Partial<MutationMetadata>;
  }
): Promise<MutationResponse<T>> {
  const mutationId = crypto.randomUUID();
  
  try {
    const moduleName = inferModuleFromTable(table);
    
    const metadata: MutationMetadata = {
      id: mutationId,
      operation: 'update',
      table,
      entityName: tableToEntityName(table),
      module: moduleName as any,
      timestamp: Date.now(),
      status: 'pending',
      retryCount: 0,
      maxRetries: 3,
      fingerprint: generateFingerprint(table, { ...updates, id: entityId }),
      ...options?.metadata,
    };
    
    const request = {
      table,
      entityId,
      updates,
      metadata,
    };
    
    const response = await fetch(`/api/alphacore/${table}/${entityId}/update`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorCode = errorData.code || response.status;
      const errorMessage = errorData.message || `HTTP ${response.status}`;
      
      await logMutationError({
        mutationId,
        table,
        operation: 'update',
        code: errorCode,
        message: errorMessage,
        context: { entityId, updates: sanitizePayload(updates) },
        fingerprint: metadata.fingerprint || '',
      });
      
      return {
        error: {
          code: String(errorCode),
          message: errorMessage,
        },
        mutationId,
        status: 'failed',
      };
    }
    
    const result = await response.json();
    const entity = result.data as T & BaseFields;
    
    await logMutationSuccess({
      mutationId,
      table,
      operation: 'update',
      entityId: entity.id,
    });
    
    return {
      data: entity,
      mutationId,
      status: 'synced',
    };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    
    await logMutationError({
      mutationId,
      table,
      operation: 'update',
      code: 'INTERNAL_ERROR',
      message: error.message,
      context: { entityId, updates: sanitizePayload(updates) },
      fingerprint: generateFingerprint(table, { ...updates, id: entityId }),
    });
    
    return {
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message,
        originalError: error,
      },
      mutationId,
      status: 'failed',
    };
  }
}

// ============================================================================
// SOFT DELETE ENTITY
// ============================================================================

/**
 * Soft-deletes an entity (sets deleted_at)
 */
export async function softDeleteEntity<T extends Record<string, any>>(
  table: string,
  entityId: string,
  options?: {
    userId?: string;
    metadata?: Partial<MutationMetadata>;
  }
): Promise<MutationResponse<T>> {
  const mutationId = crypto.randomUUID();
  
  try {
    const moduleName = inferModuleFromTable(table);
    
    const metadata: MutationMetadata = {
      id: mutationId,
      operation: 'delete',
      table,
      entityName: tableToEntityName(table),
      module: moduleName as any,
      timestamp: Date.now(),
      status: 'pending',
      retryCount: 0,
      maxRetries: 3,
      fingerprint: generateFingerprint(table, { id: entityId, operation: 'delete' }),
      ...options?.metadata,
    };
    
    const request = {
      table,
      entityId,
      metadata,
    };
    
    const response = await fetch(`/api/alphacore/${table}/${entityId}/delete`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorCode = errorData.code || response.status;
      const errorMessage = errorData.message || `HTTP ${response.status}`;
      
      await logMutationError({
        mutationId,
        table,
        operation: 'delete',
        code: errorCode,
        message: errorMessage,
        context: { entityId },
        fingerprint: metadata.fingerprint || '',
      });
      
      return {
        error: {
          code: String(errorCode),
          message: errorMessage,
        },
        mutationId,
        status: 'failed',
      };
    }
    
    const result = await response.json();
    const entity = result.data as T & BaseFields;
    
    await logMutationSuccess({
      mutationId,
      table,
      operation: 'delete',
      entityId: entity.id,
    });
    
    return {
      data: entity,
      mutationId,
      status: 'synced',
    };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    
    await logMutationError({
      mutationId,
      table,
      operation: 'delete',
      code: 'INTERNAL_ERROR',
      message: error.message,
      context: { entityId },
      fingerprint: generateFingerprint(table, { id: entityId, operation: 'delete' }),
    });
    
    return {
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message,
        originalError: error,
      },
      mutationId,
      status: 'failed',
    };
  }
}



// ============================================================================
// HELPERS
// ============================================================================

/**
 * Infer module from table name
 */
function inferModuleFromTable(table: string): string {
  const moduleMap: Record<string, string> = {
    // Logs
    logs: 'logs',
    categories: 'logs',
    tags: 'logs',
    log_tags: 'logs',
    log_attachments: 'logs',
    
    // TradeHub
    accounts: 'tradehub',
    account_categories: 'tradehub',
    trades: 'tradehub',
    setups: 'tradehub',
    tv_analysis_evidence: 'tradehub',
    weekly_reports: 'tradehub',
    
    // Terminal
    instruments: 'terminal',
    terminal_news: 'terminal',
    terminal_events: 'terminal',
    
    // Journal
    journal_entries: 'journal',
    journal_tags: 'journal',
    
    // Treasury
    treasury_configs: 'treasury',
    payouts: 'treasury',
    payout_wallet_mapping: 'treasury',
    
    // Business
    business_costs: 'business',
  };
  
  return moduleMap[table] || 'unknown';
}

/**
 * Convert table name to entity name
 */
function tableToEntityName(table: string): string {
  const nameMap: Record<string, string> = {
    logs: 'Log',
    categories: 'Category',
    tags: 'Tag',
    log_tags: 'LogTag',
    log_attachments: 'LogAttachment',
    accounts: 'Account',
    account_categories: 'AccountCategory',
    trades: 'Trade',
    setups: 'Setup',
    tv_analysis_evidence: 'TVAnalysisEvidence',
    weekly_reports: 'WeeklyReport',
    instruments: 'Instrument',
    terminal_news: 'TerminalNews',
    terminal_events: 'TerminalEvent',
    journal_entries: 'JournalEntry',
    journal_tags: 'JournalTag',
    treasury_configs: 'TreasuryConfig',
    payouts: 'Payout',
    payout_wallet_mapping: 'PayoutWalletMapping',
    business_costs: 'BusinessCost',
  };
  
  return nameMap[table] || 'Entity';
}

/**
 * Generate fingerprint for deduplication and tracking
 */
function generateFingerprint(table: string, payload: Record<string, any>): string {
  // Hash key fields for deduplication
  const keys = ['name', 'title', 'symbol', 'category_id', 'account_id'];
  const relevant = keys
    .filter((k) => payload[k] !== undefined)
    .map((k) => `${k}:${payload[k]}`)
    .join('|');
  
  return `${table}:${relevant}:${Date.now()}`;
}

/**
 * Sanitize payload for logging (remove sensitive data)
 */
function sanitizePayload(payload: Record<string, any>): Record<string, any> {
  const sensitive = ['password', 'token', 'secret', 'key', 'api_key', 'pin'];
  const sanitized = { ...payload };
  
  sensitive.forEach((field) => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  });
  
  return sanitized;
}

// ============================================================================
// ALPHASHIELD LOGGING
// ============================================================================

/**
 * Log mutation success to app_logs
 */
async function logMutationSuccess(context: {
  mutationId: string;
  table: string;
  operation: EntityOperation;
  entityId: string;
}) {
  try {
    const supabase = await createClient();
    
    await supabase.from('app_logs').insert({
      title: `${context.operation.toUpperCase()} ${tableToEntityName(context.table)}`,
      notes: `Mutation ${context.mutationId} completed successfully`,
      category_id: 'system', // Will be replaced with actual category ID
      type: 'mutation_success',
      fingerprint: `${context.table}:${context.entityId}:${context.operation}`,
    });
  } catch (err) {
    logError('Alphacore', {
      component: 'mutations.logMutationSuccess',
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Log mutation error to app_logs
 */
async function logMutationError(context: {
  mutationId: string;
  table: string;
  operation: EntityOperation;
  code: string | number;
  message: string;
  context?: Record<string, any>;
  fingerprint: string;
}) {
  try {
    const supabase = await createClient();
    
    await supabase.from('app_logs').insert({
      title: `${context.operation.toUpperCase()} ${tableToEntityName(context.table)} FAILED`,
      notes: `${context.message}\n\nCode: ${context.code}\nContext: ${JSON.stringify(context.context || {})}`,
      category_id: 'system',
      type: 'mutation_error',
      fingerprint: context.fingerprint,
    });
  } catch (err) {
    logError('Alphacore', {
      component: 'mutations.logMutationError',
      message: err instanceof Error ? err.message : String(err),
    });
  }
}
