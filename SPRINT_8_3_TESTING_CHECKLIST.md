# Sprint 8.3 Testing Checklist
## Export CSV + Offline Snapshot

**Status**: Ready for QA  
**Sprint**: 8.3  
**Feature**: Treasury Export (CSV) + Offline Snapshot (Calendar + Payouts)  
**Test Date**: January 18, 2026  

---

## Test Environment Setup

### Prerequisites
1. **Active Supabase project** with latest migrations applied (013)
2. **Test user account** with:
   - At least 1 treasury account configured
   - At least 5 transactions (mixed types: income, expense)
   - At least 2 payouts in current/previous month
   - At least 1 closed trade with PnL
   - At least 3 calendar events (mixed types)
3. **Browser DevTools** for offline simulation and IndexedDB inspection
4. **Test data**: Consistent data across test run

### Manual Environment Setup
```bash
# Start development server
npm run dev

# Navigate to Treasury
http://localhost:3000/dashboard/treasury

# Check network tab for new endpoints:
# - GET /api/treasury/export?month=2026-01
# - Network throttling for offline simulation
```

---

## Test Suite 1: Export CSV Functionality

### Test 1.1: Export CSV - Current Month
**Objective**: Verify export endpoint returns valid CSV for current month  
**Steps**:
1. Navigate to Cashflow tab
2. Note current month (e.g., January 2026)
3. Verify month input field is pre-populated with current month (YYYY-MM)
4. Click "Export CSV" button
5. Check browser console for errors
6. Wait for CSV download to complete

**Expected Results**:
- ✅ Download completes without errors
- ✅ File named `treasury-export-2026-01.csv` appears in downloads
- ✅ File size > 100 bytes (non-empty)
- ✅ No network errors in DevTools

**Acceptance Criteria**:
- File downloads successfully
- Filename matches month format

---

### Test 1.2: Export CSV - Previous Month
**Objective**: Verify export works for past months  
**Steps**:
1. In Cashflow, click month input
2. Select previous month (e.g., December 2025)
3. Click "Export CSV" button
4. Verify download completes

**Expected Results**:
- ✅ File `treasury-export-2025-12.csv` downloads
- ✅ File contains data only from December 2025
- ✅ No current month data appears in export

**Acceptance Criteria**:
- Export filters by correct month
- Past month data exports correctly

---

### Test 1.3: Export CSV - Future Month (Empty)
**Objective**: Verify export handles months with no data  
**Steps**:
1. Select future month (e.g., June 2026)
2. Click "Export CSV" button
3. Download and open file

**Expected Results**:
- ✅ Export completes (no error)
- ✅ CSV shows "Summary" section with zeros
- ✅ CSV shows "Payouts: (No payouts in this period)"
- ✅ CSV shows "Transactions: (No transactions in this period)"

**Acceptance Criteria**:
- Empty months export gracefully
- No crashes or API errors

---

### Test 1.4: Export CSV - File Format & Content
**Objective**: Verify CSV structure and data formatting  
**Steps**:
1. Export current month
2. Open CSV in text editor (not Excel, to see raw content)
3. Verify structure

**Expected Content**:
- Line 1: "SUMMARY"
- Line 2: "Metric,Value"
- Lines 3-10: Summary metrics (Export Month, Export Date, Total Closed PnL, etc.)
- Blank line
- "PAYOUTS" section with header row and data
- Blank line
- "TRANSACTIONS" section with header row and data
- Footer with generation timestamp

**Format Checks**:
- ✅ Commas separate fields
- ✅ Fields with commas/quotes are properly escaped
- ✅ UTF-8 encoding (no garbled text)
- ✅ Currency values formatted with 2 decimals (e.g., "1234.56")
- ✅ Dates formatted as YYYY-MM-DD

**Acceptance Criteria**:
- CSV format is valid and parseable
- Data types are correct (currency, dates, strings)
- No truncated fields

---

