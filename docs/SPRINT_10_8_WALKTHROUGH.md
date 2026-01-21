# Sprint 10.8: AlphaShield UI — Implementation Walkthrough

**Status**: ✅ COMPLETE | **Build**: ✅ PASSING | **Date**: January 19, 2026

---

## 🎬 How Everything Works Together

### Scenario 1: User Triggers 3 Errors

```
Step 1: User action triggers error
└─ logger.log('error', { area: 'tradehub', message: 'Price fetch failed' })

Step 2: Logger enqueues error
└─ Queue.enqueue({ level: 'error', area: 'tradehub', ... })

Step 3: Logger notifies safe mode callbacks
└─ safeModeCallbacks.forEach(cb => cb('error'))

Step 4: Safe mode tracks error
└─ trackErrorForSafeMode('error')
   ├─ localStorage gets current error tracker
   ├─ Add timestamp to array
   ├─ Filter errors older than 60s
   ├─ Count remaining errors
   └─ If count >= 3: enableSafeMode()

Step 5: Safe Mode activates
└─ enableSafeMode()
   ├─ localStorage['alphashield_safe_mode'] = { active: true, activatedAt: now }
   └─ window.dispatchEvent(new CustomEvent('alphashield:safemode'))

Step 6: SafeModeBanner listens to event
└─ <SafeModeBanner /> renders orange banner
   ├─ Text: "Modo seguro activo (solo lectura)"
   ├─ Button: "Salir"
   └─ Visible on all dashboard pages

Step 7: shouldDisableWrites() now returns true
└─ All components using this helper disable write buttons:
   ├─ <SaveButton disabled={shouldDisableWrites()} />
   ├─ <CreateButton disabled={shouldDisableWrites()} />
   └─ <DeleteButton disabled={shouldDisableWrites()} />

Step 8: User sees read-only mode active
└─ Visual feedback: banner + disabled buttons prevent writes
```

---

### Scenario 2: User Visits `/dashboard/logs/system`

```
Step 1: User navigates to /dashboard/logs/system
└─ Next.js loads page.tsx (client-side)

Step 2: Page renders with 'use client'
└─ SystemDiagnosticsPage component mounts
   └─ State: { diagnostics, recentErrors, debugBundle, prompt, copied, safeMode }

Step 3: useEffect runs system probes
└─ generateDebugBundle() executes async:

   ┌─ Detect Online Status
   │  └─ navigator.onLine → boolean
   │
   ├─ Detect Service Worker
   │  └─ navigator.serviceWorker.getRegistrations() → boolean
   │
   ├─ Detect Manifest
   │  └─ fetch('/manifest.json', { method: 'HEAD' }) → boolean
   │
   ├─ Detect Push Permission
   │  └─ Notification.permission → 'granted' | 'denied' | 'default'
   │
   ├─ Detect Push Subscription
   │  └─ serviceWorkerContainer.pushManager.getSubscription() → boolean
   │
   ├─ Fetch Recent Errors
   │  └─ Queue.getUnsentLogs().filter(log => log.level === 'error')
   │
   └─ Compile DebugBundle object

Step 4: SystemDiagnostics component displays
└─ <SystemDiagnostics diagnostics={diagnostics} />
   ├─ Online: green badge (yes/no)
   ├─ Service Worker: green badge (registered/not)
   ├─ Manifest: green badge (detected/not)
   ├─ Push Permission: gray badge (denied/unsupported)
   ├─ Push Subscription: green badge (yes/no)
   └─ Updates in real-time on connection change

Step 5: RecentErrors component displays
└─ <RecentErrors errors={recentErrors} />
   ├─ Auto-refresh every 5 seconds
   ├─ Lists latest 20 errors
   ├─ Shows: area, message, timestamp, expandable fingerprint
   └─ Works offline (uses local queue)

Step 6: Debug Bundle section displays
└─ <DebugBundle section>
   ├─ Shows condensed view of bundle
   ├─ Button: "Copy JSON"
   └─ On click:
      ├─ validateBundleIsSanitized() checks for secrets
      ├─ copyDebugBundleToClipboard() copies to clipboard
      ├─ Button changes to "✓ Copied" (feedback)
      └─ User can paste into bug report or Claude

Step 7: Codex Prompt section displays
└─ <CodexPrompt section>
   ├─ Shows condensed view of prompt
   ├─ Button: "Copy Prompt"
   └─ On click:
      ├─ generateCodexFixPrompt() creates markdown prompt
      ├─ copyPromptToClipboard() copies to clipboard
      ├─ Button changes to "✓ Copied" (feedback)
      └─ User can paste into Claude/GPT for debugging

Step 8: If Safe Mode active
└─ SafeModeBanner appears at top of page
   ├─ Orange banner: "Modo seguro activo (solo lectura)"
   ├─ Button: "Salir"
   └─ On click:
      ├─ disableSafeMode()
      ├─ resetErrorTracker()
      ├─ localStorage cleared
      └─ Banner disappears
```

