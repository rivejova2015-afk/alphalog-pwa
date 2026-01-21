# Sprint 9.4: Business Recurring Costs Scheduler + Push Alerts
## Testing Checklist

---

## 1. Environment Configuration

### 1.1 Supabase Edge Function Variables
Set in **Supabase Dashboard → Edge Functions → Settings**:

- [ ] `ALPHALOG_WEB_URL`: Set to your deployment URL
  - Dev: `http://localhost:3000`
  - Staging: `https://staging.alphalog.example.com`
  - Production: `https://alphalog.io`
- [ ] `CRON_SECRET`: Strong random secret (min 32 chars)
  - Generate: `openssl rand -base64 32`
  - Must match `.env.local` value

### 1.2 Next.js Environment Variables
Set in `.env.local`:

- [ ] `CRON_SECRET`: Same value as Edge Function setting
- [ ] `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key
- [ ] `RUNWAY_THRESHOLD_MONTHS`: Default to `3` (optional)
- [ ] `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anon key
- [ ] `VAPID_PRIVATE_KEY`: Web push private key
- [ ] `VAPID_PUBLIC_KEY`: Web push public key

---

## 2. Database Schema Validation

### 2.1 Tables Exist
```sql
-- Run in Supabase SQL Editor to verify:
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name IN (
  'business_cost_templates',
  'business_costs',
  'business_alert_history',
  'llc_info'
);
```

- [ ] `business_cost_templates` exists with columns:
  - `id`, `user_id`, `amount`, `category`, `description`, `vendor`, `day_of_month`, `start_month`, `active`, `last_generated_month`

- [ ] `business_costs` exists with columns:
  - `id`, `user_id`, `amount`, `category`, `description`, `vendor`, `cost_date`, `is_recurring_instance`, `template_id`

- [ ] `business_alert_history` exists with columns:
  - `id`, `user_id`, `alert_type`, `alert_month`, `subscriptions_sent`, `created_at`

- [ ] `llc_info` exists with columns:
  - `id`, `user_id`, `annual_report_due_month`, `last_annual_report_push_year`

### 2.2 RLS Policies Enabled
```sql
-- Verify RLS is enabled:
SELECT tablename, rowsecurity FROM pg_tables 
WHERE schemaname = 'public' AND tablename IN (
  'business_cost_templates', 'business_costs', 'business_alert_history'
);
```

- [ ] RLS enabled on all business tables
- [ ] RLS policies set to owner-only (`auth.uid() = user_id`)

### 2.3 Indexes Created
```sql
-- Check indexes:
SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename IN (
  'business_cost_templates', 'business_costs', 'business_alert_history'
);
```

- [ ] Indexes exist on `(user_id)` for lookups
- [ ] Compound indexes on `(user_id, active)` for filtering

---

## 3. Supabase Edge Functions Deployment

### 3.1 Deploy Functions

```bash
# From project root:
supabase functions deploy business-recurring-costs
supabase functions deploy business-alerts
```

- [ ] `business-recurring-costs` function deployed
  - Verify in Dashboard → Edge Functions → business-recurring-costs
  - Should list as "Active"

- [ ] `business-alerts` function deployed
  - Verify in Dashboard → Edge Functions → business-alerts
  - Should list as "Active"

### 3.2 Schedule Functions

In **Supabase Dashboard → Edge Functions**:

#### business-recurring-costs:
- [ ] Set schedule cron: `10 0 * * *` (00:10 UTC daily)
- [ ] Set timeout: 300 seconds
- [ ] Environment variables set (ALPHALOG_WEB_URL, CRON_SECRET)

#### business-alerts:
- [ ] Set schedule cron: `15 0 * * *` (00:15 UTC daily)
- [ ] Set timeout: 300 seconds
- [ ] Environment variables set (ALPHALOG_WEB_URL, CRON_SECRET)

---

## 4. Next.js Cron Endpoints Testing

### 4.1 Recurring Costs Endpoint
**Test:** `GET /api/cron/business/recurring-costs`

```bash
# Direct test (with CRON_SECRET):
curl -H "x-cron-secret: YOUR_CRON_SECRET" \
  http://localhost:3000/api/cron/business/recurring-costs
```

#### Setup Test Data:
1. Create a test user account
2. In Supabase, insert test template:
   ```sql
   INSERT INTO business_cost_templates (user_id, amount, category, description, vendor, day_of_month, start_month, active)
   VALUES (
     'USER_UUID',
     50.00,
     'Tools Software',
     'Test recurring cost',
     'Test Vendor',
     1,  -- Day of month
     '2025-01',  -- Start month
     true
   );
   ```

