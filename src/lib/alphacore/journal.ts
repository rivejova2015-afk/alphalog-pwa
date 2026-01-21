/**
 * Journal Entry Mutations & Utilities
 * 
 * Pilot implementation of journal entries using AlphaCore architecture:
 * - Pre-submission dedup checks (prevent duplicate timestamp entries)
 * - Offline-first support (auto-sync when reconnected)
 * - Type-safe mutations (createEntry, updateEntry, deleteEntry)
 * - Validation (required fields, format checking)
 */

import type { JournalEntry } from '@/lib/alphacore/contracts';
import type { BaseFields } from '@/lib/alphacore/types';
import { mutateOfflineFirst, getOfflineBridge } from '@/lib/alphacore/offline/offlineBridge';
import { preSubmitDedupeCheck } from '@/lib/alphacore/dedupe-checker';
import type { MutationResponse } from '@/lib/alphacore/mutations';

// ============================================================================
// TYPES
// ============================================================================

export interface CreateJournalEntryInput {
  text: string; // Required: main entry
  mood?: 'excellent' | 'good' | 'neutral' | 'bad' | 'terrible';
  mood_score?: number; // 1-10
  tags?: string[]; // Optional array of tags
  market_conditions?: string;
  focus_areas?: string[];
  lessons_learned?: string;
  action_items?: string[];
  trade_id?: string;
  is_private?: boolean;
}

export interface UpdateJournalEntryInput extends Partial<CreateJournalEntryInput> {
  id: string; // Required for update
}

