# Sprint 7.1 - START HERE

**What is Sprint 7.1?**
Treasury Database Schema - Complete PostgreSQL implementation with RLS, soft-delete pattern, and 5 core tables for managing account configurations, multi-currency wallets, transactions, budgets, and payouts.

**Status**: ✅ COMPLETE (Ready to Deploy)

## In 60 Seconds

✅ **3 Commits Created**:
1. `9329349` - Database migrations (010 + 011) + APP_MAP update
2. `393f536` - Documentation suite (summary + deployment + quick-ref)
3. `5a6d756` - Completion report

✅ **5 Tables Created**:
- `treasury_configs` - Account settings (withdrawal day, split mode, thresholds)
- `treasury_wallets` - Multi-currency wallets (USD, EUR, etc.)
- `treasury_transactions` - Transactions (income/expense/transfer/adjustment)
- `treasury_budgets` - Period-based targets (monthly, quarterly, annual)
- `treasury_payouts` - Scheduled withdrawals (planned → sent → received)

✅ **18 Indexes** for query optimization

✅ **20 RLS Policies** enforcing owner-only access

✅ **Zero Breaking Changes** - Backward compatible

✅ **Build Status**: 48 routes, 0 errors ✅

## What Changed

| File | Type | Changes |
|------|------|---------|
| `supabase/migrations/010_treasury_core.sql` | SQL | Created (502 lines) |
| `supabase/migrations/011_accounts_treasury_compat.sql` | SQL | Created (41 lines) |
| `APP_MAP.md` | Markdown | Updated (+57 lines) |
| `SPRINT_7_1_SUMMARY.md` | Documentation | Created (317 lines) |
| `SPRINT_7_1_DEPLOYMENT_GUIDE.md` | Documentation | Created (291 lines) |
| `SPRINT_7_1_QUICK_REFERENCE.md` | Documentation | Created (380 lines) |
| `SPRINT_7_1_COMPLETION_REPORT.md` | Documentation | Created (321 lines) |

**Total**: 1,909 lines added

## Quick Links

