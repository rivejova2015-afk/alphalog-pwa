# Sprint 8.1 - Payout Engine Deployment Guide

**Status**: Ready for Staging/Production  
**Build**: Passing (0 errors)  
**Tested**: ✅ (Follow SPRINT_8_1_TESTING_GUIDE.md for QA)

---

## Pre-Deployment Checklist

### Code Quality
- [ ] All TypeScript errors resolved (build passes)
- [ ] No console errors in browser
- [ ] Code reviewed by 1+ developer
- [ ] All tests in SPRINT_8_1_TESTING_GUIDE.md passing

### Database
- [ ] Migration file reviewed (012_treasury_payout_engine.sql)
- [ ] Backup taken before migration (if production)
- [ ] RLS policies reviewed and correct
- [ ] No breaking changes to existing tables

### Environment
- [ ] .env.local configured with correct Supabase credentials
- [ ] VAPID keys configured for push notifications
- [ ] Database connection tested
- [ ] All dependencies installed (npm ci)

### Documentation
- [ ] SPRINT_8_1_SUMMARY.md complete
- [ ] SPRINT_8_1_TESTING_GUIDE.md complete
- [ ] API documentation generated
- [ ] This deployment guide complete

---

## Deployment Procedure

### Step 1: Apply Database Migration

```bash
# Option A: Via Supabase CLI
supabase db push

# Option B: Via Supabase Dashboard
# 1. Navigate to SQL Editor
# 2. Copy contents of supabase/migrations/012_treasury_payout_engine.sql
# 3. Create new migration or run in editor
# 4. Verify: Check treasury_configs and treasury_payouts columns exist

# Option C: Via psql (if direct database access)
psql -U postgres -d postgres -h localhost -f supabase/migrations/012_treasury_payout_engine.sql
```

**Verification:**
```sql
-- Check treasury_configs new columns
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'treasury_configs' 
AND column_name IN ('wallet_id', 'last_threshold_push_cycle_start');
-- Expected: 2 rows

-- Check treasury_payouts new columns
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'treasury_payouts' 
AND column_name IN ('cycle_start', 'version', 'cash_payout_amount', 'blocked_reasons');
-- Expected: 4+ rows
```

### Step 2: Deploy Application Code

```bash
# Build and test locally
npm run build
npm run dev

# If using Vercel/similar
git push origin sprint-8-1-payout-engine
# CI/CD will automatically:
# - Run npm install
# - Run npm run build
# - Run tests (if configured)
# - Deploy to staging

# Manual deployment to production
npm run build
vercel deploy --prod  # or your deployment command
```

### Step 3: Verify Deployment

```bash
# 1. Check endpoints are accessible
curl -X POST http://localhost:3000/api/treasury/payouts/preview \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {your-jwt}" \
  -d '{"accountId":"ALL"}'
# Expected: 200 OK with preview data

# 2. Check Cashflow tab loads
# Visit: http://localhost:3000/dashboard/treasury?tab=cashflow
# Expected: Payout Engine section visible

# 3. Check push notification setup
echo $VAPID_PRIVATE_KEY
echo $VAPID_PUBLIC_KEY
# Expected: Both variables set (non-empty)

# 4. Check database connections
# Use Supabase dashboard to verify:
# - No connectivity errors
# - RLS policies applied correctly
# - New tables/columns exist
```

### Step 4: Monitor for Issues

#### Logs to Watch

```bash
# Application logs
tail -f .next/logs/error.log

# Database logs (Supabase Dashboard)
# Settings → Logs → Database Logs → Filter for errors

# Error tracking (Sentry/similar)
# Monitor 'treasury/payouts' namespace

# Browser console
# Check for client-side errors in DevTools
```

#### Key Metrics to Track

1. **API Response Times**
   - `/api/treasury/payouts/preview`: Target <500ms
   - `/api/treasury/payouts/create`: Target <300ms
   - `/api/treasury/payouts/status`: Target <200ms

2. **Error Rates**
   - 4xx errors (user errors): Expected <5%
   - 5xx errors (server errors): Expected <1%

3. **Push Notifications**
   - Delivery rate: Target >95%
   - Latency: Target <1000ms

---

## Configuration

### Environment Variables (No Changes Required)

Already configured in existing `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=...
```

### Feature Flags (Optional)

To disable payout engine temporarily:

