# SPRINT 3.3 DEPLOYMENT GUIDE — Attachments Multi-Upload

**Purpose**: Step-by-step instructions to deploy attachments feature to production  
**Estimated Time**: 15-30 minutes  
**Prerequisites**: 
- Sprint 3.3 tests passing (QA sign-off)
- Production Supabase project ready
- Git repository up-to-date

---

## Pre-Deployment Checklist

- [ ] All tests in SPRINT_3_3_TESTING_GUIDE.md **PASS** (QA sign-off)
- [ ] Build succeeds: `npm run build` → "Compiled successfully"
- [ ] No TypeScript errors: `npm run build` → "TypeScript: OK"
- [ ] No runtime errors in console (manual testing on `npm run dev`)
- [ ] Code review completed
- [ ] Backup Supabase database (optional but recommended for production)

---

## Deployment Steps

### Step 1: Create Private Storage Bucket

**In Supabase Dashboard** (`https://app.supabase.com`):

1. Navigate to **Project → Storage → Buckets**
2. Click **"Create bucket"** (blue button)
3. Bucket name: `log_attachments`
4. Toggle **"Public bucket"** → OFF (must be private)
5. Leave other settings as default
6. Click **"Create bucket"**

**Verification**:
```bash
# In Supabase Dashboard → SQL Editor:
SELECT bucket_id, name, public FROM storage.buckets 
WHERE name = 'log_attachments';
-- Expected: 1 row with public = false
```

---

### Step 2: Verify Database Schema

**Check migration 002_logs_schema.sql is applied**:

```bash
# Option 1: Using Supabase CLI
supabase db push --dry-run  # Shows what would be applied
supabase db push           # Apply migrations (if not already applied)

# Option 2: Manual check in Supabase Dashboard → SQL Editor
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'log_attachments';
-- Expected: log_attachments table exists
```

**If migration not applied yet**:
```bash
# From project root:
supabase db push
# Follow prompts, wait for completion
```

---

### Step 3: Verify RLS Policies

```sql
-- In Supabase Dashboard → SQL Editor:
SELECT policyname, permissive, cmd 
FROM pg_policies 
WHERE tablename = 'log_attachments'
ORDER BY policyname;

-- Expected policies (should exist):
-- owner_select (SELECT)
-- owner_insert (INSERT)
-- owner_update (UPDATE)
-- owner_delete (DELETE)
```

If policies missing, apply them from `002_logs_schema.sql` (they should auto-apply with migration).

---

### Step 4: Deploy Code

```bash
# Verify no pending changes
git status
# Expected: "nothing to commit, working tree clean"

# If changes exist, commit them:
git add -A
git commit -m "Sprint 3.3: Attachments multi-upload feature"

# Push to main branch (or your deployment branch)
git push origin main

# (Or deploy via your CI/CD pipeline)
```

---

### Step 5: Build & Test in Production Environment

```bash
# Build for production
npm run build
# Expected: "Compiled successfully in X.Xs"
# Expected: "TypeScript: OK"
# Expected: New routes compiled:
#   - /api/attachments (Dynamic)

# Start production server (optional, test locally first)
npm run start
# Or deploy to production platform (Vercel, etc.)
```

---

### Step 6: Smoke Test in Production

After deployment:

1. **Access prod app**: https://your-prod-domain.com/dashboard/logs
2. **Create/edit log**: Ensure AttachmentsUploader visible
3. **Upload small file** (< 1MB):
   - Expected: File uploads successfully
   - Expected: Appears in AttachmentsList
4. **Try blocked extension**:
   - Upload .exe file
   - Expected: Error message in Spanish
5. **Delete attachment**:
   - Click 🗑️, confirm
   - Expected: Disappears from list
6. **Verify in Supabase**:
   - Check Storage: File in bucket
   - Check Database: Metadata in log_attachments table

---

### Step 7: Monitor & Verify

**Supabase Dashboard Checks**:

1. **Storage Usage**:
   - Navigate to **Project → Storage → Overview**
   - Expected: Usage increases as files uploaded
   - No quota exceeded errors

2. **Database Performance**:
   - Navigate to **Project → Database → Queries**
   - Expected: No slow queries (attachments lookups < 100ms)

3. **API Logs** (if available):
   - Navigate to **Project → Logs**
   - Expected: No 500 errors from `/api/attachments`
   - Expected: Auth checks passing (401 if unauthorized)

---

## Rollback Instructions

If issues arise in production:

### Quick Rollback (Code Only)

```bash
# Revert to previous commit
git log --oneline | head -5  # Find Sprint 3.3 commit
git revert <sprint-3.3-commit>
git push origin main

# Redeploy (site automatically redeploys on push)
```

### Full Rollback (Code + Disable Feature)

If you need to keep the database but disable the feature:

1. **Don't delete** database table/bucket (allows re-enabling later)
2. **Revert code** (removes components from LogEditor)
3. **Re-deploy** (feature hidden, data intact)

### Emergency: Delete Storage Bucket

If storage bucket is corrupted:

```bash
# In Supabase Dashboard → Storage:
1. Select bucket "log_attachments"
2. Click "Delete bucket"
3. Confirm
4. Re-create bucket (same steps as Step 1)
```

**Warning**: This deletes all files. Restore from backup if critical.

### Emergency: Clean Database

If `log_attachments` table corrupted:

```sql
-- In Supabase Dashboard → SQL Editor:
DELETE FROM public.log_attachments WHERE true;  -- Clear data, keep table
-- OR
DROP TABLE public.log_attachments;  -- Remove table completely
-- Then re-apply 002_logs_schema.sql via:
-- supabase db push
```

---

## Configuration for Production

### Environment Variables

