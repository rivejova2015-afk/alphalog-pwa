# Sprint 8.2 - Treasury Calendario: Testing Checklist

**Build Date**: January 18, 2026  
**Sprint**: 8.2  
**Feature**: Treasury Calendar with monthly grid, custom events, and withdrawal day reminders  

---

## Pre-Testing Checklist

- [ ] Database migration 013 applied successfully
- [ ] npm run build passes with 0 errors
- [ ] Supabase environment configured
- [ ] CRON_SECRET and ALPHALOG_WEB_URL set in .env.local
- [ ] Web push subscriptions available (from Sprint 6A+)

---

## Test Suite 1: Calendar Grid Display

### 1.1 - Calendar Renders Current Month
**Steps**:
1. Navigate to `/dashboard/treasury` → **Calendario** tab
2. Verify calendar grid shows current month
3. Verify week day headers (Sun-Sat)
4. Verify all days of month displayed correctly

**Expected Result**: ✓ Calendar grid visible with correct month/year

---

### 1.2 - Calendar Navigation Previous Month
**Steps**:
1. Click **← Previous** button
2. Verify month changes to previous
3. Repeat 3 times (navigate backwards 3 months)
4. Verify dates are correct for each month

**Expected Result**: ✓ Month changes backward correctly

---

### 1.3 - Calendar Navigation Next Month
**Steps**:
1. Click **Next →** button
2. Verify month changes to next
3. Repeat 3 times (navigate forward 3 months)
4. Verify dates are correct for each month

**Expected Result**: ✓ Month changes forward correctly

---

### 1.4 - Today's Date Highlighted
**Steps**:
1. Navigate to current month
2. Find today's date in the calendar
3. Verify it has blue background and blue border (isToday class)

**Expected Result**: ✓ Today's date has distinct styling

---

## Test Suite 2: Withdrawal Day Display

### 2.1 - Withdrawal Day Shows in Calendar
**Setup**:
- Create a treasury config with withdrawal_day = 15
- Account display_name = "Main Account"

**Steps**:
1. Navigate to Calendario tab
2. Find the 15th day of current month
3. Verify purple chip appears: "💳 Main Account"

**Expected Result**: ✓ Purple chip with "💳 Main Account" visible

---

### 2.2 - Multiple Withdrawal Days Per Day
**Setup**:
- Create 2+ configs with withdrawal_day = 20 (different accounts)

**Steps**:
1. Navigate to Calendario tab
2. Find the 20th day
3. Verify multiple purple chips appear (one per account)

**Expected Result**: ✓ All withdrawal day chips displayed

---

### 2.3 - Withdrawal Days Accurate Across Months
**Steps**:
1. Create config with withdrawal_day = 10
2. Navigate through 3 different months
3. Verify "💳" chip appears on the 10th in each month

**Expected Result**: ✓ Withdrawal day chips appear correctly across all months

---

## Test Suite 3: Custom Events - Create

### 3.1 - Open Event Modal (Create)
**Steps**:
1. Navigate to Calendario tab
2. Click on any empty day cell
3. Verify "Create Event" modal opens

**Expected Result**: ✓ Modal visible with form

---

### 3.2 - Create Event Validation - Missing Account
**Steps**:
1. Click on a day to open Create modal
2. Leave Account dropdown empty
3. Enter Date, Title, select Type
4. Click **Save**

**Expected Result**: ✓ Error message: "Please select an account"

---

### 3.3 - Create Event Validation - Missing Date
**Steps**:
1. Open Create modal
2. Select Account only
3. Leave Date empty
4. Click **Save**

**Expected Result**: ✓ Error message: "Please select a date"

---

### 3.4 - Create Event Validation - Missing Title
**Steps**:
1. Open Create modal
2. Select Account and Date
3. Leave Title empty
4. Click **Save**

**Expected Result**: ✓ Error message: "Please enter a title"

---

### 3.5 - Create Event - Note Type
**Steps**:
1. Open Create modal for date = 2026-01-25
2. Select Account = "Main Account"
3. Title = "Team meeting"
4. Type = "Note" (default)
5. Push enabled = true (checked)
6. Click **Save**

**Expected Result**: ✓ Event created, modal closes, event appears on calendar with light gray background

---

### 3.6 - Create Event - Payout Day Type
**Steps**:
1. Open Create modal for date = 2026-02-15
2. Select Account = "Trading Account"
3. Title = "Monthly payout"
4. Type = "Payout Day"
5. Push enabled = true
6. Click **Save**

**Expected Result**: ✓ Event created with green background (payout_day styling)

---

