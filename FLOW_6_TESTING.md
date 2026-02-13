# Flow 6: Task Management - Testing Guide

This guide provides test scenarios to verify Flow 6 is working correctly.

## Prerequisites

Before testing, ensure:
1. ✅ Firebase project created and Firestore enabled
2. ✅ Environment variables set in `.env`
3. ✅ Firestore security rules deployed
4. ✅ Supabase Edge Function deployed
5. ✅ Dependencies installed (`npm install`)
6. ✅ Dev server running (`npm run dev`)

## Test Scenario 1: Add New Task

**Steps:**
1. Open the TaskManagementDashboard
2. Click the blue "+" button in bottom-right corner
3. Select time (e.g., "2:30 PM")
4. Select activity type (e.g., "Potty Break")
5. Click "Add Task"

**Expected Result:**
- ✅ Modal closes
- ✅ New task appears in chronological order
- ✅ Task shows ✏️ icon (indicates user-added)
- ✅ Network banner shows "✓ Synced" (green, auto-dismiss after 2s)

**Failure Cases:**
- ❌ Task doesn't appear → Check Firebase auth (see console for errors)
- ❌ "Permission denied" → Check Firestore security rules
- ❌ "Not authenticated" → Check Supabase Edge Function deployment

---

## Test Scenario 2: Edit Existing Task Time

**Steps:**
1. Tap any task card to expand it
2. Change time using time picker (e.g., from "9:00 AM" to "9:30 AM")
3. Click "Save Changes"

**Expected Result:**
- ✅ Card collapses
- ✅ Task reorders to correct chronological position
- ✅ Task shows ✏️ icon
- ✅ Network banner shows "✓ Synced"

**Failure Cases:**
- ❌ Task doesn't reorder → Check Firestore query orderBy
- ❌ Save button stuck on "Saving..." → Check console for Firestore errors

---

## Test Scenario 3: Edit Activity Type

**Steps:**
1. Tap a task card to expand
2. Change activity type from dropdown (e.g., "Meal" → "Training")
3. Click "Save Changes"

**Expected Result:**
- ✅ Card collapses
- ✅ Activity type updates immediately
- ✅ Network banner shows "✓ Synced"

---

## Test Scenario 4: Cancel Edit

**Steps:**
1. Tap a task to expand
2. Change time and activity type
3. Click "Cancel"

**Expected Result:**
- ✅ Card collapses
- ✅ Changes are discarded (original values remain)

---

## Test Scenario 5: Swipe to Delete (Mobile/Desktop)

**Steps:**
1. On mobile: Swipe task card from right to left
2. On desktop: Click and drag task card to the left
3. Release when "Delete" button is revealed
4. Click "Delete" button
5. Confirm deletion in modal

**Expected Result:**
- ✅ Task disappears from list
- ✅ Network banner shows "✓ Synced"

**Failure Cases:**
- ❌ Swipe doesn't work → Check react-swipeable installation
- ❌ Task reappears → Check Firestore delete permission

---

## Test Scenario 6: Cancel Delete

**Steps:**
1. Swipe task to reveal "Delete" button
2. Click "Delete"
3. In confirmation modal, click "Cancel"

**Expected Result:**
- ✅ Modal closes
- ✅ Task remains in list
- ✅ Swipe offset resets (card slides back)

---

## Test Scenario 7: Real-Time Sync (Multi-Device)

**Setup:**
- Open app in two browser tabs (Tab A and Tab B)
- Both tabs logged in as different users with access to same puppy

**Steps:**
1. In Tab A: Add a new task
2. Wait 3 seconds
3. Check Tab B

**Expected Result:**
- ✅ Tab B shows new task within 3 seconds (Firestore real-time listener)
- ✅ Task appears in chronological order in Tab B

**Failure Cases:**
- ❌ Task doesn't appear in Tab B → Check Firestore real-time subscription
- ❌ Takes > 3 seconds → Check network speed

---

## Test Scenario 8: Offline Mode

**Steps:**
1. Open Chrome DevTools (F12)
2. Go to Network tab
3. Change throttling to "Offline"
4. Add a new task

**Expected Result:**
- ✅ Yellow banner appears: "⚠️ You're offline. Changes will sync when connected."
- ✅ Task appears in list immediately (optimistic UI)
- ✅ Task persists when page is refreshed (IndexedDB persistence)

**Steps (continued):**
5. Change throttling back to "Online"
6. Wait 2 seconds

**Expected Result:**
- ✅ Banner changes to "⏳ Syncing changes..."
- ✅ Banner changes to "✓ Synced" (green, auto-dismiss)
- ✅ Check second device → task appears there

**Failure Cases:**
- ❌ Offline banner doesn't appear → Check NetworkStatusBanner connection listener
- ❌ Task disappears on refresh → IndexedDB not enabled (check browser support)
- ❌ Task never syncs when online → Check Firestore offline queue

---

## Test Scenario 9: Conflict Resolution (Last-Write-Wins)

**Setup:**
- Two users (User A and User B) both have access to same puppy

