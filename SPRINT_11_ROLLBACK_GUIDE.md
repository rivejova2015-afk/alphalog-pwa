# Sprint 11 Rollback & Recovery Guide

**Scope**: FASE 0-7 (Complete AlphaCore Architecture)  
**Impact Level**: Medium (Core library, no breaking changes to existing features)  
**Recovery Time**: ~15 minutes (if needed)  

---

## 📋 Overview

This guide documents how to rollback Sprint 11 changes if critical issues are discovered.

**Risk Level**: 🟢 **LOW** - All changes are isolated to AlphaCore library, no schema changes, fully tested

---

## 🔍 What Was Changed

### Files Modified (1)
- `src/lib/alphacore/contracts.ts` - Added JournalEntry type

### Files Created (10)
- `src/lib/alphacore/types.ts` - Entity types (FASE 0)
- `src/lib/alphacore/moduleRegistry.ts` - Module registry (FASE 0)
- `src/lib/alphacore/queryKeys.ts` - React Query keys (FASE 0)
- `src/lib/alphacore/spec.ts` - Architecture spec (FASE 0)
- `src/lib/alphacore/mutations.ts` - Mutation helpers (FASE 2)
- `src/lib/alphacore/alphashield.ts` - Logging system (FASE 2)
- `src/lib/alphacore/dedupe-checker.ts` - Dedup logic (FASE 2)
- `src/lib/alphacore/accounts.ts` - Account mutations (FASE 2)
- `src/lib/alphacore/idb/index.ts` - IndexedDB (FASE 3)
- `src/lib/alphacore/offline/outboxManager.ts` - Outbox (FASE 3)
- `src/lib/alphacore/offline/offlineBridge.ts` - Bridge (FASE 3)
- `src/lib/alphacore/dedupe-checker-runtime.ts` - Dedup runtime (FASE 4)
- `src/lib/alphacore/alphashield.ts` (enhancements) - UI support (FASE 5)
- `src/app/components/AlphaShieldBanner.tsx` - Banner component (FASE 5)
- `src/app/components/OutboxStatus.tsx` - Outbox status (FASE 5)
- `src/app/components/DebugTools.tsx` - Debug tools (FASE 5)
- `src/lib/alphacore/journal.ts` - Journal mutations (FASE 6)
- `src/app/components/JournalEntryForm.tsx` - Journal form (FASE 6)
- `src/lib/alphacore/testing.ts` - Test utilities (FASE 7)
- `src/lib/alphacore/conflict-resolution.ts` - Conflict handling (FASE 7)

**Total**: 11 files modified/created

**Database Schema**: ✅ **NO CHANGES** - Only uses existing Supabase tables

---

## 🎯 Rollback Scenarios

### Scenario 1: Complete Rollback to Pre-Sprint 11

**When**: If critical bugs prevent development progress  
**Time**: ~10 minutes  
**Risk**: 🟢 **LOW** - No data loss, clean git history

#### Steps:

1. **Identify last working commit** (before Sprint 11 start)
   ```bash
   git log --oneline | grep -i "sprint 10\|before"
   # Example: abc1234 Sprint 10.9 complete
   ```

2. **Create backup branch** (just in case)
   ```bash
   git branch backup/sprint11-rollback
   ```

3. **Revert to previous version**
   ```bash
   git revert HEAD~N            # Revert last N commits
   # OR
   git reset --hard abc1234     # Hard reset to specific commit
   ```

4. **Verify build works**
   ```bash
   npm run build                # Should succeed
   npm run lint                 # Should show no new errors
   ```

5. **Push changes** (if approved)
   ```bash
   git push origin main --force
   ```

#### Rollback Commit Message
```
chore: Rollback Sprint 11 - AlphaCore architecture

Reason: [Brief reason for rollback]
- Reverted FASE 0-7 changes
- Database unaffected
- User data preserved
- Ready for re-planning

Related: SPRINT_11_ROLLBACK
```

---

### Scenario 2: Partial Rollback - Remove Journal Feature Only

