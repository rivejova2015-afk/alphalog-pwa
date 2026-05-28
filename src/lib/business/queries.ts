/**
 * Business Module Queries — LEGACY shape reference (DO NOT CALL DIRECTLY)
 *
 * ⚠️ WARNING (Sprint 3, 2026-05-27): this file uses an UNAUTHENTICATED anon-key
 * client (see line ~12). When called from a browser component, RLS sees
 * `auth.uid() = null` and rejects every query silently — that is the root cause
 * of the "70% empty schema" observed in the 2026-05-26 audit.
 *
 * DO NOT import these functions from route handlers OR browser components.
 * Use the `/api/business/*` routes which replicate the query logic with the
 * authenticated server client (`src/lib/supabase/server.ts`).
 *
 * This file is kept as a SHAPE REFERENCE for the schema/columns. Delete once
 * the API rewire (Sprint 4) is complete and no callers remain.
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const logBusinessError = async (message: string, error?: unknown) => {
  if (typeof window !== 'undefined') {
    try {
      const { logger } = await import('@/lib/alphashield/logger');
      await logger.error('business', message, error instanceof Error ? error : undefined);
      return;
    } catch {
      // fallback below
    }
  }
  console.error(message, error);
};

import type {
  BusinessCost,
  BusinessCostTemplate,
  BusinessMilestone,
  BusinessSOP,
  BusinessSOPItem,
  BusinessSOPRun,
  BusinessSOPRunItem,
  BusinessDecision,
  BusinessDecisionTask,
  LLCInfo,
  LLCInboxItem,
} from './types';

// ============================================================================
// BUSINESS COSTS
// ============================================================================

/**
 * Get all costs for the authenticated user
 * @param filterMonth Optional YYYY-MM to filter by month
 */
export async function getBusinessCosts(filterMonth?: string): Promise<BusinessCost[]> {
  let query = supabase
    .from('business_costs')
    .select('*')
    .is('deleted_at', null)
    .order('cost_date', { ascending: false });

  if (filterMonth) {
    const startDate = `${filterMonth}-01`;
    const [year, month] = filterMonth.split('-');
    const nextMonth = parseInt(month) === 12 ? `${parseInt(year) + 1}-01` : `${year}-${(parseInt(month) + 1).toString().padStart(2, '0')}`;
    const endDate = `${nextMonth}-01`;
    
    query = query
      .gte('cost_date', startDate)
      .lt('cost_date', endDate);
  }

  const { data, error } = await query;
  
  if (error) {
    await logBusinessError('Error fetching business costs:', error);
    return [];
  }
  
  return (data as BusinessCost[]) || [];
}

/**
 * Get all cost templates for the authenticated user
 */
export async function getBusinessCostTemplates(): Promise<BusinessCostTemplate[]> {
  const { data, error } = await supabase
    .from('business_cost_templates')
    .select('*')
    .is('deleted_at', null)
    .order('day_of_month', { ascending: true });

  if (error) {
    await logBusinessError('Error fetching cost templates:', error);
    return [];
  }

  return (data as BusinessCostTemplate[]) || [];
}

/**
 * Create a business cost
 */
export async function createBusinessCost(cost: Omit<BusinessCost, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>): Promise<BusinessCost | null> {
  const { data, error } = await supabase
    .from('business_costs')
    .insert([cost])
    .select()
    .single();

  if (error) {
    await logBusinessError('Error creating business cost:', error);
    return null;
  }

  return data as BusinessCost;
}

/**
 * Delete a business cost (soft delete)
 */
export async function deleteBusinessCost(costId: string): Promise<boolean> {
  const { error } = await supabase
    .from('business_costs')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', costId);

  if (error) {
    await logBusinessError('Error deleting business cost:', error);
    return false;
  }

  return true;
}

// ============================================================================
// BUSINESS MILESTONES
// ============================================================================

/**
 * Get all milestones for the authenticated user
 */
export async function getBusinessMilestones(): Promise<BusinessMilestone[]> {
  const { data, error } = await supabase
    .from('business_milestones')
    .select('*')
    .is('deleted_at', null)
    .order('sort_index', { ascending: true });

  if (error) {
    await logBusinessError('Error fetching milestones:', error);
    return [];
  }

  return (data as BusinessMilestone[]) || [];
}

/**
 * Create a milestone
 */
export async function createBusinessMilestone(milestone: Omit<BusinessMilestone, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>): Promise<BusinessMilestone | null> {
  const { data, error } = await supabase
    .from('business_milestones')
    .insert([milestone])
    .select()
    .single();

  if (error) {
    await logBusinessError('Error creating milestone:', error);
    return null;
  }

  return data as BusinessMilestone;
}

/**
 * Update milestone status
 */
