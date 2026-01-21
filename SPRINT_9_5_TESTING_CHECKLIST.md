# Sprint 9.5: Offline Business Snapshot - Testing Checklist

**Objective**: Verify Business module operates correctly offline and in read-only mode

**Build Status**: ✅ Successful (TypeScript + Next.js)  
**Test Date**: January 19, 2026  
**Tester**: [Your Name]

---

## Pre-Testing Setup

- [ ] Browser DevTools open (F12)
- [ ] Network tab accessible
- [ ] Application/Storage tab accessible for IndexedDB inspection
- [ ] No console errors on page load

---

## Test Suite 1: Online Mode (Normal Operation)

### 1.1 Initial Load - Online with Session
- [ ] Navigate to `/dashboard/business` while online and logged in
- [ ] Verify: No warning banners displayed
- [ ] Verify: All 8 tabs load normally (Health, KPIs, P&L, Runway, Roadmap, SOPs, Decisions, LLC)
- [ ] Verify: Add buttons visible on all panels (Add Cost, New Milestone, New SOP, New Decision, Add Item)
- [ ] Console: No errors or warnings related to offline loading

### 1.2 Live Data Rendering
- [ ] Open Health panel → verify alerts/metrics load from API
- [ ] Open P&L panel → verify costs and P&L metrics display
- [ ] Open Roadmap panel → verify milestones list populates
- [ ] Open SOPs panel → verify SOP list loads
- [ ] Open Decisions panel → verify decisions display
- [ ] Open LLC panel → verify LLC info and inbox load

### 1.3 Data Mutation (Normal Mode)
- [ ] Click "Add Cost" in P&L panel → form opens
- [ ] Click "New Milestone" in Roadmap → form opens
- [ ] Click "New SOP" in SOPs → form opens
- [ ] Click "New Decision" in Decisions → form opens
- [ ] Click "Add Item" in LLC Inbox → prompt appears

---

## Test Suite 2: Offline Mode (After Snapshot Saved)

### 2.1 Simulate Offline
- [ ] Open DevTools Network tab
- [ ] Select "Offline" from throttling dropdown
- [ ] Refresh page `/dashboard/business`
- [ ] Expected: Page loads with cached data

### 2.2 Warning Banner Display
- [ ] Verify: **Amber warning banner** appears at top of page
- [ ] Verify: **WifiOff icon** displayed (offline indicator)
- [ ] Verify: Warning text reads "No internet connection"
- [ ] Verify: Banner is non-dismissible (stays visible)
- [ ] Verify: Banner uses amber/yellow styling (Tailwind `bg-amber-900`)

### 2.3 Read-Only Mode Enforcement
- [ ] Verify: **All "Add/New" buttons are hidden** (not grayed out, completely hidden)
  - [ ] No "Add Cost" button in P&L panel
  - [ ] No "New Milestone" button in Roadmap
  - [ ] No "New SOP" button in SOPs
  - [ ] No "New Decision" button in Decisions
  - [ ] No "Add Item" button in LLC Inbox
  - [ ] No "Edit LLC Info" button in LLC Panel
- [ ] Verify: Form modal cannot be opened even via console
- [ ] Verify: All panels render in read-only display mode

### 2.4 Offline Data Display
- [ ] Health panel → displays cached health alerts (if any)
- [ ] KPI panel → displays cached KPI metrics
- [ ] P&L panel → displays cached costs data
- [ ] Runway panel → displays cached runway metrics
- [ ] Roadmap panel → displays cached milestones
- [ ] SOPs panel → displays cached SOPs
- [ ] Decisions panel → displays cached decisions
- [ ] LLC panel → displays cached LLC info and inbox

### 2.5 Data Persistence
- [ ] Verify: All 9 data entities present in snapshot
  - [ ] costs
  - [ ] templates
  - [ ] milestones
  - [ ] sops
  - [ ] sop_items
  - [ ] sop_runs
  - [ ] decisions
  - [ ] tasks
  - [ ] llc_info
  - [ ] llc_inbox
- [ ] Verify: Data matches what was visible online
- [ ] Inspect IndexedDB: `alphalog-pwa` → `snapshot` table has business object

---

## Test Suite 3: No Session Mode (Offline-Only Login)

### 3.1 Clear Session & Simulate Offline
- [ ] Log out of application
- [ ] DevTools → Application → Storage → Clear all site data
- [ ] DevTools Network → Set to "Offline"
- [ ] Navigate to `/dashboard/business`
- [ ] Expected: Page attempts to load, shows appropriate state