```typescript
// In src/components/treasury/panels/Cashflow.client.tsx
const PAYOUT_ENGINE_ENABLED = process.env.NEXT_PUBLIC_PAYOUT_ENGINE_ENABLED !== 'false';

return (
  <div>
    {PAYOUT_ENGINE_ENABLED && (
      <div className="border-t border-slate-700 pt-6">
        {/* Payout Engine Section */}
      </div>
    )}
  </div>
);
```

Set in `.env.local`:
```
NEXT_PUBLIC_PAYOUT_ENGINE_ENABLED=true  # or false to disable
```

---

## Rollback Plan

### Scenario 1: Code Rollback (No Database Changes)

If issues are found in APIs or UI:

```bash
# Revert to previous commit
git revert cbfbcec

# Or restore specific files
git restore src/app/api/treasury/payouts/
git restore src/components/treasury/panels/Cashflow.client.tsx
git restore src/lib/treasury/

# Rebuild and redeploy
npm run build
git push origin main
```

### Scenario 2: Database Rollback

If migration causes issues:

```sql
-- Rollback migration (runs in reverse)
-- Option 1: Restore from backup (recommended)
-- Option 2: Drop new columns

ALTER TABLE treasury_payouts DROP COLUMN IF EXISTS cycle_start;
ALTER TABLE treasury_payouts DROP COLUMN IF EXISTS cycle_expected_end;
ALTER TABLE treasury_payouts DROP COLUMN IF EXISTS calc_cutoff;
ALTER TABLE treasury_payouts DROP COLUMN IF EXISTS version;
ALTER TABLE treasury_payouts DROP COLUMN IF EXISTS cash_payout_amount;
ALTER TABLE treasury_payouts DROP COLUMN IF EXISTS tax_reserve_amount;
ALTER TABLE treasury_payouts DROP COLUMN IF EXISTS bonus_vault_amount;
ALTER TABLE treasury_payouts DROP COLUMN IF EXISTS blocked_reasons;

ALTER TABLE treasury_configs DROP COLUMN IF EXISTS wallet_id;
ALTER TABLE treasury_configs DROP COLUMN IF EXISTS last_threshold_push_cycle_start;

DROP INDEX IF EXISTS idx_treasury_payouts_cycle;
```

### Scenario 3: Disable Feature Without Rollback

Keep code in place but disable functionality:

```typescript
// In each endpoint, add guard:
if (process.env.PAYOUT_ENGINE_ENABLED !== 'true') {
  return Response.json({ 
    success: false, 
    error: 'Feature temporarily disabled' 
  }, { status: 503 });
}

// Or in Cashflow component:
if (!process.env.NEXT_PUBLIC_PAYOUT_ENGINE_ENABLED) {
  return <div>Payout Engine temporarily unavailable</div>;
}
```

---

## Post-Deployment Validation

### User-Facing Tests

1. **Navigate to Cashflow tab**
   - [ ] Payout Engine section visible
   - [ ] Account selector works
   - [ ] Calculate button responsive

2. **Create test payout**
   - [ ] Set wallet for test account
   - [ ] Click Calculate
   - [ ] Preview data displays correctly
   - [ ] Click Create Payout
   - [ ] Success message shows
   - [ ] Payout visible in database

3. **Verify push notifications**
   - [ ] Subscribe to notifications (if not already)
   - [ ] Trigger threshold condition
   - [ ] Notification received on device
   - [ ] Notification has correct title/body

4. **Test blocking conditions**
   - [ ] Enable Anti-DD, verify blocking
   - [ ] Lower balance threshold, verify blocking
   - [ ] Disable withdrawals, verify blocking
   - [ ] Messages display correctly

### Database Validation

```sql
-- Check for new columns
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'treasury_configs'
ORDER BY ordinal_position;

-- Check new unique constraint
SELECT constraint_name, constraint_type FROM information_schema.table_constraints
WHERE table_name = 'treasury_payouts'
AND constraint_name LIKE '%unique%';

-- Check sample data
SELECT id, cycle_start, version, status FROM treasury_payouts LIMIT 5;
```

### Performance Validation

```bash
# Load test with k6 (if available)
k6 run scripts/payout-preview-load.js

# Or manual load test
for i in {1..10}; do
  time curl -X POST http://localhost:3000/api/treasury/payouts/preview \
    -H "Content-Type: application/json" \
    -d '{"accountId":"ALL"}'
done
```

---

## Troubleshooting

