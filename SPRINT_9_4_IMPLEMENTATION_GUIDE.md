# Sprint 9.4: Business Recurring Costs Scheduler + Push Alerts
## Implementation & Deployment Guide

---

## Overview

This sprint adds two critical features to the AlphaLog Business module:

1. **Recurring Costs Scheduler**: Automatically generates monthly business costs from templates
2. **Business Alerts**: Sends push notifications for low runway and annual report deadlines

Both features use Supabase Scheduled Edge Functions (like Treasury module) and Next.js cron endpoints.

---

## Files Created/Modified

### New Files:
```
supabase/functions/business-recurring-costs/index.ts    (70 lines) - Edge function scheduler
supabase/functions/business-alerts/index.ts             (70 lines) - Edge function scheduler
src/app/api/cron/business/recurring-costs/route.ts      (230 lines) - Cost generation logic
src/app/api/cron/business/alerts/route.ts               (280 lines) - Alert push logic
SPRINT_9_4_TESTING_CHECKLIST.md                         - Testing guide
```

### Modified Files:
```
supabase/migrations/014_business_core.sql  - Added business_alert_history table + RLS
.env.example                               - Added RUNWAY_THRESHOLD_MONTHS
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Supabase Dashboard (Scheduled Edge Functions)              │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ business-recurring-costs (cron: 10 0 * * *)         │   │
│  │ Runs: Daily 00:10 UTC                                │   │
│  └──────────────────┬───────────────────────────────────┘   │
│                     │                                        │
│                     ▼                                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ business-alerts (cron: 15 0 * * *)                  │   │
│  │ Runs: Daily 00:15 UTC                                │   │
│  └──────────────────┬───────────────────────────────────┘   │
└─────────────────────┼───────────────────────────────────────┘
                      │
                      │ HTTP GET (x-cron-secret header)
                      │
        ┌─────────────▼──────────────┐
        │                            │
        ▼                            ▼
   /api/cron/business/    /api/cron/business/
   recurring-costs         alerts
        │                      │
        ├─ Verify secret ──────┤
        ├─ Load templates ──────┤
        ├─ Check conditions ────┤
        ├─ Insert costs ────────┤
        ├─ Update templates ────┤
        └─ Return results ──────┤
                                │
                                ├─ Load users + templates
                                ├─ Calculate runway
                                ├─ Check thresholds
                                ├─ Get subscriptions
                                ├─ Send push notifications
                                ├─ Track alerts (no spam)
                                └─ Update tracking fields
```

---

## Setup Instructions

### Step 1: Configure Environment Variables

#### Supabase Dashboard (Edge Functions Settings):

1. Go to **Supabase Dashboard → Edge Functions**
2. Click **Settings** (gear icon)
3. Add the following environment variables:

```
ALPHALOG_WEB_URL = https://alphalog.io  (or http://localhost:3000 for dev)
CRON_SECRET = [strong-random-secret-32-chars-min]
```

**Generate strong secret:**
```bash
openssl rand -base64 32
# Output example: aBc1D2eF3gH4iJ5kL6mN7oPq8rStUvWxYzAbCdEfGhIj==
```

#### Local Development (.env.local):

```bash
# Copy from .env.example and fill in values
CRON_SECRET=aBc1D2eF3gH4iJ5kL6mN7oPq8rStUvWxYzAbCdEfGhIj==
SUPABASE_SERVICE_ROLE_KEY=[from Supabase Dashboard → Project Settings → API]
RUNWAY_THRESHOLD_MONTHS=3
ALPHALOG_WEB_URL=http://localhost:3000  # (local dev)
```

### Step 2: Apply Database Schema Migration

The migration adds the `business_alert_history` table to track sent alerts.

**Option A: Using Supabase CLI**
```bash
supabase db push
```

**Option B: Manual (Supabase Dashboard)**
1. Go to **Supabase Dashboard → SQL Editor**
2. Create new query
3. Copy content from `supabase/migrations/014_business_core.sql` (section M onwards - the new parts)
4. Run query

