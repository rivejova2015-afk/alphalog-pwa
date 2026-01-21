# SPRINT_4_1_DEPLOYMENT_GUIDE

**Sprint**: 4.1 - TradeHub Accounts CRUD  
**Date**: 2026-01-17  
**Status**: Ready for Deployment ✅

---

## Overview

This guide provides step-by-step instructions to deploy Sprint 4.1 (TradeHub Accounts feature) to production.

**What's Being Deployed**:
- Database: `account_categories` + `accounts` tables with RLS + soft-delete
- API: 4 routes for category and account CRUD + hard-delete
- UI: TradeHub page with AccountsPanel component
- **Total New Code**: ~1,405 LOC across 8 files

**Build Status**: ✅ Passes (`npm run build` → 0 errors, TypeScript OK, 15 routes compiled)

---

## Pre-Deployment Checklist

### Code Review
- [ ] Review PR with all changes
- [ ] Verify no hardcoded secrets in `.tsx` or `.ts` files
- [ ] Check `.env.local` has required vars: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_ANON_KEY`
- [ ] Confirm no new npm dependencies added

### Testing
- [ ] Run `npm run build` locally → passes without errors
- [ ] Manual test: Create account in dev environment
- [ ] Manual test: Edit and delete account
- [ ] Manual test: Papelera (trash) functionality
- [ ] Manual test: Restore from trash
- [ ] Manual test: Hard-delete (Vaciar Papelera)
- [ ] Manual test: RLS (2 users cannot see each other's accounts)
- [ ] Manual test: Anti-duplicados (cannot create 2 accounts with same name)

### Documentation
- [ ] SPRINT_4_1_SUMMARY.md created and reviewed
- [ ] APP_MAP.md updated with TradeHub > Accounts section
- [ ] TESTING_CHECKLIST.md updated with Sprint 4.1 tests

---

## Deployment Steps

### Phase 1: Database Migration (Supabase)

**Before Running**: Backup database or ensure rollback plan in place.

**Step 1: Apply Migration**
```bash
# Navigate to project root
cd c:\Users\rivej\Documents\alphalog-pwa

# Run migration
supabase db push
```

**Expected Output**:
```
Applying migration: supabase/migrations/003_tradehub_accounts.sql
Migration applied successfully
Tables created: account_categories, accounts
RLS policies applied
Triggers created
```

**Verify in Supabase Console**:
```sql
-- Table 1: account_categories
SELECT * FROM account_categories;
-- Should return empty (no data yet)

-- Table 2: accounts
SELECT * FROM accounts;
-- Should return empty (no data yet)

-- Check indexes
\di account_categories_user_name_uq
\di accounts_user_id_idx

-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename IN ('account_categories', 'accounts');
```

**If Issue**: Run `supabase db reset` to revert to previous state.

---

### Phase 2: Code Deployment (Next.js)

**Step 1: Build Validation**
```bash
npm run build
```

**Expected Output**:
```
Compiled successfully in 2.1s
TypeScript OK
Route (app)
├─ /api/account-categories
├─ /api/accounts
├─ /api/accounts/[id]
├─ /api/accounts/trash/empty
├─ /dashboard/tradehub
└─ ... (15 total routes)
```

**If Build Fails**:
- Check TypeScript errors: `npm run build` output
- Fix errors in `src/components/tradehub/` or `src/app/api/`
- Run build again

**Step 2: Deploy to Production**

**Option A: Vercel (Recommended)**
```bash
git add .
git commit -m "Sprint 4.1: TradeHub Accounts CRUD"
git push origin main  # Or your main branch
# Vercel auto-deploys
```

**Option B: Self-Hosted (Docker/VM)**
```bash
npm run build
npm start  # Or run in PM2/systemd
```

**Option C: Manual Server**
```bash
npm run build
# Copy .next/ and public/ to production server
npm install --production
npm start
```

---

### Phase 3: Post-Deployment Verification

**Step 1: Access Application**
- Navigate to `https://yourdomain.com` (or `http://localhost:3000` for local testing)
- Login with test account

**Step 2: Access TradeHub Page**
```
Navigation: Dashboard → (Find TradeHub link in sidebar/menu)
OR directly: https://yourdomain.com/dashboard/tradehub
```

**Expected**: Page loads with "TradeHub" header and "📋 Cuentas" section

**Step 3: Test CRUD Operations**

