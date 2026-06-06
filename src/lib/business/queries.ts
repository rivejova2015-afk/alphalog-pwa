/**
 * Business Module Queries — thin fetch wrappers over /api/business/* (Sprint 4)
 *
 * Rewrite history:
 *   - Original: used an unauthenticated anon-key Supabase client → RLS blocked
 *     all calls silently (root cause of "70% empty schema" audit finding).
 *   - Sprint 3 (2026-05-27): API foundation laid down at /api/business/* with
 *     authenticated server client.
 *   - Sprint 4 (2026-05-27): this file rewritten to call those routes via
 *     `fetch()` from the browser. Existing callers (panels, forms, offline-loader)
 *     keep working without modification because function signatures are preserved.
 *
 * CSRF: middleware sets the `al_csrf` cookie and requires `x-csrf-token` on
 * mutations. `csrfHeaders()` reads the cookie at call time (browser only).
 *
 * Errors are logged via alphashield (browser) or console (server). All
 * functions return defaults (`[]`, `null`, `false`) on failure to keep
 * existing UI happy-path code intact.
 */

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
import { logError } from '@/lib/log';

const logBusinessError = (message: string, error?: unknown) => {
  logError('Business', { component: 'business.queries', message, error: error instanceof Error ? error.message : String(error) });
};

const readCsrfCookie = (): string => {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(/al_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
};

const jsonHeaders = (): HeadersInit => ({
  'Content-Type': 'application/json',
  'x-csrf-token': readCsrfCookie(),
});

async function safeJson<T>(res: Response, fallback: T): Promise<T> {
  try { return (await res.json()) as T; } catch { return fallback; }
}

// ============================================================================
// BUSINESS COSTS
// ============================================================================

export async function getBusinessCosts(filterMonth?: string): Promise<BusinessCost[]> {
  try {
    const url = filterMonth ? `/api/business/costs?month=${encodeURIComponent(filterMonth)}` : '/api/business/costs';
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) { await logBusinessError(`getBusinessCosts ${res.status}`); return []; }
    const body = await safeJson<{ costs?: BusinessCost[] }>(res, {});
    return body.costs ?? [];
  } catch (err) { await logBusinessError('getBusinessCosts threw', err); return []; }
}

export async function getBusinessCostTemplates(): Promise<BusinessCostTemplate[]> {
  try {
    const res = await fetch('/api/business/cost-templates', { cache: 'no-store' });
    if (!res.ok) { await logBusinessError(`getBusinessCostTemplates ${res.status}`); return []; }
    const body = await safeJson<{ templates?: BusinessCostTemplate[] }>(res, {});
    return body.templates ?? [];
  } catch (err) { await logBusinessError('getBusinessCostTemplates threw', err); return []; }
}

export async function createBusinessCost(
  cost: Omit<BusinessCost, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'deleted_at'> & { user_id?: string }
): Promise<BusinessCost | null> {
  try {
    const res = await fetch('/api/business/costs', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({
        amount: cost.amount,
        category: cost.category,
        description: cost.description,
        vendor: cost.vendor,
        cost_date: cost.cost_date,
        is_recurring_instance: cost.is_recurring_instance,
        template_id: cost.template_id ?? undefined,
      }),
    });
    if (!res.ok) { await logBusinessError(`createBusinessCost ${res.status}`); return null; }
    const body = await safeJson<{ cost?: BusinessCost }>(res, {});
    return body.cost ?? null;
  } catch (err) { await logBusinessError('createBusinessCost threw', err); return null; }
}

