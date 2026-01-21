# Sprint 7.3 Testing Guide

## Overview

Comprehensive testing guide for Sprint 7.3 Treasury UI panels (Milestone, Cashflow, Calendario).

---

## Pre-Testing Setup

### Requirements
- [ ] Node.js 18+
- [ ] Next.js project built successfully
- [ ] Supabase project with treasury schema
- [ ] User authenticated and logged in
- [ ] Sample data in treasury tables (optional, can test empty states)

### Setup Commands

```bash
# Install dependencies
npm install

# Build project
npm run build

# Verify 0 TypeScript errors
npm run type-check

# Run development server
npm run dev

# Navigate to Treasury
# http://localhost:3000/dashboard/treasury
```

---

## Test Cases

### Test Suite 1: Component Loading

#### 1.1 Treasury Page Loads
- **Steps**:
  1. Navigate to `/dashboard/treasury`
  2. Wait for page to fully load
- **Expected Result**: 
  - Page renders without errors
  - All 8 tabs are visible
  - Overview tab shows content (Sprint 7.2)
  - No console errors

#### 1.2 All Tabs Visible
- **Steps**:
  1. On Treasury page
  2. Scroll tab navigation (if needed)
  3. Verify all 8 tabs are present
- **Expected Result**:
  ```
  📊 Overview
  🎯 Milestone    ← NEW
  📈 Cashflow     ← NEW
  📅 Calendario   ← NEW
  💰 Splits
  ⚠️  Umbral
  🛡️  Anti-DD
  🔥 Heatmap
  ```

#### 1.3 Emoji Icons Display
- **Steps**:
  1. Check tab labels in browser
  2. Verify emoji render correctly (not as squares)
- **Expected Result**: All emojis display as proper icons, not placeholder squares

---

### Test Suite 2: Milestone Panel

#### 2.1 Panel Loads Without Error
- **Steps**:
  1. Click "🎯 Milestone" tab
  2. Wait for content to render
  3. Check browser console
- **Expected Result**:
  - Panel renders without errors
  - No "Cannot read property" errors
  - No Supabase fetch errors (unless schema not deployed)

#### 2.2 Account Balances Display
- **Steps**:
  1. On Milestone panel
  2. Look for account balance cards
- **Expected Result** (if data exists):
  - Shows one card per account
  - Card header: account name
  - Card displays: current balance
  - Balance formatted as currency (e.g., "$1,234.56")

#### 2.3 Milestone Progress Bar
- **Steps**:
  1. On Milestone panel
  2. Look for progress bar section
  3. Check color and percentage
- **Expected Result** (if data exists):
  - Shows milestone target
  - Progress bar visible (blue color)
  - Percentage displayed (0-100%)
  - "Remaining to target" amount shown

#### 2.4 Tax Buffer Progress
- **Steps**:
  1. On Milestone panel
  2. Look for tax buffer section (green card)
- **Expected Result** (if data exists):
  - Shows accumulated tax buffer
  - Shows target amount
  - Progress bar displays (green color)
  - Percentage calculated correctly

#### 2.5 Bonus Vault Display
- **Steps**:
  1. On Milestone panel
  2. Look for bonus section (purple card)
- **Expected Result** (if data exists):
  - Shows bonus vault balance
  - Icon displayed (🎁)
  - Amount formatted as currency

#### 2.6 Empty State
- **Steps**:
  1. If no accounts exist in database
  2. Check Milestone panel
- **Expected Result**:
  - Graceful empty state (no error)
  - Message or empty grid displayed

---

### Test Suite 3: Cashflow Panel

#### 3.1 Panel Loads Without Error
- **Steps**:
  1. Click "📈 Cashflow" tab
  2. Wait for content to render
  3. Check browser console
- **Expected Result**:
  - Panel renders without errors
  - No TypeScript/runtime errors
  - Responsive layout

#### 3.2 Summary Cards Display
- **Steps**:
  1. On Cashflow panel
  2. Look for 4 summary cards
