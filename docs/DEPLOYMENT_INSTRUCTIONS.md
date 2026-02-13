# PupPlan Backend Deployment Instructions

## Prerequisites

Before deploying the backend, you need:

1. **Anthropic API Key** - Sign up at https://console.anthropic.com
2. **Supabase Account** - You should already have this configured
3. **Supabase CLI** - Install with `npm install -g supabase`

---

## Step 1: Configure Anthropic API Key

### Get Your API Key
1. Go to https://console.anthropic.com
2. Sign up or sign in
3. Navigate to API Keys section
4. Create a new API key
5. Copy the key (starts with `sk-ant-`)

### Add to Supabase Secrets

**For Production:**
```bash
# In Supabase Dashboard:
# 1. Go to Project Settings > Edge Functions
# 2. Add secret: ANTHROPIC_API_KEY = your-key-here
```

**For Local Development:**
```bash
# Create .env file in project root
echo "ANTHROPIC_API_KEY=sk-ant-your-key-here" > .env

# Or set in your shell
export ANTHROPIC_API_KEY=sk-ant-your-key-here
```

---

## Step 2: Deploy Database Migrations

The RLS policies and indexes are critical for security and performance.

```bash
# Navigate to project root
cd /Users/alyeo/Documents/puppy_daycare

# Apply migrations to production database
# (Replace with your actual Supabase project URL)
supabase db push --db-url "postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT].supabase.co:5432/postgres"
```

**What this does:**
- Enables Row-Level Security (RLS) on all tables
- Creates security policies so users can only access their own data
- Adds performance indexes for fast queries

---

## Step 3: Deploy Edge Function

```bash
# Deploy the generate-routine function
supabase functions deploy generate-routine \
  --project-ref [YOUR-PROJECT-REF]
```

**Verify deployment:**
```bash
# Check function logs
supabase functions logs generate-routine --project-ref [YOUR-PROJECT-REF]
```

---

## Step 4: Update Frontend Environment Variables

The frontend needs to know about the Edge Function.

**For Local Development:**
```env
# .env.local
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=your-local-anon-key
```

**For Production (Vercel):**
```env
# These should already be set
VITE_SUPABASE_URL=https://[your-project].supabase.co
VITE_SUPABASE_ANON_KEY=your-production-anon-key
```

---

## Step 5: Frontend Integration (SIMPLE APPROACH)

Since the current App.tsx flow is complex with parallel promises, here's a **simpler approach** that doesn't require major refactoring:

### Option A: Keep Client-Side Generation (Current)
**No changes needed.** The Edge Function is deployed and ready, but the frontend still uses client-side generation. You can test the Edge Function manually and switch later.

### Option B: Switch to Edge Function (Recommended)
I've created the infrastructure, but the frontend integration requires careful testing. Here's the safest migration path:

1. **Test Edge Function manually** first using curl or Postman
2. **Create a feature flag** to toggle between client-side and Edge Function
3. **Gradually roll out** to a small percentage of users

**Manual Test:**
```bash
curl -X POST 'https://[your-project].supabase.co/functions/v1/generate-routine' \
  -H "Authorization: Bearer YOUR_USER_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "puppyId": "uuid-here",
    "questionnaireData": {
      "puppyName": "Biscuit",
      "breed": "Golden Retriever",
      "ageMonths": 3,
      "ageWeeks": 2,
      "weight": 15,
      "weightUnit": "lbs",
      "livingSituation": "apartment",
      "workArrangement": "work-from-home",
      "wakeUpTime": "07:00",
      "bedTime": "22:00"
    }
  }'
```

---

## Step 6: Deploy Frontend

```bash
# If using Vercel (recommended)
git add .
git commit -m "Add backend Edge Function and migrations"
git push origin main

# Vercel will auto-deploy
```

---

## Verification Checklist

After deployment, verify everything works:

- [ ] Edge Function is deployed and accessible
- [ ] ANTHROPIC_API_KEY is set in Supabase secrets
- [ ] Database migrations applied (check Supabase dashboard for RLS policies)
- [ ] Indexes created (query performance should be fast)
- [ ] Frontend can still create puppies and routines
- [ ] Activity completion still works (realtime sync)
- [ ] No RLS policy violations (check Supabase logs)

---

## Monitoring

### Check Edge Function Logs
```bash
supabase functions logs generate-routine --project-ref [YOUR-PROJECT-REF] --tail
```

### Check for Errors
- Supabase Dashboard > Edge Functions > Logs
- Look for 500 errors or Claude API failures

### Monitor Costs
- Anthropic Dashboard > Usage > API Costs
- Should be ~$0.03 per routine generation

---

## Rollback Plan

If something goes wrong:

1. **Edge Function issues?**
   - Frontend still uses client-side generation (no change needed)
   - Fix Edge Function and redeploy

2. **RLS policy too strict?**
   - Temporarily disable RLS: `ALTER TABLE table_name DISABLE ROW LEVEL SECURITY;`
   - Fix policy and re-enable

3. **Index causing issues?**
   - Drop problematic index: `DROP INDEX idx_name;`
   - Recreate with correct configuration

---

## Next Steps

After successful deployment:

1. **Test with real users** - Create a test account, go through onboarding
2. **Monitor Claude API usage** - Check Anthropic dashboard for costs
3. **Optimize prompts** - Iterate on Claude prompt based on routine quality
4. **Add monitoring** - Set up Sentry for error tracking
5. **Implement invite system** - Deploy `accept-invite` Edge Function

---

## Troubleshooting

### "ANTHROPIC_API_KEY not configured"
- Check Supabase Dashboard > Project Settings > Edge Functions > Secrets
- Make sure key is spelled exactly: `ANTHROPIC_API_KEY`

### "Row Level Security policy violation"
- Check that RLS policies were applied: `supabase db push`
- Verify user is authenticated (has valid JWT)

### "Edge Function timeout"
- Claude API can take 5-10 seconds for complex routines
- This is normal, the 8-second animation covers it

### "Invalid JSON response from Claude"
- Claude sometimes wraps JSON in markdown code blocks
- The Edge Function handles this automatically
- If it still fails, check Edge Function logs

---

**Status:** Backend infrastructure is complete and ready for deployment. Frontend currently uses client-side generation (safe default). Edge Function is available for gradual rollout.
