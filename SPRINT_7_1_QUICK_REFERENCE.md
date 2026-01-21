# Sprint 7.1 Quick Reference - Treasury Schema

## What's New

✅ 5 new tables (treasury_configs, treasury_wallets, treasury_transactions, treasury_budgets, treasury_payouts)  
✅ 20 RLS policies (4 per table, owner-only)  
✅ 18 indexes (optimized for queries)  
✅ 4 new columns on accounts table  
✅ Full documentation in APP_MAP.md  

## Table Quick Lookup

| Table | Purpose | FK | Unique | Soft-Delete |
|-------|---------|-----|--------|-------------|
| **treasury_configs** | Account withdrawal & protection settings | user_id, account_id | (user_id, account_id) | ✅ deleted_at |
| **treasury_wallets** | Multi-currency wallets | user_id | (user_id, lower(name)) | ✅ deleted_at |
| **treasury_transactions** | Income/expense/transfer/adjustment | user_id, wallet_id, account_id? | None | ✅ deleted_at |
| **treasury_budgets** | Period-based budget targets | user_id, wallet_id | None | ✅ deleted_at |
| **treasury_payouts** | Withdrawal planning & tracking | user_id, account_id, wallet_id | None | ✅ deleted_at |

## Key Columns Summary

### treasury_configs
```
id, user_id*, account_id* (FK), withdrawal_day, split_mode, 
balance_threshold, anti_drawdown_active, anti_drawdown_threshold,
tax_buffer_percentage, tax_buffer_target, tax_buffer_accumulated,
milestone_target, milestone_bonus_vault, sort_index,
created_at, updated_at, deleted_at
```
*Required

### treasury_wallets
```
id, user_id*, name*, currency*, starting_balance,
created_at, updated_at, deleted_at
```

### treasury_transactions
```
id, user_id*, wallet_id* (FK), account_id? (FK), type*, amount*, 
occurred_on*, description?, notes?, sort_index,
created_at, updated_at, deleted_at
```

### treasury_budgets
```
id, user_id*, wallet_id* (FK), period_start*, period_end*, 
target_income?, target_expense?, target_payout?, notes?,
created_at, updated_at, deleted_at
```

### treasury_payouts
```
id, user_id*, account_id* (FK), wallet_id* (FK), payout_date*, 
amount*, status*, method?, notes?,
created_at, updated_at, deleted_at
```

## Accounts Table Updates

Added 4 columns to **accounts**:
- `account_size` (numeric) - Classification: 1=Micro, 2=Small, 3=Medium, 4=Large
- `current_balance` (numeric) - Denormalized balance copy
- `withdrawals_enabled` (boolean) - Default true
- `phase_status` (text) - Multi-phase strategy tracking

## RLS Summary

**All 5 tables have RLS enabled with 4 policies each**:
- `INSERT`: WITH CHECK (auth.uid() = user_id)
- `SELECT`: WHERE auth.uid() = user_id
- `UPDATE`: WHERE auth.uid() = user_id
- `DELETE`: WHERE auth.uid() = user_id

**Result**: Absolute owner-only access, no cross-user data leaks possible

## Enum Values

### treasury_transactions.type
- `income` - Funds in
- `expense` - Funds out
- `transfer` - Move between wallets
- `adjustment` - Correction/manual entry

### treasury_configs.split_mode
- `growth` - Growth portfolio (50% retirable)
- `safe` - Safe portfolio (40% retirable)
- `cash` - All cash (100% retirable)

### treasury_payouts.status
- `planned` - Withdrawal planned
- `sent` - Funds sent
- `received` - Funds received
- `canceled` - Withdrawal canceled

## Indexes (Performance Optimization)

### treasury_configs (3)
- (user_id)
- (account_id)
- (user_id, account_id) WHERE deleted_at IS NULL

### treasury_wallets (2)
- (user_id)
- (user_id, name) WHERE deleted_at IS NULL

### treasury_transactions (5)
- (user_id)
- (wallet_id)
- (account_id)
- (user_id, occurred_on DESC) WHERE deleted_at IS NULL
- (user_id, wallet_id) WHERE deleted_at IS NULL

### treasury_budgets (3)
- (user_id)
- (wallet_id)
- (user_id, period_start DESC) WHERE deleted_at IS NULL

### treasury_payouts (5)
- (user_id)
- (account_id)
- (wallet_id)
- (user_id, payout_date DESC) WHERE deleted_at IS NULL
- (user_id, account_id) WHERE deleted_at IS NULL

## Triggers

**All 5 tables**: `{table}_updated_at_trigger`
- Function: `set_updated_at()` (reuses existing)
- Timing: BEFORE UPDATE
- Action: Set NEW.updated_at = NOW()

## Common Query Patterns

### Get user's configs
```sql
SELECT * FROM treasury_configs 
WHERE user_id = auth.uid() AND deleted_at IS NULL;
```

### Get wallets with transactions count
```sql
SELECT w.*, COUNT(t.id) as tx_count
FROM treasury_wallets w
LEFT JOIN treasury_transactions t ON w.id = t.wallet_id AND t.deleted_at IS NULL
WHERE w.user_id = auth.uid() AND w.deleted_at IS NULL
GROUP BY w.id;
```

