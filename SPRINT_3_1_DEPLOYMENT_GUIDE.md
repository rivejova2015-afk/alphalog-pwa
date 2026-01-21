# SPRINT 3.1 DEPLOYMENT GUIDE

## Pre-Deployment Checklist

- [ ] Supabase project is active and accessible
- [ ] `.env.local` has `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] Git branch is clean (no uncommitted changes)
- [ ] Migration file exists: `supabase/migrations/002_logs_schema.sql`

---

## Step 1: Apply Migration

### Option A: Using Supabase CLI (Recommended)
```bash
# From project root
cd c:\Users\rivej\Documents\alphalog-pwa

# Link to Supabase project (if not already linked)
supabase link --project-ref <your-project-id>
# Find project-ref in Supabase dashboard → Settings → General

# Preview what will be applied
supabase db push --dry-run

# Apply the migration
supabase db push
```

**Expected output**:
```
Applying 002_logs_schema.sql...
✓ Migration applied successfully
Tables created: categories, tags, logs, log_tags, log_attachments
Triggers created: 5
Policies created: 20+
```

### Option B: Manual (Supabase Dashboard)
1. Open [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Navigate to: **SQL Editor** (left sidebar)
4. Click **New query**
5. Copy entire content from `supabase/migrations/002_logs_schema.sql`
6. Paste into editor
7. Click **Run** (top right)
8. Verify success: "Query executed successfully"

---

## Step 2: Verify Migration Applied

### In Supabase Dashboard (SQL Editor)
Run these commands to verify:

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name IN 
('categories', 'tags', 'logs', 'log_tags', 'log_attachments');
-- Expected: 5 rows

-- Check RLS is enabled
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' AND tablename IN 
('categories', 'tags', 'logs', 'log_tags', 'log_attachments');

-- Check triggers exist
SELECT trigger_name FROM information_schema.triggers 
WHERE trigger_schema = 'public' AND trigger_name LIKE '%_set_updated_at%';
-- Expected: 5 triggers

-- Check policies exist
SELECT COUNT(*) FROM information_schema.table_constraints 
WHERE table_schema = 'public';
-- Expected: many rows with different constraint types
```

### From Next.js Console (Dev Environment)
```typescript
// In browser console or server action:
const supabase = createClient(); // from @/lib/supabase/browser or server

// Test categories table
const { data, error } = await supabase
  .from('categories')
  .select('*');

if (error) {
  console.error('RLS blocking or table error:', error);
} else {
  console.log('✓ Categories table accessible:', data);
}
```

---

## Step 3: Create Storage Bucket (Manual)

**Important**: Storage policies must be set up manually or via script.

### Via Supabase Dashboard:
1. Go to: **Storage** (left sidebar)
2. Click **New bucket**
3. Name: `log_attachments`
4. **Public**: No (keep private)
5. Click **Create**

### Add Policies to Bucket (Optional - Can be done later)
1. Click bucket `log_attachments`
2. Go to **Policies** tab (right side)
3. Click **New policy**
4. Choose: **For SELECT**
   - Role: authenticated
   - Using expression: `bucket_id = 'log_attachments' and auth.uid()::text = split_part(name, '/', 1)`
5. Repeat for INSERT and DELETE with same expression

**Alternative**: Leave policies unset for now (will handle in Sprint 3.2 with API endpoint)

---

## Step 4: Run Tests

### Quick Smoke Test (5 min)
```bash
npm run dev
# In terminal, you should see: "Ready in XXms"
```

Then test in browser:

```javascript
// Open DevTools console
const { data, error } = await fetch('/api/health').then(r => r.json());
console.log(data); // Should be { ok: true, ts: <timestamp> }
```

### Full Test Suite (Optional - TESTING_CHECKLIST.md)
See [TESTING_CHECKLIST.md](TESTING_CHECKLIST.md) section "Sprint 3.1: Logs & Categories" for 50+ manual test cases.

---

## Step 5: Build & Verify

```bash
# Build for production
npm run build

# Should complete without errors
# Expected output: "Compiled successfully"
```

---

## Rollback Procedure (If Needed)

### If migration hasn't been applied yet:
```bash
# Just don't run:
supabase db push

# Or delete the migration file (keep in git history):
rm supabase/migrations/002_logs_schema.sql
```

### If migration was already applied to Supabase:

#### Option A: Via CLI
```bash
# Create rollback migration
# File: supabase/migrations/003_rollback_logs.sql
# (Content provided below)

# Then apply:
supabase db push
```

#### Option B: Manual (SQL Editor)
Copy this entire SQL and run in Dashboard → SQL Editor:

```sql
-- 003_rollback_logs.sql
-- Rollback Sprint 3.1: drop tables and triggers

-- Drop triggers first
DROP TRIGGER IF EXISTS log_attachments_set_updated_at ON public.log_attachments;
DROP TRIGGER IF EXISTS logs_set_updated_at ON public.logs;
DROP TRIGGER IF EXISTS tags_set_updated_at ON public.tags;
DROP TRIGGER IF EXISTS categories_set_updated_at ON public.categories;

-- Drop tables (cascade handles FK)
DROP TABLE IF EXISTS public.log_attachments CASCADE;
DROP TABLE IF EXISTS public.log_tags CASCADE;
DROP TABLE IF EXISTS public.logs CASCADE;
DROP TABLE IF EXISTS public.tags CASCADE;
DROP TABLE IF EXISTS public.categories CASCADE;

-- Verify
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name IN 
('categories', 'tags', 'logs', 'log_tags', 'log_attachments');
-- Expected: 0 rows
```

---

## Troubleshooting

### Error: "relation does not exist"
**Cause**: Migration wasn't applied  
**Fix**: Run `supabase db push` again

### Error: "permission denied for schema public"
**Cause**: Using wrong API key (service role instead of anon)  
**Fix**: Verify `.env.local` has `NEXT_PUBLIC_SUPABASE_ANON_KEY` (not SERVICE_ROLE_KEY)

### Error: "new row violates row-level security policy"
**Cause**: Trying to create log with different user_id in RLS-enabled table  
**Expected**: Use `auth.uid()` from session, not hardcoded UUID

### Error: "violates unique constraint logs_user_title_day_uq"
**Cause**: Trying to create duplicate log (same title, same day UTC)  
**Expected**: Change title or wait until next day

### Storage bucket not accessible
**Cause**: Policies not set, or bucket is public  
**Fix**: Check bucket settings → Policies → verify SELECT/INSERT/DELETE for authenticated users

---

## Next Steps

1. ✅ Migration applied
2. ✅ Tables verified
3. ⏳ Create API endpoints (Sprint 3.2)
   - `POST /api/categories`
   - `POST /api/logs`
   - `POST /api/logs/{id}/attachments`
   - etc.
4. ⏳ Build frontend components (Sprint 3.3)

---

## Support

If issues arise:
1. Check [TROUBLESHOOTING.md](../TROUBLESHOOTING.md)
2. Review [SPRINT_3_1_SUMMARY.md](SPRINT_3_1_SUMMARY.md)
3. Check Supabase logs: Dashboard → Logs (bottom left)
4. Verify RLS policies in: Dashboard → Authentication → Policies

**Last Updated**: 2026-01-17