#### Test Scenarios:
- [ ] **Scenario 1: Normal Generation**
  - Template is active, last_generated_month is NULL
  - Expected: Cost created, template.last_generated_month updated to current month
  - Check: `business_costs` table has new row with `is_recurring_instance=true, template_id=<id>`

- [ ] **Scenario 2: Duplicate Prevention**
  - Run endpoint twice in same day
  - Expected: Second run skips template (already generated this month)
  - Check: Only one cost created for the month

- [ ] **Scenario 3: Start Month Validation**
  - Template has `start_month='2026-06'` but today is '2025-01'
  - Expected: Template skipped with reason "Start month not yet reached"
  - Check: No cost created

- [ ] **Scenario 4: Inactive Template**
  - Toggle `active=false` on template
  - Expected: Template not fetched/processed
  - Check: No cost created in endpoint results

- [ ] **Scenario 5: Multiple Templates Per User**
  - Create 3 templates for one user
  - Expected: All 3 generate costs (if conditions met)
  - Check: 3 costs created with correct template_ids

- [ ] **Response Status**: HTTP 200
- [ ] **Response Structure**:
  ```json
  {
    "success": true,
    "message": "Recurring costs generation completed",
    "timestamp": "2025-01-19T...",
    "currentMonth": "2025-01",
    "summary": {
      "created": 2,
      "skipped": 1,
      "errors": 0,
      "total": 3
    },
    "results": [...]
  }
  ```

### 4.2 Business Alerts Endpoint
**Test:** `GET /api/cron/business/alerts`

```bash
# Direct test (with CRON_SECRET):
curl -H "x-cron-secret: YOUR_CRON_SECRET" \
  http://localhost:3000/api/cron/business/alerts
```

#### Setup Test Data:
1. Create test user with LLC info:
   ```sql
   INSERT INTO llc_info (user_id, llc_name, annual_report_due_month, registered_agent_name, ein)
   VALUES (
     'USER_UUID',
     'Test LLC',
     1,  -- January
     'Test Agent',
     '12-3456789'
   );
   ```

2. Add push subscription for user (via app UI or direct insert):
   ```sql
   INSERT INTO push_subscriptions (user_id, subscription)
   VALUES (
     'USER_UUID',
     '{"endpoint": "...", "keys": {"p256dh": "...", "auth": "..."}}'
   );
   ```

3. Add business data (trades/costs):
   ```sql
   -- Add some costs from last 3 months to calculate burn rate
   INSERT INTO business_costs (user_id, amount, category, description, vendor, cost_date)
   VALUES (
     'USER_UUID',
     500.00,
     'Tools Software',
     'Test cost',
     'Test Vendor',
     '2024-11-15'  -- 2 months ago
   );
   ```

#### Test Scenarios:

##### Low Runway Alert:
- [ ] **Scenario 1: Alert Triggered**
  - Runway < 3 months, no push sent this month
  - Expected: Push notification sent, alert_history record created
  - Check: `business_alert_history` has entry with `alert_type='low_runway', alert_month='2025-01'`

- [ ] **Scenario 2: Alert Cooldown (No Spam)**
  - Run endpoint twice in same day with low runway
  - Expected: Alert only sent once (second run finds existing history record)
  - Check: Only one entry in `business_alert_history` for this month

- [ ] **Scenario 3: Alert Suppressed (Healthy Runway)**
  - Runway >= 3 months
  - Expected: No alert sent
  - Check: No low_runway entry in `business_alert_history`

##### Annual Report Alert:
- [ ] **Scenario 1: Alert Triggered**
  - Current month = `annual_report_due_month`, `last_annual_report_push_year` is NULL or previous year
  - Expected: Push notification sent, `llc_info.last_annual_report_push_year` updated to current year
  - Check: `llc_info` has updated year; push sent if subscriptions exist

- [ ] **Scenario 2: Annual Cooldown (Once Per Year)**
  - Run endpoint twice (same calendar year, due month)
  - Expected: Alert only sent once
  - Check: `last_annual_report_push_year` matches current year; second run skips alert

- [ ] **Scenario 3: Alert Suppressed (Not Due Month)**
  - Current month != `annual_report_due_month`
  - Expected: No alert sent
  - Check: No alert_history entry for annual_report type

