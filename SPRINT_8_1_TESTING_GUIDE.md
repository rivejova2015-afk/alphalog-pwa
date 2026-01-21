# Sprint 8.1 - Payout Engine Testing Guide

**Status**: Ready for QA  
**Test Environment**: Development (local Supabase)  
**Estimated Testing Time**: 4-6 hours

---

## Pre-Test Setup

### Prerequisites
1. ✅ Build succeeds: `npm run build`
2. ✅ Database migration applied: `012_treasury_payout_engine.sql`
3. ✅ All 3 API endpoints available
4. ✅ Cashflow tab shows payout engine section
5. ✅ User has at least 1 account configured

### Test Data Setup

```sql
-- 1. Create a wallet for the test account
INSERT INTO treasury_wallets (user_id, name, currency, starting_balance)
VALUES ('{user_id}', 'Test Wallet', 'USD', 0);

-- 2. Get wallet ID and update treasury_configs
UPDATE treasury_configs 
SET wallet_id = '{wallet_id}'
WHERE account_id = '{account_id}' AND user_id = '{user_id}';

-- 3. Create sample trades (Closed status, recent dates)
INSERT INTO trades (user_id, account_id, entry_date, exit_date, pnl, status)
VALUES 
  ('{user_id}', '{account_id}', '2026-01-15', '2026-01-18', 500, 'Closed'),
  ('{user_id}', '{account_id}', '2026-01-18', '2026-01-19', 1000, 'Closed'),
  ('{user_id}', '{account_id}', '2026-01-19', '2026-01-20', -200, 'Closed');

-- 4. Verify account current_balance > account_size (to have profit)
UPDATE accounts
SET current_balance = account_size + 2000
WHERE id = '{account_id}' AND user_id = '{user_id}';
```

---

## Test Suites

### Suite 1: Cycle Calculation (5 tests)

#### Test 1.1: Cycle dates based on withdrawal_day
**Setup:**
- Account with `withdrawal_day = 15`
- Today = January 20, 2026

**Steps:**
1. Call preview endpoint
2. Check `cycleStart` and `cycleExpectedEnd` in response

**Expected:**
- `cycleStart = 2026-01-15`
- `cycleExpectedEnd = 2026-02-14`
- `cycleDatesFormatted = "Jan 15 - Feb 14"`

**Status**: [ ] Pass [ ] Fail

---

#### Test 1.2: Cycle calculation when today < withdrawal_day
**Setup:**
- Account with `withdrawal_day = 25`
- Mock today = January 10, 2026

**Steps:**
1. Call preview endpoint
2. Check returned cycle dates

**Expected:**
- `cycleStart = 2025-12-25`
- `cycleExpectedEnd = 2026-01-24`

**Status**: [ ] Pass [ ] Fail

---

#### Test 1.3: Period PnL calculation - positive
**Setup:**
- 3 closed trades: +500, +1000, -200 = +1300 net
- Trades within cycle date range
- Account: account_size = 50000, current_balance = 53000

**Steps:**
1. Call preview endpoint

**Expected:**
- `periodPnL = 1300`
- `profitTotal = 3000`
- `retirable = 1300 * 0.5 = 650` (growth split)

**Status**: [ ] Pass [ ] Fail

---

#### Test 1.4: Period PnL calculation - with out-of-range trades
**Setup:**
- Trades: +500 (2026-01-15), +1000 (2026-01-18), +500 (2026-02-20 - OUTSIDE cycle)
- Cycle: 2026-01-15 to 2026-02-14

**Steps:**
1. Call preview endpoint

**Expected:**
- `periodPnL = 1500` (excludes 2026-02-20 trade)

**Status**: [ ] Pass [ ] Fail

---

#### Test 1.5: Period PnL with no trades
**Setup:**
- No trades in account
- Account: account_size = 50000, current_balance = 51000

**Steps:**
1. Call preview endpoint

