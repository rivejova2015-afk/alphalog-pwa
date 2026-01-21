# Sprint 10.6–10.9 Rollback Plan

**Date**: January 19, 2026  
**Scope**: Complete rollback guide for AlphaShield sprints  
**Last Updated**: January 19, 2026  

---

## Quick Summary

If you need to rollback **one or more** of Sprints 10.6–10.9, this guide provides step-by-step instructions.

**Expected time**: 5-30 minutes depending on scope

---

## Prerequisites

Before rollback:
```bash
# 1. Stop dev server (if running)
# Ctrl+C in terminal

# 2. Verify git is clean
git status
# Should show no uncommitted changes, or you'll lose them

# 3. Backup current state (optional but recommended)
git stash
# or
git commit -m "WIP: Backup before rollback"
```

---

## Level 1: Quick Fixes (Without Rollback)

Try these first before rolling back entire sprints:

### Fix 1: Clear Build Cache
```bash
# Remove Next.js build cache
rm -rf .next/

# Clear node_modules cache
rm -rf node_modules/.cache/

# Rebuild
npm run build
```

### Fix 2: Verify Environment
```bash
# Check .env.local has correct values
cat .env.local | grep -E "SUPABASE|E2E_"

# Check test user exists in Supabase
# (Go to Supabase dashboard → Auth → Users)

# Check database migrations applied
# (Supabase dashboard → SQL → Check 016_app_logs.sql exists)
```

### Fix 3: Clear Database State
```bash
# Delete test logs (if needed)
# In Supabase SQL editor:
DELETE FROM app_logs 
WHERE user_id = '[TEST_USER_ID]' 
AND created_at < NOW() - INTERVAL '1 day';

# Reset auth session
# Clear browser cookies:
# Chrome DevTools → Application → Cookies → Delete alphalog domain
```

### Fix 4: Reinstall Dependencies
```bash
# Clear node_modules
rm -rf node_modules/
rm package-lock.json

# Reinstall
npm install

# Rebuild
npm run build
npm run test:e2e
```

---

## Level 2: Partial Rollback (Remove Tests Only)

**Keep**: app_logs, logger, UI  
**Remove**: Playwright tests, test scripts

### Steps

```bash
# 1. Remove test files
rm -rf tests/e2e/
rm playwright.config.ts

# 2. Update package.json
# Remove these scripts:
#   - test:e2e
#   - test:e2e:debug
#   - test:e2e:ui
#   - test:e2e:report
# Keep verify:all but without test:e2e

# 3. Update package.json dependency
# Remove: "@playwright/test": "^1.40.0"

# 4. Reinstall dependencies
npm install

# 5. Verify build
npm run build

# 6. Verify verify:all works (now just: build + audit)
npm run verify:all
```

### Using Editor

**Via file editing**:
```bash
# Edit package.json
# Find "scripts" section, remove test:e2e commands
# Find "devDependencies", remove @playwright/test
# Save and npm install
```

---

## Level 3: Remove Logs System (Keep Tests)

**Keep**: Playwright tests  
**Remove**: app_logs, logger, ingest API, UI

### Steps

```bash
# 1. Remove API routes
rm -rf src/app/api/logs/

# 2. Remove logger library
rm src/lib/logger.ts

# 3. Remove UI components
rm -rf src/components/logs/

# 4. Remove logs pages
rm -rf src/app/dashboard/logs/system/

# 5. Remove or comment out migration
# In Supabase:
# - Go to SQL editor
# - Drop table: DROP TABLE IF EXISTS app_logs CASCADE;
# - Or just don't run migrations on next deploy

# 6. Rebuild
npm run build

# 7. Tests should still work
npm run test:e2e
```

**Optional**: Remove from MIGRATION_PLAN.md references to Sprint 10.7

---

## Level 4: Complete Rollback (All 4 Sprints)

**Remove**: Everything from Sprints 10.6–10.9

### Steps