export async function updateBusinessMilestoneStatus(milestoneId: string, status: 'pending' | 'in_progress' | 'completed'): Promise<boolean> {
  const { error } = await supabase
    .from('business_milestones')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', milestoneId);

  if (error) {
    await logBusinessError('Error updating milestone status:', error);
    return false;
  }

  return true;
}

/**
 * Delete a milestone (soft delete)
 */
export async function deleteBusinessMilestone(milestoneId: string): Promise<boolean> {
  const { error } = await supabase
    .from('business_milestones')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', milestoneId);

  if (error) {
    await logBusinessError('Error deleting milestone:', error);
    return false;
  }

  return true;
}

// ============================================================================
// BUSINESS SOPs
// ============================================================================

/**
 * Get all SOPs for the authenticated user
 */
export async function getBusinessSOPs(): Promise<BusinessSOP[]> {
  const { data, error } = await supabase
    .from('business_sops')
    .select('*')
    .is('deleted_at', null)
    .order('sort_index', { ascending: true });

  if (error) {
    await logBusinessError('Error fetching SOPs:', error);
    return [];
  }

  return (data as BusinessSOP[]) || [];
}

/**
 * Get SOP with its items
 */
export async function getBusinessSOPWithItems(sopId: string): Promise<{ sop: BusinessSOP; items: BusinessSOPItem[] } | null> {
  const [sopResult, itemsResult] = await Promise.all([
    supabase
      .from('business_sops')
      .select('*')
      .eq('id', sopId)
      .is('deleted_at', null)
      .single(),
    supabase
      .from('business_sop_items')
      .select('*')
      .eq('sop_id', sopId)
      .is('deleted_at', null)
      .order('sort_index', { ascending: true })
  ]);

  if (sopResult.error || itemsResult.error) {
    await logBusinessError('Error fetching SOP with items:', sopResult.error || itemsResult.error);
    return null;
  }

  return {
    sop: sopResult.data as BusinessSOP,
    items: (itemsResult.data as BusinessSOPItem[]) || []
  };
}

/**
 * Create a SOP
 */
export async function createBusinessSOP(sop: Omit<BusinessSOP, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>): Promise<BusinessSOP | null> {
  const { data, error } = await supabase
    .from('business_sops')
    .insert([sop])
    .select()
    .single();

  if (error) {
    await logBusinessError('Error creating SOP:', error);
    return null;
  }

  return data as BusinessSOP;
}

/**
 * Delete a SOP (soft delete, cascades to items and runs)
 */
export async function deleteBusinessSOP(sopId: string): Promise<boolean> {
  const { error } = await supabase
    .from('business_sops')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', sopId);

  if (error) {
    await logBusinessError('Error deleting SOP:', error);
    return false;
  }

  return true;
}

// ============================================================================
// BUSINESS SOP RUNS
// ============================================================================

/**
 * Get all runs for a specific SOP
 */
export async function getBusinessSOPRuns(sopId: string): Promise<BusinessSOPRun[]> {
  const { data, error } = await supabase
    .from('business_sop_runs')
    .select('*')
    .eq('sop_id', sopId)
    .is('deleted_at', null)
    .order('run_date', { ascending: false });

  if (error) {
    await logBusinessError('Error fetching SOP runs:', error);
    return [];
  }

  return (data as BusinessSOPRun[]) || [];
}

/**
 * Create a SOP run
 */
export async function createBusinessSOPRun(run: Omit<BusinessSOPRun, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>): Promise<BusinessSOPRun | null> {
  const { data, error } = await supabase
    .from('business_sop_runs')
    .insert([run])
    .select()
    .single();

  if (error) {
    await logBusinessError('Error creating SOP run:', error);
    return null;
  }

  return data as BusinessSOPRun;
}

// ============================================================================
// BUSINESS SOP RUN ITEMS
// ============================================================================

/**
 * Get all items for a SOP run
 */
export async function getBusinessSOPRunItems(runId: string): Promise<BusinessSOPRunItem[]> {
  const { data, error } = await supabase
    .from('business_sop_run_items')
    .select('*')
    .eq('run_id', runId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  if (error) {
    await logBusinessError('Error fetching SOP run items:', error);
    return [];
  }

  return (data as BusinessSOPRunItem[]) || [];
}

/**
 * Update a SOP run item (mark as checked)
 */
export async function updateBusinessSOPRunItem(itemId: string, checked: boolean, note?: string): Promise<boolean> {
  const updateData: any = {
    checked,
    updated_at: new Date().toISOString()
  };

  if (checked) {
    updateData.checked_at = new Date().toISOString();
  }

  if (note !== undefined) {
    updateData.note = note;
  }

  const { error } = await supabase
    .from('business_sop_run_items')
    .update(updateData)
    .eq('id', itemId);

  if (error) {
    await logBusinessError('Error updating SOP run item:', error);
    return false;
  }

  return true;
}

// ============================================================================
// BUSINESS DECISIONS
// ============================================================================

/**
 * Get all decisions for the authenticated user
 */
export async function getBusinessDecisions(): Promise<BusinessDecision[]> {
  const { data, error } = await supabase
    .from('business_decisions')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    await logBusinessError('Error fetching decisions:', error);
    return [];
  }

  return (data as BusinessDecision[]) || [];
}