**Verify migration:**
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_name = 'business_alert_history';
-- Should return 1 row
```

### Step 3: Deploy Supabase Edge Functions

**Option A: Using Supabase CLI**
```bash
# Deploy both functions
supabase functions deploy business-recurring-costs
supabase functions deploy business-alerts
```

**Option B: Manual (Supabase Dashboard)**
1. Go to **Supabase Dashboard → Edge Functions**
2. Click **Create new function**
3. Name: `business-recurring-costs`
4. Copy content from `supabase/functions/business-recurring-costs/index.ts`
5. Click **Deploy**
6. Repeat for `business-alerts` function

**Verify deployment:**
```bash
supabase functions list
# Should show both functions with status "Active"
```

### Step 4: Configure Function Schedules

**In Supabase Dashboard → Edge Functions:**

#### For business-recurring-costs:
1. Click the function name
2. Go to **Scheduled** tab
3. Click **Create schedule** (or **Enable schedule** if exists)
4. Set:
   - **Cron expression**: `10 0 * * *` (00:10 UTC daily)
   - **Timeout**: 300 seconds
   - **Enabled**: ✓ checked
5. Click **Save**

#### For business-alerts:
1. Click the function name
2. Go to **Scheduled** tab
3. Click **Create schedule**
4. Set:
   - **Cron expression**: `15 0 * * *` (00:15 UTC daily)
   - **Timeout**: 300 seconds
   - **Enabled**: ✓ checked
5. Click **Save**

---

## Testing the Implementation

### Test 1: Verify Endpoint Security (5 min)

```bash
# Missing secret - should return 401
curl http://localhost:3000/api/cron/business/recurring-costs
# Expected: {"error": "Unauthorized: Invalid or missing cron secret"}

# Invalid secret - should return 401
curl -H "x-cron-secret: wrong-secret" \
  http://localhost:3000/api/cron/business/recurring-costs
# Expected: {"error": "Unauthorized: Invalid or missing cron secret"}

# Valid secret - should return 200
curl -H "x-cron-secret: YOUR_CRON_SECRET" \
  http://localhost:3000/api/cron/business/recurring-costs