### Issue: "Module not found: webpush.server"

**Solution:**
- Verify import path in pushNotifications.ts
- Path should be: `../push/webpush.server` (relative from treasury/)
- Check file exists at `src/lib/push/webpush.server.ts`

### Issue: API returns 401 Unauthorized

**Solution:**
- Check session is valid
- Verify NEXT_PUBLIC_SUPABASE_URL and keys correct
- Check RLS policies allow user access
- Review auth token in request

### Issue: Push notifications not sending

**Solution:**
- Check VAPID keys configured in .env.local
- Verify user has push subscriptions in database
- Check browser permission granted
- Review server logs for errors

### Issue: Payout preview empty (no accounts shown)

**Solution:**
- Verify accounts exist in database
- Check treasury_configs records exist for accounts
- Verify RLS allows access (all filtered by user_id)
- Check account_id matches in joins

### Issue: Create payout fails with "Wallet not mapped"

**Solution:**
- Update treasury_configs.wallet_id for account
- Verify wallet exists in treasury_wallets table
- Confirm wallet_id references valid wallet

---

## Support Contacts

**On-call Engineer**: ________________  
**Escalation**: ________________  

**Relevant Documentation**:
- SPRINT_8_1_SUMMARY.md - Technical overview
- SPRINT_8_1_TESTING_GUIDE.md - Test procedures
- [Database Schema](supabase/migrations/010_treasury_core.sql)
- [API Documentation](#api-documentation-below)

---

## Sign-off

**Deployed By**: ________________  
**Deployment Time**: ________________  
**Environment**: [ ] Staging [ ] Production  
**Status**: [ ] Successful [ ] Failed [ ] Partial  

**Notes**:
_________________________________

---

## API Documentation

### Endpoint: POST /api/treasury/payouts/preview

**Purpose**: Calculate payout preview for accounts (non-mutating)

**Authentication**: Required (bearer token)

**Request Body**:
```json
{
  "accountId": "ALL" | "uuid-string"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "cycleStart": "2026-01-15",
  "cycleExpectedEnd": "2026-02-14",
  "calcCutoff": "2026-01-20",
  "cycleDatesFormatted": "Jan 15 - Feb 14",
  "perAccountPreview": [
    {
      "accountId": "uuid",
      "accountName": "XAU",
      "cycleStart": "2026-01-15",
      "cycleExpectedEnd": "2026-02-14",
      "calcCutoff": "2026-01-20",
      "currentBalance": 51000,
      "accountSize": 50000,
      "periodPnL": 1300,
      "currentDrawdown": 15.5,
      "retirable": 650,
      "taxReserveAmount": 195,
      "bonusVaultAmount": 0,
      "cashPayoutAmount": 455,
      "blockedReasons": [],
      "isCreatable": true,
      "hasThresholdCondition": true,
      "walletMapped": true
    }
  ],
  "totals": {
    "retirable": 650,
    "taxReserve": 195,
    "bonusVault": 0,
    "cashPayout": 455
  },
  "pushNotificationsPending": [
    {
      "accountId": "uuid",
      "accountName": "XAU",
      "message": "Umbral alcanzado - Ya puedes retirar en XAU"
    }
  ]
}
```

**Error Responses**:
- 401: Unauthorized
- 404: Account not found
- 500: Server error

---

### Endpoint: POST /api/treasury/payouts/create

**Purpose**: Create payout record in database

**Request Body**:
```json
{
  "accountId": "uuid-string",
  "note": "optional note"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "payoutId": "uuid",
  "cycleStart": "2026-01-15",
  "version": 1,
  "breakdown": {
    "retirable": 650,
    "taxReserveAmount": 195,
    "bonusVaultAmount": 0,
    "cashPayoutAmount": 455
  }
}
```

**Error Responses**:
- 400: Bad request (wallet not mapped, no retirable)
- 401: Unauthorized
- 404: Account/config not found
- 409: Blocked by conditions (includes blockedReasons)
- 500: Server error

---

### Endpoint: PATCH /api/treasury/payouts/status

**Purpose**: Update payout status

**Request Body**:
```json
{
  "payoutId": "uuid-string",
  "status": "planned" | "sent" | "received" | "canceled"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "payoutId": "uuid",
  "newStatus": "sent"
}
```

**Error Responses**:
- 400: Invalid status value
- 401: Unauthorized
- 404: Payout not found
- 500: Server error

---