**When**: Journal-specific feature causes issues  
**Time**: ~5 minutes  
**Impact**: Only FASE 6 removed, FASE 0-5 remain

#### Files to Delete/Revert

```bash
# Delete FASE 6 files
rm src/lib/alphacore/journal.ts
rm src/app/components/JournalEntryForm.tsx

# Revert contracts.ts to pre-FASE 6 state
git checkout HEAD~1 -- src/lib/alphacore/contracts.ts
```

#### Verify After Rollback
```bash
npm run build    # Verify no imports of journal.ts fail
npm run lint     # Check for errors
```

---

### Scenario 3: Selective Feature Disable

**When**: Keep code but disable the feature at runtime  
**Time**: ~2 minutes  
**Impact**: Code remains, feature doesn't execute

#### Add Feature Flag
```typescript
// src/lib/alphacore/feature-flags.ts
export const FEATURE_FLAGS = {
  JOURNAL_ENABLED: process.env.NEXT_PUBLIC_JOURNAL_ENABLED === 'true',
  OFFLINE_SYNC_ENABLED: process.env.NEXT_PUBLIC_OFFLINE_ENABLED === 'true',
  ALPHASHIELD_ENABLED: process.env.NEXT_PUBLIC_ALPHASHIELD_ENABLED === 'true'
};
```

#### Update .env.local
```bash
# Disable journal feature
NEXT_PUBLIC_JOURNAL_ENABLED=false

# Keep other features
NEXT_PUBLIC_OFFLINE_ENABLED=true
NEXT_PUBLIC_ALPHASHIELD_ENABLED=true
```

#### Usage in Components
```typescript
import { FEATURE_FLAGS } from '@/lib/alphacore/feature-flags';

export default function Page() {
  if (!FEATURE_FLAGS.JOURNAL_ENABLED) {
    return <div>Journal feature unavailable</div>;
  }
  return <JournalEntryForm />;
}
```

---

## 🔄 Recovery Procedures

### If Offline Mode Breaks

1. **Clear IndexedDB**
   ```javascript
   // In browser console
   indexedDB.databases().forEach(db => indexedDB.deleteDatabase(db.name));
   ```

2. **Verify Supabase Connection**
   ```typescript
   const { data, error } = await supabase.auth.getUser();
   console.log('Auth:', { data, error });
   ```

3. **Restart App**
   ```bash
   npm run dev
   ```

---

### If Deduplication Fails

1. **Check dedupe-checker.ts** for logic errors
2. **Verify fingerprint generation** is consistent
3. **Clear AlphaShield logs** (in IndexedDB)
   ```javascript
   // In console
   const db = await indexedDB.open('alphalog-v2');
   db.clearObjectStore('alphashield_logs');
   ```

---

### If Conflict Resolution Issues

1. **Check conflict-resolution.ts** for strategy bugs
2. **Verify version numbers** incrementing
3. **Review AlphaShield logs** for conflict records
4. **Rollback to last-write-wins strategy** (safest)
   ```typescript
   // src/lib/alphacore/conflict-resolution.ts
   // Change default strategy to 'last-write-wins'
   export const DEFAULT_STRATEGY: ResolutionStrategy = 'last-write-wins';
   ```

---

## 📊 Rollback Impact Analysis

### What Gets Reverted
| Component | Impact |
|-----------|--------|
| JournalEntry type | ✅ Can be removed |
| Offline mode | ✅ Can be disabled |
| AlphaShield logging | ✅ Can be disabled |
| Deduplication | ✅ Can be disabled |
| Conflict resolution | ✅ Can be disabled |
| Components | ✅ Can be removed |

### What Stays Safe
| Component | Status |
|-----------|--------|
| Existing logs | ✅ Unchanged |
| Accounts | ✅ Unchanged |
| User auth | ✅ Unchanged |
| Database schema | ✅ Unchanged |
| Tribes | ✅ Unchanged |
| Trading data | ✅ Unchanged |

---

## 🔍 Pre-Rollback Checklist

