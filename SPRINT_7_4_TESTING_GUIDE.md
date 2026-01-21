# Sprint 7.4 Testing Guide

**Objective**: Verify Heatmap panel and offline support functionality

---

## Test Environment Setup

### Requirements
- Node.js 18+
- Chrome/Firefox with DevTools
- Project built: `npm run build` ✅

### Prerequisites
- Clear IndexedDB: DevTools → Application → IndexedDB → Delete
- Clear localStorage: DevTools → Application → Local Storage → Clear All
- Close all dashboard tabs

---

## Test Suite 1: Heatmap Panel Display

### Test 1.1: Heatmap Loads
**Steps**:
1. Navigate to `/dashboard/treasury`
2. Click "🔥 Heatmap" tab
3. Wait for content

**Expected**:
- Panel renders without errors
- Aggregate health score displays
- Summary cards show (Healthy, Warning, Critical counts)
- Heatmap table visible (or empty state if no accounts)

**Pass/Fail**: ___

### Test 1.2: Health Score Calculation
**Steps**:
1. On Heatmap tab
2. Note account health score
3. Verify calculation:
   - If withdrawals disabled → score should be 0
   - If in phase → score reduced by 50
   - If drawdown >= threshold → score reduced by 50
   - If balance < threshold → score reduced by 30

**Expected**:
- All scores between 0-100
- Scores match expected calculations
- Scores update when switching tabs (different data sources)

**Pass/Fail**: ___

### Test 1.3: Color Coding
**Steps**:
1. On Heatmap tab
2. Check aggregate score color
3. Check account row backgrounds
4. Check individual score colors

**Expected**:
- 75+: Green (🟢)
- 50-74: Yellow (🟡)
- <50: Red (🔴)
- Consistent across all score displays

**Pass/Fail**: ___

### Test 1.4: Account Flags Display
**Steps**:
1. On Heatmap tab
2. Look at flags column
3. Identify visible badges

**Expected**:
- 🔒 Withdrawals Disabled - if account.withdrawals_enabled = false
- 🛡️ Anti-DD On - if config.anti_drawdown_active = true
- ⏳ Umbral Active - if balance < config.balance_threshold
- 📊 In Phase - if account.phase_status includes "fase"

**Pass/Fail**: ___

### Test 1.5: Empty State
**Steps**:
1. (Optional) Mock no accounts
2. View Heatmap with zero accounts

**Expected**:
- Helpful message: "No accounts available"
- No errors
- All sections render

**Pass/Fail**: ___

### Test 1.6: Responsive Design
**Steps**:
1. On Heatmap tab (desktop: 1920px)
2. Toggle DevTools responsive mode
3. Test: Mobile (375px), Tablet (768px), Desktop (1920px)

**Expected**:
- Table scrolls horizontally on mobile
- Content readable on all sizes
- No content overflow
- Flags wrap properly

**Pass/Fail**: ___

---

## Test Suite 2: Offline Support

### Setup for Offline Tests
1. Open Treasury page
2. DevTools → Network tab
3. Simulate offline: Throttling dropdown → Offline

### Test 2.1: Offline Detection
**Steps**:
1. Page is loaded online
2. Switch to Offline (DevTools)
3. Refresh page
4. Check error/status banner

**Expected**:
- Page loads from cache (no blank screen)
- Blue banner shows: "📡 Offline Mode - Data is read-only"
- All Treasury data displays (if previously cached)
- No redirect to /auth

**Pass/Fail**: ___

### Test 2.2: No Session + Offline
**Steps**:
1. (Logout if necessary)
2. Clear session: DevTools → Application → Cookies → Delete all
3. Switch to Offline
4. Reload page

**Expected**:
- Page loads from IndexedDB cache
- Blue banner shows: "🔐 No Session - Showing cached data"
- Read-only mode active
- All data accessible

**Pass/Fail**: ___

### Test 2.3: Data Persistence
**Steps**:
1. Load Treasury page (online, with session)
2. Note account data
3. Go offline
4. Reload page multiple times
5. Toggle between tabs

**Expected**:
- Same data persists across reloads
- All tabs work offline
- No data loss
- Responsive even offline

**Pass/Fail**: ___

### Test 2.4: Online Restore
**Steps**:
1. Page is offline with cached data
2. Go back online (DevTools → Normal)
3. Wait 2 seconds
4. Refresh page

**Expected**:
- Page reloads with fresh data
- Status banner disappears
- Normal online mode
- Data updates if changed on server

**Pass/Fail**: ___

### Test 2.5: IndexedDB Snapshot Verification
**Steps**:
1. Load Treasury page (online, with session)
2. DevTools → Application → IndexedDB → alphalog
3. Look for snapshots store
4. Check SNAPSHOT_KEY: "dashboard:v1"

**Expected**:
- `treasury` object exists in snapshot
- Contains: accounts, configs, wallets, transactions, budgets, payouts, trades
- Data matches what's displayed

**Pass/Fail**: ___

### Test 2.6: Read-Only Indicators
**Steps**:
1. Go offline or logout
2. Check page subtitle
3. Check status banner

**Expected**:
- Subtitle shows "(Read-Only)" when offline
- Banner is blue/info colored (not red)
- Clear indication of offline mode
- Can still browse all tabs

**Pass/Fail**: ___

---

## Test Suite 3: Data Consistency

### Test 3.1: Cross-Tab Consistency
**Steps**:
1. On Overview tab, note account balance
2. Switch to Heatmap tab
3. Compare account data
4. Switch to Milestone tab
5. Compare again