export interface JournalEntryValidationError {
  field: string;
  message: string;
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate journal entry input before submission
 */
export function validateJournalEntry(
  input: CreateJournalEntryInput
): JournalEntryValidationError[] {
  const errors: JournalEntryValidationError[] = [];

  // Required: text
  if (!input.text || input.text.trim().length === 0) {
    errors.push({
      field: 'text',
      message: 'Journal entry text is required'
    });
  } else if (input.text.length < 10) {
    errors.push({
      field: 'text',
      message: 'Journal entry must be at least 10 characters'
    });
  } else if (input.text.length > 50000) {
    errors.push({
      field: 'text',
      message: 'Journal entry cannot exceed 50,000 characters'
    });
  }

  // Optional: mood
  if (input.mood) {
    const validMoods = ['excellent', 'good', 'neutral', 'bad', 'terrible'];
    if (!validMoods.includes(input.mood)) {
      errors.push({
        field: 'mood',
        message: 'Invalid mood value'
      });
    }
  }

  // Optional: mood_score
  if (input.mood_score !== undefined) {
    if (input.mood_score < 1 || input.mood_score > 10) {
      errors.push({
        field: 'mood_score',
        message: 'Mood score must be between 1 and 10'
      });
    }
  }

  // Optional: tags
  if (input.tags && Array.isArray(input.tags)) {
    if (input.tags.length > 20) {
      errors.push({
        field: 'tags',
        message: 'Maximum 20 tags allowed'
      });
    }
    input.tags.forEach((tag, idx) => {
      if (!tag || tag.trim().length === 0) {
        errors.push({
          field: `tags[${idx}]`,
          message: 'Tag cannot be empty'
        });
      }
      if (tag.length > 50) {
        errors.push({
          field: `tags[${idx}]`,
          message: 'Tag cannot exceed 50 characters'
        });
      }
    });
  }

  // Optional: action_items
  if (input.action_items && Array.isArray(input.action_items)) {
    if (input.action_items.length > 20) {
      errors.push({
        field: 'action_items',
        message: 'Maximum 20 action items allowed'
      });
    }
  }

  return errors;
}

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Create a new journal entry with offline-first support
 * 
 * @param input Entry data (text required, other fields optional)
 * @param userId Current user ID
 * @returns Mutation result with new entry
 * 
 * @example
 * const result = await createJournalEntry({
 *   text: 'Today was a good trading day...',
 *   mood: 'good',
 *   mood_score: 8,
 *   tags: ['winning_day', 'discipline'],
 *   lessons_learned: 'Importance of risk management'
 * }, userId);
 * 
 * if (result.error) {
 *   console.error('Failed to create entry:', result.error);
 * } else {
 *   console.log('Entry created:', result.data?.id);
 * }
 */
export async function createJournalEntry(
  input: CreateJournalEntryInput,
  userId: string
): Promise<MutationResponse<JournalEntry>> {
  const mutationId = crypto.randomUUID();

  // Validate input
  const validationErrors = validateJournalEntry(input);
  if (validationErrors.length > 0) {
    return {
      data: undefined,
      error: {
        code: 'VALIDATION_ERROR',
        message: `Validation failed: ${validationErrors.map(e => e.message).join(', ')}`
      },
      mutationId,
      status: 'failed'
    };
  }

  // Pre-submission dedup check (prevent same-timestamp entries)
  const dedupeResult = await preSubmitDedupeCheck({
    table: 'journal_entries',
    operation: 'create',
    data: {
      user_id: userId,
      text: input.text.substring(0, 100), // Check first 100 chars
      created_at: new Date().toISOString()
    },
    userId,
    isOnline: navigator?.onLine ?? true
  });

  if (dedupeResult.isDuplicate && dedupeResult.confidence === 'certain') {
    return {
      data: undefined,
      error: {
        code: 'DUPLICATE_ENTRY',
        message: 'A journal entry with this content already exists.'
      },
      mutationId,
      status: 'failed'
    };
  }

  // Generate ID and timestamps
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const entryData: JournalEntry = {
    id,
    user_id: userId,
    text: input.text,
    mood: input.mood || null,
    mood_score: input.mood_score || null,
    tags: input.tags || null,
    market_conditions: input.market_conditions || null,
    focus_areas: input.focus_areas || null,
    lessons_learned: input.lessons_learned || null,
    action_items: input.action_items || null,
    trade_id: input.trade_id || null,
    is_private: input.is_private ?? false,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    sort_index: undefined
  };

  // Use offline-first mutation (works online and offline)
  try {
    const result = await mutateOfflineFirst(
      'journal_entries',
      'create',
      entryData,
      {
        optimisticData: entryData,
        onOptimisticApplied: (data) => {
          console.log('[JournalEntry] Created entry:', data.id);
        }
      }
    );

    return {
      data: result.data as JournalEntry & BaseFields,
      error: result.error,
      status: result.status,
      mutationId
    };
  } catch (error) {
    return {
      data: undefined,
      error: {
        code: 'MUTATION_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      mutationId,
      status: 'failed'
    };
  }
}

/**
 * Update an existing journal entry
 * 
 * @param input Update data (id required, other fields optional)
 * @param userId Current user ID
 * @returns Mutation result
 */
export async function updateJournalEntry(
  input: UpdateJournalEntryInput,
  userId: string
): Promise<MutationResponse<JournalEntry>> {
  const mutationId = crypto.randomUUID();

  if (!input.id) {
    return {
      data: undefined,
      error: {
        code: 'INVALID_INPUT',
        message: 'Journal entry ID is required'
      },
      mutationId,
      status: 'failed'
    };
  }

  // Validate changed fields
  const createInput: CreateJournalEntryInput = {
    text: input.text || '',
    mood: input.mood,
    mood_score: input.mood_score,
    tags: input.tags,
    market_conditions: input.market_conditions,
    focus_areas: input.focus_areas,
    lessons_learned: input.lessons_learned,
    action_items: input.action_items,
    trade_id: input.trade_id,
    is_private: input.is_private
  };

  const validationErrors = validateJournalEntry(createInput);
  if (validationErrors.length > 0) {
    return {
      data: undefined,
      error: {
        code: 'VALIDATION_ERROR',
        message: `Validation failed: ${validationErrors.map(e => e.message).join(', ')}`
      },
      mutationId,
      status: 'failed'
    };
  }

  try {
    const result = await mutateOfflineFirst(
      'journal_entries',
      'update',
      {
        ...input,
        user_id: userId,
        updated_at: new Date().toISOString(),
        edited_at: new Date().toISOString()
      },
      {
        onOptimisticApplied: (data) => {
          console.log('[JournalEntry] Updated entry:', input.id);
        }
      }
    );

    return {
      data: result.data as JournalEntry & BaseFields,
      error: result.error,
      status: result.status,
      mutationId
    };
  } catch (error) {
    return {
      data: undefined,
      error: {
        code: 'MUTATION_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      mutationId,
      status: 'failed'
    };
  }
}

/**
 * Soft delete a journal entry (marks deleted_at)
 * 
 * @param entryId Entry ID to delete
 * @param userId Current user ID
 * @returns Mutation result
 */
export async function deleteJournalEntry(
  entryId: string,
  userId: string
): Promise<MutationResponse<JournalEntry>> {
  const mutationId = crypto.randomUUID();

  if (!entryId) {
    return {
      data: undefined,
      error: {
        code: 'INVALID_INPUT',
        message: 'Journal entry ID is required'
      },
      mutationId,
      status: 'failed'
    };
  }

  try {
    const result = await mutateOfflineFirst(
      'journal_entries',
      'delete',
      {
        id: entryId,
        user_id: userId,
        deleted_at: new Date().toISOString()
      },
      {
        onOptimisticApplied: () => {
          console.log('[JournalEntry] Deleted entry:', entryId);
        }
      }
    );

    return {
      data: result.data as JournalEntry & BaseFields,
      error: result.error,
      status: result.status,
      mutationId
    };
  } catch (error) {
    return {
      data: undefined,
      error: {
        code: 'MUTATION_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      mutationId,
      status: 'failed'
    };
  }
}

/**
 * Restore a soft-deleted journal entry
 * 
 * @param entryId Entry ID to restore
 * @param userId Current user ID
 * @returns Mutation result
 */
export async function restoreJournalEntry(
  entryId: string,
  userId: string
): Promise<MutationResponse<JournalEntry>> {
  const mutationId = crypto.randomUUID();

  if (!entryId) {
    return {
      data: undefined,
      error: {
        code: 'INVALID_INPUT',
        message: 'Journal entry ID is required'
      },
      mutationId,
      status: 'failed'
    };
  }

  try {
    const result = await mutateOfflineFirst(
      'journal_entries',
      'update',
      {
        id: entryId,
        user_id: userId,
        deleted_at: null,
        updated_at: new Date().toISOString()
      },
      {
        onOptimisticApplied: () => {
          console.log('[JournalEntry] Restored entry:', entryId);
        }
      }
    );

    return {
      data: result.data as JournalEntry & BaseFields,
      error: result.error,
      status: result.status,
      mutationId
    };
  } catch (error) {
    return {
      data: undefined,
      error: {
        code: 'MUTATION_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      mutationId,
      status: 'failed'
    };
  }
}

/**
 * Get outbox sync status for journal entries
 */
export function getJournalOutboxStatus() {
  try {
    const bridge = getOfflineBridge();
    return bridge.getOutboxStatus();
  } catch (error) {
    console.error('Failed to get journal outbox status:', error);
    return {
      total: 0,
      pending: 0,
      synced: 0,
      failed: 0,
      conflicts: 0
    };
  }
}

/**
 * Manual sync for journal entries
 */
export async function syncJournalEntries() {
  try {
    const bridge = getOfflineBridge();
    const result = await bridge.syncNow();
    console.log('[JournalEntry] Sync complete:', result);
    return result;
  } catch (error) {
    console.error('Journal sync failed:', error);
    return {
      success: false,
      error
    };
  }
}