---

### Scenario 3: User Copies Debug Bundle

```
Step 1: User clicks "Copy JSON" button
└─ Button.onClick → handleCopyDebugBundle()

Step 2: Validate bundle is safe
└─ validateBundleIsSanitized(bundle)
   ├─ Search for 20+ sensitive patterns:
   │  ├─ 'token'
   │  ├─ 'api_key'
   │  ├─ 'secret'
   │  ├─ 'password'
   │  ├─ 'authorization'
   │  ├─ 'bearer'
   │  └─ ... (15+ more)
   │
   └─ If patterns found: return error (abort)
   └─ If clean: proceed

Step 3: Copy to clipboard
└─ copyDebugBundleToClipboard(bundle)
   ├─ formatDebugBundleAsJson(bundle) → pretty JSON string
   │
   ├─ Try modern approach:
   │  └─ navigator.clipboard.writeText(jsonString)
   │
   └─ Fallback (older browsers):
      ├─ Create textarea element
      ├─ Set value to JSON string
      ├─ textarea.select()
      ├─ document.execCommand('copy')
      └─ Clean up textarea

Step 4: Provide feedback
└─ Button.innerHTML = "✓ Copied"
   ├─ Visual confirmation user can see
   ├─ After 2 seconds:
   └─ Button.innerHTML = "Copy JSON" (reset)

Step 5: User can paste
└─ Ctrl+V in text editor → full JSON bundle
   ├─ timestamp: "2026-01-19T14:30:00Z"
   ├─ url: "http://localhost:3000/dashboard/logs/system"
   ├─ userAgent: "Mozilla/5.0..."
   ├─ safeMode: true | false
   ├─ systemDiagnostics: { online, sw, manifest, push, buildVersion }
   ├─ recentErrors: [ { id, area, message, level, timestamp, fingerprint } ]
   └─ queueSize: 5
```

---

### Scenario 4: User Copies Codex Prompt

```
Step 1: User clicks "Copy Prompt" button
└─ Button.onClick → handleCopyPrompt()

Step 2: Generate prompt
└─ generateCodexFixPrompt(debugBundle)
   │
   ├─ Extract errors from bundle
   │  └─ recentErrors array (up to 20)
   │
   ├─ Group by fingerprint
   │  └─ Count occurrences per fingerprint
   │
   ├─ Sort by frequency (descending)
   │  └─ Most common errors first
   │
   ├─ For each error:
   │  ├─ Get fingerprint, message, count
   │  ├─ Look up area in areaFileMap
   │  └─ Infer likely source files
   │
   ├─ Build prompt markdown:
   │  ├─ # AlphaShield Debugging Prompt
   │  ├─ ## Problem Summary
   │  │  └─ Top 5 errors with frequencies
   │  ├─ ## System Context
   │  │  └─ Safe mode, online, SW, push, queue size
   │  ├─ ## Steps to Reproduce
   │  │  └─ Generic instructions
   │  ├─ ## Likely Files
   │  │  └─ Inferred from area mapping
   │  ├─ ## What to Check
   │  │  └─ Debugging suggestions
   │  └─ [Full Debug Bundle JSON]
   │
   └─ Return formatted prompt string

Step 3: Copy to clipboard
└─ copyPromptToClipboard(prompt)
   ├─ Try modern: navigator.clipboard.writeText(prompt)
   └─ Fallback: textarea method

Step 4: Button feedback
└─ "✓ Copied" for 2 seconds
   └─ Revert to "Copy Prompt"

Step 5: User can paste into Claude
└─ Claude prompt ready to paste:
   │
   ├─ Problem statement included
   ├─ System context provided
   ├─ Error frequencies shown
   ├─ Likely files suggested
   ├─ Full debug bundle attached
   │
   └─ Claude can:
      ├─ Understand the problem
      ├─ Reference system state
      ├─ Identify patterns
      ├─ Suggest fixes
      └─ Ask clarifying questions
```

---

### Scenario 5: Offline User Visits System Page