### 3.2 No Session Warning
- [ ] Verify: **Amber warning banner** appears
- [ ] Verify: **Lock icon** displayed (no session indicator)
- [ ] Verify: Warning text reads "Session expired" or "No login session"
- [ ] Verify: Lock icon color is amber/yellow

### 3.3 Graceful Degradation
- [ ] If snapshot exists → display cached data in read-only mode
- [ ] If snapshot missing → display "No Cached Business Data" message
- [ ] Verify: No console errors or crashes
- [ ] Verify: User can still see other modules (dashboard navigation works)

---

## Test Suite 4: Transition Scenarios

### 4.1 Online → Offline
1. Start online with session loaded
2. DevTools Network → Switch to "Offline"
3. Verify: Warning banner appears
4. Verify: Data remains visible (cached)
5. Verify: Buttons disappear (read-only mode)
6. Verify: Can switch between tabs without errors

### 4.2 Offline → Online
1. Start in offline mode with warning banner
2. DevTools Network → Switch to "Online"
3. Refresh page
4. Verify: Warning banner disappears
5. Verify: Page re-fetches fresh data from API
6. Verify: Add buttons reappear
7. Verify: Normal mode restored

### 4.3 Session Lost Mid-Session
1. Start online with session
2. Manually delete auth token from localStorage (DevTools Console: `localStorage.removeItem('auth-token')`)
3. Navigate to Business page
4. Verify: Lock warning banner appears
5. Verify: Read-only mode enforced
6. Verify: Data still displays (from snapshot)

---

## Test Suite 5: IndexedDB Validation

### 5.1 Snapshot Schema Check
- [ ] Open DevTools → Application → IndexedDB → alphalog-pwa
- [ ] Verify: `snapshot` object store exists
- [ ] Verify: Key-value pair exists (e.g., "dashboard-snapshot")
- [ ] Click to inspect snapshot value

### 5.2 Business Data Structure
Verify the snapshot contains this structure:
```json
{
  "business": {
    "costs": [...],
    "templates": [...],
    "milestones": [...],
    "sops": [...],
    "sop_items": [...],
    "sop_runs": [...],
    "decisions": [...],
    "tasks": [...],
    "llc_info": {...},
    "llc_inbox": [...]
  }
}
```
- [ ] costs: Array of cost objects (should not be empty if data exists)
- [ ] templates: Array of template objects
- [ ] milestones: Array of milestone objects
- [ ] sops: Array of SOP objects
- [ ] sop_items: Array of SOP item objects
- [ ] sop_runs: Array of SOP run objects
- [ ] decisions: Array of decision objects
- [ ] tasks: Array of task objects
- [ ] llc_info: Single object or null
- [ ] llc_inbox: Array of inbox item objects

### 5.3 Snapshot Size
- [ ] Verify: Snapshot size is < 5MB (typical: 100KB-1MB)
- [ ] Verify: IndexedDB quota not exceeded

---

## Test Suite 6: Error Scenarios

### 6.1 Corrupted Snapshot
1. DevTools → Application → IndexedDB → alphalog-pwa → snapshot
2. Delete the business object manually
3. Refresh `/dashboard/business`
4. Verify: "No Cached Business Data" message appears
5. Verify: No console errors
6. Verify: Page doesn't crash

### 6.2 Missing Network
1. DevTools Network → Set to "Offline"
2. Delete IndexedDB snapshot (clear storage)
3. Navigate to `/dashboard/business`
4. Verify: "No Cached Business Data" message appears
5. Verify: No infinite loading spinners
6. Verify: Lock + WifiOff warning banners appear

### 6.3 Slow Network
1. DevTools Network → Set to "Slow 3G"
2. Navigate to Business page
3. Verify: Page loads (may take longer)
4. Verify: No timeout errors
5. Verify: Data eventually appears or shows "Loading..." state

---

## Test Suite 7: Component-Specific Tests

### 7.1 Health Panel
- [ ] Online: Displays calculated alerts based on costs + trades
- [ ] Offline: Displays cached alerts from snapshot
- [ ] Read-only: No mutation buttons visible
- [ ] Tab switch: Can navigate away and return without errors

### 7.2 P&L Panel
- [ ] Online: Shows current month P&L + trend data
- [ ] Offline: Shows cached costs from snapshot
- [ ] Read-only: "Add Cost" button hidden
- [ ] Month selector: Works in both modes

