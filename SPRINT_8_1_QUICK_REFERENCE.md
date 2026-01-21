# Sprint 8.1 - Quick Reference Guide

**Status**: ✅ Complete  
**Build**: ✅ Passing (0 errors, 3.0s)  
**Commit**: cbfbcec (feat(treasury): Payout engine...)

---

## What's New (TL;DR)

A complete payout engine for Treasury that:
- 📅 Calculates payouts based on monthly cycles (withdrawal_day)
- 📊 Breaks down profits into tax reserves, bonuses, and cash payouts
- 🔒 Blocks payouts if Anti-DD active or balance below threshold
- 🔢 Allows multiple payout versions per cycle
- 📢 Sends "Umbral alcanzado" push notification (1/cycle/account)
- 🎯 Lives in Cashflow tab with preview + create buttons

---

## Quick Navigation

| What | Where |
|------|-------|
| **Technical Details** | [SPRINT_8_1_SUMMARY.md](SPRINT_8_1_SUMMARY.md) |
| **Testing Steps** | [SPRINT_8_1_TESTING_GUIDE.md](SPRINT_8_1_TESTING_GUIDE.md) |
| **Deployment** | [SPRINT_8_1_DEPLOYMENT_GUIDE.md](SPRINT_8_1_DEPLOYMENT_GUIDE.md) |
| **Calculation Logic** | src/lib/treasury/payoutEngine.ts |
| **API Endpoints** | src/app/api/treasury/payouts/{preview,create,status} |
| **UI Component** | src/components/treasury/panels/Cashflow.client.tsx |

---

## Key Concepts

### Cycle

A monthly period from `withdrawal_day` to day before next month's `withdrawal_day`.

```
withdrawal_day = 15

Jan 10: In Dec 15 - Jan 14 cycle
Jan 15: In Jan 15 - Feb 14 cycle (NEW cycle starts)
Jan 20: Still in Jan 15 - Feb 14 cycle
Feb 15: In Feb 15 - Mar 14 cycle (NEW cycle starts)
```

### Breakdown

Profit allocation:
```
Current Balance: $51,000
Account Size: $50,000
Profit Total: $1,000
Period PnL: $1,300 (from trades in this cycle)
Split Mode: Growth (50%)

Payoutable = min(1300, 1000) = $1,000
Retirable = 1000 * 50% = $500
Tax Reserve = 500 * 30% = $150
Bonus Vault = $0 (default)
Cash Payout = 500 - 150 - 0 = $350
```

### Blocking

Conditions that prevent payout creation:
1. ❌ Anti-DD enabled AND drawdown >= threshold
2. ❌ Balance threshold enabled AND current_balance < threshold
3. ❌ Withdrawals disabled

### Threshold Push

Notification sent when:
- ✅ Current balance >= balance_threshold
- ✅ Retirable > 0
- ✅ Push NOT already sent this cycle

Prevents duplicates with `last_threshold_push_cycle_start` tracking.

### Versioning

Multiple payouts allowed per cycle:
- v1: Created on 2026-01-15
- v2: Created on 2026-01-18
- v3: Created on 2026-01-20
- (All same cycle)

Next cycle (2026-02-15) starts v1 again.

---

## Files Created/Modified

### Created (6 files)

1. **supabase/migrations/012_treasury_payout_engine.sql** (70 lines)
   - Add wallet_id, last_threshold_push_cycle_start to treasury_configs
   - Add cycle_start, version, breakdown fields to treasury_payouts
   - New unique constraint on (user_id, account_id, cycle_start, version)

2. **src/lib/treasury/payoutEngine.ts** (370 lines)
   - Core calculation engine
   - Functions: cycle computation, PnL calc, breakdown, blocking logic

3. **src/lib/treasury/pushNotifications.ts** (70 lines)
   - Send threshold push notifications
   - Update cycle tracking to prevent duplicates

4. **src/app/api/treasury/payouts/preview/route.ts** (350 lines)
   - POST /api/treasury/payouts/preview
   - No-op calculation for UI preview
   - Sends threshold pushes