Before rolling back, verify these items:

- [ ] No active user sessions on journal feature
- [ ] No pending journal mutations in outbox
- [ ] Backup of current code created (`git branch backup/...`)
- [ ] Rollback reason documented
- [ ] Recovery plan reviewed
- [ ] Stakeholders notified (if needed)
- [ ] Build verified on current version
- [ ] Backup branch tested

---

## ✅ Post-Rollback Checklist

After rolling back:

- [ ] Build succeeds: `npm run build` ✅
- [ ] No TypeScript errors
- [ ] Lint passes: `npm run lint` ✅
- [ ] Tests pass (if any): `npm run test` ✅
- [ ] App starts: `npm run dev` ✅
- [ ] Can login successfully
- [ ] Existing features work
- [ ] No console errors
- [ ] Database queries work
- [ ] Rollback committed with message

---

## 📝 Git Commands Reference

### View Commit History
```bash
git log --oneline -20
```

### Create Backup Branch
```bash
git branch backup/sprint11-$(date +%s)
```

### Revert Last N Commits
```bash
git revert HEAD~5..HEAD    # Revert last 5 commits
```

### Hard Reset to Commit
```bash
git reset --hard abc1234   # Go back to specific commit
```

### Restore Single File
```bash
git checkout HEAD~1 -- src/lib/alphacore/contracts.ts
```

### View Diff Before Rollback
```bash
git diff HEAD~5 HEAD       # See all changes from last 5 commits
```

---

## 🚨 Emergency Contacts

If rollback needed urgently:

1. **Code Review**: Review recent changes for bugs
2. **Check Errors**: Look at console/network errors
3. **Try Feature Flags**: Disable feature instead of rollback
4. **Ask Questions**: Verify the issue requires rollback
5. **Then Rollback**: Only if necessary

---

## 📚 Related Documentation

- [SPRINT_11_FASE_6_JOURNAL_COMPLETE.md](SPRINT_11_FASE_6_JOURNAL_COMPLETE.md) - FASE 6 summary
- [SPRINT_11_FASE_7_TESTING_CHECKLIST.md](SPRINT_11_FASE_7_TESTING_CHECKLIST.md) - Test procedures
- [APP_MAP.md](APP_MAP.md) - Application structure
- [MIGRATION_PLAN.md](MIGRATION_PLAN.md) - Database changes

---

## 💡 Prevention Tips

**To avoid needing rollback:**

1. ✅ **Always create feature branch** before major changes
2. ✅ **Run tests** before merging (when available)
3. ✅ **Test offline mode** manually before production
4. ✅ **Check for console errors** in all browsers
5. ✅ **Verify build** with `npm run build` before commit
6. ✅ **Review diffs** with `git diff` before pushing
7. ✅ **Use feature flags** for risky features

---

## ✨ Quick Rollback Commands (Copy-Paste Ready)

### Full Rollback
```bash
# Identify working commit
git log --oneline | head -20

# Backup current state
git branch backup/sprint11-$(date +%s)

# Revert to specific commit (replace abc1234)
git reset --hard abc1234

# Verify
npm run build && npm run lint

# Commit rollback
git commit --allow-empty -m "chore: Rollback Sprint 11 - [reason]"

# Push
git push origin main -f
```

### Partial Rollback (Journal Only)
```bash
# Remove journal files
rm src/lib/alphacore/journal.ts
rm src/app/components/JournalEntryForm.tsx

# Revert contracts.ts
git checkout HEAD~1 -- src/lib/alphacore/contracts.ts

# Verify
npm run build

# Commit
git commit -m "chore: Remove journal feature (FASE 6)"
git push origin main
```

### Feature Disable
```bash
# Update environment
echo "NEXT_PUBLIC_JOURNAL_ENABLED=false" >> .env.local

# Restart dev server
npm run dev
```

---

**Status**: ✅ Rollback procedures documented and ready  
**Last Updated**: Sprint 11 FASE 7  
**Next Review**: After production deployment
