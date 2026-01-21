# Sprint 9.1 - Deployment Guide

## Before You Deploy

### Prerequisites
- [ ] Supabase project configured
- [ ] Database connection available
- [ ] Backup taken (if production)
- [ ] Team notified (if needed)

### What's Being Deployed
- **11 new tables** for Business module
- **48 RLS policies** (owner-only access)
- **15+ indexes** (query optimization)
- **Zero breaking changes** (all new tables)

---

## Deployment Method 1: Supabase Dashboard (Recommended for Testing)

### Step 1: Open SQL Editor
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Click **SQL Editor** in left sidebar
4. Click **New Query**

### Step 2: Copy Migration
1. Open `supabase/migrations/014_business_core.sql` in your editor
2. Copy all contents (entire file)

### Step 3: Paste & Run
1. Paste into Supabase SQL Editor
2. Click **▶ Run** button
3. Wait for completion (usually ~5 seconds)

### Step 4: Verify Success
```sql
-- Check tables exist
\dt business_*
\dt llc_*

-- Should see:
-- business_costs
-- business_cost_templates
-- business_milestones
-- business_sops
-- business_sop_items
-- business_sop_runs
-- business_sop_run_items
-- business_decisions
-- business_decision_tasks
-- llc_info
-- llc_inbox_items
```

---

## Deployment Method 2: Supabase CLI

### Prerequisites
```bash
# Install/update Supabase CLI
npm install -g supabase

# Or if using project CLI
npx supabase --version  # Should be 1.0+
```

### Step 1: Link Project
```bash
supabase link --project-ref YOUR_PROJECT_REF
# You'll be prompted for DB password
```

### Step 2: Push Migration
```bash
supabase db push

# Output should show:
# Applying new migrations...
# 014_business_core.sql
# Done! Migrations applied successfully.
```

### Step 3: Verify
```bash
supabase db list
# or check in Supabase dashboard
```

---

## Deployment Method 3: Manual SQL with psql

### Prerequisites
```bash
# Install PostgreSQL client
# macOS: brew install postgresql
# Windows: https://www.postgresql.org/download/windows/
# Linux: sudo apt-get install postgresql-client
```

### Step 1: Get Connection String
1. Supabase Dashboard → Project → Settings → Database
2. Copy **Connection string** (URI format)
3. Use it with: `psql "postgresql://[connection_string]"`

### Step 2: Run Migration
```bash
psql "postgresql://..." < supabase/migrations/014_business_core.sql
```

### Step 3: Verify Tables
```sql
\dt business_*
\dt llc_*
```

---

## Verification Checklist

### Tables Created
```sql
SELECT tablename FROM pg_tables 
WHERE tablename LIKE 'business_%' OR tablename LIKE 'llc_%';

-- Expected output (11 tables):
-- business_costs
-- business_cost_templates
-- business_milestones
-- business_sops
-- business_sop_items
-- business_sop_runs
-- business_sop_run_items
-- business_decisions
-- business_decision_tasks
-- llc_info
-- llc_inbox_items
```

### RLS Enabled
```sql
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE tablename LIKE 'business_%' OR tablename LIKE 'llc_%';

-- Expected: rowsecurity = true for all rows
```

### Policies Created
```sql
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename LIKE 'business_%' OR tablename LIKE 'llc_%';

-- Expected: 4 policies per table (SELECT, INSERT, UPDATE, DELETE)
-- Example: business_costs_owner_select, business_costs_owner_insert, etc.
```

### Indexes Created
```sql
SELECT indexname FROM pg_indexes
WHERE tablename LIKE 'business_%' OR tablename LIKE 'llc_%';

-- Expected: 15+ indexes on various columns
```

### Test RLS (Single User View)
```sql
-- Pretend to be user: 'test-user-1'
SELECT set_config('request.jwt.claims', 
  json_build_object('sub', 'test-user-1')::text, false);

-- Query costs (should be empty since test user owns nothing)
SELECT * FROM business_costs;

-- Insert a cost
INSERT INTO business_costs (
  id, user_id, amount, category, description, vendor, cost_date
) VALUES (
  gen_random_uuid(),
  'test-user-1',
  100.00,
  'Tools Software',
  'Test cost',
  'Test Vendor',
  NOW()::date
);

-- Query again (should see 1 row)
SELECT * FROM business_costs;
```

---

## Post-Deployment Tasks

### 1. Update Application
```bash
# Ensure types are in sync
npm run build

# Should complete without errors
# Exit code should be 0
```

### 2. Test Query Functions
Create a test file `test-business-queries.ts`:
```typescript
import {
  getBusinessCosts,
  getBusinessMilestones,
  getLLCInfo,
} from '@/lib/business';

async function testQueries() {
  console.log('Testing Business queries...');
  
  try {
    const costs = await getBusinessCosts();
    console.log('✅ getBusinessCosts() works:', costs?.length || 0, 'costs');
    
    const milestones = await getBusinessMilestones();
    console.log('✅ getBusinessMilestones() works:', milestones?.length || 0, 'milestones');
    
    const llc = await getLLCInfo();
    console.log('✅ getLLCInfo() works:', llc ? 'has data' : 'no data yet');
    
  } catch (err) {
    console.error('❌ Query test failed:', err);
  }
}

testQueries();
```