- **Expected Result** (if data exists):
  - Card 1: Total Income (green) with emoji 💚
  - Card 2: Total Expenses (red) with emoji 💔
  - Card 3: Transfers (blue) with emoji 🔵
  - Card 4: Payouts (purple) with emoji 🟣
  - Each card shows total amount and count

#### 3.3 Income/Expense Calculations
- **Steps**:
  1. On Cashflow panel
  2. Note the summary totals
  3. Check against sample data
- **Expected Result**:
  - Income = sum of all positive transactions
  - Expenses = sum of all negative transactions
  - Math is accurate

#### 3.4 Recent Transactions List
- **Steps**:
  1. On Cashflow panel
  2. Scroll down to "Recent Transactions"
  3. Count items displayed
- **Expected Result** (if data exists):
  - Shows max 10 transactions
  - Scrollable if more than 10
  - Each transaction shows:
    - Type badge (colored label)
    - Description
    - Date
    - Signed amount (green/red)

#### 3.5 Transaction Type Badges
- **Steps**:
  1. On Cashflow panel
  2. Check transaction type labels
- **Expected Result**:
  - Income: green badge
  - Expense: red badge
  - Transfer: blue badge
  - Adjustment: yellow badge

#### 3.6 Scheduled Payouts List
- **Steps**:
  1. On Cashflow panel
  2. Look for "Scheduled Payouts" section
- **Expected Result** (if payouts exist):
  - Shows max 10 payouts
  - Each payout shows:
    - Status badge (Planned/Sent/Received/Canceled)
    - Withdrawal method
    - Scheduled date
    - Amount

#### 3.7 Period Budgets Section
- **Steps**:
  1. On Cashflow panel
  2. Look for "Period Budgets" section
- **Expected Result** (if budgets exist):
  - Shows max 5 budgets
  - Each budget shows:
    - Period date range
    - Target income
    - Target expense
    - Target payout

#### 3.8 Scrolling Behavior
- **Steps**:
  1. On Cashflow panel
  2. Try to scroll lists (transactions, payouts)
- **Expected Result**:
  - Lists are scrollable
  - Fixed height containers
  - No layout shift

---

### Test Suite 4: Calendario Panel

#### 4.1 Panel Loads Without Error
- **Steps**:
  1. Click "📅 Calendario" tab
  2. Wait for content to render
  3. Check console
- **Expected Result**:
  - Panel renders without errors
  - No fetch errors
  - Timeline visible

#### 4.2 Date Grouping
- **Steps**:
  1. On Calendario panel
  2. Look for date headers
- **Expected Result** (if data exists):
  - Items grouped by date
  - Date format: "Monday, Jan 15, 2024" or similar
  - Dates sorted descending (most recent first)

#### 4.3 Item Type Icons
- **Steps**:
  1. On Calendario panel
  2. Check icons for each item
- **Expected Result**:
  - Income items: 📊 icon
  - Expense items: 💸 icon
  - Transfer items: 🔄 icon
  - Adjustment items: ⚙️ icon
  - Planned payouts: 📅 icon
  - Sent payouts: 📤 icon
  - Received payouts: ✅ icon
  - Canceled payouts: ❌ icon

#### 4.4 Item Details
- **Steps**:
  1. On Calendario panel
  2. Check transaction/payout details
- **Expected Result**:
  - Shows description/method
  - Shows signed amount
  - Amount color: green for +, red for -

#### 4.5 Timeline Limit
- **Steps**:
  1. On Calendario panel with lots of data
  2. Count visible items
- **Expected Result**:
  - Shows max 30 days
  - Oldest items may be cut off
  - Performance remains good

#### 4.6 Legend Display
- **Steps**:
  1. On Calendario panel
  2. Scroll to bottom
  3. Look for legend section
- **Expected Result**:
  - Legend visible at bottom
  - Shows all 8 icons with labels
  - Legend helps understand item types

#### 4.7 Empty State
- **Steps**:
  1. If no transactions/payouts exist
  2. Check Calendario panel