- [ ] **Response Status**: HTTP 200
- [ ] **Response Structure**:
  ```json
  {
    "success": true,
    "message": "Business alerts completed",
    "timestamp": "2025-01-19T...",
    "results": [
      {
        "user_id": "...",
        "alert_type": "low_runway",
        "sent": true,
        "subscription_count": 1
      }
    ]
  }
  ```

---

## 5. Security Tests

### 5.1 CRON_SECRET Validation
- [ ] **No Secret Header**:
  - Call endpoint without `x-cron-secret` header
  - Expected: HTTP 401 response
  - Check: `{"error": "Unauthorized: Invalid or missing cron secret"}`

- [ ] **Wrong Secret**:
  - Call endpoint with invalid `x-cron-secret` value
  - Expected: HTTP 401 response

- [ ] **Correct Secret**:
  - Call endpoint with correct secret
  - Expected: HTTP 200, normal processing

### 5.2 RLS Policy Testing
- [ ] **User A can only see their own data**:
  - As User A, query another user's costs
  - Expected: 0 results (RLS blocks)

- [ ] **Service role bypasses RLS**:
  - Cron endpoint (service role) can insert costs for any user
  - Expected: Costs created successfully

### 5.3 Edge Function Security
- [ ] **Missing ALPHALOG_WEB_URL**:
  - Remove env var from Edge Function settings
  - Trigger function (manually or via cron)
  - Expected: HTTP 500 with error about missing variables

- [ ] **Missing CRON_SECRET**:
  - Remove env var from Edge Function settings
  - Trigger function
  - Expected: HTTP 500 with error about missing variables

---

## 6. Integration Tests

### 6.1 End-to-End Recurring Costs Flow
1. [ ] Create a recurring cost template (via Dashboard or API)
2. [ ] Verify template fields (amount, category, day_of_month, start_month, active)
3. [ ] Call recurring-costs endpoint
4. [ ] Verify cost created in `business_costs` table
5. [ ] Verify cost has `is_recurring_instance=true` and template_id set
6. [ ] Verify `last_generated_month` updated on template
7. [ ] Call endpoint again (same day)
8. [ ] Verify no duplicate cost created

### 6.2 End-to-End Alert Flow
1. [ ] Create LLC info with annual_report_due_month
2. [ ] Create push subscription for user
3. [ ] Add business data (trades/costs)
4. [ ] Call alerts endpoint
5. [ ] If runway < threshold: verify push notification received (check browser notification or logs)
6. [ ] If current month is due month: verify annual report notification
7. [ ] Check `business_alert_history` records created
8. [ ] Verify alerts not sent twice (cooldown works)

### 6.3 Error Handling
- [ ] Endpoint handles Supabase errors gracefully (returns 500, not 503)
- [ ] Endpoint handles missing user data (no crashes, logs warning)
- [ ] Endpoint handles invalid template data (skips, logs reason)
- [ ] Endpoint handles push failures gracefully (continues processing other users)

---

## 7. Manual Testing via Supabase Dashboard

### 7.1 Test Recurring Costs Function
1. Go to **Supabase Dashboard → Edge Functions → business-recurring-costs**
2. Click **Test** (or **Invoke**)
3. Check **Function logs** for execution:
   ```
   [Business Recurring Costs] Starting at 2025-01-19
   [Business Recurring Costs] Completed: X created, Y skipped, Z errors
   ```
4. Verify return status is 200

### 7.2 Test Alerts Function
1. Go to **Supabase Dashboard → Edge Functions → business-alerts**
2. Click **Test**
3. Check **Function logs** for execution:
   ```
   [Business Alerts] Starting at 2025-01
   [Business Alerts] Completed: N alerts processed
   ```
4. Verify return status is 200

### 7.3 Check Scheduled Execution
1. Go to **Supabase Dashboard → Edge Functions → business-recurring-costs → Scheduled**
2. Verify schedule is **"10 0 * * *"** (00:10 UTC daily)
3. Check **Recent executions** tab:
   - Should show execution history
   - Check status (success/failure)
   - Review logs for any issues

4. Repeat for business-alerts function with schedule **"15 0 * * *"**

---

## 8. Monitoring & Logs

### 8.1 Supabase Function Logs
**View in Dashboard → Edge Functions → [function] → Logs**

- [ ] Check for errors related to environment variables
- [ ] Check for database connection errors
- [ ] Look for any PGRST (PostgREST) errors
- [ ] Verify functions complete within timeout (300s)

### 8.2 Next.js Application Logs
```bash
# If running locally:
npm run dev
# Check console output for cron endpoint logs

# In production:
# Check your hosting platform's logs (Vercel, Netlify, etc.)
```

