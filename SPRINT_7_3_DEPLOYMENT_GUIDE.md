# Sprint 7.3 Deployment Guide

## Overview

This guide covers deploying Sprint 7.3 Treasury UI enhancements (Milestone, Cashflow, Calendario panels) to production.

---

## Pre-Deployment Checklist

- [x] TypeScript build: 0 errors
- [x] All components created and integrated
- [x] Git commit successful: `224314e`
- [x] Treasury database schema deployed (Sprint 7.2)
- [ ] Sample data in production (optional for demo)
- [ ] Testing completed in staging environment

---

## Deployment Steps

### Step 1: Verify Build Status

```bash
npm run build
```

**Expected Output**:
```
✓ Compiled successfully in 2.8s
✓ Finished TypeScript in 2.6s
```

### Step 2: Push to Main Branch

```bash
git checkout main
git merge sprint-2-auth-middleware
git push origin main
```

### Step 3: Deploy to Vercel (or your hosting)

Vercel automatically deploys on main branch push:
- Wait for deployment to complete
- Verify `/dashboard/treasury` route loads
- Check all 8 tabs render properly

### Step 4: Verify Treasury Route

1. Navigate to https://yourapp.com/dashboard/treasury
2. Verify the following tabs load without errors:
   - 📊 Overview (Sprint 7.2)
   - 🎯 Milestone (Sprint 7.3) ← New
   - 📈 Cashflow (Sprint 7.3) ← New
   - 📅 Calendario (Sprint 7.3) ← New
   - 💰 Splits (Sprint 7.2)
   - ⚠️ Umbral (Sprint 7.2)
   - 🛡️ Anti-DD (Sprint 7.2)
   - 🔥 Heatmap (Placeholder)

### Step 5: Verify Data Loading

Each panel should either:
- Display data from Supabase (if schema is deployed)
- Show empty state gracefully (if no data)
- Never crash with runtime errors

**Key Panels to Test**:

#### Milestone Panel
- Shows per-account current balance
- Displays milestone target with progress bar
- Shows remaining amount to reach target
- Shows tax buffer progress
- Shows bonus vault balance

#### Cashflow Panel
- Displays summary cards (income, expenses, transfers, payouts)
- Shows recent transactions list
- Shows scheduled payouts list
- Shows period budgets
- Lists scroll with max items displayed

#### Calendario Panel
- Displays date-grouped timeline
- Shows transactions and payouts combined
- Groups by date with day names
- Shows item type icons
- Shows signed amounts (green/red)

---

## Rollback Steps (If Needed)

### Option 1: Revert Last Commit

```bash
git revert --no-commit 224314e
git commit -m "revert(treasury): Rollback Sprint 7.3 panels"
git push origin main
```

### Option 2: Return to Sprint 7.2

```bash
git checkout 3b1512e  # Last working commit
git push origin main --force
```

---

## Post-Deployment Verification

### Functionality Checklist

- [ ] Milestone panel loads without errors
- [ ] Cashflow panel loads without errors
- [ ] Calendario panel loads without errors
- [ ] Tab switching works for all 8 tabs
- [ ] No TypeScript errors in browser console
- [ ] No network errors in DevTools
- [ ] All emoji icons display correctly
- [ ] Layout responsive on mobile/tablet/desktop

### Performance Checklist

- [ ] Treasury page loads in < 2 seconds
- [ ] Tab switching is instant (no loading spinner)
- [ ] No memory leaks or console warnings
- [ ] Data loading errors handled gracefully

---

## Database Requirements

### Tables Required (Must Exist in Supabase)

```sql
-- Core Treasury Tables (from Sprint 7.2)
- public.treasury_configs (auth.uid() = user_id RLS)
- public.treasury_wallets (auth.uid() = user_id RLS)
- public.treasury_transactions (auth.uid() = user_id RLS)
- public.treasury_budgets (auth.uid() = user_id RLS)
- public.treasury_payouts (auth.uid() = user_id RLS)
```