# Expected: {"success": true, "message": "Recurring costs generation completed", ...}
```

### Test 2: Recurring Costs Generation (15 min)

1. **Create test data** in Supabase SQL Editor:
   ```sql
   -- Get a user UUID from your system
   -- Create a template for that user
   INSERT INTO business_cost_templates (
     user_id, 
     amount, 
     category, 
     description, 
     vendor, 
     day_of_month, 
     start_month, 
     active
   ) VALUES (
     '[YOUR_USER_UUID]',
     99.99,
     'Tools Software',
     'Monthly test subscription',
     'Test Vendor LLC',
     1,
     '2025-01',
     true
   );
   ```

2. **Call the endpoint**:
   ```bash
   curl -H "x-cron-secret: YOUR_CRON_SECRET" \
     http://localhost:3000/api/cron/business/recurring-costs
   ```

3. **Verify results**:
   - Check database: 
     ```sql
     SELECT * FROM business_costs 
     WHERE user_id = '[YOUR_USER_UUID]' 
     AND is_recurring_instance = true
     ORDER BY created_at DESC LIMIT 5;
     ```
   - Should see 1 new cost row created
   - Check template updated:
     ```sql
     SELECT last_generated_month FROM business_cost_templates 
     WHERE user_id = '[YOUR_USER_UUID]' LIMIT 1;
     ```
   - Should show current month (YYYY-MM format)

4. **Test duplicate prevention**:
   - Call endpoint again (same day)
   - Verify same number of costs (no new ones created)
   - Check endpoint response: should show "skipped" for already-generated template

### Test 3: Business Alerts (20 min)

1. **Setup test user data**:
   ```sql
   -- Create LLC info
   INSERT INTO llc_info (
     user_id,
     llc_name,
     annual_report_due_month,
     registered_agent_name,
     ein
   ) VALUES (
     '[YOUR_USER_UUID]',
     'Test LLC',
     1,  -- January (use current month if testing immediate alert)
     'Test Agent',
     '12-3456789'
   );

   -- Add some costs to calculate burn rate
   INSERT INTO business_costs (user_id, amount, category, description, vendor, cost_date)
   VALUES 
     ('[YOUR_USER_UUID]', 500, 'Tools Software', 'Cost 1', 'Vendor 1', '2024-11-15'),
     ('[YOUR_USER_UUID]', 300, 'Data', 'Cost 2', 'Vendor 2', '2024-12-10'),
     ('[YOUR_USER_UUID]', 200, 'Infrastructure', 'Cost 3', 'Vendor 3', '2025-01-05');
   
   -- (Optional) Add a test push subscription
   INSERT INTO push_subscriptions (user_id, subscription)
   VALUES (
     '[YOUR_USER_UUID]',
     '{"endpoint": "https://example.com/push", "keys": {"p256dh": "test", "auth": "test"}}'
   );
   ```

2. **Call the endpoint**:
   ```bash
   curl -H "x-cron-secret: YOUR_CRON_SECRET" \
     http://localhost:3000/api/cron/business/alerts
   ```

3. **Verify in database**:
   ```sql
   -- Check alert history was created
   SELECT * FROM business_alert_history 
   WHERE user_id = '[YOUR_USER_UUID]'
   ORDER BY created_at DESC LIMIT 5;
   ```

4. **Verify alert deduplication**:
   - Call endpoint again (same day)
   - Check response: low_runway should still be tracked but not re-sent
   - Database: alert_history should only have 1 entry per alert type per month

### Test 4: Manual Edge Function Trigger (5 min)

**In Supabase Dashboard:**

1. Go to **Edge Functions → business-recurring-costs**
2. Click **Test** button (or **Invoke**)
3. Check **Function logs** output
4. Verify logs show the execution details

**Repeat for business-alerts function**

---

## Scheduled Execution Verification

After deployment, functions will run automatically:

**Recurring Costs**: Every day at **00:10 UTC**
**Alerts**: Every day at **00:15 UTC**

### Monitor Scheduled Runs:

1. **Supabase Dashboard → Edge Functions → [function] → Scheduled**
2. Scroll to **Recent executions**
3. Check status (✓ Success or ✗ Failed)
4. Click execution to view logs

**What to look for:**
- Functions run at scheduled times
- Status shows "Success" (200 HTTP)
- Logs show expected messages:
  - `[Business Recurring Costs] Starting at...`
  - `[Business Alerts] Starting at...`
- No repeated errors

---

## Troubleshooting

### Issue: Function returns 500 "Missing environment variables"

**Solution:**
1. Go to **Supabase Dashboard → Edge Functions → Settings**
2. Verify both variables are set:
   - `ALPHALOG_WEB_URL`
   - `CRON_SECRET`
3. Redeploy function:
   ```bash
   supabase functions deploy business-recurring-costs
   ```

### Issue: Endpoint returns 401 "Unauthorized"

**Solution:**
1. Verify `CRON_SECRET` in .env.local matches Supabase setting
2. Verify header is exactly `x-cron-secret` (lowercase, with hyphen)
3. Test with correct secret:
   ```bash
   echo "CRON_SECRET=$CRON_SECRET"
   curl -H "x-cron-secret: $CRON_SECRET" http://localhost:3000/api/cron/business/recurring-costs
   ```

### Issue: Costs not being created

**Checklist:**
- [ ] Is template `active = true`?
- [ ] Is `start_month` <= current month?
- [ ] Does `last_generated_month` != current month?
- [ ] Check endpoint response for errors in `results` array
- [ ] Check Supabase logs for database errors
- [ ] Run endpoint manually with `-H "x-cron-secret: ..."` header

### Issue: Alerts not sending

**Checklist:**
- [ ] Does user have push subscriptions? Check `push_subscriptions` table
- [ ] Is `last_annual_report_push_year` set for annual alerts? Should be NULL or previous year
- [ ] Are VAPID keys configured (for local testing)?
- [ ] Check endpoint response: `results` array shows alert details
- [ ] Check `business_alert_history` table: are records created?

### Issue: Functions taking too long (timeout)

**Solution:**
1. Check for database performance issues:
   ```sql
   -- Find slow queries
   SELECT query, mean_exec_time, calls 
   FROM pg_stat_statements 
   WHERE query LIKE '%business%'
   ORDER BY mean_exec_time DESC;
   ```
2. Verify indexes exist:
   ```sql
   SELECT indexname FROM pg_indexes 
   WHERE tablename IN ('business_cost_templates', 'business_costs');
   ```
3. Increase timeout in Supabase Dashboard (up to 600 seconds)

---

## Production Deployment

### Pre-Deployment Checklist:

- [ ] Test all functionality in staging environment
- [ ] Verify environment variables are set in production
- [ ] Run database migration on production database
- [ ] Deploy Edge Functions to production
- [ ] Configure schedules in production
- [ ] Verify push notification credentials (VAPID keys) are set
- [ ] Test with real user data (but not in business hours)

### Deployment Steps:

1. **Merge feature branch to main**
   ```bash
   git checkout main
   git pull origin main
   git merge feature/sprint-9-4-recurring-costs-alerts
   ```

2. **Deploy to Supabase (production)**
   ```bash
   supabase functions deploy --project-ref=[PROD_PROJECT_ID] business-recurring-costs
   supabase functions deploy --project-ref=[PROD_PROJECT_ID] business-alerts
   ```

3. **Apply database migration**
   ```bash
   supabase db push --project-ref=[PROD_PROJECT_ID]
   ```

4. **Configure schedules** in Supabase Dashboard (as per Step 4 above)

5. **Deploy Next.js application**
   - If using Vercel: `git push` triggers automatic deployment
   - If using other platform: follow deployment procedure

6. **Verify in production**
   ```bash
   # With production URL and CRON_SECRET
   curl -H "x-cron-secret: [PROD_SECRET]" \
     https://alphalog.yourcompany.com/api/cron/business/recurring-costs
   ```

---

## Monitoring in Production

### Daily Checks:
1. **Supabase Dashboard → Edge Functions → Scheduled**
   - Verify functions ran at scheduled times
   - Check execution logs for errors
   
2. **Database Activity**
   ```sql
   -- Check new costs were created
   SELECT DATE(created_at), COUNT(*) 
   FROM business_costs 
   WHERE is_recurring_instance = true 
   GROUP BY DATE(created_at) 
   ORDER BY DATE(created_at) DESC 
   LIMIT 7;
   
   -- Check alerts were sent
   SELECT alert_type, COUNT(*) 
   FROM business_alert_history 
   WHERE DATE(created_at) = TODAY 
   GROUP BY alert_type;
   ```

3. **Application Logs**
   - Check for any 500 errors in `/api/cron/business/*` endpoints
   - Search logs for "cron" to see execution details

### Weekly Review:
- Compare actual costs vs. expected (template count × amount)
- Review alert history for users who should have received alerts
- Check push notification delivery (in Analytics if available)

---

## Rollback Instructions

### If Critical Issues Found:

**Option 1: Disable Schedules (Quickest)**
```bash
# In Supabase Dashboard:
# Go to Edge Functions → [function] → Scheduled
# Uncheck "Enable schedule" or delete the schedule
# Endpoints still work if called manually, just won't auto-trigger
```

**Option 2: Revert Function Code**
```bash
# In Supabase Dashboard:
# Go to Edge Functions → [function]
# Click "Code history" or "Previous versions"
# Select working version and click "Deploy"

# Or manually:
git revert [commit-hash-of-function-code]
supabase functions deploy business-recurring-costs
supabase functions deploy business-alerts
```

**Option 3: Remove Database Changes**
```bash
# Only if critical schema issue:
supabase db reset  # WARNING: Deletes all data in dev
# Or manually: DROP TABLE business_alert_history;
```

**Option 4: Complete Git Revert**
```bash
git revert [commit-hash-of-entire-sprint]
git push
# Then redeploy application from main branch
```

---

## Performance Optimization Tips

1. **Batch User Processing**
   - Functions process users in parallel (async)
   - Consider limiting to 50 users per execution if timeout issues
   - Add pagination: `LIMIT 50 OFFSET [batch*50]`

2. **Optimize Supabase Queries**
   - Use `.select()` to fetch only needed columns
   - Add `.limit()` to cap result sets
   - Create indexes on filter columns (done in migration)

3. **Cache Calculation Results**
   - If calculating same runway multiple times, cache in memory
   - Don't re-fetch same user data

4. **Monitor Edge Function Performance**
   - Supabase Dashboard shows execution duration
   - Aim for < 5 seconds (300s timeout allows buffer)

---

## Documentation References

- **Supabase Scheduled Functions**: https://supabase.com/docs/guides/functions/schedule
- **Next.js Route Handlers**: https://nextjs.org/docs/app/building-your-application/routing/route-handlers
- **Web Push API**: https://developer.mozilla.org/en-US/docs/Web/API/Push_API
- **Cron Expressions**: https://en.wikipedia.org/wiki/Cron

---

## Files Summary

| File | Purpose | Lines | Status |
|------|---------|-------|--------|
| `supabase/functions/business-recurring-costs/index.ts` | Edge function for recurring cost scheduling | 70 | ✅ Created |
| `supabase/functions/business-alerts/index.ts` | Edge function for business alerts | 70 | ✅ Created |
| `src/app/api/cron/business/recurring-costs/route.ts` | Next.js endpoint for cost generation | 230 | ✅ Created |
| `src/app/api/cron/business/alerts/route.ts` | Next.js endpoint for alerts | 280 | ✅ Created |
| `supabase/migrations/014_business_core.sql` | Schema migration (new table + RLS) | +50 | ✅ Updated |
| `.env.example` | Environment variables documentation | +3 | ✅ Updated |
| `SPRINT_9_4_TESTING_CHECKLIST.md` | Comprehensive testing guide | 500+ | ✅ Created |

---

## Sign-Off

- **Feature Complete**: ✅ All components implemented
- **Build Status**: Ready for testing
- **Next Step**: Execute SPRINT_9_4_TESTING_CHECKLIST.md

---

## Questions?

Refer to:
- SPRINT_9_4_TESTING_CHECKLIST.md for detailed testing steps
- AGENTS.md for coding standards and constraints
- MIGRATION_PLAN.md for future enhancements
