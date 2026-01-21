# Sprint 10.8: AlphaShield UI — Quick Start Guide

**Status**: ✅ COMPLETE | **Build**: ✅ PASSING | **Ready**: ✅ YES

---

## 🚀 Quick Overview

Sprint 10.8 adds a **system diagnostics UI** to AlphaShield logging with safe mode detection.

### What's New
- ✅ `/dashboard/logs/system` — System health page
- ✅ Safe Mode — Auto-activates on 3 errors in 60 seconds
- ✅ Debug Bundle — Click to copy sanitized JSON
- ✅ Codex Prompt — Click to copy AI troubleshooting prompt
- ✅ System Diagnostics — Shows online/offline, SW, push, manifest
- ✅ Recent Errors — Lists latest 20 errors with auto-refresh

### Key Trigger
```
3 errors (level='error') in 60 seconds
    ↓
Safe Mode activates
    ↓
Orange banner appears on all dashboard pages
    ↓
Write operations disabled (Create/Save buttons)
    ↓
Click "Salir" to exit
```

---

## 📋 Files Summary

### New Components (7 files)

```
src/lib/alphashield/
├─ safeMode.ts (250 lines)        → Error loop detection
├─ debugBundle.ts (280 lines)     → Sanitized JSON generator
└─ codexPrompt.ts (300 lines)     → AI prompt generator

src/components/logs/
├─ SystemDiagnostics.client.tsx   → Status widget
├─ RecentErrors.client.tsx        → Error list
└─ ../SafeModeBanner.client.tsx   → Alert banner

src/app/dashboard/logs/system/
└─ page.tsx (180 lines)           → Main diagnostics page
```

### Integration Points (4 files modified)

```
src/lib/alphashield/
└─ logger.ts                  → Added callback support

src/app/dashboard/
└─ layout.tsx                 → Added SafeModeBanner

Root docs/
├─ APP_MAP.md                 → Updated AlphaShield section
└─ TESTING_CHECKLIST.md       → Added 10-point Sprint 10.8 tests
```

---

## 🔧 Quick Usage

### Check if Safe Mode is Active

```typescript
import { isSafeModeActive } from '@/lib/alphashield/safeMode';

if (isSafeModeActive()) {
  console.log('Safe Mode is ACTIVE - write operations disabled');
}
```

### Disable Writes (in any component)

```typescript
import { shouldDisableWrites } from '@/lib/alphashield/safeMode';

function CreateButton() {
  const disabled = shouldDisableWrites();
  
  return (
    <button disabled={disabled}>
      {disabled ? 'Unavailable (Safe Mode)' : 'Create'}
    </button>
  );
}
```

### Generate Debug Bundle

```typescript
import { generateDebugBundle, copyDebugBundleToClipboard } from '@/lib/alphashield/debugBundle';

async function handleCopyBundle() {
  const bundle = await generateDebugBundle();
  const success = await copyDebugBundleToClipboard(bundle);
  
  if (success) {
    console.log('✓ Debug bundle copied!');
  }
}
```

### Generate Codex Prompt

```typescript
import { generateCodexFixPrompt, copyPromptToClipboard } from '@/lib/alphashield/codexPrompt';
import { generateDebugBundle } from '@/lib/alphashield/debugBundle';

async function handleCopyPrompt() {
  const bundle = await generateDebugBundle();
  const prompt = await generateCodexFixPrompt(bundle);
  
  // Ready to paste into Claude/GPT
  await copyPromptToClipboard(prompt);
}
```

### Exit Safe Mode Manually

```typescript
import { disableSafeMode, resetErrorTracker } from '@/lib/alphashield/safeMode';

function handleExitSafeMode() {
  disableSafeMode();
  resetErrorTracker();
}
```

---

## 🎯 Testing Checklist (10 Points)

### ✓ Test 1: Page Loads
- [ ] Navigate to `/dashboard/logs/system`
- [ ] Page loads without errors
- [ ] All sections display (diagnostics, recent errors, bundle, prompt)

### ✓ Test 2: Diagnostics Display
- [ ] Online/offline status shows correct value
- [ ] Service Worker shows registered/not registered
- [ ] Manifest detection works
- [ ] Push permission shows current status

### ✓ Test 3: Recent Errors
- [ ] Trigger a logger error
- [ ] Error appears in Recent Errors list within 5 seconds
- [ ] List shows area, message, timestamp

### ✓ Test 4: Safe Mode Trigger
- [ ] Trigger 3 errors rapidly
- [ ] Orange banner appears in `/dashboard/logs/system`
- [ ] Safe Mode message visible: "Modo seguro activo (solo lectura)"

### ✓ Test 5: Safe Mode on All Pages
- [ ] With Safe Mode active, navigate to other dashboard pages
- [ ] Banner appears on all dashboard pages
- [ ] Refresh page → banner persists (localStorage)