/**
 * Get decision with its follow-up tasks
 */
export async function getBusinessDecisionWithTasks(decisionId: string): Promise<{ decision: BusinessDecision; tasks: BusinessDecisionTask[] } | null> {
  const [decisionResult, tasksResult] = await Promise.all([
    supabase
      .from('business_decisions')
      .select('*')
      .eq('id', decisionId)
      .is('deleted_at', null)
      .single(),
    supabase
      .from('business_decision_tasks')
      .select('*')
      .eq('decision_id', decisionId)
      .is('deleted_at', null)
      .order('sort_index', { ascending: true })
  ]);

  if (decisionResult.error || tasksResult.error) {
    await logBusinessError('Error fetching decision with tasks:', decisionResult.error || tasksResult.error);
    return null;
  }

  return {
    decision: decisionResult.data as BusinessDecision,
    tasks: (tasksResult.data as BusinessDecisionTask[]) || []
  };
}

/**
 * Create a decision
 */
export async function createBusinessDecision(decision: Omit<BusinessDecision, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>): Promise<BusinessDecision | null> {
  const { data, error } = await supabase
    .from('business_decisions')
    .insert([decision])
    .select()
    .single();

  if (error) {
    await logBusinessError('Error creating decision:', error);
    return null;
  }

  return data as BusinessDecision;
}

/**
 * Delete a decision (soft delete)
 */
export async function deleteBusinessDecision(decisionId: string): Promise<boolean> {
  const { error } = await supabase
    .from('business_decisions')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', decisionId);

  if (error) {
    await logBusinessError('Error deleting decision:', error);
    return false;
  }

  return true;
}

// ============================================================================
// LLC INFO
// ============================================================================

/**
 * Get LLC info for the authenticated user (one per user)
 */
export async function getLLCInfo(): Promise<LLCInfo | null> {
  const { data, error } = await supabase
    .from('llc_info')
    .select('*')
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    await logBusinessError('Error fetching LLC info:', error);
    return null;
  }

  return data as LLCInfo | null;
}

/**
 * Create or update LLC info
 */
export async function upsertLLCInfo(llcInfo: Omit<LLCInfo, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>): Promise<LLCInfo | null> {
  const existing = await getLLCInfo();

  if (existing) {
    // Update
    const { data, error } = await supabase
      .from('llc_info')
      .update({
        ...llcInfo,
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) {
      await logBusinessError('Error updating LLC info:', error);
      return null;
    }

    return data as LLCInfo;
  } else {
    // Insert
    const { data, error } = await supabase
      .from('llc_info')
      .insert([llcInfo])
      .select()
      .single();

    if (error) {
      await logBusinessError('Error creating LLC info:', error);
      return null;
    }

    return data as LLCInfo;
  }
}

// ============================================================================
// LLC INBOX ITEMS
// ============================================================================

/**
 * Get all LLC inbox items for the authenticated user
 * @param filterStatus Optional status to filter by
 */
export async function getLLCInboxItems(filterStatus?: string): Promise<LLCInboxItem[]> {
  let query = supabase
    .from('llc_inbox_items')
    .select('*')
    .is('deleted_at', null);

  if (filterStatus && filterStatus !== 'all') {
    query = query.eq('status', filterStatus);
  }

  const { data, error } = await query.order('received_on', { ascending: false });

  if (error) {
    await logBusinessError('Error fetching LLC inbox items:', error);
    return [];
  }

  return (data as LLCInboxItem[]) || [];
}

/**
 * Create an LLC inbox item
 */
export async function createLLCInboxItem(item: Omit<LLCInboxItem, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>): Promise<LLCInboxItem | null> {
  const { data, error } = await supabase
    .from('llc_inbox_items')
    .insert([item])
    .select()
    .single();

  if (error) {
    await logBusinessError('Error creating LLC inbox item:', error);
    return null;
  }

  return data as LLCInboxItem;
}

/**
 * Update LLC inbox item status
 */
export async function updateLLCInboxItemStatus(itemId: string, status: 'new' | 'in_review' | 'done' | 'archived'): Promise<boolean> {
  const { error } = await supabase
    .from('llc_inbox_items')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', itemId);

  if (error) {
    await logBusinessError('Error updating LLC inbox item:', error);
    return false;
  }

  return true;
}

/**
 * Delete an LLC inbox item (soft delete)
 */
export async function deleteLLCInboxItem(itemId: string): Promise<boolean> {
  const { error } = await supabase
    .from('llc_inbox_items')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', itemId);

  if (error) {
    await logBusinessError('Error deleting LLC inbox item:', error);
    return false;
  }

  return true;
}