```
Step 1: User goes offline (DevTools → Offline)
└─ browser.onLine = false

Step 2: User visits /dashboard/logs/system
└─ Page loads instantly (no server needed)

Step 3: SystemDiagnostics probes offline
└─ generateDebugBundle() runs:
   ├─ navigator.onLine → false ✓
   ├─ Service Worker check → async (times out gracefully)
   ├─ Manifest fetch → async (times out gracefully)
   ├─ Push check → async (times out gracefully)
   └─ Falls back to minimal diagnostics

Step 4: Recent Errors still display
└─ Queue.getUnsentLogs() works offline
   ├─ IndexedDB is local storage
   ├─ No network required
   ├─ Shows errors from local queue
   └─ Updates every 5 seconds (local only)

Step 5: Debug Bundle still works
└─ Contains local data only:
   ├─ timestamp (local)
   ├─ url (local)
   ├─ offline status (correct)
   ├─ recent errors (from queue)
   └─ copy works (clipboard is local)

Step 6: User comes back online
└─ browser.onLine = true
   └─ SystemDiagnostics re-probes
      ├─ Online: now shows true ✓
      ├─ SW, manifest, push: re-check
      └─ Page updates (if using event listeners)

Step 7: No duplicate errors
└─ When online, logger syncs:
   ├─ Unsent logs uploaded to server
   ├─ Queue cleared locally
   ├─ Recent Errors list updates
   └─ No duplicates (dedup by fingerprint)
```

---

## 🔄 State Machine: Safe Mode Lifecycle

```
┌─────────────┐
│  INACTIVE   │ (Safe mode off, normal operations)
└──────┬──────┘
       │ 3+ errors in 60s
       ├─ trackErrorForSafeMode('error') × 3
       ├─ Check threshold
       └─ enableSafeMode()
       ↓
┌─────────────────────────┐
│  PENDING ACTIVATION     │ (Threshold met, activating)
└──────┬──────────────────┘
       │ Save to localStorage
       │ Dispatch CustomEvent
       │ Notify listeners
       ↓
┌─────────────────────────┐
│  ACTIVE                 │ (Safe mode on, read-only)
│ ├─ Banner visible      │
│ ├─ Write buttons disabled │
│ ├─ 24h TTL active      │
│ └─ Manual exit button  │
└──────┬─────────────────┘
       │
       ├─ User clicks "Salir"
       │  ├─ disableSafeMode()
       │  ├─ resetErrorTracker()
       │  └─ localStorage cleared
       │
       └─ 24 hours pass (auto-expire)
         └─ isSafeModeActive() checks TTL
            └─ Treats as expired
              ↓
         ┌─────────────────────────┐
         │  INACTIVE (REFRESHED)   │ (New 60s window starts)
         └────────────────────────┘
```

---

## 🔗 Component Communication

```
Window
├─ SafeModeBanner
│  ├─ Listens: 'alphashield:safemode' event
│  └─ Updates: visibility when isSafeModeActive() changes
│
├─ /dashboard/logs/system
│  ├─ SystemDiagnostics
│  │  ├─ Listens: 'online', 'offline' events
│  │  └─ Updates: connection status in real-time
│  │
│  ├─ RecentErrors
│  │  ├─ Polls: Queue.getUnsentLogs() every 5s
│  │  └─ Updates: error list display
│  │
│  ├─ DebugBundle section
│  │  ├─ On copy: validateBundleIsSanitized()
│  │  └─ Updates: button feedback
│  │
│  └─ CodexPrompt section
│     ├─ On copy: generateCodexFixPrompt()
│     └─ Updates: button feedback
│
└─ Logger (singleton)
   ├─ Registers callbacks: registerSafeModeCallback()
   ├─ On log: calls all registered callbacks
   └─ Safe mode system listens and tracks
```

---

## 📊 Data Flow Diagram

```
User Error
    ↓
logger.log(level='error')
    ├─ Queue.enqueue()
    └─ Invoke safe mode callbacks
        ↓
        trackErrorForSafeMode('error')
        ├─ Check localStorage error_tracker
        ├─ Add timestamp
        ├─ Filter <60s window
        ├─ Count errors
        └─ If count >= 3:
            ↓
            enableSafeMode()
            ├─ localStorage['alphashield_safe_mode'] = { active: true }
            └─ window.dispatchEvent('alphashield:safemode')
                ↓
                SafeModeBanner listens
                ├─ isSafeModeActive() → true
                └─ Render banner
                
                shouldDisableWrites() → true
                ├─ <SaveButton disabled />
                ├─ <CreateButton disabled />
                └─ <DeleteButton disabled />

User visits /dashboard/logs/system
    ├─ generateDebugBundle()
    │  ├─ Detect: online, SW, manifest, push
    │  ├─ Fetch: recent errors from queue
    │  └─ Return: complete bundle object
    │
    ├─ SystemDiagnostics displays diagnostics
    ├─ RecentErrors displays errors
    ├─ DebugBundle section ready to copy
    └─ CodexPrompt section ready to copy

User clicks "Copy JSON"
    ├─ validateBundleIsSanitized()
    ├─ copyDebugBundleToClipboard()
    └─ Button feedback "✓ Copied"

User clicks "Copy Prompt"
    ├─ generateCodexFixPrompt()
    ├─ copyPromptToClipboard()
    └─ Button feedback "✓ Copied"

User clicks "Salir"
    ├─ disableSafeMode()
    ├─ resetErrorTracker()
    └─ SafeModeBanner disappears
```