### Get pending payouts
```sql
SELECT * FROM treasury_payouts
WHERE user_id = auth.uid() 
  AND status = 'planned'
  AND deleted_at IS NULL
ORDER BY payout_date ASC;
```

### Get budget vs actual for wallet
```sql
SELECT 
  b.id, b.period_start, b.period_end,
  b.target_income, COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END), 0) as actual_income,
  b.target_expense, COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) as actual_expense
FROM treasury_budgets b
LEFT JOIN treasury_transactions t ON b.wallet_id = t.wallet_id 
  AND t.occurred_on >= b.period_start 
  AND t.occurred_on <= b.period_end
  AND t.deleted_at IS NULL
WHERE b.user_id = auth.uid() AND b.deleted_at IS NULL
GROUP BY b.id, b.period_start, b.period_end, b.target_income, b.target_expense;
```

## Soft-Delete Pattern

### Soft-delete a record
```sql
UPDATE treasury_configs 
SET deleted_at = NOW() 
WHERE id = 'uuid-here' AND user_id = auth.uid();
```

### Restore a record
```sql
UPDATE treasury_configs 
SET deleted_at = NULL 
WHERE id = 'uuid-here' AND user_id = auth.uid();
```

### Hard-delete (permanent)
```sql
DELETE FROM treasury_configs 
WHERE id = 'uuid-here' AND user_id = auth.uid();
```

### List only active (not deleted)
```sql
SELECT * FROM treasury_configs 
WHERE user_id = auth.uid() AND deleted_at IS NULL;
```

### List only trash (deleted)
```sql
SELECT * FROM treasury_configs 
WHERE user_id = auth.uid() AND deleted_at IS NOT NULL;
```

## Constraints & Validations

| Table | Constraint | Type | Details |
|-------|-----------|------|---------|
| treasury_configs | (user_id, account_id) UNIQUE | Unique (partial) | WHERE deleted_at IS NULL |
| treasury_configs | split_mode IN (...)  | Check | Only 3 allowed values |
| treasury_wallets | (user_id, lower(name)) UNIQUE | Unique (partial) | Case-insensitive, WHERE deleted_at IS NULL |
| treasury_transactions | type IN (...) | Check | Only 4 allowed values |
| treasury_payouts | status IN (...) | Check | Only 4 allowed values |

## FK Relationships

```
treasury_configs
  ├─ user_id → auth.users(id) ON DELETE CASCADE
  └─ account_id → accounts(id) ON DELETE CASCADE

treasury_wallets
  └─ user_id → auth.users(id) ON DELETE CASCADE

treasury_transactions
  ├─ user_id → auth.users(id) ON DELETE CASCADE
  ├─ wallet_id → treasury_wallets(id) ON DELETE CASCADE
  └─ account_id → accounts(id) ON DELETE SET NULL [optional]

treasury_budgets
  ├─ user_id → auth.users(id) ON DELETE CASCADE
  └─ wallet_id → treasury_wallets(id) ON DELETE CASCADE

treasury_payouts
  ├─ user_id → auth.users(id) ON DELETE CASCADE
  ├─ account_id → accounts(id) ON DELETE CASCADE
  └─ wallet_id → treasury_wallets(id) ON DELETE CASCADE
```

## Future API Routes (To Implement)

```
GET    /api/treasury/configs
POST   /api/treasury/configs
PATCH  /api/treasury/configs/{id}
DELETE /api/treasury/configs/{id}

GET    /api/treasury/wallets
POST   /api/treasury/wallets
PATCH  /api/treasury/wallets/{id}
DELETE /api/treasury/wallets/{id}

GET    /api/treasury/transactions
POST   /api/treasury/transactions
PATCH  /api/treasury/transactions/{id}
DELETE /api/treasury/transactions/{id}

GET    /api/treasury/budgets
POST   /api/treasury/budgets
PATCH  /api/treasury/budgets/{id}
DELETE /api/treasury/budgets/{id}

GET    /api/treasury/payouts
POST   /api/treasury/payouts
PATCH  /api/treasury/payouts/{id}
DELETE /api/treasury/payouts/{id}
```

## Files Changed

- ✅ `supabase/migrations/010_treasury_core.sql` (502 lines, created)
- ✅ `supabase/migrations/011_accounts_treasury_compat.sql` (41 lines, created)
- ✅ `APP_MAP.md` (+57 lines, updated)

**Total**: 600 lines of code/docs

## Build Status

```
Routes: 48 (no new API routes yet)
TypeScript Errors: 0
Build Time: ~3.0s
Status: ✅ PASSING
```

## Commit Info

- **Commit**: 9329349
- **Message**: "feat(treasury): DB schema with RLS for treasury core (configs, wallets, transactions, budgets, payouts)"
- **Branch**: sprint-2-auth-middleware
- **Date**: [current sprint]

## Links

- Full Summary: SPRINT_7_1_SUMMARY.md
- Deployment Guide: SPRINT_7_1_DEPLOYMENT_GUIDE.md
- App Map Details: APP_MAP.md (lines 323-380)
- Migration Files: supabase/migrations/010_*, 011_*

---

**Sprint 7.1**: Schema-Only Complete ✅
Next: API Routes + UI Components (Sprint 7.2)