- **What's in the Schema?** → [SPRINT_7_1_QUICK_REFERENCE.md](SPRINT_7_1_QUICK_REFERENCE.md)
- **Full Details?** → [SPRINT_7_1_SUMMARY.md](SPRINT_7_1_SUMMARY.md)
- **How to Deploy?** → [SPRINT_7_1_DEPLOYMENT_GUIDE.md](SPRINT_7_1_DEPLOYMENT_GUIDE.md)
- **Did We Complete It?** → [SPRINT_7_1_COMPLETION_REPORT.md](SPRINT_7_1_COMPLETION_REPORT.md)
- **Where in APP_MAP?** → [APP_MAP.md](APP_MAP.md#treasury-sprint-71) (lines 323-380)

## Treasury Features Enabled

### 1. Configuration Management
- Per-account withdrawal day (1-31)
- Split mode selection (growth/safe/cash)
- Balance thresholds for alerts
- Anti-drawdown protection with threshold
- Tax buffer percentage and accumulated amount
- Milestone target tracking (e.g., 50k+)

### 2. Multi-Currency Wallets
- Create unlimited wallets per user
- Each wallet has currency (USD, EUR, BTC, etc.)
- Track starting balance per wallet
- Soft-delete for archival

### 3. Transaction Tracking
- 4 transaction types: income, expense, transfer, adjustment
- Optional link to trading accounts
- Date-based recording
- Full audit trail (created_at, updated_at, deleted_at)

### 4. Budget Planning
- Period-based targets (monthly, quarterly, annual)
- Separate goals for income, expense, payout
- Compare actual vs. target
- Notes for context and adjustments

### 5. Payout Management
- Status tracking: planned → sent → received → canceled
- Withdrawal method field
- Date-based scheduling
- Account and wallet links

## Table Quick Lookup

### treasury_configs
```
For each trading account, define:
- When to withdraw (withdrawal_day: 1-31)
- How to split profits (growth/safe/cash)
- Protection thresholds (balance_threshold, anti_drawdown)
- Tax reserves (buffer_percentage, buffer_target)
- Milestone tracking (milestone_target, bonus_vault)
```

### treasury_wallets
```
Create wallets for different purposes:
- "Cash Wallet" (USD) - Emergency fund
- "Savings" (USD) - Medium-term
- "Growth" (USD) - Investment
- "Crypto" (BTC) - Crypto holdings
```

### treasury_transactions
```
Record all money movements:
- Income from trades/salary/bonus
- Expense (fees, taxes, living costs)
- Transfer between wallets
- Adjustment (corrections, accounting)

Link to trading account if related.
```

### treasury_budgets
```
Set targets for periods:
- January 1-31: Income target $5k, Expense target $2k
- Q1: Payout target $1500
- 2024: Annual targets and tracking
```

### treasury_payouts
```
Plan withdrawals:
- March 15: $500 (planned) → bank transfer
- April 1: $1000 (sent) → waiting confirmation
- May 1: $2000 (received) → completed
- May 15: $1500 (canceled) → changed mind
```

## RLS Security

**Every table is protected with RLS:**
- ✅ User A cannot see User B's configs
- ✅ User A cannot see User B's transactions
- ✅ User A cannot UPDATE/DELETE User B's data
- ✅ Enforced at database level (not app level)

**Example**:
```sql
-- User A's query
SELECT * FROM treasury_configs;
-- Result: Only User A's configs (RLS enforces auth.uid() = user_id)

-- User A tries to access User B's config
SELECT * FROM treasury_configs WHERE user_id = 'user-b-id';
-- Result: Empty (RLS blocks it)
```

## Soft-Delete Pattern

All tables use `deleted_at` timestamp for soft-delete:

```sql
-- Soft-delete a wallet (still in DB, marked as deleted)
UPDATE treasury_wallets SET deleted_at = NOW() WHERE id = 'wallet-id';

-- Restore a wallet (set deleted_at back to NULL)
UPDATE treasury_wallets SET deleted_at = NULL WHERE id = 'wallet-id';

-- Query active wallets only (WHERE deleted_at IS NULL)
SELECT * FROM treasury_wallets WHERE user_id = auth.uid() AND deleted_at IS NULL;

-- Hard-delete (permanent removal)
DELETE FROM treasury_wallets WHERE id = 'wallet-id';
```

## Next Steps (Sprint 7.2+)

### Sprint 7.2: API Routes
```
POST   /api/treasury/configs - Create config
GET    /api/treasury/configs - List configs
PATCH  /api/treasury/configs/{id} - Update config
DELETE /api/treasury/configs/{id} - Soft-delete config

[Similar for wallets, transactions, budgets, payouts]
```

### Sprint 7.3: UI Components
```
/dashboard/treasury/
  ├─ Overview (balance, pending payouts, health score)
  ├─ Milestone (progress bar, bonus tracking)
  ├─ Cashflow (income/expense chart)
  ├─ Calendario (payout calendar)
  ├─ Splits (mode selector, percentages)
  ├─ Umbral (threshold configuration)
  ├─ Anti-Drawdown (protection status)
  └─ Heatmap (visualization)
```

## Deploy Instructions

**Short Version:**
1. Run migrations in Supabase (SQL Editor or CLI)
2. Verify: 5 tables visible, 20 RLS policies enabled
3. Test: Insert/select your own data, verify RLS blocks other users
4. Done! ✅

**Full Version:**
See [SPRINT_7_1_DEPLOYMENT_GUIDE.md](SPRINT_7_1_DEPLOYMENT_GUIDE.md)

## Validation Checklist

Before going live:

- [ ] All 5 tables visible in Supabase Table Editor
- [ ] 20 RLS policies created and enabled (check Auth > Policies)
- [ ] Migrations marked as applied
- [ ] `npm run build` passes (48 routes, 0 errors)
- [ ] Test user can insert/select own treasury data
- [ ] Test user cannot access another user's data
- [ ] accounts table has 4 new columns

## Troubleshooting

**"relation 'treasury_configs' does not exist"**
→ Migrations not applied yet. Run Step 2 from deployment guide.

**"new row violates row-level security policy"**
→ Trying to INSERT with wrong user_id. Use auth.uid() in INSERT.

**"unique violation"**
→ Trying to create duplicate treasury_config for same account. Use UPDATE instead of INSERT.

**Build fails**
→ Unrelated to schema (we don't have API routes yet). Check TypeScript errors in /src.

## Files to Review

| File | Purpose | Time |
|------|---------|------|
| SPRINT_7_1_QUICK_REFERENCE.md | Column lookups, query patterns, enums | 5 min |
| SPRINT_7_1_SUMMARY.md | Full feature documentation | 15 min |
| SPRINT_7_1_DEPLOYMENT_GUIDE.md | How to deploy and verify | 10 min |
| SPRINT_7_1_COMPLETION_REPORT.md | Metrics, test checklist, next steps | 10 min |
| supabase/migrations/010_treasury_core.sql | Source code (SQL) | 20 min |

## Key Stats

- **Commits**: 3
- **Files Modified**: 7
- **Lines Added**: 1,909
- **Tables Created**: 5
- **RLS Policies**: 20
- **Indexes Created**: 18
- **Build Status**: ✅ 48 routes, 0 errors
- **Breaking Changes**: 0
- **Deployment Risk**: LOW (schema-only)

## Questions?

1. **How do I query my own treasury data?**
   → Use `WHERE user_id = auth.uid()` (RLS auto-enforces)

2. **What if I need to soft-delete and then restore?**
   → Use UPDATE: SET deleted_at = NULL for restore

3. **Can I query transactions for a specific wallet?**
   → Yes: `SELECT * FROM treasury_transactions WHERE wallet_id = 'wallet-id'`

4. **How do I create a budget for January?**
   → INSERT into treasury_budgets with period_start/end dates

5. **What's the difference between soft-delete and hard-delete?**
   → Soft: sets deleted_at (recoverable, auditable)
   → Hard: DELETE statement (permanent, no recovery)

## Success!

✅ Sprint 7.1 is COMPLETE

You now have:
- ✅ 5 production-ready tables
- ✅ Full RLS security
- ✅ Soft-delete audit trail
- ✅ 18 performance indexes
- ✅ Comprehensive documentation
- ✅ Ready to deploy

**Next Step**: Review [SPRINT_7_1_DEPLOYMENT_GUIDE.md](SPRINT_7_1_DEPLOYMENT_GUIDE.md) to deploy to production.

---

**Sprint 7.1 Execution Summary**

| Phase | Commits | Files | Status |
|-------|---------|-------|--------|
| Database Schema | 1 | 3 | ✅ Complete |
| Documentation | 2 | 4 | ✅ Complete |
| **Total** | **3** | **7** | **✅ COMPLETE** |

**Ready to Move to Sprint 7.2: API Endpoints**
