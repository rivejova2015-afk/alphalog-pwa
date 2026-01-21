/**
 * AlphaCore Deduplication Checker
 * Runtime validation for preventing duplicate entries before submission
 * 
 * This module provides pre-submission dedup validation across 40+ entities.
 * Works seamlessly with offline-first architecture:
 * - Online: checks against live database via Supabase
 * - Offline: checks against local IndexedDB metadata
 * 
 * Integration point: Call preSubmitDedupeCheck() BEFORE enqueuing mutations
 */

import type { BaseFields } from '@/lib/alphacore/types';
import { DEDUPE_SCHEMAS } from '@/lib/alphacore/dedupe';
import { getMetadata, storeMetadata } from '@/lib/alphacore/offline/idb';
import { createClient } from '@/lib/supabase/browser';

/**
 * Runtime dedup check result
 */
export interface DedupeCheckResult {
  isDuplicate: boolean;
  confidence: 'certain' | 'likely' | 'unknown';
  existingId?: string;
  existingRecord?: Record<string, any>;
  strategy: 'unique_constraint' | 'derived' | 'undetermined' | 'offline';
  message?: string;
}

/**
 * Pre-submission validation context
 */
export interface DedupeValidationContext {
  table: string;
  operation: 'create' | 'update' | 'delete';
  data: Record<string, any>;
  userId?: string;
  isOnline: boolean;
}

/**
 * Main pre-submission duplicate checker
 * Call this BEFORE mutateOfflineFirst() to validate
 * 
 * @param context Validation context with table, operation, data
 * @returns DedupeCheckResult with duplicate detection
 * 
 * @example
 * const result = await preSubmitDedupeCheck({
 *   table: 'trades',
 *   operation: 'create',
 *   data: { symbol: 'AAPL', direction: 'long', entry_price: 150.25 },
 *   isOnline: navigator.onLine
 * });
 * 
 * if (result.isDuplicate) {
 *   showError(`Duplicate trade detected! Existing trade ID: ${result.existingId}`);
 * } else {
 *   await mutateOfflineFirst('trades', 'create', data);
 * }
 */
export async function preSubmitDedupeCheck(
  context: DedupeValidationContext
): Promise<DedupeCheckResult> {
  const { table, operation, data, userId, isOnline } = context;

  // Skip check for updates and deletes (no new data to duplicate)
  if (operation !== 'create') {
    return {
      isDuplicate: false,
      confidence: 'certain',
      strategy: 'undetermined',
      message: 'Updates and deletes skip dedup check'
    };
  }

  // Get schema for this table
  const schema = DEDUPE_SCHEMAS[table as keyof typeof DEDUPE_SCHEMAS];
  if (!schema || !schema.enabled) {
    return {
      isDuplicate: false,
      confidence: 'unknown',
      strategy: 'undetermined',
      message: `No active dedup schema for table: ${table}`
    };
  }

  // Skip if source is UNDETERMINED
  if (schema.source === 'UNDETERMINED') {
    return {
      isDuplicate: false,
      confidence: 'unknown',
      strategy: 'undetermined',
      message: `Dedup strategy undetermined for table: ${table}`
    };
  }

  // Priority 1: UNIQUE_CONSTRAINT checks
  if (schema.source === 'UNIQUE_CONSTRAINT') {
    const uniqueCheckResult = await checkUniqueConstraint(
      table,
      schema.fields,
      data,
      userId,
      isOnline
    );
    if (uniqueCheckResult.isDuplicate) {
      return uniqueCheckResult;
    }
  }

  // Priority 2: DERIVED_FROM_UI_DB checks
  if (schema.source === 'DERIVED_FROM_UI_DB') {
    const derivedCheckResult = await checkDerivedFields(
      table,
      schema.fields,
      data,
      userId,
      isOnline
    );
    if (derivedCheckResult.isDuplicate) {
      return derivedCheckResult;
    }
  }

  // No duplicate found
  return {
    isDuplicate: false,
    confidence: 'likely',
    strategy: schema.source as any,
    message: `No duplicate found for ${table}`
  };
}

/**
 * Check UNIQUE_CONSTRAINT strategy
 * Validates unique column combinations
 */
async function checkUniqueConstraint(
  table: string,
  uniqueFields: string[],
  data: Record<string, any>,
  userId?: string,
  isOnline: boolean = true
): Promise<DedupeCheckResult> {
  try {
    if (isOnline) {
      // Online: check live database
      return await checkUniqueConstraintOnline(
        table,
        uniqueFields,
        data,
        userId
      );
    } else {
      // Offline: check local metadata
      return await checkUniqueConstraintOffline(
        table,
        uniqueFields,
        data,
        userId
      );
    }
  } catch (error) {
    console.error('UNIQUE_CONSTRAINT check failed:', error);
    return {
      isDuplicate: false,
      confidence: 'unknown',
      strategy: 'unique_constraint',
      message: `Constraint check failed: ${error instanceof Error ? error.message : 'unknown'}`
    };
  }
}