5. **src/app/api/treasury/payouts/create/route.ts** (240 lines)
   - POST /api/treasury/payouts/create
   - Validates & creates payout record
   - Enforces blocking conditions

6. **src/app/api/treasury/payouts/status/route.ts** (70 lines)
   - PATCH /api/treasury/payouts/status
   - Updates payout status (planned → sent → received)

### Modified (3 files)

1. **src/components/treasury/panels/Cashflow.client.tsx** (+400 lines)
   - Added payout engine section
   - Account selector, preview table, create button
   - Error/success message handling

2. **src/lib/treasury/calculations.ts** (TreasuryConfig interface)
   - Added `wallet_id?: string`
   - Added `last_threshold_push_cycle_start?: string`

3. **src/lib/treasury/queries.ts** (TreasuryPayout interface)
   - Added 9 new optional fields
   - cycle_start, version, breakdown fields, etc.

---

## API Endpoints

### POST /api/treasury/payouts/preview

**No changes to database** - Safe to call repeatedly

**Request**: `{ accountId: "ALL" | uuid }`

**Response**: Preview data with:
- Per-account breakdown (retirable, tax, bonus, cash)
- Blocking reasons (if any)
- Threshold push pending status
- Totals aggregated

### POST /api/treasury/payouts/create

**Creates record** - Validates blocking conditions first

**Request**: `{ accountId: uuid, note?: string }`

**Response**: Created payout with:
- payoutId, version, cycleStart
- Full breakdown amounts
- Status: "planned"

### PATCH /api/treasury/payouts/status

**Updates existing record** - Status workflow only

**Request**: `{ payoutId: uuid, status: "sent" | "received" | "canceled" }`

**Response**: Updated status confirmation

---

## Testing Checklist

### Before QA
- [ ] npm run build passes (0 errors)
- [ ] Database migration ready
- [ ] All 3 endpoints accessible
- [ ] Cashflow tab loads payout engine

### During QA (43 tests total)
- [ ] **Cycles** (5 tests): Date calculation, PnL filtering
- [ ] **Breakdown** (6 tests): Split modes, aggregation
- [ ] **Blocking** (5 tests): All conditions, create rejects
- [ ] **Wallet** (3 tests): Mapping required validation
- [ ] **Push** (4 tests): Threshold condition, dedup, no crash
- [ ] **Versioning** (3 tests): v1→v2 in cycle, new cycle v1
- [ ] **UI** (6 tests): Selector, preview, create, totals
- [ ] **Regression** (3 tests): Existing features unaffected
- [ ] **Errors** (3 tests): Timeout, missing data, graceful
- [ ] **Performance** (2 tests): <1s for 10 accounts

### Sign-off
- [ ] All tests passing
- [ ] No regressions
- [ ] Performance acceptable
- [ ] Ready for deployment

---

## Deployment Steps

```bash
# 1. Apply migration
supabase db push
# or SQL: CREATE migrations/012_treasury_payout_engine.sql content

# 2. Verify columns exist
SELECT column_name FROM information_schema.columns 
WHERE table_name IN ('treasury_configs', 'treasury_payouts');

# 3. Build & test
npm run build
npm run dev

# 4. Deploy
git push origin main  # or vercel deploy --prod

# 5. Verify
curl -X POST http://localhost:3000/api/treasury/payouts/preview \
  -H "Content-Type: application/json" \
  -d '{"accountId":"ALL"}'
```

---

## Configuration

### Required Setup

1. **Create wallet** (UI or SQL):
   ```sql
   INSERT INTO treasury_wallets (user_id, name, currency)
   VALUES ('{user_id}', 'Main Wallet', 'USD');
   ```

2. **Map wallet to account** (SQL):
   ```sql
   UPDATE treasury_configs
   SET wallet_id = '{wallet_id}'
   WHERE account_id = '{account_id}';
   ```

3. **Set withdrawal_day** (if not already):
   ```sql
   UPDATE treasury_configs
   SET withdrawal_day = 15
   WHERE account_id = '{account_id}';
   ```

### Optional

