# Sprint 9.4 Quick Start Guide

**Status**: Code complete, ready for deployment  
**Last Updated**: [Now]  
**Next Step**: Follow deployment steps below

---

## The TL;DR

Sprint 9.4 adds **automatic recurring costs** + **push alerts for low runway & annual reports**.

**Files Created**: 
- 2 Supabase Edge Functions (scheduler triggers)
- 2 Next.js cron endpoints (business logic)
- 1 database migration (alert tracking table)

**What Works**:
- Templates auto-generate monthly costs (no duplicates)
- Low runway alerts notify users (3-month threshold, monthly cooldown)
- Annual report alerts notify users (yearly cooldown)
- All code follows existing Treasury pattern

**What's Missing**:
- Database migration not applied yet
- Edge Functions not deployed to Supabase
- Edge Function schedules not configured
- No manual testing done yet

---

## 5-Minute Setup (Development)

### 1. Configure Secrets

```bash
# In your .env.local file (add these):
CRON_SECRET=aBc1D2eF3gH4iJ5kL6mN7oPq8rStUvWxYzAbCdEfGhIj==
SUPABASE_SERVICE_ROLE_KEY=[get from Supabase Dashboard > Settings > API > Service Role Key]
RUNWAY_THRESHOLD_MONTHS=3
ALPHALOG_WEB_URL=http://localhost:3000
```

### 2. Apply Database Migration

```bash
# Option A (using CLI):
supabase db push

# Option B (manual): Copy lines from 014_business_core.sql starting at "CREATE TABLE business_alert_history" and run in Supabase SQL Editor
```

### 3. Deploy Edge Functions

```bash
supabase functions deploy business-recurring-costs
supabase functions deploy business-alerts
```

### 4. Configure Schedules (Supabase Dashboard)

Go to **Edge Functions**:

- **business-recurring-costs**: 
  - Cron: `10 0 * * *` (daily 00:10 UTC)
  - Timeout: 300s
  
- **business-alerts**: 
  - Cron: `15 0 * * *` (daily 00:15 UTC)
  - Timeout: 300s

Also set environment variables in Edge Functions Settings:
- `ALPHALOG_WEB_URL=http://localhost:3000`
- `CRON_SECRET=[same value as .env.local]`

---

## Quick Test (2 minutes)

```bash
# Test 1: Verify security (should return 401)
curl http://localhost:3000/api/cron/business/recurring-costs

# Test 2: Test with secret (should return 200)
curl -H "x-cron-secret: YOUR_CRON_SECRET_VALUE" \
  http://localhost:3000/api/cron/business/recurring-costs

# Expected response (success):
# {
#   "success": true,
#   "message": "Recurring costs generation completed",
#   "timestamp": "2025-01-15T00:10:23Z",
#   "currentMonth": "2025-01",
#   "summary": {
#     "created": 5,
#     "skipped": 2,
#     "errors": 0,
#     "total": 7
#   }
# }
```

---

## Files at a Glance

```
✅ CREATED:
  supabase/functions/business-recurring-costs/index.ts
  supabase/functions/business-alerts/index.ts
  src/app/api/cron/business/recurring-costs/route.ts
  src/app/api/cron/business/alerts/route.ts
  SPRINT_9_4_TESTING_CHECKLIST.md
  SPRINT_9_4_IMPLEMENTATION_GUIDE.md (this guide's companion)

✅ MODIFIED:
  supabase/migrations/014_business_core.sql (added alert tracking table)
  .env.example (added new env variables)

🔄 STILL PENDING:
  - Database migration execution
  - Edge Function deployment
  - Schedule configuration
  - Manual testing
  - Production deployment
```

---

## Key Environment Variables

| Variable | Purpose | Example |
|----------|---------|---------|
| `CRON_SECRET` | Validates requests to cron endpoints | `aBc1D2eF...` (32+ chars) |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin database access for cron | From Supabase Dashboard |
| `ALPHALOG_WEB_URL` | Public URL Edge Functions use to call endpoints | `http://localhost:3000` or `https://alphalog.io` |
| `RUNWAY_THRESHOLD_MONTHS` | When to alert (runway < this many months) | `3` |

**⚠️ IMPORTANT**: `CRON_SECRET` must be identical in:
1. `.env.local` (Next.js)
2. Supabase Edge Functions → Settings

---

## How It Works (Simple)

### Recurring Costs Flow:
```
Supabase (cron: 10 0 * * *)
    ↓
business-recurring-costs Edge Function
    ↓
Edge Function calls: GET /api/cron/business/recurring-costs
    ↓ (with x-cron-secret header)
Next.js validates secret + loads templates
    ↓
For each template where last_generated_month != current month:
  - Create business_cost entry
  - Update template.last_generated_month
    ↓
Return: created/skipped/error counts
```