Ensure `.env.local` (or your production `.env`) has:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Optional (usually auto-detected):
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # Only if needed for server actions
```

**Note**: Do NOT hardcode SUPABASE_STORAGE_BUCKET_NAME or MAX_FILE_MB in environment. They're constants in code.

---

## Optional: Set Storage Limits

### Per-Bucket Size Limit

```sql
-- In Supabase Dashboard → SQL Editor (if supported):
UPDATE storage.buckets 
SET file_size_limit = 10485760000  -- 10GB per bucket
WHERE name = 'log_attachments';
```

**Note**: Supabase may not support per-bucket limits. Check their docs.

### Per-User Storage Quota

(Not implemented in Sprint 3.3, but can be added later)

---

## Troubleshooting

### Bucket Not Found Error

**Error**: `bucket "log_attachments" not found`

**Solution**:
1. Verify bucket created in Supabase Dashboard
2. Verify bucket name spelled correctly (case-sensitive)
3. Check RLS policies are enabled on bucket (shouldn't block bucket existence)

### Permission Denied on Upload

**Error**: `403 Permission Denied` when uploading

**Likely Cause**: Bucket is public (wrong setting)

**Solution**:
```bash
# In Supabase Dashboard → Storage:
1. Select log_attachments bucket
2. Check "Public bucket" toggle is OFF
3. Click Update if toggled incorrectly
```

### Signed URLs Not Working

**Error**: 403 when accessing signed URL

**Likely Causes**:
1. URL expired (60-second window passed) → Generate new URL
2. Bucket is public (shouldn't need signed URL) → Set private
3. User not authenticated → Log in first

### Large File Upload Hangs

**Symptom**: Upload > 50MB stalls or times out

**Workaround**: 
- Implement chunked upload (TUS protocol) — future enhancement
- For now, recommend files < 100MB (tested up to this limit)

### Attachment Metadata Missing

**Symptom**: File in storage but not in database

**Likely Cause**: Database INSERT failed (network error during metadata save)

**Recovery**:
1. Open Supabase Storage, find orphaned file
2. Delete manually: Right-click → Delete
3. User can retry upload

---

## Performance Baseline

After deployment, typical performance metrics:

| Operation | Metric | Target |
|-----------|--------|--------|
| Upload 50MB file | Time | 10-30 seconds |
| Fetch attachment list (10 files) | Time | < 500ms |
| Generate signed URL | Time | < 100ms |
| Delete attachment | Time | < 1 second |
| List storage (1000 files) | Time | < 2 seconds |

**If slower**: Check Supabase project size, available CPU, network latency.

---

## Post-Deployment Monitoring

### Daily Checks (First Week)

- [ ] No error logs from `/api/attachments`
- [ ] Storage usage growing as expected (not explosive)
- [ ] Signed URLs working consistently
- [ ] No user-reported issues

### Weekly Checks (Ongoing)

- [ ] Storage quota not exceeded
- [ ] API response times stable
- [ ] RLS policies enforced (no unauthorized access in logs)
- [ ] Soft-deletes working (deleted_at column updated)

### Alert Triggers (Set Up Monitoring)

- [ ] Storage bucket usage > 80% of quota
- [ ] `/api/attachments` response time > 5 seconds
- [ ] `/api/attachments` error rate > 5%
- [ ] Large file upload failures

---

## Communication Checklist

Before going live:

- [ ] Notify stakeholders of new feature
- [ ] Inform users about:
  - 100MB file size limit per attachment
  - .exe, .bat files blocked (security)
  - 60-second signed URL expiry (normal, generates new on each access)
  - Soft-delete behavior (hidden, but can be recovered by developers)

---

## Success Criteria

Deployment successful if:

- ✅ `/dashboard/logs` loads without errors
- ✅ Can upload files to existing logs
- ✅ .exe/.bat files blocked
- ✅ Files appear in list with signed URLs
- ✅ Image previews render
- ✅ Delete works with confirmation
- ✅ Files appear in Supabase Storage bucket
- ✅ Metadata in database (log_attachments table)
- ✅ No console errors
- ✅ No API 500 errors in Supabase logs

---

## Maintenance

### Regular Backups

```bash
# Backup Supabase database (via dashboard or CLI):
supabase db pull  # Pulls schema
# Or use Supabase Dashboard: Project Settings → Backups
```

### Cleanup Soft-Deleted Files (Optional Task)

```sql
-- Periodically delete very old soft-deleted attachments to save space:
DELETE FROM public.log_attachments
WHERE deleted_at < now() - interval '90 days';

-- Also delete corresponding files from storage:
-- (Manual process via Supabase Dashboard → Storage)
```

### Monitor Bucket Growth

```sql
-- Monitor attachment size over time:
SELECT 
  DATE(created_at) as upload_date,
  COUNT(*) as file_count,
  SUM(size_bytes) / (1024*1024*1024)::numeric as total_gb
FROM public.log_attachments
WHERE deleted_at IS NULL
GROUP BY DATE(created_at)
ORDER BY upload_date DESC;
```

---

## Next Steps (Post-Sprint 3.3)

After successful deployment, consider:

1. **Attachment Sharing**: Add "Share link" button (public or with expiry)
2. **Bulk Operations**: Bulk delete, bulk download as ZIP
3. **Storage Quota**: Add per-user storage limits (e.g., 5GB max)
4. **Virus Scanning**: Integrate ClamAV or similar (enterprise feature)
5. **Search in Attachments**: Search logs by attachment filename
6. **Attachment Versioning**: Allow multiple versions of same file
7. **Drag-and-Drop**: Full drag-and-drop support in modal

---

**Deployment Guide Version**: 1.0  
**Created**: 2026-01-17  
**Last Updated**: 2026-01-17  
**Status**: READY FOR DEPLOYMENT