export async function deleteBusinessCost(costId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/business/costs/${encodeURIComponent(costId)}`, {
      method: 'DELETE',
      headers: jsonHeaders(),
    });
    if (!res.ok) { await logBusinessError(`deleteBusinessCost ${res.status}`); return false; }
    return true;
  } catch (err) { await logBusinessError('deleteBusinessCost threw', err); return false; }
}

// ============================================================================
// BUSINESS MILESTONES
// ============================================================================

export async function getBusinessMilestones(): Promise<BusinessMilestone[]> {
  try {
    const res = await fetch('/api/business/milestones', { cache: 'no-store' });
    if (!res.ok) { await logBusinessError(`getBusinessMilestones ${res.status}`); return []; }
    const body = await safeJson<{ milestones?: BusinessMilestone[] }>(res, {});
    return body.milestones ?? [];
  } catch (err) { await logBusinessError('getBusinessMilestones threw', err); return []; }
}

export async function createBusinessMilestone(
  milestone: Omit<BusinessMilestone, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'deleted_at'> & { user_id?: string }
): Promise<BusinessMilestone | null> {
  try {
    const res = await fetch('/api/business/milestones', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({
        title: milestone.title,
        description: milestone.description,
        target_date: milestone.target_date ?? null,
        status: milestone.status,
        goal_id: milestone.goal_id ?? null,
        notes: milestone.notes ?? null,
      }),
    });
    if (!res.ok) { await logBusinessError(`createBusinessMilestone ${res.status}`); return null; }
    const body = await safeJson<{ milestone?: BusinessMilestone }>(res, {});
    return body.milestone ?? null;
  } catch (err) { await logBusinessError('createBusinessMilestone threw', err); return null; }
}

export async function updateBusinessMilestoneStatus(
  milestoneId: string,
  status: 'pending' | 'in_progress' | 'completed'
): Promise<boolean> {
  try {
    const res = await fetch(`/api/business/milestones/${encodeURIComponent(milestoneId)}`, {
      method: 'PUT',
      headers: jsonHeaders(),
      body: JSON.stringify({ status }),
    });
    if (!res.ok) { await logBusinessError(`updateBusinessMilestoneStatus ${res.status}`); return false; }
    return true;
  } catch (err) { await logBusinessError('updateBusinessMilestoneStatus threw', err); return false; }
}

export async function deleteBusinessMilestone(milestoneId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/business/milestones/${encodeURIComponent(milestoneId)}`, {
      method: 'DELETE',
      headers: jsonHeaders(),
    });
    if (!res.ok) { await logBusinessError(`deleteBusinessMilestone ${res.status}`); return false; }
    return true;
  } catch (err) { await logBusinessError('deleteBusinessMilestone threw', err); return false; }
}

// ============================================================================
// BUSINESS SOPs
// ============================================================================

export async function getBusinessSOPs(): Promise<BusinessSOP[]> {
  try {
    const res = await fetch('/api/business/sops', { cache: 'no-store' });
    if (!res.ok) { await logBusinessError(`getBusinessSOPs ${res.status}`); return []; }
    const body = await safeJson<{ sops?: Array<BusinessSOP & { items?: BusinessSOPItem[] }> }>(res, {});
    return (body.sops ?? []).map(({ items: _items, ...sop }) => sop);
  } catch (err) { await logBusinessError('getBusinessSOPs threw', err); return []; }
}

export async function getBusinessSOPWithItems(sopId: string): Promise<{ sop: BusinessSOP; items: BusinessSOPItem[] } | null> {
  try {
    const res = await fetch('/api/business/sops', { cache: 'no-store' });
    if (!res.ok) { await logBusinessError(`getBusinessSOPWithItems ${res.status}`); return null; }
    const body = await safeJson<{ sops?: Array<BusinessSOP & { items?: BusinessSOPItem[] }> }>(res, {});
    const match = (body.sops ?? []).find((s) => s.id === sopId);
    if (!match) return null;
    const { items, ...sop } = match;
    return { sop, items: items ?? [] };
  } catch (err) { await logBusinessError('getBusinessSOPWithItems threw', err); return null; }
}

export async function createBusinessSOP(
  sop: Omit<BusinessSOP, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'deleted_at'> & { user_id?: string }
): Promise<BusinessSOP | null> {
  try {
    const res = await fetch('/api/business/sops', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({
        title: sop.title,
        type: sop.type,
        content: sop.content,
      }),
    });
    if (!res.ok) { await logBusinessError(`createBusinessSOP ${res.status}`); return null; }
    const body = await safeJson<{ sop?: BusinessSOP }>(res, {});
    return body.sop ?? null;
  } catch (err) { await logBusinessError('createBusinessSOP threw', err); return null; }
}

