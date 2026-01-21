# Sprint 4.4 Deployment Guide

**Sprint**: 4.4 - TradeHub Evidence Vault + Playbook  
**Date**: 2026-01-17  
**Environment**: Staging → Production  

---

## Pre-Deployment Verification

### 1. Build Check
```bash
cd /path/to/alphalog-pwa
npm run build

# Expected Output:
# ✓ Compiled successfully in 2.5s
# ✓ All 32 routes recognized
# ✓ /api/tradehub/evidence routes present
```

### 2. Code Review
- [x] No console.error() left in code
- [x] No TODO comments blocking deployment
- [x] All imports resolved
- [x] No hardcoded secrets or keys
- [x] RLS policies properly formatted

### 3. Git Status
```bash
git status  # Should be clean or have only documentation changes
git log --oneline -5  # Verify recent commits
```

---

## Database Migration

### Step 1: Backup (Production Only)
```bash
# Create backup before migration
supabase projects list
# Note your project ID
supabase db pull --project-ref <project-id>  # Creates supabase/backup/
```

### Step 2: Preview Migration
```bash
# Dry-run to see what will be applied
supabase db push --dry-run

# Expected output should show:
# migration/006_tradehub_evidence_playbook.sql will be applied
# Table tv_analysis_evidence will be created
# 4 RLS policies will be created
# 3 indexes will be created
# 1 trigger will be created
```

### Step 3: Apply Migration
```bash
# Apply the migration
supabase db push

# Expected output:
# ✓ Migration applied successfully
# ✓ Tables synced
# ✓ RLS policies enabled
```

### Step 4: Verify Schema
```bash
# Connect to database and verify
supabase db push --skip-seed

# Verify tables:
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';

# Expected: Should include 'tv_analysis_evidence'
```

### Step 5: Verify RLS
```bash
-- Connect as authenticated user
SELECT * FROM tv_analysis_evidence;  -- Should return 0 rows initially

-- Verify RLS policies exist:
SELECT policy_name FROM pg_policies WHERE tablename = 'tv_analysis_evidence';

-- Expected policies:
-- - tv_analysis_evidence_select_policy
-- - tv_analysis_evidence_insert_policy
-- - tv_analysis_evidence_update_policy
-- - tv_analysis_evidence_delete_policy
```

---

## Deployment Steps

### Option A: Staging Environment First (Recommended)

```bash
# 1. Deploy to staging
git push origin sprint-4-4-evidence-vault  # Push feature branch

# 2. Trigger staging deployment (CI/CD)
# (Depends on your CI/CD pipeline)

# 3. Update Supabase staging project
export SUPABASE_PROJECT_ID=<staging-project-id>
supabase link --project-ref $SUPABASE_PROJECT_ID
supabase db push

# 4. Test staging environment
# (See QA Testing section below)
```

### Option B: Direct to Production

```bash
# 1. Verify build is passing
npm run build

# 2. Merge to main branch
git checkout main
git pull origin main
git merge sprint-4-4-evidence-vault

# 3. Backup production database
export SUPABASE_PROJECT_ID=<production-project-id>
supabase projects list  # Find production project ID
supabase db pull --project-ref $SUPABASE_PROJECT_ID

# 4. Apply migration
supabase link --project-ref $SUPABASE_PROJECT_ID
supabase db push --dry-run  # Preview first

# 5. Confirm and apply
supabase db push

# 6. Deploy code
git push origin main  # Triggers production deployment (if using CI/CD)
# Or manually deploy to hosting (Vercel, AWS, etc.)

# 7. Smoke test production
# (See QA Testing section below)
```

---

## QA Testing (Post-Deployment)

### Quick Smoke Tests (5 minutes)

#### 1. Evidence Upload
```
1. Go to /dashboard/tradehub
2. Click "📁 Evidence Vault" tab
3. Click "+ Subir Evidencia"
4. Upload small PNG image (≤10MB)
5. Fill date: today
6. Optional: Add account/trade link
7. Click Upload
8. ✅ Image appears in list with "🔍 needs_review" status
```

#### 2. Status Update
```
1. Click evidence card in list
2. Click status dropdown
3. Select "✅ valid"
4. ✅ Status updates immediately
5. ✅ Status indicator changes to ✅
```

#### 3. Soft-Delete
```
1. Click evidence card
2. Click "Delete" button
3. Confirm deletion
4. ✅ Evidence disappears from list
```