### 3. Create Test Fixtures (Optional)
```sql
-- Insert sample data for testing
INSERT INTO business_costs (
  id, user_id, amount, category, description, vendor, cost_date
) VALUES (
  gen_random_uuid(),
  auth.uid(),  -- Current user
  150.00,
  'Tools Software',
  'Annual IDE subscription',
  'JetBrains',
  '2024-01-15'::date
);
```

---

## Troubleshooting

### Error: "relation already exists"
**Cause**: Migration was already applied

**Solution**: This is safe—just means it's already deployed. Check tables exist with verification queries above.

### Error: "permission denied"
**Cause**: User doesn't have CREATE TABLE permission

**Solution**: 
- Use project admin credentials
- Or ask Supabase support to grant permissions

### Error: "function set_updated_at() does not exist"
**Cause**: Migration 010 (set_updated_at trigger) wasn't applied yet

**Solution**: 
1. Apply migration 010 first
2. Then apply 014

**Check**: Query existing migrations in Supabase (usually auto-numbered):
```bash
ls supabase/migrations/  # Check if 010_* exists
```

### Error: "foreign key constraint violation"
**Cause**: Usually tradermap_goals not found

**Solution**: This won't happen on fresh migration, but if re-running:
1. Ensure tradermap_goals table exists in DB
2. Or drop/recreate business tables first

### Queries return null/empty despite inserts
**Cause**: RLS filtering—user doesn't own the data

**Solution**: 
- Make sure `user_id` in insert matches authenticated user ID
- Check `auth.uid()` in your application
- Test manually with RLS verification query above

---

## Rollback Instructions

### Option 1: Drop All Tables (If Deployment Failed)

**In Supabase Dashboard:**
1. SQL Editor → New Query
2. Paste:
```sql
DROP TABLE IF EXISTS llc_inbox_items CASCADE;
DROP TABLE IF EXISTS llc_info CASCADE;
DROP TABLE IF EXISTS business_decision_tasks CASCADE;
DROP TABLE IF EXISTS business_decisions CASCADE;
DROP TABLE IF EXISTS business_sop_run_items CASCADE;
DROP TABLE IF EXISTS business_sop_runs CASCADE;
DROP TABLE IF EXISTS business_sop_items CASCADE;
DROP TABLE IF EXISTS business_sops CASCADE;
DROP TABLE IF EXISTS business_milestones CASCADE;
DROP TABLE IF EXISTS business_cost_templates CASCADE;
DROP TABLE IF EXISTS business_costs CASCADE;
```
3. Run query
4. Verify tables are gone

### Option 2: Revert Git Commit + Re-apply

```bash
# Undo code changes
git revert 0fe561b

# In Supabase, drop tables (see Option 1)
# Then restart if needed

# Note: Tables won't auto-drop when code is reverted
# You must manually drop them in Supabase
```

### Option 3: Keep Tables, Just Delete Data

```sql
-- Soft delete all records (safe, preserves history)
UPDATE business_costs SET deleted_at = NOW();
UPDATE business_cost_templates SET deleted_at = NOW();
UPDATE business_milestones SET deleted_at = NOW();
UPDATE business_sops SET deleted_at = NOW();
UPDATE business_sop_items SET deleted_at = NOW();
UPDATE business_sop_runs SET deleted_at = NOW();
UPDATE business_sop_run_items SET deleted_at = NOW();
UPDATE business_decisions SET deleted_at = NOW();
UPDATE business_decision_tasks SET deleted_at = NOW();
UPDATE llc_info SET deleted_at = NOW();
UPDATE llc_inbox_items SET deleted_at = NOW();

-- Hard delete (irreversible)
DELETE FROM business_costs;
DELETE FROM business_cost_templates;
-- ... etc
```

---

## Post-Rollback Recovery

```bash
# If you rolled back and need to re-apply:

# 1. Revert the revert
git revert <revert-commit-hash>

# 2. Create fresh DB (if on local Supabase)
supabase db reset

# 3. Push migrations again
supabase db push

# 4. Or manually re-apply via dashboard
```

---

## Monitoring After Deployment

### Check for Errors in Logs
```bash
# If using Supabase CLI
supabase logs --tail
```

### Monitor Database Performance
In Supabase Dashboard:
- **Database** → **Migrations** → Should see 014_business_core
- **Database** → **Tables** → Should see all 11 new tables
- **Authentication** → Check user count (for RLS testing)

### Test Application
1. Log in as a user
2. Navigate to Business section (once built)
3. Try CRUD operations
4. Verify data is user-specific (RLS working)

---

## Estimated Timing

| Task | Time |
|------|------|
| Copy migration | < 1 min |
| Paste into Supabase | < 1 min |
| Run query | 5-10 sec |
| Verify tables | 1-2 min |
| Test queries | 2-3 min |
| **Total** | **~10 min** |

---

## Success Indicators

✅ All 11 tables created  
✅ 48 RLS policies enforced  
✅ Indexes created  
✅ No errors in Supabase logs  
✅ TypeScript build passes  
✅ Queries return typed results  
✅ RLS prevents cross-user access  

---

## Support

**Issues?**
1. Check troubleshooting section above
2. Review [Supabase Docs](https://supabase.com/docs)
3. Check migration syntax in `014_business_core.sql`
4. Verify migration 010 (set_updated_at) is applied first

---

**Status**: ✅ Ready to deploy

**Commit**: `0fe561b`

**File to deploy**: `supabase/migrations/014_business_core.sql`