### 3.7 - Create Event - Push Disabled
**Steps**:
1. Open Create modal
2. Fill all required fields
3. **Uncheck** "Enable push notification reminder"
4. Click **Save**

**Expected Result**: ✓ Event created with push_enabled = false

---

### 3.8 - Create Event - Duplicate Prevention
**Setup**:
- Event exists: 2026-01-20, "Test Event", type="note"

**Steps**:
1. Try to create another event with same:
   - account_id
   - event_date = 2026-01-20
   - kind = "note"
2. Click **Save**

**Expected Result**: ✓ Error: "Event already exists for this date and type"

---

## Test Suite 4: Custom Events - Display

### 4.1 - Event Appears on Calendar
**Setup**:
- Create event: date=2026-01-18, title="Daily standup", type="note", push_enabled=true

**Steps**:
1. Navigate to Calendario
2. Find the 18th
3. Verify event chip appears with text "🔔 Daily standup"

**Expected Result**: ✓ Event chip visible with push icon (bell)

---

### 4.2 - Event Without Push Notification
**Setup**:
- Create event: date=2026-01-18, title="Optional meeting", push_enabled=false

**Steps**:
1. Navigate to Calendario
2. Find the 18th
3. Verify event appears WITHOUT bell icon (🔔)

**Expected Result**: ✓ Event chip shows "Optional meeting" (no bell)

---

### 4.3 - Multiple Events Per Day
**Setup**:
- Create 3 events on same date = 2026-01-22

**Steps**:
1. Navigate to Calendario
2. Find the 22nd
3. Verify all 3 event chips appear
4. Check that they're stacked/scrollable if space limited

**Expected Result**: ✓ All events visible

---

### 4.4 - Event Color Coding
**Setup**:
- Event A: type="payout_day" (green)
- Event B: type="payout_cycle" (blue)
- Event C: type="note" (gray)

**Steps**:
1. Create all 3 on different dates
2. Navigate to Calendario
3. Verify color coding:
   - payout_day: 🟢 green background
   - payout_cycle: 🔵 blue background
   - note: ⚫ gray background

**Expected Result**: ✓ All three colors visible and correct

---

## Test Suite 5: Custom Events - Edit

### 5.1 - Open Event Modal (Edit)
**Setup**:
- Event exists on calendar

**Steps**:
1. Click on the event chip
2. Verify modal opens with "Edit Event" title
3. Verify all fields are pre-filled

**Expected Result**: ✓ Edit modal with pre-filled values

---

### 5.2 - Edit Event Title
**Setup**:
- Event with title = "Old Title"

**Steps**:
1. Click event to open Edit modal
2. Change Title to "New Title"
3. Click **Save**

**Expected Result**: ✓ Event updated, calendar refreshes, new title displayed

---

### 5.3 - Edit Event Type
**Setup**:
- Event with type="note" (gray)

**Steps**:
1. Click event
2. Change Type to "Payout Day"
3. Click **Save**

**Expected Result**: ✓ Event background changes to green

---

### 5.4 - Edit Event Push Enabled
**Setup**:
- Event with push_enabled=true (shows 🔔)

**Steps**:
1. Click event
2. **Uncheck** "Enable push notification"
3. Click **Save**

**Expected Result**: ✓ Event updated, bell icon disappears from chip

---

### 5.5 - Edit Event Date
**Setup**:
- Event on 2026-01-15

**Steps**:
1. Click event
2. Change date to 2026-01-22
3. Click **Save**

**Expected Result**: ✓ Event moves to new date on calendar

---

## Test Suite 6: Custom Events - Delete

### 6.1 - Delete Event Button Visible
**Setup**:
- Event exists on calendar

**Steps**:
1. Click event to open Edit modal
2. Verify **Delete** button visible (red)

**Expected Result**: ✓ Delete button visible in modal

---

### 6.2 - Delete Event Confirmation
**Steps**:
1. Click Delete button
2. Verify confirmation dialog appears

**Expected Result**: ✓ JS confirm() dialog appears

---

### 6.3 - Delete Event Success
**Steps**:
1. Click Delete button
2. Click "OK" in confirmation
3. Verify modal closes
4. Verify event removed from calendar

**Expected Result**: ✓ Event deleted (soft-delete via deleted_at)

---

### 6.4 - Delete Event - Cancel
**Steps**:
1. Click Delete button
2. Click "Cancel" in confirmation
3. Verify modal remains open
4. Verify event still on calendar

**Expected Result**: ✓ Deletion cancelled, event remains

---

## Test Suite 7: Cron Endpoint - Manual Testing

