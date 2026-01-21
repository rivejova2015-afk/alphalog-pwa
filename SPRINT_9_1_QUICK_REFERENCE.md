# Sprint 9.1 - Quick Reference

## What Was Built

11 database tables for the **Business module** with complete RLS, soft delete, and TypeScript types.

---

## Files Created

| File | Size | Purpose |
|------|------|---------|
| `supabase/migrations/014_business_core.sql` | 1100 L | Database schema with 11 tables, RLS, indexes |
| `src/lib/business/types.ts` | 220 L | TypeScript interfaces + enum arrays |
| `src/lib/business/queries.ts` | 630 L | 25+ server-side query functions |
| `src/lib/business/index.ts` | 3 L | Module exports |

---

## Database Tables (11 Total)

| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `business_costs` | Monthly expenses | amount, category, vendor, cost_date |
| `business_cost_templates` | Recurring costs | amount, category, day_of_month |
| `business_milestones` | Business goals | title, status (pending/in_progress/completed), target_date |
| `business_sops` | Standard procedures | title, type, content |
| `business_sop_items` | SOP checklist items | label, sort_index |
| `business_sop_runs` | SOP executions | sop_id, run_date |
| `business_sop_run_items` | Execution status | checked, checked_at, note |
| `business_decisions` | Strategic decisions | title, context, decision, rationale, impact, tags |
| `business_decision_tasks` | Follow-up tasks | title, done |
| `llc_info` | LLC registration (1 per user) | llc_name, formation_date, ein, etc. |
| `llc_inbox_items` | LLC inbox | title, received_on, status (new/in_review/done/archived) |

---

## Enum Values (for forms/filters)

### Cost Categories
```
'Tools Software'
'Data'
'Commissions Fees'
'Infrastructure'
'Education'
'Other'
```

### SOP Types
```
'pre_session', 'post_session', 'drawdown_protocol',
'withdrawal_protocol', 'weekly_close', 'monthly_close', 'custom'
```

### Milestone Statuses
```
'pending', 'in_progress', 'completed'
```

### Decision Priorities
```
'low', 'med', 'high'
```

### LLC Inbox Statuses
```
'new', 'in_review', 'done', 'archived'
```

---

## TypeScript Usage

```typescript
import {
  // Types
  BusinessCost,
  BusinessMilestone,
  BusinessSOP,
  BusinessDecision,
  LLCInfo,
  
  // Query functions
  getBusinessCosts,
  createBusinessMilestone,
  getLLCInfo,
  upsertLLCInfo,
  
  // Enum constants
  COST_CATEGORIES,
  MILESTONE_STATUSES,
  SOP_TYPES,
  DECISION_PRIORITIES,
  LLC_INBOX_STATUSES,
} from '@/lib/business';
```

---

## Common Queries

### Get all costs for a month
```typescript
const costs = await getBusinessCosts('2024-01');
```

### Get milestone with tasks
```typescript
const decision = await getBusinessDecisionWithTasks(decisionId);
const tasks = decision?.tasks || [];
```

### Get SOP with checklist
```typescript
const sop = await getBusinessSOPWithItems(sopId);
const items = sop?.items || [];
```

### Get or create LLC info
```typescript
let llc = await getLLCInfo();
if (!llc) {
  llc = await upsertLLCInfo({
    llc_name: 'My LLC',
    ein: '12-3456789',
    // ... other fields
  });
}
```

---

## Key Architecture Decisions

| Decision | Why |
|----------|-----|
| **RLS on all tables** | Prevent cross-user data access at database level |
| **Soft delete** | Keep historical data while hiding deleted records |
| **updated_at trigger** | Track changes without manual timestamps |
| **sort_index** | Let users manually order items (not alphabetical) |
| **cost_templates + costs** | Separate recurring definitions from instances |
| **optional goal_id** | Link milestones to TraderMap if needed |
| **hierarchical SOPs** | SOP → Items → Runs → RunItems for tracking |
| **UNIQUE(user_id) on LLC** | One LLC info per user (enforced) |

---

## RLS Security

All tables have **owner-only access** enforced at database level:

```sql
WHERE auth.uid() = user_id  -- Users can only see their own data
```

No authentication needed in queries—Supabase RLS handles it automatically.

---

## Build Status

✅ **Passed**: Exit code 0, no TypeScript errors

---

## Deploy to Supabase

```bash
# 1. Copy migration file contents
supabase/migrations/014_business_core.sql

# 2. Apply via Dashboard:
#    Supabase → SQL Editor → Paste & Run

# OR via CLI:
supabase db push
```

---

## Rollback

```bash
git revert 0fe561b
# Then drop tables in Supabase if needed
```

---

## Next Steps

1. Apply migration to Supabase
2. Implement React components (Business dashboard)
3. Add API endpoints if needed
4. Test UI integration

---

**Status**: ✅ Ready for Supabase migration

**Commit**: `0fe561b`
