# Sprint 9.1 - API Reference

## Module: `@/lib/business`

All query functions are **server-side only** (use in Server Components or API routes).

---

## Types & Constants

### Import
```typescript
import {
  // Types
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
  
  // Constants
  COST_CATEGORIES,
  SOP_TYPES,
  MILESTONE_STATUSES,
  DECISION_PRIORITIES,
  LLC_INBOX_STATUSES,
} from '@/lib/business';
```

### Type Definitions

#### BusinessCost
```typescript
interface BusinessCost {
  id: string;                    // UUID, primary key
  user_id: string;               // UUID, RLS filter
  amount: number;                // decimal(12,2), >= 0
  category: string;              // See COST_CATEGORIES
  description: string;
  vendor: string;
  cost_date: string;             // YYYY-MM-DD
  is_recurring_instance: boolean; // True if created from template
  template_id: string | null;    // ref to business_cost_templates
  sort_index: number;            // User-controlled ordering
  created_at: string;            // ISO timestamp
  updated_at: string;            // ISO timestamp
  deleted_at: string | null;     // Soft delete marker
}
```

#### BusinessCostTemplate
```typescript
interface BusinessCostTemplate {
  id: string;                // UUID
  user_id: string;           // UUID, RLS filter
  amount: number;            // decimal(12,2)
  category: string;          // See COST_CATEGORIES
  description: string;
  vendor: string;
  day_of_month: number;      // 1-31, day to generate cost
  start_month: string;       // YYYY-MM format, when template starts
  active: boolean;           // Can be toggled on/off
  last_generated_month: string | null; // YYYY-MM, prevents duplication
  sort_index: number;        // User-controlled ordering
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}
```

#### BusinessMilestone
```typescript
interface BusinessMilestone {
  id: string;           // UUID
  user_id: string;      // UUID, RLS filter
  title: string;        // e.g., "Hit 6-figure account"
  description: string;
  target_date: string | null; // YYYY-MM-DD
  status: 'pending' | 'in_progress' | 'completed';
  goal_id: string | null; // Optional link to tradermap_goals
  notes: string | null;
  sort_index: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}
```

#### BusinessSOP
```typescript
interface BusinessSOP {
  id: string;    // UUID
  user_id: string; // UUID, RLS filter
  title: string;   // e.g., "Pre-Trading Checklist"
  type: 'pre_session' | 'post_session' | 'drawdown_protocol' | 
        'withdrawal_protocol' | 'weekly_close' | 'monthly_close' | 'custom';
  content: string; // Markdown or plain text
  sort_index: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}
```

#### BusinessSOPItem
```typescript
interface BusinessSOPItem {
  id: string;       // UUID
  sop_id: string;   // UUID, ref to business_sops
  user_id: string;  // UUID, RLS filter
  label: string;    // Checklist item text
  sort_index: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}
```

#### BusinessSOPRun
```typescript
interface BusinessSOPRun {
  id: string;       // UUID
  user_id: string;  // UUID, RLS filter
  sop_id: string;   // UUID, ref to business_sops
  run_date: string; // YYYY-MM-DD, when SOP was executed
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}
```

#### BusinessSOPRunItem
```typescript
interface BusinessSOPRunItem {
  id: string;       // UUID
  user_id: string;  // UUID, RLS filter
  run_id: string;   // UUID, ref to business_sop_runs
  item_id: string;  // UUID, ref to business_sop_items
  checked: boolean;
  checked_at: string | null; // ISO timestamp when checked
  note: string | null;        // Item-specific note
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}
```

#### BusinessDecision
```typescript
interface BusinessDecision {
  id: string;           // UUID
  user_id: string;      // UUID, RLS filter
  title: string;        // Short decision name
  context: string;      // Situation analysis
  decision: string;     // What decision was made
  rationale: string;    // Why this decision
  impact: string;       // Expected outcomes
  tags: string[];       // Array of string tags
  priority: 'low' | 'med' | 'high';
  sort_index: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}
```

#### BusinessDecisionTask
```typescript
interface BusinessDecisionTask {
  id: string;           // UUID
  user_id: string;      // UUID, RLS filter
  decision_id: string;  // UUID, ref to business_decisions
  title: string;        // Task description
  done: boolean;
  sort_index: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}
```

#### LLCInfo
```typescript
interface LLCInfo {
  id: string;                       // UUID
  user_id: string;                  // UUID, RLS filter, UNIQUE per user
  llc_name: string;                 // "Acme Trading LLC"
  formation_date: string | null;    // YYYY-MM-DD
  annual_report_due_month: number;  // 1-12
  annual_fee_baseline: number;      // decimal(10,2), default 60.00
  registered_agent_name: string;
  ein: string;                      // "12-3456789"
  notes: string | null;
  last_annual_report_push_year: number | null; // For reminder tracking
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}
```