#### 4. Playbook Stats
```
1. Go to /dashboard/tradehub
2. Click "📖 Playbook" tab
3. ✅ Setup list loads
4. Click setup card to expand
5. ✅ Stats display correctly:
   - Total trades shown
   - Win rate calculated
   - P&L aggregated
6. ✅ Recent trades list visible
```

### Comprehensive QA Tests (1 hour)

See [TESTING_CHECKLIST.md](../TESTING_CHECKLIST.md) Sprint 4.4 section for full 120+ test scenarios.

**Key tests**:
- [ ] File validation (>100MB rejected)
- [ ] Extension blocking (.exe, .bat rejected)
- [ ] RLS enforcement (2 users can't see each other's data)
- [ ] Stats accuracy (setup with known trades validates correctly)
- [ ] Signed URL expiry (image fails after 60s)

### Performance Testing

```bash
# Lighthouse audit
1. Open /dashboard/tradehub
2. DevTools → Lighthouse
3. Run audit
4. Expected: ≥90 performance score
```

---

## Rollback Plan

### If Deployment Fails

#### Option 1: Revert Code Only
```bash
# If database is fine, just code is broken
git revert <sprint-4-4-commit>
git push origin main

# Or manually restore previous version from backup
git checkout <previous-stable-commit>
npm install
npm run build
# Deploy
```

#### Option 2: Revert Database Only
```bash
# If code is fine, database migration failed
supabase db pull --project-ref <project-id>  # Get current schema
# Manually drop tv_analysis_evidence table and dependent objects
# Or restore from backup:
supabase projects restore --project-ref <project-id> --backup-id <backup-id>
```

#### Option 3: Full Rollback
```bash
# If both code and database need rollback
git revert <sprint-4-4-commit>
git push origin main

# Restore database from backup
supabase projects restore --project-ref <project-id> --backup-id <backup-id>

# Verify
npm run build  # Should succeed
supabase db push --dry-run  # Should show no changes
```

---

## Post-Deployment Checklist

### Immediate (Same Day)
- [ ] Build successful (0 errors)
- [ ] Database migration applied
- [ ] Smoke tests pass (all 4)
- [ ] No error logs in console
- [ ] Users can upload evidence
- [ ] Playbook stats display correctly
- [ ] All 4 TradeHub tabs visible and functional

### Within 24 Hours
- [ ] Full QA testing completed (120+ scenarios)
- [ ] RLS enforcement verified (2-user test)
- [ ] File validation working (100MB, .exe/.bat)
- [ ] Signed URL expiry working (60s)
- [ ] Performance acceptable (Lighthouse ≥90)
- [ ] No production errors reported

### Within 1 Week
- [ ] User feedback collected
- [ ] Any bugs documented in KNOWN_ISSUES.md
- [ ] Performance metrics tracked
- [ ] Capacity planning verified (storage usage)

---

## Monitoring & Observability

### Logs to Monitor
```bash
# Application logs
# /api/tradehub/evidence errors:
- File size validation failures (400)
- Extension blocking (400)
- FK verification failures (404)
- RLS enforcement failures (401)
- Storage upload failures (500)

# Database logs
# tv_analysis_evidence table:
- INSERT failures (NOT NULL constraint)
- UPDATE failures (CHECK constraint on validation_status)
- DELETE failures (cascade/constraint)

# Storage logs
# log_attachments bucket:
- Upload failures (quota, permissions)
- Signed URL generation failures
```

### Metrics to Track
```
- Evidence uploads per day
- Evidence deletion rate (churn)
- Playbook setup count
- Playbook stats calculation time
- Signed URL hit rate
- File size distribution (bytes)
- File type distribution (MIME types)
- RLS policy enforcement rate
```

### Alerts to Set Up
```
- Evidence upload failure rate > 1%
- Average setup count < 1 (might indicate bug)
- Signed URL failures > 10 per day
- Database query time for playbook > 500ms
```

---

## Rollback Triggers

Deploy rollback if any of these occur:

### Critical (Immediate Rollback)
- [ ] Build fails to compile
- [ ] Database migration doesn't apply
- [ ] Users cannot upload evidence (500 error)
- [ ] Playbook shows incorrect stats (calculation bug)
- [ ] RLS policy blocks authorized users (false positive)
- [ ] Evidence deleted prematurely (data loss)