- **Expected Result**:
  - Graceful empty state (no crash)
  - Helpful message or empty timeline

---

### Test Suite 5: Tab Navigation

#### 5.1 Tab Switching
- **Steps**:
  1. Click different tabs in sequence
  2. Observe content change
  3. Click back to previous tabs
- **Expected Result**:
  - Tab content changes instantly
  - No loading spinner needed
  - State preserved on return

#### 5.2 Active Tab Highlight
- **Steps**:
  1. Click a tab
  2. Check tab styling
- **Expected Result**:
  - Active tab has blue bottom border
  - Inactive tabs are gray
  - Clear visual indication

#### 5.3 Tab Accessibility
- **Steps**:
  1. Use keyboard to navigate tabs (Tab key)
  2. Press Enter on selected tab
- **Expected Result**:
  - Tabs are keyboard accessible
  - Visual focus indicator appears
  - Tab switches on Enter

---

### Test Suite 6: Data Fetching

#### 6.1 Async Data Loading
- **Steps**:
  1. Monitor network tab in DevTools
  2. Navigate to Treasury page
  3. Watch API calls
- **Expected Result**:
  - Multiple Supabase queries run
  - Queries: accounts, configs, trades, transactions, payouts, budgets
  - All complete within 2 seconds

#### 6.2 Error Handling
- **Steps**:
  1. Disconnect internet or mock API failure
  2. Navigate to Treasury
  3. Check page state
- **Expected Result**:
  - Error banner displays at top
  - Shows "Failed to load treasury data"
  - Error message is user-friendly

#### 6.3 Empty Data Handling
- **Steps**:
  1. If certain tables are empty in database
  2. Navigate to respective panel
- **Expected Result**:
  - Panel handles empty arrays gracefully
  - Shows empty state instead of error
  - No console errors

---

### Test Suite 7: Responsive Design

#### 7.1 Mobile Layout
- **Steps**:
  1. Open DevTools (F12)
  2. Toggle device toolbar
  3. Select iPhone 12 (375px width)
  4. Navigate to Treasury
  5. Check all panels
- **Expected Result**:
  - Tabs stack vertically or scroll horizontally
  - Cards are full-width
  - Text readable without horizontal scroll
  - Images/icons not cut off

#### 7.2 Tablet Layout
- **Steps**:
  1. Select iPad (768px width) in DevTools
  2. Check layout
- **Expected Result**:
  - Content displays in 1-2 column layout
  - Cards arranged properly
  - Lists are readable

#### 7.3 Desktop Layout
- **Steps**:
  1. Full screen on 1920px+ monitor
  2. Check layout
- **Expected Result**:
  - Content well-organized
  - Proper spacing
  - Not stretched excessively

---

### Test Suite 8: Performance

#### 8.1 Component Load Time
- **Steps**:
  1. Open Chrome DevTools
  2. Go to Performance tab
  3. Record while switching to Milestone tab
  4. Check metrics
- **Expected Result**:
  - Tab switch completes in < 100ms
  - No long tasks (> 50ms)
  - Smooth animation if any

#### 8.2 Memory Usage
- **Steps**:
  1. Open Memory/Performance tab
  2. Take heap snapshot before Treasury
  3. Navigate to Treasury
  4. Take heap snapshot after
  5. Compare sizes
- **Expected Result**:
  - Memory increase < 5MB
  - No memory leaks after page leave
  - Cleanup on tab unload

#### 8.3 First Contentful Paint (FCP)
- **Steps**:
  1. Open Lighthouse in DevTools
  2. Run audit on Treasury page
  3. Check FCP metric
- **Expected Result**:
  - FCP < 1.5 seconds
  - No "Poor" ratings
  - Overall score > 90

---

### Test Suite 9: Browser Compatibility

Test on:
- [ ] Chrome latest
- [ ] Firefox latest
- [ ] Safari latest
- [ ] Edge latest

