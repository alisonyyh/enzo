# Deploy Edge Function to Supabase

## Issue
The Supabase CLI isn't linked to the project yet. We need to deploy the updated Edge Function with CORS fixes so Flow 6 can work on localhost.

## Quick Deploy via Supabase Dashboard (Recommended)

Since `supabase link` is failing, use the Supabase Dashboard to deploy the Edge Function manually:

### Step 1: Go to Edge Functions in Dashboard

1. Open https://supabase.com/dashboard/project/hhleugaxskawbmywwxtd/functions
2. Look for existing function named `get-firebase-token`
   - If it exists, click it to edit
   - If it doesn't exist, click "Create Function"

### Step 2: Deploy the Updated Code

**Function name:** `get-firebase-token`

**Function code:** Copy-paste from `/Users/alyeo/Documents/puppy_daycare/supabase/functions/get-firebase-token/index.ts`

The code includes critical CORS fixes:
- OPTIONS request handler for preflight
- CORS headers on all responses
- Updated Firebase Admin imports (npm: instead of esm.sh)

### Step 3: Set Environment Variable

In the Edge Function settings, add this environment variable:

**Name:** `FIREBASE_SERVICE_ACCOUNT`

**Value:** Your Firebase service account JSON (the entire JSON object from Firebase Console → Project Settings → Service Accounts → Generate New Private Key)

Example format:
```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "...",
  "client_id": "...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "..."
}
```

### Step 4: Deploy

Click "Deploy" or "Save" to deploy the function.

### Step 5: Verify Deployment

After deployment, test the Edge Function:

```bash
curl -i \
  -H "Authorization: Bearer YOUR_SUPABASE_ACCESS_TOKEN" \
  https://hhleugaxskawbmywwxtd.supabase.co/functions/v1/get-firebase-token
```

You should see:
- OPTIONS requests return 200 with CORS headers
- Authenticated POST/GET requests return Firebase token

---

## Alternative: Fix CLI Link (For Future Use)

If you want to use `supabase link` in the future, try:

```bash
cd /Users/alyeo/Documents/puppy_daycare
supabase link --project-ref hhleugaxskawbmywwxtd
```

If that fails with config error, try:

```bash
supabase link --project-ref hhleugaxskawbmywwxtd --skip-config
```

Once linked, you can deploy via CLI:

```bash
supabase functions deploy get-firebase-token
```

---

## After Deployment: Test Flow 6

1. **Delete your test user** (you've already done this ✅)
2. **Sign out of the app** on localhost
3. **Sign in with Google** (creates fresh user)
4. **Complete onboarding** (create a puppy)
5. **Test Flow 6 features:**
   - ✅ View today's tasks on Dashboard
   - ✅ Add a new task
   - ✅ Edit task (swipe → Edit)
   - ✅ Delete task (swipe → Delete)
   - ✅ Complete task (swipe right)
   - ✅ Undo task (swipe left)
   - ✅ Offline mode (disable network, make changes, re-enable network)

---

## Current Status

- ✅ User deletion fix applied (CASCADE constraints)
- ✅ Edge Function code updated with CORS fixes (local file)
- ⏳ Edge Function needs deployment to Supabase
- ⏳ Flow 6 testing pending

**Next step:** Deploy the Edge Function via Supabase Dashboard, then test Flow 6 on localhost.