/**
 * Online unique constraint check against Supabase
 */
async function checkUniqueConstraintOnline(
  table: string,
  uniqueFields: string[],
  data: Record<string, any>,
  userId?: string
): Promise<DedupeCheckResult> {
  const supabase = await createClient();

  // Build query filter from unique fields
  const filterObj: Record<string, any> = {};
  uniqueFields.forEach(field => {
    filterObj[field] = data[field];
  });

  // Add user filter if applicable (for user-scoped tables)
  const userScopedTables = ['trades', 'analytics', 'notes', 'journal_entries', 'custom_alerts'];
  if (userScopedTables.includes(table) && userId) {
    filterObj.user_id = userId;
  }

  // Query Supabase
  let query = supabase.from(table).select('id, *');

  // Apply filters
  Object.entries(filterObj).forEach(([key, value]) => {
    query = query.eq(key, value);
  });

  const { data: existing, error } = await query.limit(1);

  if (error) {
    console.error(`Unique constraint check failed for ${table}:`, error);
    return {
      isDuplicate: false,
      confidence: 'unknown',
      strategy: 'unique_constraint',
      message: `Query failed: ${error.message}`
    };
  }

  if (existing && existing.length > 0) {
    return {
      isDuplicate: true,
      confidence: 'certain',
      existingId: existing[0].id,
      existingRecord: existing[0],
      strategy: 'unique_constraint',
      message: `Duplicate found: ${uniqueFields.join(', ')} combination already exists`
    };
  }

  return {
    isDuplicate: false,
    confidence: 'certain',
    strategy: 'unique_constraint',
    message: `No duplicate: ${uniqueFields.join(', ')} is unique`
  };
}

/**
 * Offline unique constraint check against local metadata
 */
async function checkUniqueConstraintOffline(
  table: string,
  uniqueFields: string[],
  data: Record<string, any>,
  userId?: string
): Promise<DedupeCheckResult> {
  try {
    // Create fingerprint from unique fields
    const fingerprint = createFingerprint(
      uniqueFields.map(f => data[f]).join('|')
    );

    // Check local metadata (stored by previous syncs)
    const existingMetadata = await getMetadata(table, 'unique', uniqueFields.join(','));

    if (existingMetadata === fingerprint) {
      return {
        isDuplicate: true,
        confidence: 'likely',
        strategy: 'offline',
        message: `Offline: Likely duplicate (metadata match)`
      };
    }

    // Store this fingerprint for future checks
    await storeMetadata(
      table,
      'unique',
      uniqueFields.join(','),
      fingerprint
    );

    return {
      isDuplicate: false,
      confidence: 'likely',
      strategy: 'offline',
      message: `Offline: No known duplicate`
    };
  } catch (error) {
    console.error('Offline unique constraint check failed:', error);
    return {
      isDuplicate: false,
      confidence: 'unknown',
      strategy: 'offline',
      message: `Offline check failed: ${error instanceof Error ? error.message : 'unknown'}`
    };
  }
}

/**
 * Check DERIVED_FROM_UI_DB strategy
 * Validates derived/computed field combinations
 */
async function checkDerivedFields(
  table: string,
  derivedFields: string[],
  data: Record<string, any>,
  userId?: string,
  isOnline: boolean = true
): Promise<DedupeCheckResult> {
  try {
    if (isOnline) {
      return await checkDerivedFieldsOnline(
        table,
        derivedFields,
        data,
        userId
      );
    } else {
      return await checkDerivedFieldsOffline(
        table,
        derivedFields,
        data,
        userId
      );
    }
  } catch (error) {
    console.error('DERIVED_FROM_UI_DB check failed:', error);
    return {
      isDuplicate: false,
      confidence: 'unknown',
      strategy: 'derived',
      message: `Derived check failed: ${error instanceof Error ? error.message : 'unknown'}`
    };
  }
}

/**
 * Online derived fields check
 */