For each browser:
- [ ] All panels render
- [ ] Emoji icons display
- [ ] Styling looks correct
- [ ] No console errors
- [ ] Responsive layout works

---

### Test Suite 10: Integration Tests

#### 10.1 Data Consistency
- **Steps**:
  1. On Cashflow panel
  2. Note the total income
  3. Switch to Calendario panel
  4. Manually sum all income items
  5. Compare totals
- **Expected Result**:
  - Cashflow total = Calendario sum
  - Calculations consistent

#### 10.2 Cross-Panel Data
- **Steps**:
  1. Note account balance in Milestone
  2. Check same account in Overview (Sprint 7.2)
  3. Compare balances
- **Expected Result**:
  - Same balance displayed in both
  - Data consistency maintained

---

## Automated Test Suite (Optional)

If you want to add automated tests, create:

```bash
src/__tests__/
├── panels/
│   ├── Milestone.test.tsx
│   ├── Cashflow.test.tsx
│   └── Calendario.test.tsx
└── treasury/
    ├── calculations.test.ts
    └── queries.test.ts
```

Example test:
```typescript
// Milestone.test.tsx
import { render, screen } from '@testing-library/react';
import MilestonePanel from '@/components/treasury/panels/Milestone.client';

describe('MilestonePanel', () => {
  it('renders without crashing', () => {
    render(
      <MilestonePanel 
        accounts={[]} 
        configs={[]} 
        trades={[]} 
      />
    );
    expect(screen.getByText(/milestone/i)).toBeInTheDocument();
  });
});
```

---

## Test Reporting

### Test Case Template

```markdown
### Test: [Test Name]
- **Status**: ✅ PASS / ❌ FAIL
- **Expected**: [What should happen]
- **Actual**: [What actually happened]
- **Notes**: [Any additional observations]
- **Environment**: [Browser, OS, Screen size]
- **Timestamp**: [When test was run]
```

### Example Report

```markdown
### Test: 3.2 Summary Cards Display
- **Status**: ✅ PASS
- **Expected**: Shows 4 summary cards (income, expenses, transfers, payouts)
- **Actual**: All 4 cards rendered with correct colors and icons
- **Notes**: Icons displayed correctly, numbers formatted as currency
- **Environment**: Chrome 120, Windows 11, 1920x1080
- **Timestamp**: 2024-01-15 14:30 UTC
```

---

## Regression Testing

After deployment, run these tests weekly:

- [ ] All 8 tabs load
- [ ] Milestone panel displays data
- [ ] Cashflow summary calculations correct
- [ ] Calendario timeline sorted properly
- [ ] No console errors
- [ ] Responsive design intact
- [ ] Data loads within 2 seconds

---

## Troubleshooting During Testing

### Issue: "Cannot read property X of undefined"
- **Cause**: Component expecting data that's not provided
- **Fix**: Check props being passed, verify data shape matches interface

### Issue: Styling looks different
- **Cause**: TailwindCSS not compiled correctly
- **Fix**: Run `npm run build` or restart dev server

### Issue: Empty panels when data exists
- **Cause**: Data fetch failed silently
- **Fix**: Check browser console for PGRST errors, verify RLS policies

### Issue: Emoji not displaying
- **Cause**: Font rendering issue or unsupported emoji
- **Fix**: Update OS/browser, check console for errors

---

## Success Criteria

✅ Testing complete when:

1. All test cases in Suites 1-5 pass
2. At least one responsive design test passes
3. At least one performance test passes
4. No console errors or warnings
5. All three panels load and display data (or empty states)
6. Tab navigation works smoothly
7. No breaking changes from Sprint 7.2

---

## Sign-Off

- [ ] All tests passed
- [ ] No blocking issues found
- [ ] Ready for production deployment
- [ ] Tested by: ___________
- [ ] Date: ___________

---

**Test Estimated Duration**: 1-2 hours  
**Test Difficulty**: Low-Medium  
**Critical Tests**: 3.2, 4.2, 5.1, 6.1
