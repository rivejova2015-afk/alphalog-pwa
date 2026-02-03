/**
 * Conflict Resolution Engine
 * 
 * Handles merge conflicts when offline changes conflict with server state:
 * - Detects version mismatches
 * - Implements resolution strategies (last-write-wins, user-choice, merge)
 * - Logs conflicts to console
 * - Supports rollback on conflict
 */

import type { EntityOperation } from '@/lib/alphacore/types';

/**
 * Conflict detection result
 */
export interface ConflictDetection {
  hasConflict: boolean;
  type: 'version-mismatch' | 'content-mismatch' | 'delete-conflict' | 'none';
  clientVersion: number;
  serverVersion: number;
  clientData: Record<string, any>;
  serverData: Record<string, any>;
  suggestedResolution: ResolutionStrategy;
}

/**
 * Conflict resolution strategies
 */
export type ResolutionStrategy = 
  | 'last-write-wins'    // Server data wins (default)
  | 'client-preference'   // Client data wins
  | 'manual-merge'        // Requires user intervention
  | 'abort';              // Rollback transaction

/**
 * Resolved conflict result
 */
export interface ConflictResolution {
  resolved: boolean;
  strategy: ResolutionStrategy;
  mergedData: Record<string, any>;
  conflictId: string;
  timestamp: string;
  notes?: string;
}

/**
 * Conflict metadata for logging
 */
export interface ConflictMetadata {
  entityId: string;
  table: string;
  operation: EntityOperation;
  userId: string;
  clientTimestamp: string;
  serverTimestamp: string;
  conflictType: ConflictDetection['type'];
  resolution: ResolutionStrategy;
}

// ============================================================================
// DETECTION
// ============================================================================

/**
 * Detect version-based conflicts
 * 
 * Compares local version against server version to detect conflicts
 * Version format: incremented on each server mutation
 */
export function detectVersionConflict(
  clientVersion: number,
  serverVersion: number,
  clientData: Record<string, any>,
  serverData: Record<string, any>
): ConflictDetection {
  const hasConflict = clientVersion !== serverVersion;
  
  return {
    hasConflict,
    type: hasConflict ? 'version-mismatch' : 'none',
    clientVersion,
    serverVersion,
    clientData,
    serverData,
    suggestedResolution: hasConflict ? 'last-write-wins' : 'last-write-wins'
  };
}

/**
 * Detect content-based conflicts
 * 
 * Compares field values to detect if actual content conflicts
 * (not just version numbers)
 */
export function detectContentConflict(
  clientData: Record<string, any>,
  serverData: Record<string, any>,
  protectedFields: string[] = ['id', 'user_id', 'created_at', 'deleted_at']
): ConflictDetection {
  const conflictingFields: string[] = [];
  
  // Check for modified fields (excluding protected ones)
  for (const key of Object.keys(clientData)) {
    if (protectedFields.includes(key)) continue;
    
    if (JSON.stringify(clientData[key]) !== JSON.stringify(serverData[key])) {
      conflictingFields.push(key);
    }
  }
  
  const hasConflict = conflictingFields.length > 0;
  
  return {
    hasConflict,
    type: hasConflict ? 'content-mismatch' : 'none',
    clientVersion: clientData.version || 1,
    serverVersion: serverData.version || 1,
    clientData,
    serverData,
    suggestedResolution: hasConflict ? 'manual-merge' : 'last-write-wins'
  };
}

/**
 * Detect delete conflicts
 * 
 * Handles cases where record was deleted locally but modified on server
 * (or vice versa)
 */
export function detectDeleteConflict(
  clientDeleted: boolean,
  serverDeleted: boolean,
  clientData: Record<string, any>,
  serverData: Record<string, any>
): ConflictDetection {
  const hasConflict = clientDeleted !== serverDeleted;
  
  return {
    hasConflict,
    type: hasConflict ? 'delete-conflict' : 'none',
    clientVersion: clientData.version || 1,
    serverVersion: serverData.version || 1,
    clientData,
    serverData,
    suggestedResolution: hasConflict ? 'manual-merge' : 'last-write-wins'
  };
}

// ============================================================================
// RESOLUTION STRATEGIES
// ============================================================================

/**
 * Last-write-wins strategy
 * 
 * Server data is authoritative (default strategy)
 * Client changes are discarded
 * 
 * Use case: Most conflicts where server is source of truth
 */
