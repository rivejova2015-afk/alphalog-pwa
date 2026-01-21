# 🔄 Sprint 4.7 - Rollback Guide

**In case of critical issues**, use this guide to revert changes.

---

## 📋 FILES CREATED (Safe to Delete)

These are new files. If you need to rollback completely:

```bash
# Remove Safe Data Layer
rm src/lib/safe.ts
rm src/lib/log.ts

# Remove useAutoRefresh Hook
rm src/hooks/useAutoRefresh.ts

# Remove Error Boundary
rm src/app/dashboard/terminal/error.tsx

# Remove Documentation
rm SPRINT_4_7_ANTI_BUG_SYSTEM.md
rm SPRINT_4_7_TESTING_GUIDE.md
rm SPRINT_4_7_QUICK_START.md
```

---

## 📝 FILES MODIFIED (Can be Reverted via Git)

These files were refactored. Use git to revert:

```bash
# Revert specific files
git restore src/components/terminal/CalendarPanel.client.tsx
git restore src/components/terminal/EvidenceReports.client.tsx
git restore src/components/terminal/NewsPanel.client.tsx
git restore src/components/logs/SeedCategoriesButton.client.tsx

# OR revert all changes from this sprint
git reset --hard HEAD~1  # Go back 1 commit (if committed as single commit)
```

---

## 🎯 Partial Rollback (If Specific Component Broke)

### If CalendarPanel broke:
```bash
git restore src/components/terminal/CalendarPanel.client.tsx
npm run dev
```

### If EvidenceReports broke:
```bash
git restore src/components/terminal/EvidenceReports.client.tsx
npm run dev
```

### If NewsPanel broke:
```bash
git restore src/components/terminal/NewsPanel.client.tsx
npm run dev
```

### If SeedCategoriesButton broke:
```bash
git restore src/components/logs/SeedCategoriesButton.client.tsx
npm run dev
```

---

## 🔧 Minimal Rollback (Keep Utilities, Revert Components)

If you want to keep the Safe Data Layer but revert component changes:

```bash
# Keep:
# - src/lib/safe.ts ✅
# - src/lib/log.ts ✅
# - src/hooks/useAutoRefresh.ts ✅
# - src/app/dashboard/terminal/error.tsx ✅

# Revert:
git restore src/components/terminal/CalendarPanel.client.tsx
git restore src/components/terminal/EvidenceReports.client.tsx
git restore src/components/terminal/NewsPanel.client.tsx
git restore src/components/logs/SeedCategoriesButton.client.tsx

npm run dev
```

Then components will work with old logic, but you still have the utilities for future use.

---

## 🚨 Emergency: Full Revert to Previous Sprint

If everything is broken:

```bash
# Show commit history
git log --oneline | head -5

# Revert to previous commit (assuming sprint 4.6)
git reset --hard <commit-hash-of-sprint-4-6>

# OR if you just committed this sprint:
git reset --hard HEAD~1
```

---

## ✅ Verification After Rollback

```bash
# Clean build
rm -r .next
npm run build

# If build passes
npm run dev

# Check http://localhost:3000/dashboard/terminal
# Should work (possibly with old bugs, but stable)
```

---

## 📊 What Was Changed

### Added (New Files):
- `src/lib/safe.ts` (98 lines)
- `src/lib/log.ts` (50 lines)
- `src/hooks/useAutoRefresh.ts` (280 lines)
- `src/app/dashboard/terminal/error.tsx` (65 lines)

### Modified (Existing Files):
- `src/components/terminal/CalendarPanel.client.tsx` (+35 lines)
- `src/components/terminal/EvidenceReports.client.tsx` (+60 lines)
- `src/components/terminal/NewsPanel.client.tsx` (+35 lines)
- `src/components/logs/SeedCategoriesButton.client.tsx` (+80 lines)

**Total Impact**: +493 lines added, 4 files modified

---

## ⏱️ Estimated Rollback Time

| Scenario | Time | Command |
|----------|------|---------|
| Full revert (git) | <1 min | `git reset --hard HEAD~1` |
| Delete new files | <1 min | `rm src/lib/*.ts src/hooks/*.ts src/app/.../error.tsx` |
| Revert 4 components | <1 min | `git restore src/components/...` |
| Clean rebuild | ~30 sec | `rm -r .next && npm run build` |

---

## 🔑 Key Points

- **New files are harmless**: If you don't use them, they don't execute
- **useAutoRefresh hook** is not attached to anything unless you import it
- **Error boundary** only activates if there's an error in that segment
- **safe.ts and log.ts** are utilities, not auto-executing
- **Reverting components only** is the safest partial rollback

---

## ❓ FAQs

**Q: If I delete safe.ts, will components break?**
- A: Only if they import it. The 4 modified components do import it, so keep it if you keep those components.

**Q: Can I keep useAutoRefresh but not use it?**
- A: Yes, it's inert unless imported. You can keep it for future sprints.

**Q: Is there a git log to see what changed?**
- A: Yes: `git diff HEAD~1` (if committed) or `git status` (if uncommitted)

---

## 🎯 Decision Tree

```
Do you need to rollback?
│
├─ YES, completely (revert to sprint 4.6)
│  └─→ git reset --hard <previous-commit>
│
├─ YES, one component broke
│  └─→ git restore src/components/terminal/<ComponentName>.client.tsx
│
└─ NO, keep the code
   └─→ Continue with SPRINT_4_7_TESTING_GUIDE.md
```

---

**Emergency Contact**: Refer to SPRINT_4_7_ANTI_BUG_SYSTEM.md for architecture details

**Last Updated**: 2026-01-17