### 7.1 - Cron Endpoint Requires Secret
**Steps**:
1. Open terminal/Postman
2. Call: `curl GET http://localhost:3000/api/cron/treasury/withdrawal-reminders`
3. Verify 401 Unauthorized response

**Expected Result**: ✓ 401 Unauthorized (no header)

---

### 7.2 - Cron Endpoint with Invalid Secret
**Steps**:
1. Call with header: `x-cron-secret: wrong-secret`
2. Verify 401 Unauthorized response

**Expected Result**: ✓ 401 Unauthorized (wrong secret)

---

### 7.3 - Cron Endpoint with Valid Secret
**Setup**:
- CRON_SECRET set in .env.local
- User has push subscription active
- Today is a withdrawal day for an account
- Account has push_withdrawal_day_enabled=true

**Steps**:
1. Call: `curl -H "x-cron-secret: $CRON_SECRET" GET http://localhost:3000/api/cron/treasury/withdrawal-reminders`
2. Verify 200 OK response
3. Verify response includes: status, processed count, sent count

**Expected Result**: ✓ 200 OK with JSON response

---

### 7.4 - Cron Endpoint - No Active Subscriptions
**Setup**:
- No users with active push_subscriptions

**Steps**:
1. Call cron endpoint with valid secret
2. Verify response: `"processed": 0`

**Expected Result**: ✓ Gracefully returns processed=0 (no error)

---

### 7.5 - Cron Push Notification Sent
**Setup**:
- User has active push subscription
- Today is withdrawal_day for account
- Account has push_withdrawal_day_enabled=true
- last_withdrawal_push_cycle_start != today's cycle_start

**Steps**:
1. Call cron endpoint
2. Verify response: `"sent": 1` (or more)
3. Check browser: verify push notification received
4. Notification title: "Día de Retiro"
5. Notification body includes account name and "Withdrawal day reminder"

**Expected Result**: ✓ Push notification received on browser/mobile

---

### 7.6 - Cron Push Cooldown (Prevent Duplicates)
**Setup**:
- Run test 7.5 successfully
- last_withdrawal_push_cycle_start updated to today's cycle_start

**Steps**:
1. Run cron endpoint again (same day)
2. Verify response: `"sent": 0` (no new notifications)
3. Check database: last_withdrawal_push_cycle_start unchanged

**Expected Result**: ✓ No duplicate notification sent (cooldown effective)

---

### 7.7 - Cron Custom Event Notification
**Setup**:
- User has active push subscription
- Create custom event for today with push_enabled=true
- Event title = "Monthly review"

**Steps**:
1. Call cron endpoint
2. Verify response includes event in sent count
3. Check notification: body contains "Event: Monthly review"

**Expected Result**: ✓ Push notification for custom event received

---

### 7.8 - Cron Event with Push Disabled
**Setup**:
- Custom event for today with push_enabled=false

**Steps**:
1. Call cron endpoint
2. Verify response: event NOT counted in sent count
3. Verify no notification received for this event

**Expected Result**: ✓ Event skipped (push_enabled=false respected)

---

## Test Suite 8: Supabase Edge Function

### 8.1 - Edge Function Configured
**Steps**:
1. Go to Supabase Dashboard → Edge Functions
2. Verify "treasury-withdrawal-reminders" function listed
3. Verify status: enabled/active

**Expected Result**: ✓ Function visible in dashboard

---

### 8.2 - Edge Function Environment Variables
**Steps**:
1. Go to Edge Function details
2. Verify secrets are set:
   - ALPHALOG_WEB_URL
   - CRON_SECRET
3. Verify values match deployment

**Expected Result**: ✓ Secrets set and match

---

### 8.3 - Edge Function Schedule Configured
**Steps**:
1. Go to Edge Function details → "Scheduled functions"
2. Verify cron schedule visible: `5 0 * * *` (00:05 UTC daily)

**Expected Result**: ✓ Schedule visible and correct

---

### 8.4 - Edge Function Manual Trigger
**Steps**:
1. Go to Edge Function → Manual invoke
2. Trigger function
3. Wait for response
4. Verify execution succeeded

**Expected Result**: ✓ Function executed, response received

---

### 8.5 - Edge Function Logs
**Steps**:
1. Go to Edge Function → Logs
2. Find most recent execution
3. Verify logs show:
   - Start time (00:05 UTC)
   - Endpoint called
   - Response status

**Expected Result**: ✓ Logs visible, no errors

---

## Test Suite 9: Regression Tests

### 9.1 - Existing Treasury Features Unaffected
**Steps**:
1. Navigate to Overview tab → verify balance displays
2. Navigate to Cashflow tab → verify charts render
3. Navigate to Payouts tab → verify preview/create still work
4. Navigate to Splits tab → verify selector works

