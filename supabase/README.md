# PupPlan Supabase Backend

This directory contains the Supabase backend implementation for PupPlan:
- **Edge Functions** - Serverless API endpoints (Deno/TypeScript)
- **Migrations** - Database schema changes (SQL)
- **Configuration** - Local development setup

---

## Directory Structure

```
supabase/
├── functions/
│   └── generate-routine/
│       └── index.ts          # AI routine generation Edge Function
├── migrations/
│   ├── 20260211000001_rls_policies.sql   # Row-Level Security policies
│   └── 20260211000002_indexes.sql        # Performance indexes
├── config.toml               # Local Supabase config
└── README.md                 # This file
```

---

## Edge Functions

### `generate-routine`

**Purpose:** Generate personalized puppy care routines using Claude AI

**How it works:**
1. Receives questionnaire data from frontend
2. Validates user owns the puppy (RLS check)
3. Calls Anthropic Claude API with structured prompt
4. Parses and validates AI response
5. Saves routine + items to database
6. Returns complete routine to frontend

**Request:**
```typescript
{
  puppyId: string;
  questionnaireData: {
    puppyName: string;
    breed: string;
    ageMonths: number;
    ageWeeks: number;
    weight: number | null;
    weightUnit: 'lbs' | 'kg';
    livingSituation: string;
    workArrangement: string;
    wakeUpTime: string;  // HH:MM
    bedTime: string;     // HH:MM
  }
}
```

**Response:**
```typescript
{
  routine: {
    id: string;
    puppy_id: string;
    generated_at: string;
    source: 'ai_generated';
    is_active: true;
    routine_items: RoutineItem[];
  }
}
```

**Environment Variables Required:**
- `ANTHROPIC_API_KEY` - Claude API key (set in Supabase Dashboard)
- `SUPABASE_URL` - Auto-provided by Supabase
- `SUPABASE_ANON_KEY` - Auto-provided by Supabase

**Deployment:**
```bash
supabase functions deploy generate-routine --project-ref YOUR_PROJECT_REF
```

**Testing Locally:**
```bash
# Start local Supabase (includes Edge Functions)
supabase start

# Edge Function runs at:
# http://localhost:54321/functions/v1/generate-routine
```

---

## Migrations

### `20260211000001_rls_policies.sql`

**Purpose:** Enable Row-Level Security (RLS) on all tables

**Why this is critical:**
- Without RLS, any authenticated user can read/write ANY data
- RLS policies ensure users can only access their own puppies
- Protects against data leaks and unauthorized access

**What it does:**
- Enables RLS on: `profiles`, `puppies`, `puppy_memberships`, `routines`, `routine_items`, `activity_logs`, `invites`
- Creates policies for SELECT, INSERT, UPDATE, DELETE operations
- Enforces membership checks (users must be active members to access puppy data)

**Testing RLS:**
```sql
-- Try to access another user's puppy (should fail)
SELECT * FROM puppies WHERE id = 'some-other-users-puppy-id';
-- Returns 0 rows (policy blocks it)

-- Access your own puppy (should work)
SELECT * FROM puppies WHERE id = 'your-puppy-id';
-- Returns puppy data
```

---

### `20260211000002_indexes.sql`

**Purpose:** Speed up common queries (especially RLS checks)

**Why this is critical:**
- Every query runs through RLS policies
- RLS policies do EXISTS checks on `puppy_memberships` table
- Without indexes, these checks are SLOW (full table scans)
- With indexes, queries are <10ms instead of >500ms