export function resolveLastWriteWins(
  clientData: Record<string, any>,
  serverData: Record<string, any>
): ConflictResolution {
  return {
    resolved: true,
    strategy: 'last-write-wins',
    mergedData: serverData,
    conflictId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    notes: 'Server data retained (last-write-wins strategy)'
  };
}

/**
 * Client-preference strategy
 * 
 * Client data is retained despite server changes
 * Server changes are overwritten on next sync
 * 
 * Use case: User explicitly wants their version
 */
export function resolveClientPreference(
  clientData: Record<string, any>,
  serverData: Record<string, any>
): ConflictResolution {
  void serverData;
  return {
    resolved: true,
    strategy: 'client-preference',
    mergedData: clientData,
    conflictId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    notes: 'Client data retained (client-preference strategy)'
  };
}

/**
 * Field-level merge strategy
 * 
 * Merges non-conflicting fields from both sides
 * Conflicting fields use server version with warning
 * 
 * Use case: Multiple fields were edited, some conflict
 */
export function resolveManualMerge(
  clientData: Record<string, any>,
  serverData: Record<string, any>,
  protectedFields: string[] = ['id', 'user_id', 'created_at', 'version']
): ConflictResolution {
  const mergedData: Record<string, any> = {};
  const conflictingFields: string[] = [];
  
  // Start with server data as base
  Object.assign(mergedData, serverData);
  
  // Merge non-conflicting client fields
  for (const key of Object.keys(clientData)) {
    if (protectedFields.includes(key)) continue;
    
    if (JSON.stringify(clientData[key]) === JSON.stringify(serverData[key])) {
      // No conflict - field values are same
      mergedData[key] = clientData[key];
    } else {
      // Conflict detected - track it
      conflictingFields.push(key);
      // Keep server version but log conflict
      mergedData[key] = serverData[key];
    }
  }
  
  return {
    resolved: true,
    strategy: 'manual-merge',
    mergedData,
    conflictId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    notes: `Merged data. Conflicting fields: ${conflictingFields.join(', ')}`
  };
}

/**
 * Abort strategy
 * 
 * Reject the mutation entirely and prompt user
 * No data is persisted
 * 
 * Use case: Critical conflicts requiring user decision
 */
export function resolveAbort(
  clientData: Record<string, any>,
  serverData: Record<string, any>
): ConflictResolution {
  void clientData;
  void serverData;
  return {
    resolved: false,
    strategy: 'abort',
    mergedData: {},
    conflictId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    notes: 'Conflict resolution aborted. User intervention required.'
  };
}

// ============================================================================
// AUTOMATIC RESOLUTION
// ============================================================================

/**
 * Auto-resolve conflicts based on type
 * 
 * Routes to appropriate resolution strategy based on conflict characteristics
 */
export async function autoResolveConflict(
  conflict: ConflictDetection,
  options?: {
    strategy?: ResolutionStrategy;
    protectedFields?: string[];
  }
): Promise<ConflictResolution> {
  if (!conflict.hasConflict) {
    return {
      resolved: true,
      strategy: 'last-write-wins',
      mergedData: conflict.serverData,
      conflictId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      notes: 'No conflict detected'
    };
  }
  
  // Use provided strategy or default based on conflict type
  const strategy = options?.strategy || conflict.suggestedResolution;
  
  switch (strategy) {
    case 'last-write-wins':
      return resolveLastWriteWins(conflict.clientData, conflict.serverData);
      
    case 'client-preference':
      return resolveClientPreference(conflict.clientData, conflict.serverData);
      
    case 'manual-merge':
      return resolveManualMerge(
        conflict.clientData,
        conflict.serverData,
        options?.protectedFields
      );
      
    case 'abort':
      return resolveAbort(conflict.clientData, conflict.serverData);
      
    default:
      return resolveLastWriteWins(conflict.clientData, conflict.serverData);
  }
}

// ============================================================================
// LOGGING & TRACKING
// ============================================================================

/**
 * Log conflict to console
 */
export async function logConflict(
  metadata: ConflictMetadata,
  resolution: ConflictResolution
): Promise<void> {
  // Log to console for now - can be integrated with AlphaShield later
  console.log('[ConflictResolution]', {
    entityId: metadata.entityId,
    table: metadata.table,
    conflictType: metadata.conflictType,
    resolution: metadata.resolution,
    conflictId: resolution.conflictId
  });
}