### Test 1.5: Export CSV - Excel Compatibility
**Objective**: Verify CSV opens correctly in Excel  
**Steps**:
1. Export current month
2. Open CSV in Microsoft Excel or LibreOffice Calc
3. Verify all data displays correctly

**Expected Results**:
- ✅ File opens without warnings
- ✅ Summary section displays: Metric in col A, Value in col B
- ✅ Payouts section shows account, date, amount, status columns
- ✅ Transactions section shows date, account, type, amount columns
- ✅ Currency values display correctly (no ### symbols)
- ✅ Dates are recognized as dates (not text)

**Acceptance Criteria**:
- CSV is Excel-compatible
- Data displays in proper columns
- No encoding issues

---

### Test 1.6: Export - Error Handling (No Auth)
**Objective**: Verify API requires authentication  
**Steps**:
1. Open DevTools Network tab
2. Clear all cookies/session storage
3. Attempt export
4. Check Network tab for API response

**Expected Results**:
- ✅ API returns 401 Unauthorized
- ✅ UI shows error: "Unauthorized: No session"
- ✅ CSV does not download

**Acceptance Criteria**:
- Unauthenticated users cannot export
- Error message is clear

---

### Test 1.7: Export - Error Handling (Invalid Month Format)
**Objective**: Verify month validation  
**Steps**:
1. In Cashflow month input, enter invalid format (e.g., "01-2026" or "2026")
2. Click Export
3. Check response

**Expected Results**:
- ✅ Error message: "Invalid month format. Use YYYY-MM"
- ✅ CSV does not download

**Acceptance Criteria**:
- Month format is validated
- Clear error messages provided

---

## Test Suite 2: Offline Snapshot - Treasury Data Persistence

### Test 2.1: Snapshot - Verify IndexedDB Storage
**Objective**: Confirm treasury data is saved to IndexedDB  
**Steps**:
1. In Treasury, navigate to Overview tab (view all data)
2. Open DevTools → Application → IndexedDB → alphalog → snapshots
3. Inspect `dashboard:v1` object
4. Expand `treasury` object

**Expected Results**:
- ✅ IndexedDB database exists (alphalog)
- ✅ `snapshots` object store contains `dashboard:v1` key
- ✅ `treasury` object contains:
  - `accounts[]` (non-empty)
  - `configs[]` (non-empty if configs exist)
  - `calendar_events[]` (non-empty if events exist)
  - `payouts[]` (non-empty if payouts exist)
  - `transactions[]` (non-empty)

**Acceptance Criteria**:
- Treasury data is persisted to IndexedDB
- All expected fields are present

---

### Test 2.2: Snapshot - Update on Page Refresh
**Objective**: Verify snapshot updates when data changes  
**Steps**:
1. In Treasury, note number of transactions visible
2. Check IndexedDB: record `treasury.transactions.length`
3. Refresh page (F5)
4. Check IndexedDB again

**Expected Results**:
- ✅ `updatedAt` timestamp in snapshot is recent
- ✅ Transaction count matches visible data
- ✅ No errors in console

**Acceptance Criteria**:
- Snapshot auto-updates on data load
- Data is current

---

### Test 2.3: Offline - Simulate Offline Mode
**Objective**: Test offline capability with cached data  
**Steps**:
1. In DevTools, go to Network tab
2. Throttle to "Offline" (or uncheck "Disable cache")
3. With offline mode active, reload page
4. Navigate to Cashflow tab
5. Navigate to Calendario tab

**Expected Results**:
- ✅ Page loads without network error
- ✅ Cashflow shows cached payouts data (read-only)
- ✅ Calendario shows cached calendar events (read-only)
- ✅ Yellow badge "📴 Offline (Read-Only)" appears
- ✅ Export button is visible but grayed out (or error if clicked)
- ✅ "Cannot create events" error if trying to create event

**Acceptance Criteria**:
- Treasury pages display offline (read-only)
- Offline indicator is visible
- No crashes or runtime errors

---

### Test 2.4: Offline - Calendario Read-Only Mode
**Objective**: Verify Calendario is read-only when offline  
**Steps**:
1. Go offline (DevTools → Network → Offline)
2. Navigate to Calendario tab
3. Attempt to:
   - Click on a day to create event
   - Click on existing event
   - Modify event

**Expected Results**:
- ✅ Calendar displays events from snapshot
- ✅ "📴 Offline (Read-Only)" badge visible
- ✅ Clicking day shows error: "Cannot create events in offline mode"
- ✅ Event modal does not open (or opens in read-only view)
- ✅ No API calls are attempted

**Acceptance Criteria**:
- Calendar is read-only offline
- Users are prevented from editing
- Error messages are clear

---

### Test 2.5: Offline - Cashflow Payouts Display
**Objective**: Verify Cashflow shows payouts when offline  
**Steps**:
1. Go offline
2. Navigate to Cashflow tab
3. Check payouts list and summary cards

**Expected Results**:
- ✅ Payout summary cards display (Total Payouts card)
- ✅ Payout data matches online view
- ✅ No network errors in console
- ✅ Export section visible with month input + button

**Acceptance Criteria**:
- Offline cashflow displays cached payouts
- All data is readable

---

### Test 2.6: Offline - Snapshot Backward Compatibility
**Objective**: Verify new calendar_events field doesn't break old snapshots  
**Steps**:
1. In IndexedDB, manually delete `calendar_events` array from treasury object
2. Go offline
3. Navigate to Calendario

**Expected Results**:
- ✅ No crashes
- ✅ Calendar displays with empty events list (or graceful fallback)
- ✅ No console errors

**Acceptance Criteria**:
- New field is optional
- Old snapshots still work

---

## Test Suite 3: Offline - Transition Back Online

### Test 3.1: Offline → Online Transition
**Objective**: Verify app re-syncs when connection restored  
**Steps**:
1. Go offline in DevTools
2. Verify Treasury data displays (from snapshot)
3. Go back online (disable throttling)
4. Refresh page
5. Check if data is fresh

**Expected Results**:
- ✅ Page loads without offline badge
- ✅ Data is fresh from server (not cached)
- ✅ No sync errors

**Acceptance Criteria**:
- Transition to online is seamless
- Data re-syncs correctly

---

### Test 3.2: Create Event - Requires Online Session
**Objective**: Verify offline modal prevents event creation  
**Steps**:
1. Go offline
2. Try to create calendar event
3. Go back online
4. Try to create event again

**Expected Results**:
- **Offline**: Error message "Cannot create events in offline mode"
- **Online**: Modal opens normally, event can be created

**Acceptance Criteria**:
- Event creation requires online session
- Transition is smooth

---

## Test Suite 4: Export Data Accuracy

### Test 4.1: Export Summary - PnL Calculation
**Objective**: Verify closed PnL is calculated correctly  
**Steps**:
1. Create/prepare 2 closed trades with known PnL (e.g., +100, -50)
2. Export month containing these trades
3. Check "Total Closed PnL" in CSV

**Expected Results**:
- ✅ Total Closed PnL = 50 (100 - 50)
- ✅ Only closed trades are counted
- ✅ Open trades are not included

**Acceptance Criteria**:
- PnL calculation is accurate
- Only closed trades count

---

### Test 4.2: Export Summary - Payouts by Status
**Objective**: Verify payout amounts are grouped by status  
**Steps**:
1. Create 3 payouts with different statuses:
   - "planned" $1000
   - "sent" $500
   - "received" $300
2. Export month
3. Verify summary section

**Expected Results**:
- ✅ Total Payouts Planned: 1000.00
- ✅ Total Payouts Sent: 500.00
- ✅ Total Payouts Received: 300.00

**Acceptance Criteria**:
- Payouts are correctly grouped by status
- Amounts are accurate

---

### Test 4.3: Export Payouts Section - Fields
**Objective**: Verify all payout fields export correctly  
**Steps**:
1. Create payout with:
   - Account: "Trading Account"
   - Status: "sent"
   - Cash Amount: $1234.56
   - Tax Reserve: $200.00
   - Bonus Vault: $100.00
2. Export
3. Find payout in CSV

**Expected Results**:
- ✅ Account column: "Trading Account"
- ✅ Status column: "sent"
- ✅ Cash Amount column: "1234.56"
- ✅ Tax Reserve column: "200.00"
- ✅ Bonus Vault column: "100.00"
- ✅ All dates formatted as YYYY-MM-DD

**Acceptance Criteria**:
- All payout fields export
- Formatting is correct

---

### Test 4.4: Export Transactions Section - Fields
**Objective**: Verify all transaction fields export correctly  
**Steps**:
1. Create transaction:
   - Type: "income"
   - Amount: $5000.00
   - Description: "Monthly profit"
   - Balance After: $25000.00
2. Export
3. Find transaction in CSV

**Expected Results**:
- ✅ Type column: "income"
- ✅ Amount column: "5000.00"
- ✅ Description column: "Monthly profit"
- ✅ Balance After column: "25000.00"
- ✅ Date formatted as YYYY-MM-DD

**Acceptance Criteria**:
- All transaction fields export
- Data integrity maintained

---

## Test Suite 5: UI Integration Tests

### Test 5.1: UI - Export Button Visibility
**Objective**: Verify export UI is properly integrated  
**Steps**:
1. Navigate to Cashflow tab
2. Look for "Export" section

**Expected Results**:
- ✅ "Export" heading visible
- ✅ Month input field visible (pre-populated with current month)
- ✅ "Export CSV" button visible (cyan-600 color)
- ✅ Help text below: "Exports monthly summary with payouts and transactions in CSV format"

**Acceptance Criteria**:
- UI is properly positioned
- All elements visible
- Styling matches design

---

### Test 5.2: UI - Month Input Functionality
**Objective**: Verify month picker works  
**Steps**:
1. Click month input field
2. Select different month
3. Verify value updates

**Expected Results**:
- ✅ Month picker opens (native HTML5 input)
- ✅ Can select past/future months
- ✅ Input shows selected month in YYYY-MM format
- ✅ Export button uses selected month

**Acceptance Criteria**:
- Month input is functional
- Format is correct

---

### Test 5.3: UI - Offline Badge
**Objective**: Verify offline indicator displays correctly  
**Steps**:
1. Go offline
2. Navigate to Calendario
3. Check for offline badge

**Expected Results**:
- ✅ "📴 Offline (Read-Only)" badge appears in header
- ✅ Badge is yellow/warning color
- ✅ Badge is positioned clearly visible

**Acceptance Criteria**:
- Offline indicator is visible
- Badge is clear and distinguishable

---

## Test Suite 6: Performance & Edge Cases

### Test 6.1: Performance - Export Large Dataset
**Objective**: Verify export performance with large dataset  
**Steps**:
1. In treasury, create month with:
   - 100+ transactions
   - 50+ payouts
   - Multiple accounts
2. Export month

**Expected Results**:
- ✅ Export completes within 5 seconds
- ✅ CSV file size is reasonable (< 1MB)
- ✅ No memory warnings in DevTools

**Acceptance Criteria**:
- Export is performant
- No UI freezing

---

### Test 6.2: Edge Case - No Data in Month
**Objective**: Verify handling of empty months  
**Steps**:
1. Select month with zero transactions/payouts
2. Export

**Expected Results**:
- ✅ Export succeeds
- ✅ CSV shows "Summary" with zeros
- ✅ Shows "(No payouts in this period)" message
- ✅ Shows "(No transactions in this period)" message

**Acceptance Criteria**:
- Empty months export gracefully
- Clear messaging for empty sections

---

### Test 6.3: Edge Case - Special Characters in Data
**Objective**: Verify CSV escaping of special characters  
**Steps**:
1. Create transaction with description containing:
   - Commas: "Profit, taxes, fees"
   - Quotes: 'Income from "client"'
   - Newlines (if possible)
2. Export
3. Open CSV in text editor and Excel

**Expected Results**:
- ✅ Fields with special characters are quoted
- ✅ Quotes inside fields are escaped (doubled)
- ✅ Excel opens correctly without data corruption
- ✅ Text editor shows proper escaping

**Acceptance Criteria**:
- Special characters are properly handled
- CSV is valid

---

### Test 6.4: Edge Case - International Characters
**Objective**: Verify UTF-8 handling  
**Steps**:
1. Create transaction with non-ASCII description (e.g., "Ingreso en €" or "日本円")
2. Export
3. Open in Excel

**Expected Results**:
- ✅ Characters display correctly in text editor
- ✅ Characters display correctly in Excel
- ✅ No garbled text

**Acceptance Criteria**:
- UTF-8 encoding works
- International characters supported

---

## Test Suite 7: Regression Tests

### Test 7.1: Regression - Existing Treasury Features Work
**Objective**: Verify export feature doesn't break existing functionality  
**Steps**:
1. Create new transaction (Cashflow → Transactions)
2. Create new payout (Cashflow → Payout Engine)
3. Create calendar event (Calendario)
4. All operations should work without export feature interfering

**Expected Results**:
- ✅ Transaction creation works
- ✅ Payout creation works
- ✅ Event creation works
- ✅ No errors in console
- ✅ UI is responsive

**Acceptance Criteria**:
- Existing features unaffected
- No regressions introduced

---

### Test 7.2: Regression - Offline Mode Doesn't Affect Online
**Objective**: Verify offline code doesn't interfere with online usage  
**Steps**:
1. Navigate Treasury normally (online)
2. Create events, transactions, payouts
3. Verify all operations work without offline checks interfering

**Expected Results**:
- ✅ All operations complete successfully
- ✅ No performance degradation
- ✅ No unexpected offline badges

**Acceptance Criteria**:
- Online experience unchanged
- Performance maintained

---

## Sign-Off Checklist

### Functional Requirements
- [ ] CSV export generates valid files
- [ ] CSV contains all required sections (Summary, Payouts, Transactions)
- [ ] Export includes summary metrics (PnL, payouts by status, tax/bonus reserves)
- [ ] Month filtering works correctly
- [ ] File downloads to user's device

### Offline Support
- [ ] Treasury data persists to IndexedDB
- [ ] Calendar displays when offline from snapshot
- [ ] Payouts display when offline from snapshot
- [ ] "Offline (Read-Only)" badge appears
- [ ] Event creation prevented when offline
- [ ] Transition online/offline works smoothly

### Data Integrity
- [ ] No data corruption in exports
- [ ] Special characters properly escaped
- [ ] International characters supported
- [ ] Date/currency formatting correct
- [ ] Accurate calculations (PnL, payouts)

### UX/Accessibility
- [ ] Export button visible and functional
- [ ] Month input works intuitively
- [ ] Error messages are clear
- [ ] Offline state is obvious to user
- [ ] No console errors

### Performance
- [ ] Export completes within 5 seconds
- [ ] Large datasets handled efficiently
- [ ] No UI freezing
- [ ] IndexedDB operations don't slow UI

### Backward Compatibility
- [ ] New snapshot fields don't break old data
- [ ] Existing treasury features work
- [ ] No regressions from previous sprints

---

## Known Issues / Notes

(To be filled during testing)

---

## Test Summary

**Total Test Cases**: 32  
**Passed**: ___  
**Failed**: ___  
**Blocked**: ___  
**Date Completed**: ___________  
**Tested By**: ___________  

## QA Sign-Off

**QA Engineer Signature**: ___________  
**Date**: ___________  
**Approved for Deployment**: ☐ Yes ☐ No

---

**Notes**:
- All test cases should be executed in fresh test database
- If any test fails, create bug with steps to reproduce
- Compare behavior against acceptance criteria
- Document any environment-specific issues

---

End of SPRINT_8_3_TESTING_CHECKLIST.md