**Key Indexes:**
- `idx_puppy_memberships_user_puppy` - Critical for RLS checks
- `idx_activity_logs_puppy_date` - Dashboard loads (today's activities)
- `idx_routines_puppy_active` - Fetch active routine
- `idx_invites_token` - Invite acceptance flow

**Performance Impact:**
- Before indexes: Dashboard load ~800ms
- After indexes: Dashboard load ~200ms

---

## Local Development

### Setup
```bash
# Install Supabase CLI
npm install -g supabase

# Start local Supabase (Postgres + Edge Functions + Auth + Storage)
supabase start

# This spins up:
# - Database: localhost:54322
# - API: localhost:54321
# - Studio: localhost:54323
# - Edge Functions: localhost:54324
```

### Testing Edge Functions Locally
```bash
# Set environment variable
export ANTHROPIC_API_KEY=sk-ant-your-key-here

# Start Supabase
supabase start

# Edge Function is now available at:
# http://localhost:54321/functions/v1/generate-routine

# Test with curl:
curl -X POST 'http://localhost:54321/functions/v1/generate-routine' \
  -H "Authorization: Bearer YOUR_LOCAL_JWT" \
  -H "Content-Type: application/json" \
  -d '{"puppyId":"uuid","questionnaireData":{...}}'
```

### Applying Migrations Locally
```bash
# Apply all pending migrations
supabase db push

# Or apply specific migration
supabase db push --file supabase/migrations/20260211000001_rls_policies.sql
```

---

## Production Deployment

### Prerequisites
1. Anthropic API key (get from https://console.anthropic.com)
2. Supabase project (should already exist)
3. Supabase CLI installed

### Deployment Steps

**1. Configure Secrets**
```bash
# In Supabase Dashboard:
# Project Settings > Edge Functions > Add Secret
ANTHROPIC_API_KEY=sk-ant-your-production-key
```

**2. Deploy Migrations**
```bash
# Apply to production database
supabase db push --db-url "postgresql://postgres:PASSWORD@PROJECT.supabase.co:5432/postgres"
```

**3. Deploy Edge Functions**
```bash
supabase functions deploy generate-routine --project-ref YOUR_PROJECT_REF
```

**4. Verify Deployment**
```bash
# Check function logs
supabase functions logs generate-routine --tail
```

---

## Monitoring & Debugging

### Edge Function Logs
```bash
# Real-time logs
supabase functions logs generate-routine --tail

# Filter errors only
supabase functions logs generate-routine --tail | grep "ERROR"
```

### Database Performance
```sql
-- Check slow queries
SELECT
  query,
  mean_exec_time,
  calls
FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Check index usage
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC;
```

### RLS Policy Debugging
```sql
-- Test as specific user
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = 'user-uuid-here';

-- Now run queries to see what they can access
SELECT * FROM puppies;
```

---

## Cost Estimation

### Claude API Costs
- Model: claude-sonnet-4-5-20250929
- Input: $3.00 per million tokens
- Output: $15.00 per million tokens
- Per routine: ~500 input + ~2000 output tokens
- **Cost per routine: ~$0.03**

### Supabase Costs
- Free tier: 500MB database, 2GB storage, 2M Edge Function invocations
- Pro tier ($25/mo): 8GB database, 100GB storage, unlimited Edge Functions
- **Recommendation:** Start on Pro tier for production

---

## Security Best Practices

1. **Never expose ANTHROPIC_API_KEY in client code**
   - Always call Edge Function, never Claude API directly from frontend

2. **Always test RLS policies before deploying**
   - Use separate test accounts to verify isolation

3. **Rotate API keys quarterly**
   - Update ANTHROPIC_API_KEY every 3 months

4. **Monitor Edge Function logs for suspicious activity**
   - Watch for unusual spike in AI generation requests

5. **Rate limit AI generation**
   - Currently: 1 routine per puppy per 5 minutes
   - Prevents abuse and cost overruns

---

## Troubleshooting

### "ANTHROPIC_API_KEY not configured"
**Solution:** Add secret in Supabase Dashboard > Edge Functions > Secrets

### "Row Level Security policy violation"
**Solution:**
- Check migrations were applied: `supabase db push`
- Verify user is authenticated (valid JWT)
- Check user has active membership for the puppy

### "Edge Function timeout"
**Solution:** Normal for Claude API (5-10s). Increase timeout if needed.

### "Invalid JSON response from Claude"
**Solution:** Edge Function auto-handles markdown code blocks. Check logs for actual error.

---

## Future Enhancements

**Planned Edge Functions:**
- `accept-invite` - Handle caretaker invite acceptance
- `adjust-routine` - AI-powered routine modifications
- `weekly-insights` - Generate progress summaries

**Planned Migrations:**
- Partitioning for `activity_logs` (when >1M rows)
- Materialized views for progress stats
- Archive old routines (soft delete after 30 days inactive)

---

## Support

**Documentation:** See `/docs/backend-development-plan.md` for full architecture
**Deployment:** See `/docs/DEPLOYMENT_INSTRUCTIONS.md` for step-by-step guide
**Issues:** Check Supabase logs and Edge Function logs first