### Alerts Flow:
```
Supabase (cron: 15 0 * * *)
    ↓
business-alerts Edge Function
    ↓
Edge Function calls: GET /api/cron/business/alerts
    ↓ (with x-cron-secret header)
Next.js calculates runway for all users
    ↓
Check conditions:
  1. Low Runway: runway < 3 months + not alerted this month
  2. Annual Report: due_month == current month + not alerted this year
    ↓
For matching users:
  - Send push notification
  - Record in business_alert_history (prevent spam)
    ↓
Return: users alerted by type
```

---

## Common Tasks

### Add New Recurring Cost Template
```sql
INSERT INTO business_cost_templates (
  user_id, amount, category, description, vendor, 
  day_of_month, start_month, active
) VALUES (
  '[USER_UUID]',
  99.99,
  'Tools Software',
  'Monthly subscription',
  'Vendor Name',
  1,
  '2025-01',
  true
);
```

Next day at 00:10 UTC, cron will automatically create the cost.

### Trigger Cron Manually (Development)
```bash
# Recurring costs
curl -H "x-cron-secret: $CRON_SECRET" \
  http://localhost:3000/api/cron/business/recurring-costs

# Alerts
curl -H "x-cron-secret: $CRON_SECRET" \
  http://localhost:3000/api/cron/business/alerts
```

### Check If Cron Ran
```sql
-- For recurring costs
SELECT COUNT(*) FROM business_costs 
WHERE is_recurring_instance = true 
AND DATE(created_at) = CURRENT_DATE;

-- For alerts
SELECT * FROM business_alert_history 
WHERE DATE(created_at) = CURRENT_DATE
ORDER BY created_at DESC;
```

### Prevent Duplicate Cost Generation
Already handled! The code checks `last_generated_month` field.  
Even if cron runs twice same day, only 1 cost is created per template.

### Test Push Notifications
```bash
# Alerts endpoint will try to send to all user subscriptions
# If no subscriptions exist, it logs "No subscriptions found"
# If subscription fails, it logs error but continues

# To verify a push was attempted, check endpoint response:
curl -H "x-cron-secret: $CRON_SECRET" \
  http://localhost:3000/api/cron/business/alerts | jq .
```

---

## Troubleshooting Quick Reference

| Problem | Solution |
|---------|----------|
| 401 Unauthorized | Check `x-cron-secret` header matches env var (exact case) |
| 500 Missing env vars | Set `ALPHALOG_WEB_URL` + `CRON_SECRET` in Edge Functions Settings |
| No costs created | Check template `active=true` + `last_generated_month != current month` |
| Costs duplicated | Shouldn't happen (last_generated_month prevents it) - if it does, check code |
| Alerts not sending | Check user has push subscriptions + check business_alert_history table |
| Cron never runs | Verify schedule is enabled in Supabase Dashboard |

---

## Next Steps (In Order)

- [ ] 1. Set environment variables (.env.local)
- [ ] 2. Run `supabase db push` (apply migration)
- [ ] 3. Run `supabase functions deploy business-recurring-costs`
- [ ] 4. Run `supabase functions deploy business-alerts`
- [ ] 5. Configure schedules in Supabase Dashboard (cron expressions)
- [ ] 6. Test endpoints with curl (see above)
- [ ] 7. Monitor logs tomorrow (check if cron ran automatically)
- [ ] 8. Follow SPRINT_9_4_TESTING_CHECKLIST.md for comprehensive testing
- [ ] 9. Commit to git

---

## For Complete Details

See: **SPRINT_9_4_IMPLEMENTATION_GUIDE.md** (full deployment walkthrough with production steps)

---

## Questions?

1. **How to generate CRON_SECRET?**
   ```bash
   openssl rand -base64 32
   ```

2. **Where to find Service Role Key?**
   Supabase Dashboard → Project Settings → API → Find "service_role" key

3. **How to verify migration was applied?**
   ```sql
   SELECT * FROM information_schema.tables 
   WHERE table_name = 'business_alert_history';
   ```

4. **Can I run cron manually?**
   Yes! Use curl with x-cron-secret header (see Quick Test above)

5. **Will functions run if I'm offline?**
   No. They require internet connection to Supabase and .

6. **Can I disable functions temporarily?**
   Yes. Supabase Dashboard → Edge Functions → [function] → Scheduled → toggle off

---

**Ready to deploy?** Start with the 5-Minute Setup above.