### Major (Investigate, Then Rollback)
- [ ] Upload file validation bypass (security)
- [ ] File size limit not enforced
- [ ] Extension blocking not working
- [ ] Signed URL generation fails
- [ ] Storage quota exceeded

### Minor (Monitor, No Rollback)
- [ ] UI display issue (missing icons)
- [ ] Performance slower than expected
- [ ] User feedback about UX

---

## Communication

### Deployment Announcement
```
Subject: Sprint 4.4 Deployment - Evidence Vault + Playbook

Hi team,

Sprint 4.4 is being deployed to [ENVIRONMENT] on [DATE] at [TIME].

New Features:
✅ Evidence Vault: Upload and validate trading analysis images
✅ Playbook: Real-time setup performance analytics
✅ TradeHub now has 4 tabs (Cuentas, New Trades Log, Evidence, Playbook)

Database Changes:
- New table: tv_analysis_evidence (with RLS policies)
- Migration: 006_tradehub_evidence_playbook.sql

Testing:
- Build: ✓ PASSING
- QA: In progress (120+ test scenarios)
- Expected downtime: None (rolling deployment)

Rollback Plan:
- If issues: git revert + database restore
- Time to rollback: < 10 minutes

Questions? Contact: [TEAM_CONTACT]
```

### Post-Deployment Notification
```
Sprint 4.4 deployed successfully! 🚀

✓ Evidence Vault available in TradeHub
✓ Playbook analytics live
✓ All 4 tabs functional
✓ RLS enforcement verified

Known Issues: None
Next steps: User feedback collection
```

---

## Deployment Checklist (Final)

### Pre-Deployment
- [ ] Code review completed
- [ ] Build passing (npm run build)
- [ ] No breaking changes
- [ ] Database backup created
- [ ] Migration syntax verified
- [ ] RLS policies correct
- [ ] Documentation updated
- [ ] Team notified

### During Deployment
- [ ] Database migration applied
- [ ] Code deployed to hosting
- [ ] Environment variables configured
- [ ] All API routes accessible
- [ ] Database connections working
- [ ] Storage connections working

### Post-Deployment
- [ ] Smoke tests pass
- [ ] No error logs
- [ ] Monitoring alerts configured
- [ ] Team notified (success)
- [ ] Rollback plan ready (just in case)

---

## Support

### Troubleshooting

**Issue**: Evidence upload fails with 413 error
```
Solution: Check file size, must be ≤100MB
- npm run build to verify build
- Check API route: /api/tradehub/evidence
```

**Issue**: Signed URL returns 404
```
Solution: Image may have been deleted or URL expired
- Verify file exists in storage bucket
- Regenerate signed URL (60s validity)
```

**Issue**: Playbook shows 0 trades
```
Solution: Check if setups exist and have trades
- Verify GET /api/tradehub/setups returns data
- Verify GET /api/tradehub/trades returns data
- Check RLS policies allow access
```

**Issue**: RLS blocks authorized user
```
Solution: Check auth context and session
- Verify auth token present
- Verify auth.uid() matches user_id in DB
- Check RLS policy SQL syntax
```

### Contacts

- **Frontend**: [FRONTEND_CONTACT]
- **Backend/Database**: [BACKEND_CONTACT]
- **DevOps/Infrastructure**: [DEVOPS_CONTACT]
- **Product**: [PRODUCT_CONTACT]

---

## Appendix: File Locations

### Key Files for Sprint 4.4

**Database**:
- Migration: `supabase/migrations/006_tradehub_evidence_playbook.sql`

**Components**:
- EvidenceVault: `src/components/tradehub/EvidenceVault.client.tsx`
- Playbook: `src/components/tradehub/Playbook.client.tsx`

**API Routes**:
- GET/POST: `src/app/api/tradehub/evidence/route.ts`
- PATCH/DELETE: `src/app/api/tradehub/evidence/[id]/route.ts`
- Signed URL: `src/app/api/tradehub/evidence/signed-url/route.ts`

**Page**:
- TradeHub: `src/app/dashboard/tradehub/page.tsx`

**Documentation**:
- APP_MAP.md: Evidence + Playbook sections
- TESTING_CHECKLIST.md: Sprint 4.4 tests
- SPRINT_4_4_SUMMARY.md: Technical summary
- SPRINT_4_4_COMPLETION_CHECKLIST.md: Development checklist

---

**Deployment Date**: [TO BE FILLED]  
**Deployed By**: [TO BE FILLED]  
**Approval**: [TO BE FILLED]  