**Steps:**
1. User A: Go offline (DevTools → Network → Offline)
2. User B: Go offline
3. User A: Edit Task #1 time to "10:00 AM"
4. User B: Edit Task #1 time to "10:30 AM"
5. User A: Go online
6. Wait 2 seconds
7. User B: Go online

**Expected Result:**
- ✅ User B's change wins (last write at 10:30 AM)
- ✅ User A sees task update to "10:30 AM" (overwriting their edit)
- ✅ No errors in console
- ✅ No data corruption

**Note:** This is expected behavior with last-write-wins. Future P1 improvement: Show toast notification to User A: "Mike edited this task after you. Updated to 10:30 AM."

---

## Test Scenario 10: Network Failure Recovery

**Steps:**
1. Disable network (DevTools → Offline)
2. Edit multiple tasks (3-5 tasks)
3. Delete a task
4. Add a new task
5. Enable network

**Expected Result:**
- ✅ All changes sync in order (queue processed)
- ✅ Banner shows "⏳ Syncing changes..."
- ✅ Banner shows "✓ Synced" when complete
- ✅ No tasks are lost
- ✅ Other devices receive all updates

**Failure Cases:**
- ❌ Some changes don't sync → Check Firestore offline queue
- ❌ Duplicate tasks appear → Check for race conditions in addTask

---

## Test Scenario 11: Empty State

**Steps:**
1. Delete all tasks
2. Observe empty state

**Expected Result:**
- ✅ Shows empty state with:
  - 🐾 emoji
  - "No tasks for today"
  - "Tap + to add a task"

---

## Test Scenario 12: Permission Denied (Security Rules)

**Setup:**
- User logged in but NOT a member of the puppy

**Steps:**
1. Try to load TaskManagementDashboard for a puppy the user doesn't have access to

**Expected Result:**
- ✅ Error message shown: "Permission denied"
- ✅ No tasks visible
- ✅ Network banner shows "❌ Couldn't sync changes. Check your connection."

This verifies Firestore security rules are working correctly.

---

## Performance Benchmarks

### Expected Performance Metrics

- **Add task:** < 500ms (local) → < 2s (Firestore write)
- **Edit task:** < 500ms (optimistic) → < 2s (Firestore update)
- **Delete task:** < 200ms (optimistic) → < 1s (Firestore delete)
- **Real-time sync:** < 3s (cross-device)
- **Offline → Online sync:** < 5s (depends on queue size)

### How to Measure

1. Open Chrome DevTools → Performance tab
2. Click "Record"
3. Perform action (add/edit/delete task)
4. Stop recording
5. Check timeline for Firestore operations

**Red Flags:**
- ❌ Add task takes > 5s → Check Firestore quota limits
- ❌ Real-time sync takes > 10s → Check network speed
- ❌ Offline queue sync takes > 30s → Check queue size (too many pending operations)

---

## Debugging Common Issues

### Issue: "Not authenticated"

**Check:**
1. Supabase auth working? (user logged in)
2. Edge Function deployed? `supabase functions list`
3. Firebase service account secret set? `supabase secrets list`
4. Firebase config in `.env`?

**Fix:**
```bash
# Re-deploy Edge Function
supabase functions deploy get-firebase-token

# Verify secret
supabase secrets list | grep FIREBASE
```

### Issue: "Permission denied"

**Check:**
1. Firestore security rules deployed? `firebase deploy --only firestore:rules`
2. User has puppy_memberships record?
3. Custom Claims include puppyIds?

**Fix:**
```bash
# Re-deploy security rules
firebase deploy --only firestore:rules

# Check Supabase database
# SELECT * FROM puppy_memberships WHERE user_id = 'your-user-id';
```

### Issue: Tasks not syncing in real-time

**Check:**
1. Firestore composite index created?
2. Network connection stable?
3. Multiple tabs open? (IndexedDB conflict)

**Fix:**
```bash
# Re-deploy indexes
firebase deploy --only firestore:indexes

# Close all tabs except one
# Refresh page
```

### Issue: Offline mode not working

**Check:**
1. Browser supports IndexedDB?
2. Private browsing mode? (IndexedDB disabled)
3. Multiple tabs open? (only one tab can have offline persistence)

**Fix:**
- Use regular browsing mode
- Close all tabs except one
- Check console for persistence errors

---

## Success Criteria

Flow 6 is ready for production when:

- ✅ All 12 test scenarios pass
- ✅ No console errors
- ✅ Network status banner displays correctly in all states
- ✅ Swipe animations are smooth (200ms expansions, 300ms fade-outs)
- ✅ Offline queue works (edits sync when reconnected)
- ✅ Multi-user sync works (< 3s cross-device)
- ✅ Performance benchmarks met

---

## Next: User Acceptance Testing

After technical testing passes, perform UAT with real users:

1. **Owner adds task while puppy is awake** → Verify caretaker sees it on their device
2. **Caretaker edits task time** → Verify owner sees update
3. **Both users offline, edit same task** → Verify conflict resolution works
4. **Airplane mode for 1 hour, make edits** → Verify all sync when back online

---

**Need help?** See [FLOW_6_SETUP.md](FLOW_6_SETUP.md) for setup instructions or [backend-development-plan.md](docs/backend-development-plan.md) Section 17 for implementation details.