**Create Account**:
```
1. Click "+ Nueva Cuenta"
2. Fill form:
   - Name: "Test Account"
   - Category: Select from dropdown (or seed if empty)
   - Account Size: 10000
   - Current Balance: 5000
3. Click Submit
4. Account appears in list
5. Verify in Supabase: SELECT * FROM accounts WHERE name='Test Account'
```

**Read Account**:
```
1. Account visible in list with all fields
2. Click on account card/row → shows details (if detail view exists)
```

**Update Account**:
```
1. Click Edit button on account
2. Change Name: "Test Account Updated"
3. Click Submit
4. List updates immediately
5. Verify in Supabase: SELECT name FROM accounts WHERE id='...'
```

**Delete Account (Soft-Delete)**:
```
1. Click Delete button on account
2. Confirm dialog appears: "¿Estás seguro de eliminar esta cuenta?"
3. Click Yes
4. Account disappears from list
5. Account still in DB: SELECT * FROM accounts WHERE deleted_at IS NOT NULL
```

**Step 4: Test Papelera (Trash)**
```
1. Check "Ver papelera" checkbox
2. Deleted account appears in trash view
3. Header changes to "🗑️ Papelera"
4. See "RESTAURAR" button on deleted account
5. Click Restore → account moved back to active list
```

**Step 5: Test Vaciar Papelera (Hard-Delete)**
```
1. Ensure 1+ accounts in trash
2. Click "VACIAR PAPELERA" button
3. Strong confirmation modal appears: "¿Estás seguro? Se eliminarán PERMANENTEMENTE..."
4. Click Confirm
5. Trash becomes empty
6. Verify in Supabase: SELECT COUNT(*) FROM accounts WHERE deleted_at IS NOT NULL → 0
```

**Step 6: Test Categories Seed**
```
1. Delete all categories (if any exist) — soft-delete via API
2. Open AccountDialog (New Account)
3. Button should show: "Crear categorías sugeridas"
4. Click button
5. 5 default categories created:
   - Propfirm Forex
   - Propfirm Futuros
   - Forex Real
   - Futuros Real
   - Opciones
6. Dropdown updates with new categories
7. Verify in Supabase: SELECT COUNT(*) FROM account_categories → 5
```

**Step 7: Test Anti-Duplicados**
```
1. Create account: "My Trading Account"
2. Try to create another with same name → Error 409 (Duplicate)
3. Try with lowercase: "my trading account" → Error 409 (case-insensitive)
4. Delete first account
5. Create "My Trading Account" again → Success (soft-delete allows reuse)
```

**Step 8: Test RLS (2 Users)**
- Create 2 test accounts: `user_a@test.com`, `user_b@test.com`
- User A: Creates account "Private Account"
- User B: Login in separate browser/incognito
  - Navigate to `/dashboard/tradehub`
  - Should NOT see User A's accounts
  - Should only see their own (empty if just created)
- User B: Try to call API directly:
  ```bash
  curl -H "Authorization: Bearer USER_B_TOKEN" \
       https://yourdomain.com/api/accounts
  # Should return only User B's accounts
  ```
- User A's accounts should never be visible to User B

---

## Health Check

**Before Declaring Success**, run this health check:

```bash
# 1. Build validation (already done)
npm run build
# Should show: "Compiled successfully"

# 2. Start dev server
npm run dev
# Should show: "ready - started server on ..."

# 3. API health check
curl http://localhost:3000/api/health
# Should return: {"status": "ok"}

# 4. Navigate to page
open http://localhost:3000/dashboard/tradehub
# Should load without errors in browser console

# 5. Create test data
# Via UI: Create 1 account, 1 category, verify in DB

# 6. Check Supabase logs
# Supabase Dashboard → Logs → should show no errors for account_categories / accounts queries
```

---

## Rollback Plan (If Critical Issues Found)

### Immediate Rollback (Within Minutes)

**Option 1: Code Only**
```bash
# Revert to previous commit
git revert <sprint-4-1-commit-sha>
npm run build
npm start
```

**Option 2: Database Only**
```bash
# Revert migration
supabase db reset
# This reverts to previous migration state
# WARNING: Data loss in new tables (acceptable since new feature)
```

**Option 3: Full Rollback**
```bash
# Revert code + database
git revert <sprint-4-1-commit-sha>
supabase db reset
npm run build
npm start
```

### Files to Remove (If Manual Cleanup Needed)

If full revert fails, manually delete:
- `supabase/migrations/003_tradehub_accounts.sql`
- `src/components/tradehub/` (entire directory)
- `src/app/dashboard/tradehub/` (entire directory)
- `src/app/api/account-categories/` (entire directory)
- `src/app/api/accounts/` (entire directory)