**Expected Result**: ✓ All existing features work normally

---

### 9.2 - Existing Configs Still Load
**Steps**:
1. Verify treasury configs load without error
2. Verify accounts with treasury config display correctly
3. Verify withdrawal_day value still stored/retrieved

**Expected Result**: ✓ Existing config data unaffected

---

### 9.3 - RLS Policies Enforced
**Setup**:
- User A and User B (different users)
- User A creates event for their account
- User B tries to access User A's event

**Steps**:
1. Log in as User A
2. Create event on calendar
3. Note the event_id
4. Log in as User B
5. Try to fetch event: `GET /api/treasury/calendar-events?eventId={event_id}`
6. Try to update event: `PATCH /api/treasury/calendar-events/{event_id}`

**Expected Result**: ✓ User B cannot access User A's events (RLS enforced)

---

## Test Suite 10: Performance & Edge Cases

### 10.1 - Calendar with Large Number of Events
**Setup**:
- Create 50+ custom events across month

**Steps**:
1. Navigate to Calendario tab
2. Verify page loads in < 2 seconds
3. Navigate between months
4. Verify month changes in < 1 second

**Expected Result**: ✓ Performance acceptable, no lag

---

### 10.2 - Event with Special Characters
**Steps**:
1. Create event with title: "Test: Event! [URGENT] 📌"
2. Verify event saves without error
3. Verify title displays correctly on calendar

**Expected Result**: ✓ Special chars and emojis handled correctly

---

### 10.3 - Event Date Boundary (Month Edge)
**Steps**:
1. Create event on 2026-01-31 (last day of January)
2. Create event on 2026-02-01 (first day of February)
3. Navigate to January
4. Verify Jan 31 event visible
5. Navigate to February
6. Verify Feb 1 event visible

**Expected Result**: ✓ Events at month boundaries display correctly

---

### 10.4 - Leap Year Handling
**Steps**:
1. Create event on 2024-02-29 (leap day)
2. Navigate to February 2024
3. Verify day 29 appears and event visible

**Expected Result**: ✓ Leap year dates handled correctly

---

## Test Suite 11: UX & Error Handling

### 11.1 - Loading State on Modal Save
**Steps**:
1. Open Create modal
2. Fill all fields
3. Click **Save**
4. Verify button text changes to "Saving..."
5. Verify form disabled during save

**Expected Result**: ✓ Loading state visible during request

---

### 11.2 - Error Message Display
**Setup**:
- Event creation fails (e.g., server error)

**Steps**:
1. Attempt to create event
2. Verify error message appears in red box
3. Verify error text is user-friendly

**Expected Result**: ✓ Error displayed clearly

---

### 11.3 - Modal Close on Success
**Steps**:
1. Create event successfully
2. Verify modal closes automatically
3. Verify calendar refreshes with new event

**Expected Result**: ✓ Modal closes, calendar updated

---

### 11.4 - Modal Close on Cancel
**Steps**:
1. Open Create modal
2. Fill some fields
3. Click **Cancel**
4. Verify modal closes
5. Verify no event created

**Expected Result**: ✓ Modal closes, no data saved

---

## Manual Testing Environment Setup

### Prerequisites
```bash
# 1. Apply database migration
supabase db push  # or apply 013_treasury_calendar_events.sql manually

# 2. Set environment variables
export CRON_SECRET="your-strong-random-secret"
export ALPHALOG_WEB_URL="http://localhost:3000"  # or deployment URL

# 3. Start dev server
npm run dev

# 4. Set up push subscription (if testing notifications)
- Navigate to app
- Grant browser permission for notifications
- Verify subscription created in push_subscriptions table
```

### Testing Notifications Locally
```bash
# 1. Call cron endpoint manually
curl -H "x-cron-secret: $CRON_SECRET" \
  http://localhost:3000/api/cron/treasury/withdrawal-reminders

# 2. Check response
# Should show: {"status": "success", "processed": X, "sent": Y}

# 3. Verify push notification in browser
# Should see "Día de Retiro" notification
```

---

## Sign-Off

**QA Tester Name**: ________________  
**Test Date**: ________________  
**Build Version**: Sprint 8.2  
**Overall Status**: 

- [ ] All tests PASSED ✓
- [ ] Some tests FAILED (list below)
- [ ] Testing INCOMPLETE (list below)

**Failed Tests**:
```
(List any test numbers that failed and failure reason)
```

**Notes**:
```
(Any observations, issues, or recommendations)
```

**Ready for Deployment**: [ ] YES [ ] NO

---

*End of Testing Checklist*
