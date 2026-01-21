# AlphaShield Logging - 30-Day Retention Setup

## Overview

The `app_logs` table stores application logs for 30 days. After 30 days, old logs are automatically deleted to maintain database performance and storage costs.

## Retention Strategy

There are two recommended approaches:

### Option A: Supabase Scheduled SQL (Recommended)

Supabase provides native scheduled SQL jobs (cron). This is the recommended approach as it:
- Runs directly in Postgres (no external service needed)
- Automatically configured in the database
- No API keys or CRON_SECRET needed
- Simple and reliable

**Setup Steps:**

1. Go to Supabase Dashboard → SQL Editor
2. Create a new query with this SQL:

```sql
-- Create scheduled job to delete logs older than 30 days
SELECT cron.schedule(
  'cleanup-app-logs',
  '0 2 * * *', -- Daily at 2 AM UTC
  $$
    DELETE FROM public.app_logs
    WHERE created_at < NOW() - INTERVAL '30 days'
    AND deleted_at IS NULL
  $$
);
```

3. Execute the query
4. Verify in Extensions tab that pg_cron is enabled

**To view scheduled jobs:**
```sql
SELECT * FROM cron.job;
```

**To remove the job:**
```sql
SELECT cron.unschedule('cleanup-app-logs');
```

### Option B: External Scheduler (if Supabase cron unavailable)

If your Supabase plan doesn't include cron, use an external scheduler:

**Setup Steps:**

1. Add to `.env.local`:
```
CRON_SECRET=your-secret-token-here
```

2. Configure scheduler to call:
```
POST /api/logs/cleanup
Authorization: Bearer <CRON_SECRET>
```

**Scheduler options:**

- **Vercel Cron**: Add to `vercel.json`
```json
{
  "crons": [
    {
      "path": "/api/logs/cleanup",
      "schedule": "0 2 * * *"
    }
  ]
}
```

- **Supabase Edge Functions**: Create function that calls the endpoint
- **AWS Lambda**: Scheduled Lambda that calls the endpoint
- **n8n**: Webhook trigger with schedule
- **cron-job.org**: Free external cron service

**Example curl:**
```bash
curl -X POST https://yourapp.com/api/logs/cleanup \
  -H "Authorization: Bearer $CRON_SECRET"
```

## Monitoring

### Check logs being cleaned up

```sql
-- View logs from past 31 days
SELECT COUNT(*), MIN(created_at), MAX(created_at) 
FROM app_logs 
WHERE created_at > NOW() - INTERVAL '31 days';

-- View old logs (about to be deleted)
SELECT id, user_id, level, area, created_at 
FROM app_logs 
WHERE created_at < NOW() - INTERVAL '30 days'
LIMIT 10;
```

### Verify cleanup ran

```sql
-- Check logs after last 30 days
SELECT COUNT(*) FROM app_logs 
WHERE created_at < NOW() - INTERVAL '30 days';
-- Should return 0 if cleanup is working
```

## Storage Impact

Estimated usage (assuming 100 logs/user/day):

- **1 user**: ~3,000 logs/month = ~300 KB
- **100 users**: ~300,000 logs/month = ~30 MB
- **1,000 users**: ~3M logs/month = ~300 MB

With 30-day retention, you'll maintain ~10-300 MB depending on user count.

## Retention Duration

To change retention from 30 days to another duration:

**Supabase cron (SQL):**
```sql
-- Change to 60 days
SELECT cron.schedule(
  'cleanup-app-logs',
  '0 2 * * *',
  $$
    DELETE FROM public.app_logs
    WHERE created_at < NOW() - INTERVAL '60 days'
  $$
);
```

**API endpoint (route.ts):**
Change this line in `src/app/api/logs/cleanup/route.ts`:
```typescript
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30); // Change 30 to your value
```

## Soft Deletes

Note: The cleanup process respects `deleted_at` (soft deletes):

```sql
-- Only delete logs that haven't been soft-deleted
WHERE created_at < NOW() - INTERVAL '30 days'
AND deleted_at IS NULL
```

To hard-delete soft-deleted logs immediately:

```sql
DELETE FROM public.app_logs
WHERE deleted_at IS NOT NULL
AND deleted_at < NOW() - INTERVAL '7 days'; -- Hard delete after 7 days of soft delete
```

## Testing Cleanup

To test cleanup in development:

**1. Adjust cron schedule to run more frequently:**

```sql
SELECT cron.schedule(
  'cleanup-app-logs-test',
  '*/1 * * * *', -- Every minute (for testing)
  $$
    DELETE FROM public.app_logs
    WHERE created_at < NOW() - INTERVAL '1 minute'
  $$
);
```

**2. Or manually call the API:**

```bash
curl -X POST http://localhost:3000/api/logs/cleanup \
  -H "Authorization: Bearer test-secret" \
  -H "Content-Type: application/json"
```

(Make sure CRON_SECRET=test-secret in your .env.local)

## Alerts

### Set up alerts for cleanup failures

**Supabase Alerts (if available):**
1. Go to Supabase Dashboard → Monitoring
2. Create alert for failed cron jobs

**Manual monitoring:**
```sql
-- Check when cleanup last ran
SELECT NOW() - MAX(created_at) as hours_since_latest_log
FROM app_logs;
-- Should be less than 2 hours if cleanup runs every 2 hours
```

## Disaster Recovery

If you need to restore deleted logs:

1. **Supabase backup**: Check if automatic backups are enabled
   - Go to Dashboard → Settings → Backups
   - Download point-in-time recovery

2. **Manual backup**: Before running cleanup, export logs:
```bash
supabase db pull --schema-only > backup.sql
```

## Related Files

- **Migration**: `supabase/migrations/016_app_logs.sql`
- **Logger**: `src/lib/alphashield/logger.ts`
- **Ingest API**: `src/app/api/logs/ingest/route.ts`
- **Cleanup Endpoint**: `src/app/api/logs/cleanup/route.ts` (optional)

## Next Steps

1. Choose retention strategy (Recommended: Supabase cron)
2. Set up cleanup job
3. Monitor via SQL queries
4. Test in staging before production

---

**Retention Window**: 30 days  
**Recommended Cleanup**: Daily at 2 AM UTC  
**Storage**: ~300 KB per user per month (100 logs/day)
