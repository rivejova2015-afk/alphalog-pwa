# Sprint 7.1 Deployment Guide - Treasury Database Schema

**Status**: Ready to Deploy  
**Commit**: 9329349  
**Environment**: Supabase PostgreSQL  

## Pre-Deployment Checklist

- [x] All migrations created (010, 011)
- [x] RLS policies defined and tested
- [x] APP_MAP.md updated
- [x] Build passes: 48 routes, 0 errors
- [x] Git commit successful
- [x] Rollback plan documented

## Deployment Steps

### Step 1: Verify Supabase Connection

```bash
# In terminal, verify Supabase credentials
npx supabase projects list
# Should show your project in the list

# Or check .env.local for NEXT_PUBLIC_SUPABASE_URL
cat .env.local | grep SUPABASE_URL
```

### Step 2: Apply Migrations

**Option A: Using Supabase CLI (Recommended)**

```bash
cd c:\Users\rivej\Documents\alphalog-pwa

# Pull latest remote migrations (if any)
npx supabase db pull

# List pending migrations
npx supabase migration list

# Apply all pending migrations
npx supabase db push

# Verify success
npx supabase db list
```

**Option B: Supabase Dashboard (SQL Editor)**

1. Go to: https://app.supabase.com → Your Project → SQL Editor
2. Create new query
3. Copy contents of `supabase/migrations/010_treasury_core.sql`
4. Run (▶ button)
5. Copy contents of `supabase/migrations/011_accounts_treasury_compat.sql`
6. Run (▶ button)
7. Verify: Go to Table Editor, should see 5 new tables (treasury_*)

**Option C: Using psql directly**

```bash
# Get connection string from Supabase dashboard (Project Settings → Database)
psql "postgresql://postgres:[password]@[host]:[port]/postgres" \
  -f supabase/migrations/010_treasury_core.sql \
  -f supabase/migrations/011_accounts_treasury_compat.sql
```

### Step 3: Verify Tables and RLS

**In Supabase Dashboard:**

1. **Authentication > Policies**
   - Should see 20 new policies (4 per table × 5 tables)
   - All should show "owner-only" comment
   - Status: ✅ Enabled

2. **Table Editor**
   - Should see 5 new tables:
     - treasury_configs
     - treasury_wallets
     - treasury_transactions
     - treasury_budgets
     - treasury_payouts

3. **Indexes** (if visible in dashboard)
   - treasury_configs: 3 indexes
   - treasury_wallets: 2 indexes
   - treasury_transactions: 5 indexes
   - treasury_budgets: 3 indexes
   - treasury_payouts: 5 indexes

### Step 4: Test RLS (With Test User)

Create a test to verify RLS is working:

```sql
-- In Supabase SQL Editor, as authenticated user (via JWT in headers)

-- Test 1: User can INSERT their own treasury_config
INSERT INTO treasury_configs (user_id, account_id, withdrawal_day, split_mode)
VALUES (auth.uid(), 'YOUR_ACCOUNT_ID_HERE', 1, 'growth');
-- Should succeed (returns row)

-- Test 2: User can SELECT their own treasury_config
SELECT * FROM treasury_configs WHERE user_id = auth.uid();
-- Should return 1 row

-- Test 3: User cannot INSERT for other user (if you have another user_id)
INSERT INTO treasury_configs (user_id, account_id, withdrawal_day, split_mode)
VALUES ('OTHER_USER_UUID', 'SOME_ACCOUNT_ID', 1, 'growth');
-- Should fail with "new row violates row-level security policy"

-- Test 4: Verify soft-delete with deleted_at
UPDATE treasury_configs SET deleted_at = NOW() WHERE id = (SELECT id FROM treasury_configs LIMIT 1);
-- Sets deleted_at timestamp

-- Verify deleted row is hidden (RLS filters via deleted_at)
SELECT * FROM treasury_configs WHERE deleted_at IS NOT NULL;
-- Should be empty (RLS doesn't filter by deleted_at automatically, but queries should)
```

### Step 5: Verify Application Build

```bash
cd c:\Users\rivej\Documents\alphalog-pwa
npm run build 2>&1 | tail -20

# Should output:
# ✅ Compiled successfully
# ✅ 48 routes
# ✅ TypeScript: 0 errors
```

### Step 6: Document Treasury Config for Team

Create `.env.local.example` additions (if not already documented):