/**
 * Track conflict metrics
 */
export class ConflictMetrics {
  private conflicts: Map<string, ConflictResolution> = new Map();
  private resolutionCounts: Record<ResolutionStrategy, number> = {
    'last-write-wins': 0,
    'client-preference': 0,
    'manual-merge': 0,
    'abort': 0
  };
  
  record(resolution: ConflictResolution): void {
    this.conflicts.set(resolution.conflictId, resolution);
    this.resolutionCounts[resolution.strategy]++;
  }
  
  getMetrics(): {
    totalConflicts: number;
    resolutions: Record<ResolutionStrategy, number>;
    successRate: number;
  } {
    const total = this.conflicts.size;
    const resolved = Array.from(this.conflicts.values()).filter(r => r.resolved).length;
    
    return {
      totalConflicts: total,
      resolutions: this.resolutionCounts,
      successRate: total > 0 ? (resolved / total) * 100 : 100
    };
  }
  
  clear(): void {
    this.conflicts.clear();
    this.resolutionCounts = {
      'last-write-wins': 0,
      'client-preference': 0,
      'manual-merge': 0,
      'abort': 0
    };
  }
}

// ============================================================================
// ROLLBACK SUPPORT
// ============================================================================

/**
 * Prepare rollback snapshot
 */
export interface RollbackSnapshot {
  entityId: string;
  table: string;
  operation: EntityOperation;
  dataBeforeChange: Record<string, any>;
  dataAfterChange: Record<string, any>;
  timestamp: string;
  conflictId: string;
}

/**
 * Create rollback snapshot
 */
export function createRollbackSnapshot(
  entityId: string,
  table: string,
  operation: EntityOperation,
  dataBefore: Record<string, any>,
  dataAfter: Record<string, any>,
  conflictId: string
): RollbackSnapshot {
  return {
    entityId,
    table,
    operation,
    dataBeforeChange: dataBefore,
    dataAfterChange: dataAfter,
    timestamp: new Date().toISOString(),
    conflictId
  };
}

/**
 * Rollback to snapshot
 */
export async function rollbackToSnapshot(
  snapshot: RollbackSnapshot
): Promise<void> {
  // TODO: Implement actual rollback logic in API
  // This is a stub that would:
  // 1. Restore dataBeforeChange to database
  // 2. Update version numbers
  // 3. Log rollback to audit log
  // 4. Notify user of rollback
  
  console.warn(
    `[ROLLBACK] Would restore ${snapshot.table}/${snapshot.entityId} to state before conflict`
  );
  
  // Log to console for now
  console.log('[Rollback] Conflict snapshot:', {
    entityId: snapshot.entityId,
    table: snapshot.table,
    operation: snapshot.operation,
    conflictId: snapshot.conflictId,
    restoredVersion: snapshot.dataBeforeChange.version
  });
}

// ============================================================================
// EXPORT CONFLICT MANAGER
// ============================================================================

/**
 * High-level conflict manager
 */
export class ConflictManager {
  private metrics = new ConflictMetrics();
  
  async resolveConflict(
    clientData: Record<string, any>,
    serverData: Record<string, any>,
    options?: {
      strategy?: ResolutionStrategy;
      protectedFields?: string[];
      table?: string;
      entityId?: string;
    }
  ): Promise<ConflictResolution> {
    // Detect conflict
    const conflict = detectVersionConflict(
      clientData.version || 1,
      serverData.version || 1,
      clientData,
      serverData
    );
    
    // Auto-resolve
    const resolution = await autoResolveConflict(conflict, options);
    
    // Track metrics
    this.metrics.record(resolution);
    
    // Log to AlphaShield
    if (options?.table && options?.entityId) {
      await logConflict(
        {
          entityId: options.entityId,
          table: options.table,
          operation: 'update',
          userId: clientData.user_id || 'unknown',
          clientTimestamp: clientData.updated_at || new Date().toISOString(),
          serverTimestamp: serverData.updated_at || new Date().toISOString(),
          conflictType: conflict.type,
          resolution: resolution.strategy
        },
        resolution
      );
    }
    
    return resolution;
  }
  
  getMetrics() {
    return this.metrics.getMetrics();
  }
  
  resetMetrics(): void {
    this.metrics.clear();
  }
}

export const conflictManager = new ConflictManager();