- [ ] Verify CRON_SECRET validation logs
- [ ] Check Supabase query logs for success/failure
- [ ] Verify response JSON structure matches spec

### 8.3 Database Activity
**In Supabase SQL Editor:**

```sql
-- Check recently created costs
SELECT id, user_id, amount, is_recurring_instance, template_id, created_at
FROM business_costs
WHERE created_at > NOW() - INTERVAL '1 day'
ORDER BY created_at DESC;

-- Check alert history
SELECT id, user_id, alert_type, alert_month, subscriptions_sent, created_at
FROM business_alert_history
WHERE created_at > NOW() - INTERVAL '1 day'
ORDER BY created_at DESC;

-- Check template updates
SELECT id, last_generated_month, updated_at
FROM business_cost_templates
WHERE updated_at > NOW() - INTERVAL '1 day'
ORDER BY updated_at DESC;
```

---

## 9. Performance Testing

### 9.1 Endpoint Response Time
- [ ] Recurring costs endpoint: should complete < 5s (with < 50 templates)
- [ ] Alerts endpoint: should complete < 5s (with < 100 users)
- [ ] Monitor Supabase query performance in Dashboard → Performance

### 9.2 Database Query Performance
```sql
-- Verify indexes are used (EXPLAIN ANALYZE)
EXPLAIN ANALYZE
SELECT * FROM business_cost_templates
WHERE user_id = 'USER_UUID' AND active = true AND deleted_at IS NULL;

-- Should show "Index Scan" not "Seq Scan"
```

- [ ] Template lookups use index
- [ ] Cost inserts complete quickly (< 100ms each)

---

## 10. Rollback Testing

### 10.1 Disable Scheduled Functions
**If issues arise:**

1. **Disable Recurring Costs Schedule**:
   - Go to **Supabase Dashboard → Edge Functions → business-recurring-costs → Scheduled**
   - Uncheck **"Enable schedule"** or delete schedule
   - Endpoint still works if called directly, but won't run automatically

2. **Disable Alerts Schedule**:
   - Go to **Supabase Dashboard → Edge Functions → business-alerts → Scheduled**
   - Uncheck **"Enable schedule"**

3. **Test with manual trigger**:
   ```bash
   # After making fixes:
   curl -H "x-cron-secret: YOUR_SECRET" http://localhost:3000/api/cron/business/recurring-costs
   ```

### 10.2 Revert Function Code
```bash
# If function has critical bug:
git revert [commit-hash]

# Or manually delete and redeploy:
supabase functions delete business-recurring-costs
supabase functions delete business-alerts
# Fix code...
supabase functions deploy business-recurring-costs
supabase functions deploy business-alerts
```

### 10.3 Remove Database Changes
```sql
-- If needed, drop the new table:
DROP TABLE IF EXISTS business_alert_history;

-- Restore old llc_info schema (if changed):
-- Schema already had columns, no destructive changes
```

---

## 11. Sign-Off Checklist

Before marking Sprint 9.4 complete:

- [ ] All environment variables configured
- [ ] Database schema migrated successfully
- [ ] Supabase Edge Functions deployed
- [ ] Edge Functions scheduled correctly
- [ ] Next.js cron endpoints respond with 200 OK
- [ ] Recurring costs generated without duplicates
- [ ] Alerts sent with proper cooldown
- [ ] RLS policies tested (users can only see their own data)
- [ ] CRON_SECRET authentication working
- [ ] Error handling tested (graceful failures)
- [ ] Response JSON matches spec
- [ ] Function logs reviewed (no errors)
- [ ] Manual testing completed (test cases passed)
- [ ] Performance acceptable (< 5s endpoint response)
- [ ] Rollback plan documented and tested

---

## 12. Known Limitations & Future Improvements

### Current Limitations:
1. **Runway calculation**: Uses simple 3-month average (no seasonal adjustment)
2. **Cost allocation**: KPI costs use proportional by trade count (configurable in future)
3. **Alert frequency**: Once per month (low runway), once per year (annual report)
4. **No manual trigger UI**: Alerts/recurring costs only via cron (manual call possible with curl)

### Future Enhancements:
- [ ] Add manual trigger button in Business Dashboard
- [ ] Configurable alert thresholds per user
- [ ] Webhook support for other services (Slack, email)
- [ ] Expense forecasting for runway projections
- [ ] Daily/weekly alert variations
- [ ] Integration with calendar for event-based alerts