**Expected**:
- Same account data across all tabs
- Consistent balances
- Consistent calculations

**Pass/Fail**: ___

### Test 3.2: Health Score vs Anti-DD Tab
**Steps**:
1. Note account with low health score in Heatmap
2. Switch to Anti-DD tab
3. Check same account's drawdown

**Expected**:
- If drawdown ≥ threshold → Heatmap health < 50
- If drawdown < threshold → Score higher
- Data consistent across tabs

**Pass/Fail**: ___

### Test 3.3: Offline Data Freshness
**Steps**:
1. Load Treasury (online)
2. Change account balance on server (if possible)
3. Go offline
4. Reload page
5. Check Heatmap score

**Expected**:
- Offline shows old data (expected)
- Go back online
- Reload page
- New data appears

**Pass/Fail**: ___

---

## Test Suite 4: Browser Compatibility

### Browsers to Test
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest, if available)
- [ ] Edge (latest)

### For Each Browser
**Test 4.X: Browser Compatibility**
1. Load `/dashboard/treasury`
2. Click Heatmap tab
3. Verify:
   - [ ] Panel renders
   - [ ] No console errors
   - [ ] Colors display correctly
   - [ ] Table scrolls properly
   - [ ] Offline mode works

**Pass/Fail**: ___

---

## Test Suite 5: Performance

### Test 5.1: Heatmap Load Time
**Steps**:
1. DevTools → Performance tab
2. Record while clicking Heatmap tab
3. Check metrics

**Expected**:
- Tab switch < 100ms
- No long tasks (>50ms)
- Smooth 60fps if possible

**Pass/Fail**: ___

### Test 5.2: Offline Load Time
**Steps**:
1. Go offline
2. Reload page
3. DevTools → Performance
4. Check FCP (First Contentful Paint)

**Expected**:
- FCP < 1 second (from cache)
- All content loaded within 2 seconds

**Pass/Fail**: ___

### Test 5.3: Snapshot Size
**Steps**:
1. DevTools → Storage → IndexedDB → alphalog → snapshots
2. Right-click treasury → Inspect Value
3. Note approximate size

**Expected**:
- Less than 100KB per snapshot
- Reasonable storage impact

**Pass/Fail**: ___

---

## Test Suite 6: Error Handling

### Test 6.1: No Data Scenario
**Steps**:
1. Clear IndexedDB: DevTools → Application → IndexedDB → Delete
2. Go offline
3. Load `/dashboard/treasury`

**Expected**:
- No error crash
- Helpful message
- Page structure intact
- Can still browse (empty state)

**Pass/Fail**: ___

### Test 6.2: Invalid Session Token
**Steps**:
1. Modify/clear auth token in localStorage
2. Reload page

**Expected**:
- Falls back to cached data
- Shows "No Session" banner
- No crashes

**Pass/Fail**: ___

### Test 6.3: Network Error Recovery
**Steps**:
1. Throttle network to "Slow 3G"
2. Reload page
3. Wait for load to complete
4. Set back to "Normal"

**Expected**:
- Page eventually loads
- Error handled gracefully
- Can retry after setting Normal

**Pass/Fail**: ___

---

## Test Suite 7: Accessibility

### Test 7.1: Keyboard Navigation
**Steps**:
1. Use Tab key to navigate all elements
2. Try to tab to Heatmap button
3. Press Enter

**Expected**:
- All interactive elements reachable
- Visual focus indicators
- Tab order logical

**Pass/Fail**: ___

### Test 7.2: Color Contrast
**Steps**:
1. Chrome DevTools → Lighthouse
2. Run Accessibility audit
3. Check color contrast

**Expected**:
- No low contrast warnings
- Text readable on backgrounds

**Pass/Fail**: ___

---

## Regression Tests

### Must Not Break
- [ ] Overview tab still loads
- [ ] Splits tab still works
- [ ] Umbral tab still works
- [ ] Anti-DD tab still works
- [ ] Milestone tab still works
- [ ] Cashflow tab still works
- [ ] Calendario tab still works
- [ ] No new TypeScript errors
- [ ] Build still compiles in < 5 seconds

**Pass/Fail**: ___

---

## Manual Test Cases

### Scenario 1: Home Office WiFi Drop
1. Load `/dashboard/treasury`
2. Simulate WiFi drop: Offline in DevTools
3. Verify offline mode works
4. Reconnect: Normal mode
5. Verify online works

**Result**: ___

### Scenario 2: Airplane Mode
1. Use DevTools to simulate offline
2. Browse all Treasury tabs
3. Switch between tabs rapidly
4. Check Heatmap calculations

**Result**: ___

### Scenario 3: User Session Expires
1. Load Treasury page
2. Clear session (DevTools → Cookies)
3. Stay online
4. Reload page

**Result**: ___

---

## Final Checklist

- [ ] All test cases passed
- [ ] No console errors
- [ ] No build warnings
- [ ] Offline mode verified
- [ ] Heatmap calculations correct
- [ ] Data persistence working
- [ ] No TypeScript errors
- [ ] Responsive on mobile/tablet/desktop
- [ ] Browser compatibility tested
- [ ] Performance acceptable
- [ ] Ready for deployment

---

## Sign-Off

**Tested By**: ___________  
**Date**: ___________  
**Overall Result**: ✅ PASS / ❌ FAIL  
**Notes**: 

---

**Test Duration**: 2-3 hours  
**Difficulty**: Medium  
**Critical Tests**: 2.1, 2.4, 3.1