#### LLCInboxItem
```typescript
interface LLCInboxItem {
  id: string;             // UUID
  user_id: string;        // UUID, RLS filter
  title: string;          // Document/notice name
  received_on: string;    // YYYY-MM-DD
  status: 'new' | 'in_review' | 'done' | 'archived';
  notes: string | null;
  attachment_path: string | null; // Path in Supabase Storage
  sort_index: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}
```

### Constants

```typescript
export const COST_CATEGORIES = [
  'Tools Software',
  'Data',
  'Commissions Fees',
  'Infrastructure',
  'Education',
  'Other',
];

export const SOP_TYPES = [
  'pre_session',
  'post_session',
  'drawdown_protocol',
  'withdrawal_protocol',
  'weekly_close',
  'monthly_close',
  'custom',
];

export const MILESTONE_STATUSES = [
  'pending',
  'in_progress',
  'completed',
];

export const DECISION_PRIORITIES = [
  'low',
  'med',
  'high',
];

export const LLC_INBOX_STATUSES = [
  'new',
  'in_review',
  'done',
  'archived',
];
```

---

## Query Functions

All functions are located in `src/lib/business/queries.ts`.

### Business Costs

#### getBusinessCosts()
Get all costs for user, optionally filtered by month.

```typescript
async function getBusinessCosts(filterMonth?: string): Promise<BusinessCost[] | null>
```

**Parameters:**
- `filterMonth?` - Optional month filter in format `YYYY-MM` (e.g., `'2024-01'`)

**Returns:**
- Array of costs, or null on error
- Automatically filtered to user (RLS)
- Excludes soft-deleted records

**Example:**
```typescript
// Get all costs
const allCosts = await getBusinessCosts();

// Get costs for January 2024
const jan2024 = await getBusinessCosts('2024-01');

// Filter in component
const costs = allCosts?.filter(c => c.category === 'Tools Software') || [];
```

#### getBusinessCostTemplates()
Get all recurring cost templates for user.

```typescript
async function getBusinessCostTemplates(): Promise<BusinessCostTemplate[] | null>
```

**Returns:**
- Array of active templates, or null on error
- Automatically filtered to user
- Excludes soft-deleted records

**Example:**
```typescript
const templates = await getBusinessCostTemplates();
const activeCosts = templates?.filter(t => t.active) || [];
```

#### createBusinessCost()
Insert a new cost.

```typescript
async function createBusinessCost(cost: Partial<BusinessCost>): Promise<BusinessCost | null>
```

**Parameters:**
- `cost` - Object with: `amount`, `category`, `description`, `vendor`, `cost_date`, `template_id?`
- `user_id` is automatically set to current user
- `id`, `created_at` are auto-generated

**Example:**
```typescript
const newCost = await createBusinessCost({
  amount: 99.99,
  category: 'Tools Software',
  description: 'Annual IDE subscription',
  vendor: 'JetBrains',
  cost_date: '2024-01-15',
});
```

#### deleteBusinessCost()
Soft-delete a cost.

```typescript
async function deleteBusinessCost(costId: string): Promise<boolean>
```

**Returns:**
- `true` if successful, `false` on error
- Data is not removed, just marked as deleted (`deleted_at` set)

**Example:**
```typescript
const success = await deleteBusinessCost(costId);
if (success) console.log('Cost deleted');
```

---

### Business Milestones

#### getBusinessMilestones()
Get all milestones for user.

```typescript
async function getBusinessMilestones(): Promise<BusinessMilestone[] | null>
```

**Returns:**
- Array of milestones, or null on error
- Automatically filtered to user

**Example:**
```typescript
const milestones = await getBusinessMilestones();
const completed = milestones?.filter(m => m.status === 'completed') || [];
```

#### createBusinessMilestone()
Create a new milestone.

```typescript
async function createBusinessMilestone(
  milestone: Partial<BusinessMilestone>
): Promise<BusinessMilestone | null>
```

**Parameters:**
- `milestone` - Object with: `title`, `description`, `target_date?`, `goal_id?`, `status?` (default: pending)

**Example:**
```typescript
const milestone = await createBusinessMilestone({
  title: 'Achieve 10K monthly profit',
  description: 'Consistent profitability milestone',
  target_date: '2024-06-30',
  status: 'pending',
});
```

#### updateBusinessMilestoneStatus()
Update milestone status.

```typescript
async function updateBusinessMilestoneStatus(
  milestoneId: string,
  status: 'pending' | 'in_progress' | 'completed'
): Promise<BusinessMilestone | null>
```

**Example:**
```typescript
await updateBusinessMilestoneStatus(milestoneId, 'in_progress');
```

#### deleteBusinessMilestone()
Soft-delete a milestone.

```typescript
async function deleteBusinessMilestone(milestoneId: string): Promise<boolean>
```

---