- `balance_threshold`: Set to enable threshold notifications
- `anti_drawdown_active`: Set to enable drawdown protection
- `tax_buffer_percentage`: Adjust tax reserve (default 30%)
- `split_mode`: Change from growth (50%) to safe (40%) or cash (100%)

---

## Common Workflows

### User Flow: Preview & Create Payout

```
1. Navigate to Treasury → Cashflow tab
2. Payout Engine section visible
3. Select "Account A" or "All Accounts"
4. Click "Calculate" button
5. Preview loads showing:
   - Cycle dates (e.g., "Jan 15 - Feb 14")
   - Per-account breakdown
   - Blocking reasons (if any)
   - "Create Payout" button status
6. Click "Create Payout" (if not blocked)
7. Success: "Payout v1 created for cycle 2026-01-15"
8. Click "Calculate" again → v2 available (new version in same cycle)
```

### Dev Flow: Testing New Feature

```
1. Checkout branch: git checkout sprint-8-1-payout-engine
2. Build: npm run build
3. Run: npm run dev
4. Test locally:
   - Create test wallet
   - Update account config with wallet_id
   - Create closed trade with +PnL
   - Navigate to Cashflow tab
   - Click Calculate
   - Verify breakdown correct
   - Click Create Payout
   - Verify payout in database
```

### Ops Flow: Deploy to Production

```
1. Verify all tests passing (SPRINT_8_1_TESTING_GUIDE.md)
2. Backup database
3. Apply migration: supabase db push
4. Verify migration: SELECT * FROM treasury_configs LIMIT 1
5. Deploy code: git push origin main
6. Verify endpoints: curl /api/treasury/payouts/preview
7. Monitor error logs for 24h
8. Celebrate! 🎉
```

---

## Rollback Scenarios

### "I deployed code, need to rollback"
```bash
git revert cbfbcec
npm run build
git push origin main
```

### "I applied migration, need to undo"
```sql
ALTER TABLE treasury_payouts DROP COLUMN IF EXISTS cycle_start, cycle_expected_end, calc_cutoff, version, cash_payout_amount, tax_reserve_amount, bonus_vault_amount, blocked_reasons;
ALTER TABLE treasury_configs DROP COLUMN IF EXISTS wallet_id, last_threshold_push_cycle_start;
```

### "Everything broken, rollback completely"
```bash
# 1. Restore database from backup (before migration)
# 2. git revert cbfbcec
# 3. npm run build
# 4. git push origin main
# This reverts all changes
```

---

## FAQs

**Q: Why "Umbral alcanzado" push notification?**  
A: Spanish for "threshold reached" - notifies user when balance hits their minimum threshold with retirable profit available.

**Q: Why allow multiple versions in same cycle?**  
A: Users might want to adjust allocations (more to tax, less to bonus) and recreate - versions track these variations.

**Q: Why wallet_id required?**  
A: Ensures payouts route to correct account (prevents accidental transfers).

**Q: Can I create payout if blocked?**  
A: No - API returns 409 Conflict with blockedReasons. Must fix conditions first (enable withdrawals, lower balance threshold, etc.).

**Q: What if no push subscriptions?**  
A: Gracefully skips push send, doesn't fail. User can still see notification in UI preview.

**Q: How often can I run preview?**  
A: As often as you want - it's read-only. Good for live dashboard.

**Q: Does create payout deduct from balance?**  
A: No - creates "planned" record only. Actual transfer happens separately (future feature).

---

## Contact & Support

**Questions about this feature?**
- Review [SPRINT_8_1_SUMMARY.md](SPRINT_8_1_SUMMARY.md) for technical details
- Check [SPRINT_8_1_TESTING_GUIDE.md](SPRINT_8_1_TESTING_GUIDE.md) for test examples
- See deployment guide for troubleshooting

**Found a bug?**
- Check KNOWN_ISSUES.md
- Review test case in SPRINT_8_1_TESTING_GUIDE.md
- Add issue to backlog with sprint label

**Want to enhance?**
- Tax buffer wizard in Milestone tab
- Batch operations for all accounts
- Webhook integrations
- Multi-currency support

---

**Happy payouts! 💰**

