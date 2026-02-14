# Flow 6 Testing Guide

## What Was Fixed

### Issue
401 Unauthorized error when Dashboard tried to get Firebase Custom Token from Edge Function.

### Root Causes
1. **Missing Authorization header validation** - Edge Function wasn't checking if the header existed before using it
2. **Stale session** - New users might have invalid/expired session tokens when Dashboard first mounts
3. **Insufficient logging** - Couldn't diagnose where auth was failing

### Fixes Applied
1. **Edge Function** (`supabase/functions/get-firebase-token/index.ts`):
   - Added explicit Authorization header validation
   - Enhanced logging at each auth step
   - Better error messages with JSON responses

2. **Client** (`src/lib/firebase.ts`):
   - Added session refresh fallback if getSession() fails
   - Enhanced logging for debugging
   - More detailed error messages

## Testing Steps

### 1. Check Edge Function Logs
The Edge Function now has detailed logging. After testing, check logs at:
https://supabase.com/dashboard/project/hhleugaxskawbmywwxtd/functions

Look for these log messages:
- `[Edge Function] Request received`
- `[Edge Function] Authorization header present: true`
- `[Edge Function] User lookup result: {...}`
- `[Edge Function] Found puppy memberships: X`
- `[Edge Function] Firebase token generated successfully`

### 2. Test Flow 6 on Localhost

**Prerequisites:**
- Fresh user account (delete old one if needed)
- Dev server running (`npm run dev`)

**Test Cases:**

#### A. Initial Load
1. Sign in with Google
2. Complete onboarding (create puppy)
3. **Check browser console** - should see:
   - `Firebase auth: Supabase session valid, requesting Custom Token...`
   - `Firebase auth: Session user ID: <uuid>`
   - `Firebase auth: Access token present: true`
   - `Firebase auth: Custom Token received, signing in...`
   - `Firebase auth: Successfully signed in to Firebase`
4. Dashboard should load without "Failed to load tasks" error

#### B. Add Task
1. Click the + (Add Task) button
2. Fill in task details
3. Submit
4. Task should appear in the list

#### C. Complete Task
1. Swipe right on a task card
2. Task should move to "Completed" section

#### D. Undo Task
1. Swipe left on a completed task
2. Task should move back to "Pending" section

#### E. Edit Task
1. Swipe to reveal action buttons
2. Click "Edit"
3. Modify task details
4. Save
5. Task should update

#### F. Delete Task
1. Swipe to reveal action buttons
2. Click "Delete"
3. Confirm deletion
4. Task should be removed

#### G. Offline Mode
1. Open DevTools → Network tab
2. Enable "Offline" mode
3. Complete a task (swipe right)
4. Add a new task
5. **Network status banner should appear** at top
6. Disable "Offline" mode
7. Changes should sync automatically
8. Network banner should disappear

### 3. Expected Console Output (Success)

**Client console:**
```
Firebase auth: Supabase session valid, requesting Custom Token...
Firebase auth: Session user ID: <uuid>
Firebase auth: Access token present: true
Firebase auth: Custom Token received, signing in...
Firebase auth: Successfully signed in to Firebase
```

**Edge Function logs (Supabase Dashboard):**
```
[Edge Function] Request received
[Edge Function] Authorization header present: true
[Edge Function] User lookup result: { hasUser: true, userId: '<uuid>', hasError: false }
[Edge Function] Found puppy memberships: 1
[Edge Function] Firebase token generated successfully
```

### 4. Common Errors & Solutions

#### Error: "Missing Authorization header"
**Cause:** Session not established before Dashboard mounts
**Solution:** Sign out and sign in again

#### Error: "No puppy memberships found"
**Cause:** User hasn't completed onboarding yet
**Solution:** Complete onboarding to create a puppy

#### Error: "Unauthorized" with valid session
**Cause:** Edge Function environment variables not set
**Solution:** Check that `FIREBASE_SERVICE_ACCOUNT` is set in Supabase Dashboard → Edge Functions → Settings

#### Error: "Firebase token generation failed"
**Cause:** Invalid Firebase service account JSON
**Solution:** Verify `FIREBASE_SERVICE_ACCOUNT` contains valid JSON from Firebase Console

## Verification Checklist

- [ ] Edge Function deployed successfully
- [ ] Edge Function logs show detailed auth steps
- [ ] Client console shows successful Firebase auth flow
- [ ] Dashboard loads without errors
- [ ] Can add tasks
- [ ] Can complete tasks
- [ ] Can undo completed tasks
- [ ] Can edit tasks
- [ ] Can delete tasks
- [ ] Offline mode works (shows banner, syncs when back online)

## Next Steps After Testing

1. **If tests pass:** Flow 6 is fully integrated! 🎉
2. **If tests fail:** Check Edge Function logs and client console, share error messages for further debugging
3. **Future improvements:**
   - Add task filtering (by date, status)
   - Add task sorting
   - Add bulk task operations
   - Add task templates