```bash
# 1. Remove test files & config
rm -rf tests/e2e/
rm playwright.config.ts

# 2. Remove logs system
rm -rf src/app/api/logs/
rm src/lib/logger.ts
rm -rf src/components/logs/
rm -rf src/app/dashboard/logs/system/

# 3. Remove from package.json
# All test scripts, audit script (optional)
# @playwright/test dependency
# Keep basic scripts only: dev, build, start, lint

# 4. Update .env.example
# Remove: E2E_EMAIL, E2E_PASSWORD, PLAYWRIGHT_BASE_URL

# 5. Update .gitignore
# Remove test artifact lines:
# /test-results/
# /playwright-report/
# /blob-report/
# /playwright/.cache/

# 6. Reinstall
npm install

# 7. Verify build
npm run build

# 8. Remove documentation (optional)
rm SPRINT_10_9_*.md
rm SPRINT_10_8_*.md
rm SPRINT_10_6_*.md
rm SPRINT_10_7_*.md
rm docs/SPRINT_AUDIT.md
rm docs/SPRINT_10_6-10_9_ROLLBACK_PLAN.md

# 9. Revert TESTING_CHECKLIST.md to previous version
git checkout -- TESTING_CHECKLIST.md
```

---

## Using Git for Rollback

### Option A: Revert Last N Commits

```bash
# See recent commits
git log --oneline -20

# Revert last commit (creates new commit)
git revert HEAD

# Or revert multiple commits
git revert HEAD~0..HEAD~3

# Verify
npm run build
```

### Option B: Hard Reset to Specific Commit

**⚠️ WARNING: This deletes changes. Back up first.**

```bash
# Find commit before Sprint 10.6 started
git log --oneline | grep -E "10.5|before.*10.6"

# Reset to that commit
git reset --hard [COMMIT_HASH]

# Verify
npm run build
```

### Option C: Create New Branch (Safe)

```bash
# Create branch at current point
git branch backup-current

# Check out previous version
git checkout [PREVIOUS_COMMIT_HASH]

# Or revert to tag
git checkout v1.0.0  # if you have version tags
```

---

## File-by-File Rollback

If you only want to revert specific files:

```bash
# Revert single file to previous version
git checkout HEAD~1 -- src/app/api/logs/ingest/route.ts

# Revert multiple files
git checkout HEAD~1 -- src/app/api/logs/
git checkout HEAD~1 -- package.json

# See what changed
git diff

# Apply changes
git add .
git commit -m "Partial rollback of Sprint 10.6-10.9"
```

---

## Database Rollback

### Remove app_logs Table (Supabase)

```sql
-- Option 1: Drop table completely
DROP TABLE IF EXISTS public.app_logs CASCADE;

-- Option 2: Keep table, delete data
DELETE FROM app_logs WHERE created_at < NOW();

-- Option 3: Drop function/triggers if used
DROP FUNCTION IF EXISTS cleanup_app_logs() CASCADE;
```

### Undo Migration

```bash
# In local Supabase:
supabase db push --dry-run  # Preview changes
supabase db reset           # Reset to initial state
```

### On Production Supabase

```bash
# Contact Supabase support to:
# 1. Drop table manually via SQL editor
# 2. Or restore from backup
```

---

## Verification After Rollback

### Test Build
```bash
npm run build
# Should succeed with 0 errors
```

### Test Existing Features
```bash
npm run dev

# Visit http://localhost:3000
# Test that other features still work:
# - Login
# - Dashboard
# - Create logs (if not removing logs system)
# - Other modules
```

### Check for Orphaned References
```bash
# Search for references to removed files
grep -r "import.*logger" src/ || echo "No logger imports"
grep -r "test:e2e" . --include="*.md" --include="*.json"
grep -r "app_logs" src/ --include="*.tsx" --include="*.ts"
```

---

## Rollback by Sprint

### Sprint 10.6 Only (Audit + verify:all)

**What it changed**:
- package.json: Added audit:sprints, verify:all scripts
- scripts/sprint-audit.js: New file
- docs/SPRINT_AUDIT.md: Generated

**To rollback**:
```bash
# Option 1: Simple revert
git revert HEAD

# Option 2: Manual
# 1. Remove verify:all and audit:sprints from package.json
# 2. Keep sprint-audit.js (doesn't hurt)
# 3. Delete docs/SPRINT_AUDIT.md
npm install  # Update lockfile
```

### Sprint 10.7 Only (app_logs + logger)

**What it changed**:
- supabase/migrations/016_app_logs.sql: New migration
- src/app/api/logs/: New API routes
- src/lib/logger.ts: New logger library

**To rollback**:
```bash
# 1. Remove migration
rm supabase/migrations/016_app_logs.sql

# 2. Delete table in Supabase
# (See Database Rollback section above)

# 3. Remove code
rm -rf src/app/api/logs/
rm src/lib/logger.ts

# 4. Rebuild
npm run build
```

### Sprint 10.8 Only (UI /dashboard/logs/system)

**What it changed**:
- src/app/dashboard/logs/system/: New UI page
- src/components/logs/: New components

