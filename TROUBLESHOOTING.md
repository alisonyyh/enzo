# Flow 6 Troubleshooting Guide

## Error: "Failed to send a request to the Edge Function"

This error occurs when the Dashboard tries to get a Firebase Custom Token from the Supabase Edge Function.

### Quick Diagnosis

Open browser console (F12) and look for these log messages:

1. **"Firebase auth: Supabase session valid, requesting Custom Token..."**
   - ✅ Supabase authentication is working
   - Issue is with the Edge Function call

2. **"Not authenticated with Supabase. Please sign in first."**
   - ❌ You're not signed into Supabase
   - **Fix:** Sign out and sign in again with Google

3. **"Failed to get Firebase token: [error message]"**
   - ❌ Edge Function exists but returned an error
   - Check the specific error message for details

---

## Common Causes & Fixes

### Cause 1: Edge Function Not Deployed

**Symptoms:**
- Error: "Failed to send a request to the Edge Function"
- Browser console: "Function not found" or "404"

**Check:**
```bash
# Via Supabase Dashboard
# Go to https://supabase.com/dashboard → Your Project → Edge Functions
# Look for "get-firebase-token" in the list

# OR via CLI
supabase functions list
```

**Fix:**
The Edge Function was deployed via Dashboard (manual paste), so verify:
1. Go to Supabase Dashboard → Edge Functions
2. Click on `get-firebase-token`
3. Verify status is "Active" or "Deployed"
4. If not, redeploy using the code from `supabase/functions/get-firebase-token/index.ts`

---

### Cause 2: Missing Firebase Service Account Secret

**Symptoms:**
- Error: "Internal server error" or "500"
- Edge Function logs show: "FIREBASE_SERVICE_ACCOUNT is not defined"

**Check:**
```bash
supabase secrets list
```

You should see `FIREBASE_SERVICE_ACCOUNT` in the list.

**Fix:**
```bash
# Set the secret with your Firebase service account JSON
supabase secrets set FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"...",...}'
```

Get the JSON from:
Firebase Console → Project Settings → Service Accounts → Generate new private key

---

### Cause 3: User Not Authenticated

**Symptoms:**
- Error: "Not authenticated with Supabase. Please sign in first."
- Browser console shows this message before Edge Function call

**Fix:**
1. Sign out of the app
2. Sign in again with Google
3. Refresh the page

---

### Cause 4: Edge Function Code Error

**Symptoms:**
- Error: "Internal server error" or specific error from Edge Function
- Browser console shows detailed error message

**Check Edge Function Logs:**
```bash
supabase functions logs get-firebase-token
```

**Common Edge Function Errors:**

#### "puppy_memberships table not found"
- The Edge Function queries `puppy_memberships` table
- **Fix:** Create the table in Supabase (see FLOW_6_SETUP.md Step 8)

#### "Firebase Admin SDK error"
- Firebase service account JSON is invalid
- **Fix:** Re-download service account JSON and reset secret

#### "User has no puppy access"
- User exists but has no puppies associated
- **Fix:** Complete onboarding to create a puppy first

---

### Cause 5: CORS or Network Issues

**Symptoms:**
- Error: "Failed to fetch" or "Network error"
- Browser console shows CORS error

**Fix:**
This shouldn't happen with Supabase Edge Functions, but if it does:
1. Check your Supabase project URL is correct in `.env`
2. Verify you're not behind a restrictive firewall/VPN
3. Try in incognito mode to rule out browser extensions

---

## Step-by-Step Debugging Process

### Step 1: Check Browser Console

Open browser DevTools (F12) → Console tab

Look for log messages starting with "Firebase auth:"

**Expected flow:**
```
Firebase auth: Supabase session valid, requesting Custom Token...
Firebase auth: Custom Token received, signing in...
Firebase auth: Successfully signed in to Firebase
```

**If you see:**
- "Not authenticated with Supabase" → Sign in again
- "Edge Function error:" → Check Edge Function deployment
- Nothing → Check if Dashboard component is loading

### Step 2: Verify Environment Variables

```bash
cat /Users/alyeo/Documents/puppy_daycare/.env
```

Should include:
```
VITE_SUPABASE_URL=https://...supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=...firebaseapp.com
VITE_FIREBASE_PROJECT_ID=...
```

**If missing Firebase variables:**
1. Copy from `.env.example`
2. Fill in values from Firebase Console
3. Restart dev server: `npm run dev`

### Step 3: Test Edge Function Directly

```bash
# Get your Supabase access token from browser console:
# Run: await supabase.auth.getSession()
# Copy the access_token value

# Then test Edge Function:
curl -X POST https://hhleugaxskawbmywwxtd.supabase.co/functions/v1/get-firebase-token \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Expected response:**
```json
{"firebaseToken":"eyJhbGc..."}
```

**Error responses:**
- `401 Unauthorized` → Access token is invalid/expired
- `500 Internal Server Error` → Edge Function has a bug (check logs)
- `404 Not Found` → Edge Function not deployed

### Step 4: Check Firestore Security Rules

If Firebase auth succeeds but tasks don't load:

```bash
# Check if Firestore rules are deployed
firebase deploy --only firestore:rules
```

Verify in Firebase Console → Firestore → Rules:
- Rules should include `hasPuppyAccess()` function
- `match /tasks/{taskId}` should exist

---

## Still Not Working?

### Nuclear Option: Fresh Restart

1. **Sign out of app**
2. **Clear browser data:**
   - DevTools → Application → Storage → Clear site data
3. **Restart dev server:**
   ```bash
   # Ctrl+C to stop
   npm run dev
   ```
4. **Sign in again**
5. **Check console for new error messages**

### Check Supabase Edge Function Logs

```bash
# Real-time logs (keep this running while testing)
supabase functions logs get-firebase-token --follow

# Recent logs
supabase functions logs get-firebase-token --limit 50
```

This shows exactly what's happening in the Edge Function.

---

## Error Message Reference

| Error | Meaning | Fix |
|-------|---------|-----|
| "Failed to send a request to the Edge Function" | Edge Function call failed | Check if deployed, check network |
| "Not authenticated with Supabase" | No Supabase session | Sign in with Google |
| "Failed to get Firebase token: [message]" | Edge Function returned error | Check Edge Function logs |
| "Edge Function returned no token" | Edge Function succeeded but didn't return token | Check Edge Function code |
| "Permission denied" (Firestore) | Firestore security rules blocking access | Deploy Firestore rules, check puppyIds claim |

---

## Prevention Checklist

Before testing Flow 6, ensure:

- [ ] Node.js installed
- [ ] Dependencies installed (`npm install`)
- [ ] `.env` file exists with Firebase + Supabase config
- [ ] Firebase project created
- [ ] Firestore enabled
- [ ] Firestore security rules deployed
- [ ] Firestore indexes deployed
- [ ] Firebase service account JSON downloaded
- [ ] Supabase secret `FIREBASE_SERVICE_ACCOUNT` set
- [ ] Edge Function `get-firebase-token` deployed
- [ ] Edge Function status: Active
- [ ] User signed in with Google
- [ ] User has completed onboarding (has a puppy)

---

## Getting Help

If you're still stuck:

1. **Check console logs:** Browser DevTools → Console (filter for "Firebase" or "Error")
2. **Check Edge Function logs:** `supabase functions logs get-firebase-token`
3. **Check Firestore logs:** Firebase Console → Firestore → Usage
4. **Share error messages:** Copy the exact error from console

Most issues are caused by:
- Edge Function not deployed (50%)
- Missing Firebase service account secret (30%)
- User not authenticated (15%)
- Environment variables missing (5%)