**Expected:**
- `periodPnL = 0`
- `retirable = 0` (can't have profit without trades in period)
- No crash

**Status**: [ ] Pass [ ] Fail

---

### Suite 2: Breakdown Calculation (6 tests)

#### Test 2.1: Full breakdown calculation
**Setup:**
- periodPnL = 1000
- current_balance = 51000, account_size = 50000 (profitTotal = 1000)
- split_mode = "growth" (50%)
- tax_buffer_percentage = 30

**Steps:**
1. Call preview endpoint

**Expected:**
```
retirable = min(1000, 1000) * 0.5 = 500
tax_reserve = 500 * 0.30 = 150
bonus_vault = 0
cash_payout = 500 - 150 - 0 = 350
```

**Status**: [ ] Pass [ ] Fail

---

#### Test 2.2: Breakdown with safe split mode
**Setup:**
- Same as 2.1 but split_mode = "safe" (40%)

**Steps:**
1. Call preview endpoint

**Expected:**
```
retirable = 1000 * 0.4 = 400
tax_reserve = 400 * 0.30 = 120
cash_payout = 400 - 120 = 280
```

**Status**: [ ] Pass [ ] Fail

---

#### Test 2.3: Breakdown with cash split mode
**Setup:**
- Same as 2.1 but split_mode = "cash" (100%)

**Steps:**
1. Call preview endpoint

**Expected:**
```
retirable = 1000 * 1.0 = 1000
tax_reserve = 1000 * 0.30 = 300
cash_payout = 1000 - 300 = 700
```

**Status**: [ ] Pass [ ] Fail

---

#### Test 2.4: Breakdown when periodPnL > profitTotal
**Setup:**
- Hypothetically: periodPnL = 2000
- current_balance = 51500, account_size = 50000 (profitTotal = 1500)

**Steps:**
1. Setup: Manually test logic with inputs
2. Expected: retirable capped by profitTotal, not periodPnL

**Expected:**
```
payoutableProfit = min(2000, 1500) = 1500
retirable = 1500 * 0.5 = 750
```

**Status**: [ ] Pass [ ] Fail

---

#### Test 2.5: Breakdown when negative PnL
**Setup:**
- periodPnL = -500
- current_balance = 49800, account_size = 50000 (profitTotal = -200)

**Steps:**
1. Call preview endpoint

**Expected:**
```
payoutableProfit = max(0, min(-500, -200)) = 0
retirable = 0
cash_payout = 0
```

**Status**: [ ] Pass [ ] Fail

---

#### Test 2.6: All accounts total aggregation
**Setup:**
- Account A: retirable = 500
- Account B: retirable = 300
- Account C: retirable = 200
- Call with accountId = "ALL"

**Steps:**
1. Call preview with accountId = "ALL"

**Expected:**
```
totals.retirable = 1000
totals.taxReserve = 300
totals.bonusVault = 0
totals.cashPayout = 700
```

**Status**: [ ] Pass [ ] Fail

---

### Suite 3: Blocking Conditions (5 tests)

#### Test 3.1: Block on anti_drawdown_active
**Setup:**
- Account: anti_drawdown_active = true, anti_drawdown_threshold = 20
- Current drawdown = 25%
- Has retirable profit

**Steps:**
1. Call preview endpoint

**Expected:**
```
blockedReasons = ["anti_dd_active"]
isCreatable = false
UI shows: "Blocked" badge + "anti_dd_active" in reasons list
```

**Status**: [ ] Pass [ ] Fail

---

#### Test 3.2: Block on balance_threshold
**Setup:**
- Account: balance_threshold = 52000
- current_balance = 50000
- Has retirable profit

**Steps:**
1. Call preview endpoint

**Expected:**
```
blockedReasons = ["balance_below_threshold"]
isCreatable = false
```

**Status**: [ ] Pass [ ] Fail

---

#### Test 3.3: Block on withdrawals_disabled
**Setup:**
- Account: withdrawals_enabled = false
- Has retirable profit, no other blocks

**Steps:**
1. Call preview endpoint

**Expected:**
```
blockedReasons = ["withdrawals_disabled"]
isCreatable = false
```

**Status**: [ ] Pass [ ] Fail

---

#### Test 3.4: Multiple blocking reasons
**Setup:**
- Account: withdrawals_enabled = false
- balance_threshold = 52000, current_balance = 50000
- anti_drawdown_active = true, drawdown = 25

**Steps:**
1. Call preview endpoint

**Expected:**
```
blockedReasons = ["withdrawals_disabled", "anti_dd_active", "balance_below_threshold"]
isCreatable = false
```

**Status**: [ ] Pass [ ] Fail

---

#### Test 3.5: Create endpoint rejects blocked accounts
**Setup:**
- Account blocked (any reason)
- Wallet mapped

**Steps:**
1. Call POST /api/treasury/payouts/create with blocked account

**Expected:**
- Status: 409 Conflict
- Response includes `blockedReasons` array
- Payout NOT created

**Status**: [ ] Pass [ ] Fail

---

### Suite 4: Wallet Mapping (3 tests)

#### Test 4.1: Preview succeeds with wallet mapped
**Setup:**
- Account: wallet_id set in treasury_configs

**Steps:**
1. Call preview endpoint

**Expected:**
```
walletMapped = true
isCreatable = true (if no other blocks)
```

**Status**: [ ] Pass [ ] Fail

---

#### Test 4.2: Preview shows wallet not mapped
**Setup:**
- Account: wallet_id = NULL

**Steps:**
1. Call preview endpoint

**Expected:**
```
walletMapped = false
isCreatable = false
UI shows: "⚠️ Wallet not mapped"
```

**Status**: [ ] Pass [ ] Fail

---

#### Test 4.3: Create rejects if wallet not mapped
**Setup:**
- Account: wallet_id = NULL
- No other blocks

**Steps:**
1. Call POST /api/treasury/payouts/create

**Expected:**
- Status: 400 Bad Request
- Message: "Wallet mapping required"
- Payout NOT created

**Status**: [ ] Pass [ ] Fail

---

### Suite 5: Push Notifications (4 tests)

#### Test 5.1: Threshold condition met (sends push)
**Setup:**
- Account: balance_threshold = 50000
- current_balance = 51000
- retirable = 500
- last_threshold_push_cycle_start = NULL (hasn't sent yet)
- User has push subscriptions

**Steps:**
1. Call preview endpoint

**Expected:**
```
hasThresholdCondition = true
pushNotificationsPending = [{ message: "Umbral alcanzado..." }]
last_threshold_push_cycle_start updated to cycle_start
Notification sent to subscriptions
```

**Status**: [ ] Pass [ ] Fail

---

#### Test 5.2: Threshold already sent (no duplicate push)
**Setup:**
- Account: same as 5.1
- last_threshold_push_cycle_start = cycleStart (already sent)

**Steps:**
1. Call preview endpoint

**Expected:**
```
hasThresholdCondition = true
pushNotificationsPending = [] (empty)
No push sent
last_threshold_push_cycle_start unchanged
```

**Status**: [ ] Pass [ ] Fail

---

#### Test 5.3: Threshold not met (no push)
**Setup:**
- Account: balance_threshold = 52000
- current_balance = 51000 (below threshold)
- retirable = 500

**Steps:**
1. Call preview endpoint

**Expected:**
```
hasThresholdCondition = false
pushNotificationsPending = []
No push sent
```

**Status**: [ ] Pass [ ] Fail

---

#### Test 5.4: Threshold no subscriptions (graceful)
**Setup:**
- Account: threshold met
- User: no push subscriptions in database

**Steps:**
1. Call preview endpoint

**Expected:**
```
hasThresholdCondition = true
pushNotificationsPending shows pending
Preview succeeds (doesn't fail)
No crash, just logs warning
```

**Status**: [ ] Pass [ ] Fail

---

### Suite 6: Versioning (3 tests)

#### Test 6.1: Create v1 payout
**Setup:**
- Account: no existing payouts for this cycle

**Steps:**
1. Call POST /api/treasury/payouts/create with valid account

**Expected:**
```
version = 1
payout created with all breakdown fields
cycle_start = correct date
```

**Status**: [ ] Pass [ ] Fail

---

#### Test 6.2: Create v2 payout in same cycle
**Setup:**
- Account: v1 payout already exists for cycle_start = 2026-01-15
- Call preview/create again before cycle ends

**Steps:**
1. Call POST /api/treasury/payouts/create

**Expected:**
```
version = 2
Both v1 and v2 exist in database
Unique constraint allows both (same user, account, cycle, different version)
```

**Status**: [ ] Pass [ ] Fail

---

#### Test 6.3: New cycle starts with v1 again
**Setup:**
- Account: withdrawal_day = 15
- Mock time to 2026-02-16 (new cycle started)
- v1, v2 exist for cycle 2026-01-15

**Steps:**
1. Call POST /api/treasury/payouts/create for new cycle

**Expected:**
```
version = 1
New payout with cycle_start = 2026-02-15
cycle_start != previous cycles
```

**Status**: [ ] Pass [ ] Fail

---

### Suite 7: UI Integration (6 tests)

#### Test 7.1: Account selector changes options
**Setup:**
- Cashflow panel loaded
- 3 accounts configured

**Steps:**
1. Click account selector dropdown

**Expected:**
- Options: "All Accounts", "Account 1", "Account 2", "Account 3"

**Status**: [ ] Pass [ ] Fail

---

#### Test 7.2: Calculate button loads preview
**Setup:**
- Account selector set to specific account
- Account has valid config

**Steps:**
1. Click "Calculate" button
2. Wait for response

**Expected:**
- Button shows "⏳ Loading..." state
- Preview table appears with account data
- Breakdown table visible
- No console errors

**Status**: [ ] Pass [ ] Fail

---

#### Test 7.3: Create button disabled when blocked
**Setup:**
- Account blocked (any reason)
- Preview loaded

**Steps:**
1. Look at "Create Payout" button for blocked account

**Expected:**
- Button is disabled (gray)
- Button text: "✅ Create Payout"
- Blocked reasons displayed above

**Status**: [ ] Pass [ ] Fail

---

#### Test 7.4: Create button enabled when ready
**Setup:**
- Account not blocked
- Wallet mapped
- Preview loaded

**Steps:**
1. Look at "Create Payout" button

**Expected:**
- Button is enabled (green)
- Button text: "✅ Create Payout"
- Clickable

**Status**: [ ] Pass [ ] Fail

---

#### Test 7.5: Create successfully shows success message
**Setup:**
- Click "Create Payout" button on enabled account

**Steps:**
1. Button shows "⏳ Creating..." state
2. Wait for response
3. Check for message

**Expected:**
- Message appears: "✅ Payout v1 created for cycle 2026-01-15"
- Preview refreshes
- Create button now shows v2 available (if clicking again)

**Status**: [ ] Pass [ ] Fail

---

#### Test 7.6: Totals card aggregates correctly
**Setup:**
- Preview loaded for "ALL" accounts
- 3 accounts with different retirables

**Steps:**
1. Scroll to "Total (All Accounts)" card

**Expected:**
- Total Retirable = sum of all
- Total Tax Reserve = sum of all
- Total Cash Payout = sum of all
- Values match per-account values

**Status**: [ ] Pass [ ] Fail

---

## Regression Tests

### Existing Features Unaffected

#### Test R1: Cashflow transactions still display
**Setup:**
- Cashflow panel has existing transactions data

**Steps:**
1. Load Cashflow panel
2. Scroll down to "Recent Transactions"

**Expected:**
- Transaction list displays normally
- Payout engine doesn't break existing UI

**Status**: [ ] Pass [ ] Fail

---

#### Test R2: Payouts list still displays
**Setup:**
- Existing payouts in database

**Steps:**
1. Load Cashflow panel
2. Scroll to "Scheduled Payouts"

**Expected:**
- Existing payouts displayed
- Payout engine section separate

**Status**: [ ] Pass [ ] Fail

---

#### Test R3: Budgets still display
**Setup:**
- Existing budgets in database

**Steps:**
1. Load Cashflow panel
2. Scroll to "Period Budgets"

**Expected:**
- Budgets displayed normally

**Status**: [ ] Pass [ ] Fail

---

## Error Handling Tests

#### Test E1: API timeout (slow server)
**Steps:**
1. Intentionally slow down server (throttle network)
2. Click preview button

**Expected:**
- Request times out or fails
- Error message displays: "Error loading preview"
- No crash, UI recovers

**Status**: [ ] Pass [ ] Fail

---

#### Test E2: Missing account
**Setup:**
- Select non-existent account ID

**Steps:**
1. Modify accountId in request manually
2. Call preview endpoint

**Expected:**
- Status: 404 Not Found
- Message: "Account not found"

**Status**: [ ] Pass [ ] Fail

---

#### Test E3: Missing config
**Setup:**
- Account has no treasury_configs entry

**Steps:**
1. Delete treasury_configs for account
2. Call preview endpoint

**Expected:**
- Account skipped (not included in preview)
- Response succeeds but account not in perAccountPreview

**Status**: [ ] Pass [ ] Fail

---

## Performance Tests

#### Test P1: Preview with 10 accounts
**Setup:**
- User has 10 accounts configured
- Each with trades and configs

**Steps:**
1. Call preview with accountId = "ALL"
2. Time the response

**Expected:**
- Response time < 1000ms
- All 10 accounts in perAccountPreview
- No timeout

**Status**: [ ] Pass [ ] Fail  
**Time**: ____ ms

---

#### Test P2: Create payout response time
**Setup:**
- Account ready to create

**Steps:**
1. Call create endpoint
2. Time the response

**Expected:**
- Response time < 500ms

**Status**: [ ] Pass [ ] Fail  
**Time**: ____ ms

---

## Summary

**Total Tests**: 43  
**Tests Passed**: ____  
**Tests Failed**: ____  
**Pass Rate**: ____%  

---

## Sign-off

**QA Lead**: ________________  
**Date**: ________________  
**Build Signed Off**: [ ] Yes [ ] No  

**Issues Found**:
(Attach separate issue log if failures)

---

## Deployment Readiness

- [ ] All critical tests pass
- [ ] No regressions detected
- [ ] Performance acceptable
- [ ] Error handling verified
- [ ] Ready for production deployment