**To rollback**:
```bash
# 1. Remove UI
rm -rf src/app/dashboard/logs/system/

# 2. Optionally remove component library
rm -rf src/components/logs/

# 3. Rebuild
npm run build
```

### Sprint 10.9 Only (Playwright Tests)

**What it changed**:
- tests/e2e/: New test files
- playwright.config.ts: New config
- package.json: Added test scripts

**To rollback**:
```bash
# 1. Remove tests
rm -rf tests/e2e/
rm playwright.config.ts

# 2. Update package.json
# Remove test scripts and @playwright/test

# 3. Reinstall
npm install
npm run build
```

---

## Common Issues During Rollback

### Issue 1: Build Fails After Rollback

**Symptom**: `npm run build` fails with errors

**Solution**:
```bash
# 1. Clear cache
rm -rf .next/

# 2. Reinstall dependencies
rm -rf node_modules/
npm install

# 3. Rebuild
npm run build
```

### Issue 2: Tests Still Fail

**Symptom**: `npm run test:e2e` fails after rollback

**Solution**:
```bash
# 1. Verify test files removed
ls tests/e2e/
# Should be empty or not exist

# 2. Verify package.json doesn't reference @playwright/test
grep playwright package.json

# 3. Reinstall and rebuild
npm install
npm run build
```

### Issue 3: Database Errors

**Symptom**: "Relation app_logs doesn't exist"

**Solution**:
```bash
# 1. Verify table dropped in Supabase
# Go to Supabase dashboard → Tables
# Check app_logs is not listed

# 2. If still there, drop it:
-- In Supabase SQL editor:
DROP TABLE IF EXISTS public.app_logs CASCADE;

# 3. Restart dev server
npm run dev
```

### Issue 4: Git Conflicts

**Symptom**: `git revert` shows conflicts

**Solution**:
```bash
# 1. See conflicts
git status

# 2. Resolve manually (edit files)

# 3. Mark resolved
git add [RESOLVED_FILES]

# 4. Complete revert
git revert --continue

# 5. Or abort if too complex
git revert --abort
```

---

## Testing Rollback Plan

**Before doing actual rollback**, test the process:

```bash
# 1. Create backup branch
git branch backup-before-rollback

# 2. Test rollback on current branch
rm -rf tests/e2e/  # etc.
npm run build

# 3. If something breaks, switch back
git checkout backup-before-rollback

# 4. If all works, keep rollback
```

---

## Emergency Rollback (When Everything Breaks)

**If the app is completely broken**:

```bash
# Option 1: Reset to known good state
git reset --hard v1.0.0  # Or previous version

# Option 2: Start fresh from backup
rm -rf .git/ .next/ node_modules/
git clone [BACKUP_REPO] .

# Option 3: Contact team lead
# They may have a recovery procedure
```

---

## Documentation Cleanup

After rollback, update documentation:

```bash
# Remove Sprint 10.6-10.9 docs
rm SPRINT_10_9_*.md
rm SPRINT_10_8_*.md
rm SPRINT_10_7_*.md
rm SPRINT_10_6_*.md

# Update TESTING_CHECKLIST.md
# Remove Sprint 10.6-10.9 sections

# Update START_HERE.md
# Remove references to new features

# Update README.md
# Remove feature descriptions if applicable
```

---

## Rollback Checklist

Before considering rollback complete:

- [ ] Build succeeds (`npm run build`)
- [ ] No TypeScript errors
- [ ] Dev server starts (`npm run dev`)
- [ ] Can login to app
- [ ] Can navigate to dashboard
- [ ] Existing features still work
- [ ] No console errors
- [ ] Tests pass (if keeping tests)
- [ ] Documentation updated
- [ ] Team notified

---

## Support & Questions

**If you're unsure about anything**:

1. **Check git history**: `git log --oneline -20`
2. **See what changed**: `git diff HEAD~1 HEAD`
3. **Ask team lead**: Before making changes
4. **Make backup first**: `git stash` or `git branch backup`

---

## Summary

| Action | Time | Risk | Recommended |
|--------|------|------|-------------|
| Quick fixes | 5 min | Low | YES - Try first |
| Remove tests only | 10 min | Low | For test issues |
| Remove logs system | 15 min | Medium | For logs issues |
| Complete rollback | 30 min | High | Only if broken |
| Database reset | 20 min | High | Backup first |

---

**Sprint 10.6–10.9 Rollback Plan**  
**Created**: January 19, 2026  
**Updated**: January 19, 2026  
**Status**: Ready for use  