Then run:
```bash
npm run build
npm start
```

### Estimated Rollback Time
- **Code rollback**: <5 minutes
- **Database rollback**: <2 minutes
- **Total**: <10 minutes (fully operational)

---

## Monitoring & Support

### Post-Deployment Monitoring (First 24 Hours)

**Watch For**:
1. **Error Logs**: Check Supabase logs for RLS errors, FK constraint violations
2. **API Response Times**: Monitor `/api/accounts` endpoint (should be <200ms)
3. **Build Errors**: Check deployment logs for any runtime errors
4. **User Reports**: Monitor Slack/support for complaints about TradeHub feature

### Key Metrics
- Successful account creations
- RLS policy denials (should be 0 for valid users)
- Database query errors (should be 0)
- API error rates (should be <1%)

### Support Escalation
If critical issues:
1. **Immediate**: Check error logs in Supabase console
2. **Diagnosis**: Run rollback test in staging
3. **Escalation**: If >30 min to fix, trigger full rollback
4. **Post-Mortem**: Document issue + root cause

---

## Success Criteria

✅ Deployment is **successful** when:

- [ ] All POST requests compile and routes are registered
- [ ] `npm run build` passes with 0 errors
- [ ] TradeHub page loads without JavaScript errors
- [ ] Create account button works + account appears in list
- [ ] Edit account button works + changes persist
- [ ] Delete account works + account moves to trash
- [ ] Restore from trash works + account returns to active list
- [ ] Vaciar papelera works + permanently deletes accounts
- [ ] RLS prevents cross-user data access
- [ ] Anti-duplicados prevents duplicate account names
- [ ] Seed categories button creates 5 default categories
- [ ] No TypeScript errors in browser console
- [ ] Supabase logs show no critical errors
- [ ] Database queries execute in <500ms (acceptable for MVP)

---

## Cleanup (Post-Success)

Once deployment verified successful:

1. **Archive Old Docs** (if any):
   ```bash
   mv SPRINT_4_0_SUMMARY.md archive/
   # Keep only current + previous sprint summaries
   ```

2. **Update Status**:
   - [ ] Mark Sprint 4.1 as COMPLETE in project tracker
   - [ ] Update START_HERE.md with new feature list
   - [ ] Update README.md if user-facing (likely not needed)

3. **Prepare Next Sprint**:
   - [ ] Create SPRINT_4_2_PLAN.md (if planning next feature)
   - [ ] Assign team for next work
   - [ ] Close Sprint 4.1 in Jira/Linear (if using)

---

## Contacts & Escalation

**For Deployment Issues**:
- Database: Check supabase.io console logs
- Code: Check Next.js build errors + browser console
- Integration: Check RLS policies applied correctly

**For Feature Questions**:
- See APP_MAP.md for architecture
- See TESTING_CHECKLIST.md for test procedures
- See SPRINT_4_1_SUMMARY.md for design decisions

**For Emergency Rollback**:
- Follow "Rollback Plan" section above
- Estimated time: <10 minutes to stable state
- No data loss expected (new tables only)

---

## Appendix: Database Migration Details

**Migration File**: `supabase/migrations/003_tradehub_accounts.sql`

**Tables Created**:
1. **account_categories**: Stores category definitions (max 5-10 per user typically)
2. **accounts**: Stores actual trading accounts (max 20-50 per user typically)

**Policies Applied**:
- `account_categories_owner_select`: Users can only see own categories
- `account_categories_owner_insert`: Users can only create own categories
- `account_categories_owner_update`: Users can only update own categories
- `account_categories_owner_delete`: Users can only delete own categories
- Similar policies for `accounts` table

**Triggers Applied**:
- `account_categories_updated_at`: Auto-update `updated_at` on modify
- `accounts_updated_at`: Auto-update `updated_at` on modify

**Indexes Created**:
- `account_categories_user_name_uq`: Unique (user_id, name_lower) for anti-duplicados
- `accounts_user_id_idx`: Query optimization for list operations
- `accounts_user_id_sort_index_idx`: Query optimization for sorted lists
- `accounts_user_id_created_at_idx`: Query optimization for date range queries

---

**Document Created**: 2026-01-17  
**Deployment Ready**: ✅ YES  
**Estimated Deployment Time**: 15-30 minutes (including verification)  
**Expected Downtime**: 0 minutes (zero-downtime deployment strategy)