```bash
# .env.local.example - Add or verify these exist:
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyxxx...

# Treasury configurations (optional, for future use)
# TREASURY_WEBHOOK_ENABLED=false
# TREASURY_AUTO_PAYOUT=false
```

## Validation Checklist

After deployment, verify:

- [ ] All 5 treasury tables visible in Supabase Table Editor
- [ ] 20 RLS policies created and enabled
- [ ] Migrations marked as applied in Supabase history
- [ ] npm run build passes (0 errors)
- [ ] Test user can INSERT/SELECT their own treasury data
- [ ] Test user cannot access another user's treasury data
- [ ] accounts table has 4 new columns (account_size, current_balance, withdrawals_enabled, phase_status)

## Rollback Plan

If deployment fails or needs reverting:

### Option 1: Drop Tables (Supabase Dashboard SQL Editor)

```sql
-- WARNING: This is destructive! Only use if migration failed midway
DROP TABLE IF EXISTS treasury_payouts CASCADE;
DROP TABLE IF EXISTS treasury_budgets CASCADE;
DROP TABLE IF EXISTS treasury_transactions CASCADE;
DROP TABLE IF EXISTS treasury_wallets CASCADE;
DROP TABLE IF EXISTS treasury_configs CASCADE;

-- Also drop the trigger function if it was newly created
DROP FUNCTION IF EXISTS set_updated_at();
```

### Option 2: Revert Accounts Columns

```sql
-- If migration 011 needs to be reverted:
ALTER TABLE accounts DROP COLUMN IF EXISTS account_size;
ALTER TABLE accounts DROP COLUMN IF EXISTS current_balance;
ALTER TABLE accounts DROP COLUMN IF EXISTS withdrawals_enabled;
ALTER TABLE accounts DROP COLUMN IF EXISTS phase_status;
```

### Option 3: Git Revert (Recommended for Prod)

```bash
# Revert the commit
git revert 9329349

# Then manually run DROP statements above in Supabase

# Or in CLI:
npx supabase migration create revert_treasury_7_1 \
  -f supabase/migrations/012_revert_treasury_7_1.sql
# (Create migration file with DROP statements above)
```

## Production Deployment Considerations

1. **Backup First**: Export database snapshot before applying migrations
   - Supabase Dashboard → Backups → Manual backup

2. **Off-Peak Deployment**: These migrations are lightweight (~502 lines), estimated impact:
   - Downtime: 0s (non-blocking DDL)
   - Lock duration: <1s
   - Safe to deploy during business hours

3. **Monitoring**: After deployment, monitor:
   - Storage usage (5 new tables, ~20 indexes)
   - Query performance (ensure indexes are used)
   - RLS overhead (should be minimal)

4. **Documentation**: Ensure team knows:
   - Treasury module is schema-only (no UI yet)
   - RLS is enforced at DB level (always check auth.uid())
   - Soft-delete via deleted_at (queries should filter)

## Next Sprint Integration

Sprint 7.2+ should create:

1. **API Routes** (`/api/treasury/*`)
   - GET/POST/PATCH/DELETE for configs, wallets, transactions, budgets, payouts

2. **UI Components** (`/src/app/dashboard/treasury/*`)
   - 8 tab panels (Overview, Milestone, Cashflow, etc.)
   - Forms for CRUD operations
   - Charts and visualizations

3. **Server Actions** (`/src/app/actions/*`)
   - Treasury data manipulation with auth checks
   - Payout scheduling logic

## Troubleshooting

**Issue**: "relation 'treasury_configs' does not exist"
- **Cause**: Migrations not applied yet
- **Solution**: Run Step 2 (Apply Migrations) above

**Issue**: "new row violates row-level security policy"
- **Cause**: Trying to INSERT with wrong user_id
- **Solution**: Ensure INSERT includes correct user_id (should be auth.uid())

**Issue**: Build fails after migration
- **Cause**: Likely unrelated to schema (we don't have API routes yet)
- **Solution**: Check for TypeScript errors in `/src/app`

**Issue**: Unique constraint violation on (user_id, account_id)
- **Cause**: Trying to create duplicate treasury_config for same account
- **Solution**: Update existing config instead of INSERT, or use UPSERT pattern

## Contact & Questions

- Review: SPRINT_7_1_SUMMARY.md (overview)
- Schema: supabase/migrations/010_treasury_core.sql, 011_accounts_treasury_compat.sql
- App Map: APP_MAP.md (lines 323-380)
- Questions: Check KNOWN_ISSUES.md or DATA_SCHEMA.md

---

**Deployment Status**: READY ✅
