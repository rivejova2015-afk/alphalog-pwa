/**
 * AlphaCore Base Types
 * Core types used across the AlphaCore mutation system
 */

import type { ModuleName, SubsectionName } from './moduleRegistry';

/**
 * Base fields present in all entities (from migrations)
 */
export interface BaseFields {
  id: string; // UUID
  user_id: string; // UUID, references auth.users
  created_at: string; // timestamptz
  updated_at: string; // timestamptz
  deleted_at: string | null; // timestamptz, null = active
  sort_index?: number; // int, optional flexible ordering
}

/**
 * Entity operation types
 */
export type EntityOperation = 'create' | 'update' | 'delete' | 'restore';

/**
 * Mutation status
 */
export type MutationStatus = 
  | 'pending'    // Queued, not yet executed
  | 'optimistic' // Applied to cache optimistically
  | 'synced'     // Confirmed with server
  | 'failed'     // Error occurred
  | 'conflict';  // Conflict detected (version mismatch)

/**
 * Mutation metadata for tracking
 */
export interface MutationMetadata {
  id: string; // Unique mutation ID
  operation: EntityOperation;
  table: string;
  entityName?: string; // Human-readable name (e.g., "Account", "Trade")
  module?: ModuleName;
  subsection?: SubsectionName;
  timestamp?: number; // Date.now()
  status?: MutationStatus;
  retryCount?: number;
  maxRetries?: number;
  lastError?: string;
  fingerprint?: string; // For deduplication and error tracking
  /**
   * Custom drain target for the OutboxManager. When set, the outbox POSTs/
   * PATCHes to this URL instead of the generic `/api/alphacore/...` route.
   * Used by feature panels that fall back to the outbox on network errors
   * without migrating to the generic endpoint contract.
   */
  endpoint?: string;
  /** Override HTTP verb. Defaults to operation → verb mapping. */
  method?: string;
  /**
   * Body shape used when draining:
   *   - 'wrapped' (default): `{ payload, metadata, outboxId }` — generic alphacore route
   *   - 'direct': raw payload — domain-specific route that doesn't know about the outbox
   */
  bodyMode?: 'wrapped' | 'direct';
}

/**
 * Optimistic update configuration
 */
export interface OptimisticConfig {
  enabled: boolean;
  tempIdPrefix?: string; // Prefix for temporary IDs (default: 'temp_')
  cacheUpdater?: (payload: any) => void; // Custom cache update logic
}

/**
 * Dedupe configuration
 */
export interface DedupeConfig {
  enabled: boolean;
  fields: string[]; // Fields to check for duplicates
  source: 'UNIQUE_CONSTRAINT' | 'DERIVED_FROM_UI_DB' | 'UNDETERMINED';
  strictMode: boolean; // If true, block insert on duplicate; if false, warn only
  description?: string; // Human-readable description of deduplication rules
}

/**
 * Conflict resolution strategies
 */
export type ConflictResolution = 'keep-local' | 'keep-server' | 'manual';

/**
 * Conflict data for UI
 */
export interface ConflictData {
  mutationId: string;
  table: string;
  entityId: string;
  localVersion: any; // Local payload
  serverVersion: any; // Server payload
  localUpdatedAt?: string;
  serverUpdatedAt?: string;
  conflictFields: string[]; // Fields that differ
}

/**
 * Error detail for AlphaShield logging
 */
export interface ErrorDetail {
  code?: string; // Error code (e.g., '23505' for unique violation)
  message: string;
  stack?: string;
  area: string; // Module name
  context?: Record<string, any>; // Additional context (sanitized)
  fingerprint: string; // Dedupe fingerprint
  timestamp: number;
}

/**
 * Mutation result
 */
export interface MutationResult<T = any> {
  success: boolean;
  data?: T;
  error?: ErrorDetail;
  metadata: MutationMetadata;
  conflictData?: ConflictData;
}

/**
 * Query key structure (React Query)
 */
export interface QueryKey {
  scope: 'list' | 'detail' | 'aggregate';
  module: ModuleName;
  table: string;
  subsection?: SubsectionName;
  filters?: Record<string, any>;
  entityId?: string;
}

/**
 * Safe mode state
 */
export interface SafeModeState {
  active: boolean;
  activatedAt: number | null;
  reason?: string;
  errorCount?: number;
}

/**
 * Outbox entry (offline queue)
 */
export interface OutboxEntry {
  id: string; // UUID for outbox entry
  operation: EntityOperation;
  table: string;
  payload: any; // Entity data
  createdAt: number;
  retryCount: number;
  status: MutationStatus;
  lastError?: string;
  fingerprint?: string;
  metadata: MutationMetadata;
}

/**
 * Sync result
 */
export interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  conflicts: number;
  errors: ErrorDetail[];
  conflictEntries: OutboxEntry[];
}