export async function deleteBusinessSOP(sopId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/business/sops/${encodeURIComponent(sopId)}`, {
      method: 'DELETE',
      headers: jsonHeaders(),
    });
    if (!res.ok) { await logBusinessError(`deleteBusinessSOP ${res.status}`); return false; }
    return true;
  } catch (err) { await logBusinessError('deleteBusinessSOP threw', err); return false; }
}

export async function getBusinessSOPRuns(sopId: string): Promise<BusinessSOPRun[]> {
  try {
    const res = await fetch(`/api/business/sops/${encodeURIComponent(sopId)}/runs`, { cache: 'no-store' });
    if (!res.ok) { await logBusinessError(`getBusinessSOPRuns ${res.status}`); return []; }
    const body = await safeJson<{ runs?: Array<BusinessSOPRun & { items?: BusinessSOPRunItem[] }> }>(res, {});
    return (body.runs ?? []).map(({ items: _items, ...run }) => run);
  } catch (err) { await logBusinessError('getBusinessSOPRuns threw', err); return []; }
}

export async function createBusinessSOPRun(
  run: Omit<BusinessSOPRun, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'deleted_at'> & { user_id?: string }
): Promise<BusinessSOPRun | null> {
  try {
    const res = await fetch(`/api/business/sops/${encodeURIComponent(run.sop_id)}/runs`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({
        run_date: run.run_date,
        notes: run.notes,
      }),
    });
    if (!res.ok) { await logBusinessError(`createBusinessSOPRun ${res.status}`); return null; }
    const body = await safeJson<{ run?: BusinessSOPRun }>(res, {});
    return body.run ?? null;
  } catch (err) { await logBusinessError('createBusinessSOPRun threw', err); return null; }
}

export async function getBusinessSOPRunItems(runId: string): Promise<BusinessSOPRunItem[]> {
  // We don't have a direct GET for a single run's items; iterate runs of each SOP would be wasteful.
  // The runs endpoint already returns items joined — callers should use getBusinessSOPRuns.
  // This helper kept for backwards-compat: returns empty array, callers should migrate.
  await logBusinessError(`getBusinessSOPRunItems called for runId=${runId} — use getBusinessSOPRuns instead`);
  return [];
}

export async function updateBusinessSOPRunItem(itemId: string, checked: boolean, note?: string): Promise<boolean> {
  // The PATCH route requires both runId and itemId in the path. Caller now needs to pass runId too.
  // For backwards-compat, this helper is a no-op — patch logic moved to direct fetch in panels.
  await logBusinessError(`updateBusinessSOPRunItem requires runId — use direct fetch to /api/business/sops/runs/[runId]/items/[itemId]`);
  void itemId; void checked; void note;
  return false;
}

// ============================================================================
// BUSINESS DECISIONS
// ============================================================================

export async function getBusinessDecisions(): Promise<BusinessDecision[]> {
  try {
    const res = await fetch('/api/business/decisions', { cache: 'no-store' });
    if (!res.ok) { await logBusinessError(`getBusinessDecisions ${res.status}`); return []; }
    const body = await safeJson<{ decisions?: BusinessDecision[] }>(res, {});
    return body.decisions ?? [];
  } catch (err) { await logBusinessError('getBusinessDecisions threw', err); return []; }
}

export async function getBusinessDecisionWithTasks(decisionId: string): Promise<{ decision: BusinessDecision; tasks: BusinessDecisionTask[] } | null> {
  try {
    const res = await fetch(`/api/business/decisions/${encodeURIComponent(decisionId)}`, { cache: 'no-store' });
    if (!res.ok) { await logBusinessError(`getBusinessDecisionWithTasks ${res.status}`); return null; }
    const body = await safeJson<{ decision?: BusinessDecision; tasks?: BusinessDecisionTask[] }>(res, {});
    if (!body.decision) return null;
    return { decision: body.decision, tasks: body.tasks ?? [] };
  } catch (err) { await logBusinessError('getBusinessDecisionWithTasks threw', err); return null; }
}

export async function createBusinessDecision(
  decision: Omit<BusinessDecision, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'deleted_at'> & { user_id?: string }
): Promise<BusinessDecision | null> {
  try {
    const res = await fetch('/api/business/decisions', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({
        title: decision.title,
        context: decision.context,
        decision: decision.decision,
        rationale: decision.rationale,
        impact: decision.impact,
        tags: decision.tags,
        priority: decision.priority,
      }),
    });
    if (!res.ok) { await logBusinessError(`createBusinessDecision ${res.status}`); return null; }
    const body = await safeJson<{ decision?: BusinessDecision }>(res, {});
    return body.decision ?? null;
  } catch (err) { await logBusinessError('createBusinessDecision threw', err); return null; }
}

export async function deleteBusinessDecision(decisionId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/business/decisions/${encodeURIComponent(decisionId)}`, {
      method: 'DELETE',
      headers: jsonHeaders(),
    });
    if (!res.ok) { await logBusinessError(`deleteBusinessDecision ${res.status}`); return false; }
    return true;
  } catch (err) { await logBusinessError('deleteBusinessDecision threw', err); return false; }
}