### ✓ Test 6: Safe Mode Exit
- [ ] Click "Salir" button on banner
- [ ] Banner disappears
- [ ] localStorage cleared
- [ ] Can trigger Safe Mode again after 60s

### ✓ Test 7: Debug Bundle
- [ ] Click "Copy JSON" button
- [ ] Button shows "✓ Copied" feedback
- [ ] Paste into text editor → valid JSON
- [ ] Contains: timestamp, url, diagnostics, recentErrors, queueSize
- [ ] NO tokens/API keys visible

### ✓ Test 8: Codex Prompt
- [ ] Click "Copy Prompt" button
- [ ] Button shows "✓ Copied" feedback
- [ ] Paste into editor → readable markdown
- [ ] Contains: problem summary, system context, debug bundle
- [ ] Ready to paste into Claude/GPT

### ✓ Test 9: Offline Handling
- [ ] Enable offline mode (DevTools)
- [ ] System page still loads
- [ ] Diagnostics show "Online: no"
- [ ] Recent errors still display (from queue)

### ✓ Test 10: No Blank Pages
- [ ] Load page with various network conditions
- [ ] Slow 3G: page still loads (doesn't timeout)
- [ ] No errors: page loads instantly
- [ ] With 20+ errors: page displays without delay

---

## 🔐 Security Notes

### Safe Mode
- ✅ Doesn't require re-login
- ✅ Just disables "Create/Save/Delete" buttons
- ✅ User can exit immediately with "Salir"
- ✅ Expires after 24 hours automatically

### Debug Bundle
- ✅ Validates sanitization before export
- ✅ Tokens/secrets are NOT included
- ✅ Only system diagnostics + recent errors
- ✅ Safe to share in bug reports

### Codex Prompt
- ✅ Auto-generated from debug bundle
- ✅ Includes sanitized error details
- ✅ No credentials or secrets
- ✅ Ready to share with Claude/GPT

---

## 🚨 Common Issues

### Safe Mode Stays Active
**Cause**: Error tracker not reset, or new errors triggered  
**Fix**: Click "Salir" button, wait 60s, or manually:
```typescript
import { disableSafeMode, resetErrorTracker } from '@/lib/alphashield/safeMode';
disableSafeMode();
resetErrorTracker();
```

### Debug Bundle Copy Fails
**Cause**: Clipboard API not available (older browser)  
**Fix**: Automatically falls back to textarea method (works on all browsers)

### Codex Prompt is Empty
**Cause**: No errors logged yet  
**Fix**: Trigger an error first, wait 5s for Recent Errors to update

### Banner Doesn't Appear
**Cause**: Safe Mode not active or component not integrated  
**Fix**: Check localStorage: `localStorage.getItem('alphashield_safe_mode')`

---

## 📊 Build Status

```bash
$ npm run build

✅ Compiled successfully in 2.7s
✅ 0 TypeScript errors
✅ Route /dashboard/logs/system registered
✅ All components compiled
✅ No warnings
```

---

## 🔄 Integration Checklist

- [x] Safe mode utilities created
- [x] Logger modified to track errors
- [x] SafeModeBanner added to dashboard layout
- [x] System diagnostics page created
- [x] All components use 'use client'
- [x] TypeScript strict mode passes
- [x] No new dependencies added
- [x] Build passes with 0 errors

---

## 📚 Documentation

**Full Details**:
- [SPRINT_10_8_ALPHASHIELD_UI_REPORT.md](SPRINT_10_8_ALPHASHIELD_UI_REPORT.md) — Complete implementation guide
- [APP_MAP.md](APP_MAP.md) — Architecture overview (AlphaShield section)
- [TESTING_CHECKLIST.md](TESTING_CHECKLIST.md) — Testing guide (Sprint 10.8 section)

**Source Code**:
- [src/lib/alphashield/safeMode.ts](../src/lib/alphashield/safeMode.ts) — Safe mode logic
- [src/lib/alphashield/debugBundle.ts](../src/lib/alphashield/debugBundle.ts) — Bundle generator
- [src/lib/alphashield/codexPrompt.ts](../src/lib/alphashield/codexPrompt.ts) — Prompt generator
- [src/app/dashboard/logs/system/page.tsx](../src/app/dashboard/logs/system/page.tsx) — Main page

---

## 🎯 Next Steps

1. **QA Testing** — Run 10-point checklist above
2. **Code Review** — Check for security, performance
3. **Merge to Main** — Integrate into main branch
4. **Sprint 10.9** — Next feature (optional: analytics dashboard)

---

**Sprint 10.8**: ✅ COMPLETE  
**Build**: ✅ PASSING  
**Ready for QA**: ✅ YES  
**Ready for Merge**: ✅ YES