### Business SOPs

#### getBusinessSOPs()
Get all SOPs for user.

```typescript
async function getBusinessSOPs(): Promise<BusinessSOP[] | null>
```

#### getBusinessSOPWithItems()
Get single SOP with all checklist items (relational query).

```typescript
async function getBusinessSOPWithItems(
  sopId: string
): Promise<(BusinessSOP & { items: BusinessSOPItem[] }) | null>
```

**Returns:**
- SOP object with `items` array containing all checklist items
- Useful for rendering complete SOP with checklist

**Example:**
```typescript
const sopWithItems = await getBusinessSOPWithItems(sopId);
if (sopWithItems) {
  console.log(sopWithItems.title);
  sopWithItems.items.forEach(item => {
    console.log(`- ${item.label}`);
  });
}
```

#### createBusinessSOP()
Create a new SOP.

```typescript
async function createBusinessSOP(
  sop: Partial<BusinessSOP>
): Promise<BusinessSOP | null>
```

**Parameters:**
- `sop` - Object with: `title`, `type`, `content`

**Example:**
```typescript
const sop = await createBusinessSOP({
  title: 'Pre-Trading Checklist',
  type: 'pre_session',
  content: '1. Review overnight news\n2. Check market conditions\n3. Plan entries...',
});
```

#### deleteBusinessSOP()
Soft-delete an SOP (cascades to items, runs, and run items).

```typescript
async function deleteBusinessSOP(sopId: string): Promise<boolean>
```

#### getBusinessSOPRuns()
Get execution history for a SOP.

```typescript
async function getBusinessSOPRuns(sopId: string): Promise<BusinessSOPRun[] | null>
```

**Returns:**
- Array of run records for a specific SOP
- Sorted by run_date

**Example:**
```typescript
const runs = await getBusinessSOPRuns(sopId);
const thisMonth = runs?.filter(r => 
  r.run_date.startsWith('2024-01')
) || [];
```

#### getBusinessSOPRunItems()
Get completed checklist items for a specific run.

```typescript
async function getBusinessSOPRunItems(runId: string): Promise<BusinessSOPRunItem[] | null>
```

**Returns:**
- Array of run items (linked to items and runs)
- Includes check status and timestamps

**Example:**
```typescript
const runItems = await getBusinessSOPRunItems(runId);
const checked = runItems?.filter(ri => ri.checked).length || 0;
const total = runItems?.length || 0;
console.log(`${checked}/${total} items completed`);
```

#### createBusinessSOPRun()
Record a new SOP execution.

```typescript
async function createBusinessSOPRun(
  run: Partial<BusinessSOPRun>
): Promise<BusinessSOPRun | null>
```

**Parameters:**
- `run` - Object with: `sop_id`, `run_date`, `notes?`

**Example:**
```typescript
const run = await createBusinessSOPRun({
  sop_id: sopId,
  run_date: new Date().toISOString().split('T')[0], // Today
  notes: 'Morning routine completed successfully',
});
```

#### updateBusinessSOPRunItem()
Mark a checklist item as checked/unchecked in a run.

```typescript
async function updateBusinessSOPRunItem(
  runItemId: string,
  checked: boolean,
  note?: string
): Promise<BusinessSOPRunItem | null>
```

**Example:**
```typescript
// Mark as checked
await updateBusinessSOPRunItem(runItemId, true, 'News review took 10 min');

// Mark as unchecked
await updateBusinessSOPRunItem(runItemId, false);
```

---

### Business Decisions

#### getBusinessDecisions()
Get all decisions for user.

```typescript
async function getBusinessDecisions(): Promise<BusinessDecision[] | null>
```

#### getBusinessDecisionWithTasks()
Get single decision with follow-up tasks.

```typescript
async function getBusinessDecisionWithTasks(
  decisionId: string
): Promise<(BusinessDecision & { tasks: BusinessDecisionTask[] }) | null>
```

**Example:**
```typescript
const decision = await getBusinessDecisionWithTasks(decisionId);
if (decision) {
  console.log(decision.title);
  const pendingTasks = decision.tasks.filter(t => !t.done);
  console.log(`${pendingTasks.length} tasks remaining`);
}
```

#### createBusinessDecision()
Create a new decision record.

```typescript
async function createBusinessDecision(
  decision: Partial<BusinessDecision>
): Promise<BusinessDecision | null>
```

**Parameters:**
- `decision` - Object with: `title`, `context`, `decision`, `rationale`, `impact`, `tags?`, `priority?`

**Example:**
```typescript
const decision = await createBusinessDecision({
  title: 'Switch to prop firm',
  context: 'Current broker fees are too high',
  decision: 'Approved move to XYZ Prop Firm',
  rationale: 'Better fee structure and risk management tools',
  impact: 'Expected 2% improvement in monthly returns',
  tags: ['finance', 'strategy'],
  priority: 'high',
});
```