async function checkDerivedFieldsOnline(
  table: string,
  derivedFields: string[],
  data: Record<string, any>,
  userId?: string
): Promise<DedupeCheckResult> {
  const supabase = await createClient();

  // Build query filter from all fields
  const filterObj: Record<string, any> = {};
  derivedFields.forEach(field => {
    if (data[field] !== undefined) {
      filterObj[field] = data[field];
    }
  });

  // Add user filter if applicable
  const userScopedTables = ['trades', 'analytics', 'notes', 'journal_entries', 'custom_alerts', 'accounts', 'setups'];
  if (userScopedTables.includes(table) && userId) {
    filterObj.user_id = userId;
  }

  if (Object.keys(filterObj).length === 0) {
    return {
      isDuplicate: false,
      confidence: 'unknown',
      strategy: 'derived',
      message: 'No valid fields to check'
    };
  }

  let query = supabase.from(table).select('id, *');

  Object.entries(filterObj).forEach(([key, value]) => {
    query = query.eq(key, value);
  });

  const { data: existing, error } = await query.limit(1);

  if (!error && existing && existing.length > 0) {
    return {
      isDuplicate: true,
      confidence: 'likely',
      existingId: existing[0].id,
      existingRecord: existing[0],
      strategy: 'derived',
      message: `Derived duplicate found: ${derivedFields.join(', ')} combination already exists`
    };
  }

  return {
    isDuplicate: false,
    confidence: 'likely',
    strategy: 'derived',
    message: `No derived duplicate found`
  };
}

/**
 * Offline derived fields check
 */
async function checkDerivedFieldsOffline(
  table: string,
  derivedFields: string[],
  data: Record<string, any>,
  userId?: string
): Promise<DedupeCheckResult> {
  try {
    // Create fingerprint from all fields
    const fingerprint = createFingerprint(
      derivedFields.map(f => data[f]).filter(v => v !== undefined).join('|')
    );

    if (!fingerprint) {
      return {
        isDuplicate: false,
        confidence: 'unknown',
        strategy: 'offline',
        message: 'No valid data to fingerprint'
      };
    }

    const metadataKey = `derived_${derivedFields.join('_')}`;
    const existingMetadata = await getMetadata(table, 'derived', metadataKey);

    if (existingMetadata === fingerprint) {
      return {
        isDuplicate: true,
        confidence: 'likely',
        strategy: 'offline',
        message: `Offline: Likely derived duplicate (${derivedFields.join(', ')})`
      };
    }

    await storeMetadata(table, 'derived', metadataKey, fingerprint);

    return {
      isDuplicate: false,
      confidence: 'likely',
      strategy: 'offline',
      message: `Offline: No derived duplicates found`
    };
  } catch (error) {
    console.error('Offline derived check failed:', error);
    return {
      isDuplicate: false,
      confidence: 'unknown',
      strategy: 'offline',
      message: `Offline check failed: ${error instanceof Error ? error.message : 'unknown'}`
    };
  }
}

/**
 * Create SHA-256 fingerprint from string
 * Used for metadata storage
 */
function createFingerprint(input: string): string {
  // Simple hash function (in production, use crypto.subtle.digest)
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16);
}

/**
 * Interpret database error as duplicate
 * Called after mutation fails with error code
 * 
 * @param table Table name
 * @param errorCode PostgreSQL error code (e.g., '23505')
 * @param errorDetail Full error message
 * @returns Duplicate interpretation
 */
export function interpretDatabaseError(
  table: string,
  errorCode: string,
  errorDetail: string
): { isDuplicate: boolean; reason: string } {
  // PostgreSQL unique constraint violation
  if (errorCode === '23505') {
    return {
      isDuplicate: true,
      reason: 'Unique constraint violation - duplicate already exists'
    };
  }

  // PostgreSQL foreign key violation
  if (errorCode === '23503') {
    return {
      isDuplicate: false,
      reason: 'Foreign key violation - referenced record not found'
    };
  }

  // Duplicate key errors (varies by field)
  if (errorDetail.toLowerCase().includes('duplicate')) {
    return {
      isDuplicate: true,
      reason: `Duplicate detected: ${errorDetail}`
    };
  }

  return {
    isDuplicate: false,
    reason: `Unknown error: ${errorDetail}`
  };
}

/**
 * Get all dedup schemas for documentation
 * Used by DEDUPE_KEYS.md generation
 */
export function getAllDedupeSchemas() {
  return DEDUPE_SCHEMAS;
}

/**
 * Export dedup configuration for debugging
 */
export function exportDedupeConfig() {
  const tables = Object.keys(DEDUPE_SCHEMAS);
  const config = {
    totalTables: tables.length,
    byStrategy: {
      UNIQUE_CONSTRAINT: 0,
      DERIVED_FROM_UI_DB: 0,
      UNDETERMINED: 0
    },
    tables: {} as Record<string, any>
  };

  tables.forEach(table => {
    const schema = DEDUPE_SCHEMAS[table as keyof typeof DEDUPE_SCHEMAS];
    config.byStrategy[schema.source]++;
    config.tables[table] = {
      enabled: schema.enabled,
      strategy: schema.source,
      fields: schema.fields || [],
      strictMode: schema.strictMode
    };
  });

  return config;
}