### 7.3 Roadmap Panel
- [ ] Online: Shows all milestones with status
- [ ] Offline: Shows cached milestones
- [ ] Read-only: "New Milestone" button hidden
- [ ] Status filters: Work in offline mode (if implemented)

### 7.4 SOPs Panel
- [ ] Online: Lists all SOPs
- [ ] Offline: Shows cached SOPs
- [ ] Read-only: "New SOP" button hidden
- [ ] SOP expansion: Can view details of cached SOP

### 7.5 Decisions Panel
- [ ] Online: Lists all decisions
- [ ] Offline: Shows cached decisions
- [ ] Read-only: "New Decision" button hidden
- [ ] Expand decision: Can view cached tasks

### 7.6 LLC Panel
- [ ] Online: Shows LLC info + inbox items
- [ ] Offline: Shows cached LLC info
- [ ] Read-only: "Edit LLC Info" + "Add Item" buttons hidden
- [ ] Sensitive info: EIN toggling works

---

## Test Suite 8: Performance & UX

### 8.1 Load Time
- [ ] Online first load: < 2 seconds
- [ ] Offline reload: < 500ms (from IndexedDB)
- [ ] Tab switching: Instant (< 100ms)

### 8.2 Visual Feedback
- [ ] Loading states: Show spinners/skeletons while fetching
- [ ] Error states: Display error messages clearly
- [ ] Success states: Data renders correctly
- [ ] No visual glitches or layout shifts

### 8.3 Accessibility
- [ ] Warning banners: High contrast (amber/yellow on dark)
- [ ] Text readable: Font size ≥ 14px
- [ ] Icons: Have alt text or aria-labels
- [ ] Keyboard navigation: Tab through panels works

---

## Test Suite 9: Browser Compatibility

Test on multiple browsers if possible:
- [ ] Chrome/Chromium (latest)
- [ ] Firefox (latest)
- [ ] Safari (if available)
- [ ] Mobile browsers (iOS Safari, Chrome Mobile)

For each browser:
- [ ] Offline mode works
- [ ] IndexedDB saves/reads correctly
- [ ] Warning banners display properly
- [ ] No console errors

---

## Test Suite 10: Rollback Verification

### 10.1 Pre-Rollback Snapshot
- [ ] Verify business data loads online and saves to IndexedDB

### 10.2 Remove Business Snapshot Code
1. Revert snapshot.ts changes (remove `saveBusinessDataToSnapshot`, `getBusinessOfflineData`)
2. Rebuild: `npm run build`
3. Navigate to `/dashboard/business`
4. Verify: Application doesn't crash
5. Verify: No console errors related to missing functions
6. Verify: Business page loads (may not have offline support)

### 10.3 Remove IDB Schema Extension
1. Revert idb.ts changes (remove business field from interface)
2. Rebuild: `npm run build`
3. Verify: No TypeScript errors
4. Verify: Application still functional
5. Verify: Offline mode for other modules still works

### 10.4 Restore All Changes
1. `git restore` all files or revert commits
2. Rebuild: `npm run build`
3. Run full test suite again

---

## Test Results Summary

| Test Suite | Status | Notes |
|-----------|--------|-------|
| 1. Online Mode | [ ] PASS [ ] FAIL | |
| 2. Offline Mode | [ ] PASS [ ] FAIL | |
| 3. No Session | [ ] PASS [ ] FAIL | |
| 4. Transitions | [ ] PASS [ ] FAIL | |
| 5. IndexedDB | [ ] PASS [ ] FAIL | |
| 6. Error Scenarios | [ ] PASS [ ] FAIL | |
| 7. Components | [ ] PASS [ ] FAIL | |
| 8. Performance | [ ] PASS [ ] FAIL | |
| 9. Browser Compat | [ ] PASS [ ] FAIL | |
| 10. Rollback | [ ] PASS [ ] FAIL | |

**Overall Status**: [ ] ALL PASSED [ ] SOME FAILED [ ] BLOCKED

---

## Known Issues & Workarounds

### Issue 1: [If any found during testing]
- **Symptom**: 
- **Root Cause**: 
- **Workaround**: 
- **Fix Tracking**: 

---

## Sign-Off

- **Tested By**: ______________________
- **Date**: ______________________
- **Environment**: Offline/Online/Hybrid
- **Approved By**: ______________________

---

## Additional Notes

[Space for tester observations and recommendations]