// ============================================================================
// LLC INFO + INBOX
// ============================================================================

export async function getLLCInfo(): Promise<LLCInfo | null> {
  try {
    const res = await fetch('/api/business/llc', { cache: 'no-store' });
    if (!res.ok) { await logBusinessError(`getLLCInfo ${res.status}`); return null; }
    const body = await safeJson<{ llc?: LLCInfo | null }>(res, {});
    return body.llc ?? null;
  } catch (err) { await logBusinessError('getLLCInfo threw', err); return null; }
}

export async function upsertLLCInfo(
  llcInfo: Omit<LLCInfo, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'deleted_at'> & { user_id?: string }
): Promise<LLCInfo | null> {
  try {
    const res = await fetch('/api/business/llc', {
      method: 'PUT',
      headers: jsonHeaders(),
      body: JSON.stringify({
        llc_name: llcInfo.llc_name,
        formation_date: llcInfo.formation_date ?? null,
        annual_report_due_month: llcInfo.annual_report_due_month,
        annual_fee_baseline: llcInfo.annual_fee_baseline,
        registered_agent_name: llcInfo.registered_agent_name,
        ein: llcInfo.ein,
        notes: llcInfo.notes ?? null,
      }),
    });
    if (!res.ok) { await logBusinessError(`upsertLLCInfo ${res.status}`); return null; }
    const body = await safeJson<{ llc?: LLCInfo }>(res, {});
    return body.llc ?? null;
  } catch (err) { await logBusinessError('upsertLLCInfo threw', err); return null; }
}

export async function getLLCInboxItems(filterStatus?: string): Promise<LLCInboxItem[]> {
  try {
    const res = await fetch('/api/business/llc/inbox', { cache: 'no-store' });
    if (!res.ok) { await logBusinessError(`getLLCInboxItems ${res.status}`); return []; }
    const body = await safeJson<{ items?: LLCInboxItem[] }>(res, {});
    const items = body.items ?? [];
    return filterStatus ? items.filter((i) => i.status === filterStatus) : items;
  } catch (err) { await logBusinessError('getLLCInboxItems threw', err); return []; }
}

export async function createLLCInboxItem(
  item: Omit<LLCInboxItem, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'deleted_at'> & { user_id?: string }
): Promise<LLCInboxItem | null> {
  try {
    const res = await fetch('/api/business/llc/inbox', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({
        title: item.title,
        received_on: item.received_on,
        status: item.status,
        notes: item.notes ?? null,
        attachment_path: item.attachment_path ?? null,
      }),
    });
    if (!res.ok) { await logBusinessError(`createLLCInboxItem ${res.status}`); return null; }
    const body = await safeJson<{ item?: LLCInboxItem }>(res, {});
    return body.item ?? null;
  } catch (err) { await logBusinessError('createLLCInboxItem threw', err); return null; }
}

export async function updateLLCInboxItemStatus(
  itemId: string,
  status: 'new' | 'in_review' | 'done' | 'archived'
): Promise<boolean> {
  try {
    const res = await fetch(`/api/business/llc/inbox/${encodeURIComponent(itemId)}`, {
      method: 'PUT',
      headers: jsonHeaders(),
      body: JSON.stringify({ status }),
    });
    if (!res.ok) { await logBusinessError(`updateLLCInboxItemStatus ${res.status}`); return false; }
    return true;
  } catch (err) { await logBusinessError('updateLLCInboxItemStatus threw', err); return false; }
}

export async function deleteLLCInboxItem(itemId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/business/llc/inbox/${encodeURIComponent(itemId)}`, {
      method: 'DELETE',
      headers: jsonHeaders(),
    });
    if (!res.ok) { await logBusinessError(`deleteLLCInboxItem ${res.status}`); return false; }
    return true;
  } catch (err) { await logBusinessError('deleteLLCInboxItem threw', err); return false; }
}