#### deleteBusinessDecision()
Soft-delete a decision (cascades to tasks).

```typescript
async function deleteBusinessDecision(decisionId: string): Promise<boolean>
```

---

### LLC Info

#### getLLCInfo()
Get LLC info for current user (returns single record).

```typescript
async function getLLCInfo(): Promise<LLCInfo | null>
```

**Returns:**
- Single LLCInfo record, or null if not created yet
- Max 1 per user (enforced by UNIQUE constraint)

**Example:**
```typescript
const llc = await getLLCInfo();
if (!llc) {
  console.log('LLC info not set up yet');
}
```

#### upsertLLCInfo()
Create or update LLC info.

```typescript
async function upsertLLCInfo(llcInfo: Partial<LLCInfo>): Promise<LLCInfo | null>
```

**Parameters:**
- `llcInfo` - Object with: `llc_name`, `formation_date?`, `annual_report_due_month`, `ein`, `registered_agent_name`, `annual_fee_baseline?`, `notes?`
- Automatically checks for existing record and updates if found

**Example:**
```typescript
const llc = await upsertLLCInfo({
  llc_name: 'My Trading LLC',
  formation_date: '2023-01-15',
  annual_report_due_month: 3, // March
  ein: '12-3456789',
  registered_agent_name: 'John Agent Inc',
  annual_fee_baseline: 125.00,
});
```

---

### LLC Inbox

#### getLLCInboxItems()
Get LLC inbox items, optionally filtered by status.

```typescript
async function getLLCInboxItems(
  filterStatus?: 'new' | 'in_review' | 'done' | 'archived'
): Promise<LLCInboxItem[] | null>
```

**Example:**
```typescript
// Get all inbox items
const allItems = await getLLCInboxItems();

// Get new items only
const newItems = await getLLCInboxItems('new');

// Get archived items
const archived = await getLLCInboxItems('archived');
```

#### createLLCInboxItem()
Add item to LLC inbox.

```typescript
async function createLLCInboxItem(
  item: Partial<LLCInboxItem>
): Promise<LLCInboxItem | null>
```

**Parameters:**
- `item` - Object with: `title`, `received_on`, `status?` (default: 'new'), `notes?`, `attachment_path?`

**Example:**
```typescript
const item = await createLLCInboxItem({
  title: 'Annual Report 2024',
  received_on: '2024-01-10',
  status: 'new',
  notes: 'Due by March 31',
});
```

#### updateLLCInboxItemStatus()
Update status of inbox item.

```typescript
async function updateLLCInboxItemStatus(
  itemId: string,
  status: 'new' | 'in_review' | 'done' | 'archived'
): Promise<LLCInboxItem | null>
```

**Example:**
```typescript
await updateLLCInboxItemStatus(itemId, 'done');
```

#### deleteLLCInboxItem()
Soft-delete inbox item.

```typescript
async function deleteLLCInboxItem(itemId: string): Promise<boolean>
```

---

## Error Handling

All functions follow consistent error handling:

```typescript
// Function returns null on error
const result = await getBusinessCosts();
if (!result) {
  console.error('Failed to fetch costs');
  // Handle gracefully in UI
}

// Or check length/existence
const costs = await getBusinessCosts();
const count = costs?.length || 0;
```

Errors are logged to browser console but don't throw exceptions.

---

## Server Component Example

```typescript
// app/dashboard/business/page.tsx
import {
  getBusinessCosts,
  getBusinessMilestones,
  getLLCInfo,
  COST_CATEGORIES,
} from '@/lib/business';

export default async function BusinessPage() {
  const [costs, milestones, llc] = await Promise.all([
    getBusinessCosts(),
    getBusinessMilestones(),
    getLLCInfo(),
  ]);

  return (
    <div>
      <h1>Business Dashboard</h1>
      
      <section>
        <h2>Costs ({costs?.length || 0})</h2>
        {costs?.map(cost => (
          <div key={cost.id}>
            {cost.vendor} - ${cost.amount} ({cost.category})
          </div>
        ))}
      </section>

      <section>
        <h2>Milestones</h2>
        {milestones?.map(m => (
          <div key={m.id}>
            {m.title} - {m.status}
          </div>
        ))}
      </section>

      {llc && (
        <section>
          <h2>LLC Info</h2>
          <p>{llc.llc_name}</p>
          <p>EIN: {llc.ein}</p>
        </section>
      )}
    </div>
  );
}
```

---

## RLS & Security

All queries automatically enforce owner-only access:
- No authentication needed (handled by Supabase middleware)
- Can't access other users' data
- Soft-deleted records filtered automatically
- All operations checked at database level

---

**Status**: ✅ Complete API Reference

**Module**: `@/lib/business`

**All functions**: Server-side only (use in Server Components or API routes)