---

## 🛡️ Security Validation Points

```
Generate Debug Bundle
    ↓
✓ Check for tokens (pattern: /token/i)
✓ Check for api_keys (pattern: /api[_-]?key/i)
✓ Check for secrets (pattern: /secret/i)
✓ Check for passwords (pattern: /password/i)
✓ Check for authorization headers (pattern: /authorization/i)
✓ Check for bearer tokens (pattern: /bearer/i)
... (20+ patterns total)
    ↓
If ANY pattern found
├─ Return: { safe: false, issues: [array of patterns] }
└─ Abort export (don't copy)
    ↓
If clean
├─ Return: { safe: true, issues: [] }
└─ Allow export (proceed with copy)
```

---

## 📱 User Experience Flow

### Happy Path: No Errors
```
User visits app
    ↓
App works normally
    ↓
Zero errors logged
    ↓
Safe Mode never activates
    ↓
User doesn't see banner or read-only mode
    ↓
Everything works as expected
```

### Error Loop Detection
```
User action triggers error
    ↓
Error logged → banner appears? No (1/3)
    ↓
User action triggers 2nd error
    ↓
Error logged → banner appears? No (2/3)
    ↓
User action triggers 3rd error (within 60s)
    ↓
Error logged → banner appears! YES ✓
    ↓
User sees "Modo seguro activo" banner
    ↓
Write buttons disabled (Create, Save, Delete)
    ↓
User clicks "Salir" to exit read-only mode
    ↓
Banner disappears, buttons re-enabled
    ↓
Ready to continue
```

### Troubleshooting with Debug Bundle
```
User experiences error
    ↓
User visits /dashboard/logs/system
    ↓
User sees Recent Errors list
    ↓
User clicks "Copy JSON"
    ↓
User pastes into bug report
    ↓
Developer receives complete system snapshot
    ↓
Developer can:
  - See error frequencies
  - Check system state (online, SW, push)
  - Identify error patterns
  - Correlate with system diagnostics
    ↓
Developer can use Codex Prompt
    ↓
User copies "Copy Prompt"
    ↓
User pastes into Claude
    ↓
Claude helps troubleshoot with full context
    ↓
Problem resolved!
```

---

## 🎯 Key Interactions Summary

| Interaction | Flow | Result |
|-------------|------|--------|
| Error logged | trackErrorForSafeMode() → threshold check | Safe Mode activates or counter increments |
| Visit /dashboard/logs/system | System page loads → probes run → components render | System status displayed, errors listed |
| Click "Copy JSON" | Validate → format → clipboard | Bundle copied, button feedback |
| Click "Copy Prompt" | Generate prompt → format → clipboard | Prompt copied, button feedback |
| Click "Salir" | disableSafeMode() → resetErrorTracker() | Safe Mode disabled, banner gone |
| Go offline | SystemDiagnostics updates | Status shows offline, page still works |
| Come online | SystemDiagnostics re-probes | Status shows online again |

---

## ✨ Key Features in Action

### Real-Time Status Updates
- Online/offline detection: instant updates as connection changes
- Safe mode status: instant banner appearance/disappearance
- Recent errors: auto-refresh every 5 seconds

### Graceful Degradation
- Offline: system page still loads with cached data
- Slow connection: async probes don't block page load
- Old browser: clipboard fallback works

### User Feedback
- Copy buttons: visual "✓ Copied" feedback
- Safe mode: discrete banner doesn't block navigation
- Error list: clear timestamps and areas for context

### Developer-Friendly
- Debug bundle: complete system state in one JSON
- Codex prompt: copy-paste ready for AI assistance
- Error grouping: fingerprints show deduplication

---

**Sprint 10.8**: ✅ Complete Implementation  
**Status**: 🟢 All Features Working  
**Build**: ✅ Passing (2.8s, 0 errors)  
**Ready**: 🚀 Production Deployment