All tables must have:
- `user_id` column for RLS enforcement
- `deleted_at` column for soft deletes (nullable timestamp)
- Proper foreign key relationships

### Run Migration

```bash
# If not already done in Sprint 7.2
supabase db push
```

---

## Configuration

No additional configuration required. The following environment variables should already be set:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key
```

---

## Troubleshooting

### Issue: "Could not find the table 'public.treasury_*'"

**Cause**: Supabase schema hasn't been deployed yet.

**Solution**: 
1. Deploy Sprint 7.2 migration: `supabase db push`
2. Verify table exists: `supabase db list-tables`
3. Rebuild Next.js: `npm run build`

### Issue: Panels show "Coming soon"

**Cause**: TreasuryTabs component not properly integrated.

**Solution**:
1. Verify imports in `TreasuryTabs.client.tsx`
2. Check that Milestone, Cashflow, Calendario components exist
3. Verify tab routing logic: `activeTab === 'milestone'` etc.

### Issue: Data not displaying in panels

**Cause**: Supabase RLS or data fetch failure.

**Solution**:
1. Check browser console for PGRST errors
2. Verify RLS policies allow authenticated reads
3. Check sample data exists in tables
4. Verify user is authenticated

---

## Feature Flags

No feature flags are required. All panels are automatically enabled once the code is deployed.

To temporarily disable a panel, comment out the tab in `tabs` array in `TreasuryTabs.client.tsx`:

```typescript
const tabs = [
  { id: 'overview', label: '📊 Overview' },
  // { id: 'milestone', label: '🎯 Milestone' },  // Disabled
  // { id: 'cashflow', label: '📈 Cashflow' },    // Disabled
  // { id: 'calendario', label: '📅 Calendario' }, // Disabled
  { id: 'splits', label: '💰 Splits' },
  // ...
];
```

---

## Monitoring

### Key Metrics to Monitor

1. **Build Time**: Should be < 3 seconds
2. **Page Load Time**: Should be < 2 seconds
3. **Tab Switch Time**: Should be < 100ms
4. **Error Rate**: Should be 0 (besides PGRST for missing tables)

### Error Tracking

Monitor these error codes:
- `PGRST205`: Table not found (expected if schema not deployed)
- `PGRST116`: Relation not found
- `401`: Unauthorized (user not authenticated)

---

## Success Criteria

✅ Deployment is successful when:

1. Build completes with 0 TypeScript errors
2. `/dashboard/treasury` route loads
3. All 8 tabs are visible and clickable
4. Tab switching works without loading delay
5. No errors in browser console
6. Panels display empty state if no data exists
7. Panels display data when Supabase schema is populated

---

## Support

### Questions?

Refer to:
- [SPRINT_7_3_SUMMARY.md](SPRINT_7_3_SUMMARY.md) - Complete feature overview
- [SPRINT_7_2_SUMMARY.md](SPRINT_7_2_SUMMARY.md) - Sprint 7.2 context (Overview, Splits, etc.)
- [DATA_SCHEMA.md](DATA_SCHEMA.md) - Database schema details
- [SPRINT_7_1_SUMMARY.md](SPRINT_7_1_SUMMARY.md) - Treasury architecture overview

---

## Rollback Plan

If critical issues arise post-deployment:

1. **Immediate Rollback** (< 5 minutes):
   ```bash
   git revert 224314e
   git push origin main
   ```
   Vercel will automatically redeploy.

2. **Partial Rollback** (disable just new panels):
   Edit `TreasuryTabs.client.tsx` to hide tabs, then push.

3. **Full Revert to Sprint 7.2**:
   ```bash
   git checkout 3b1512e
   git push origin main --force
   ```

---

**Estimated Deployment Time**: 5-10 minutes (including Vercel build)  
**Risk Level**: Low (no breaking changes, backward compatible)  
**Rollback Time**: < 5 minutes
