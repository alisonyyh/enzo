# PupPlan Backend - Quick Reference

One-page reference for common backend operations.

---

## 🚀 Deployment

```bash
# Deploy Edge Function
supabase functions deploy generate-routine --project-ref YOUR_PROJECT_REF

# Deploy migrations
supabase db push --db-url "postgresql://postgres:PASSWORD@PROJECT.supabase.co:5432/postgres"

# Deploy frontend (Vercel)
git push origin main
```

---

## 🔑 Configuration

```bash
# Set Anthropic API key (Production)
# Supabase Dashboard > Project Settings > Edge Functions > Secrets
ANTHROPIC_API_KEY=sk-ant-xxx

# Set Anthropic API key (Local)
export ANTHROPIC_API_KEY=sk-ant-xxx
```

---

## 🧪 Local Development

```bash
# Start Supabase locally (DB + Edge Functions + Auth)
supabase start

# Stop Supabase
supabase stop

# View logs
supabase functions logs generate-routine --tail

# Apply migrations locally
supabase db push
```

**Local URLs:**
- Database: `localhost:54322`
- API: `localhost:54321`
- Studio: `http://localhost:54323`
- Edge Functions: `localhost:54324`

---

## 🧪 Testing Edge Function

**Production:**
```bash
curl -X POST 'https://YOUR_PROJECT.supabase.co/functions/v1/generate-routine' \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
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

**Local:**
```bash
curl -X POST 'http://localhost:54321/functions/v1/generate-routine' \
  -H "Authorization: Bearer YOUR_LOCAL_JWT" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

---

## 📊 Monitoring

**Edge Function logs:**
```bash
# Real-time
supabase functions logs generate-routine --tail

# Errors only
supabase functions logs generate-routine --tail | grep ERROR
```

**Database performance:**
```sql
-- Slow queries (> 100ms)
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY mean_exec_time DESC LIMIT 10;

-- Index usage
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC;
```

---

## 🔒 Security Checks

**Test RLS policies:**
```sql
-- Switch to authenticated user context
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = 'user-uuid';

-- Try to access data (should respect RLS)
SELECT * FROM puppies;
```

**Check for RLS violations:**
```bash
# Supabase Dashboard > Database > Logs
# Look for "permission denied" errors
```

---

## 🐛 Troubleshooting

| Error | Solution |
|-------|----------|
| `ANTHROPIC_API_KEY not configured` | Add in Supabase Dashboard > Edge Functions > Secrets |
| `Row Level Security policy violation` | Check migrations applied: `supabase db push` |
| `Edge Function timeout` | Normal (Claude takes 5-10s). Check logs. |
| `Invalid JSON from Claude` | Check Edge Function logs for actual error |
| Slow dashboard | Check indexes created: `\d+ table_name` |

---

## 💰 Cost Monitoring

**Anthropic Dashboard:**
- https://console.anthropic.com
- Usage > API Costs
- Should be ~$0.03 per routine

**Supabase Dashboard:**
- Project Settings > Usage
- Database size, API requests, storage

---

## 📁 Key Files

| File | Purpose |
|------|---------|
| `supabase/functions/generate-routine/index.ts` | AI routine generation |
| `supabase/migrations/20260211000001_rls_policies.sql` | Security policies |
| `supabase/migrations/20260211000002_indexes.sql` | Performance indexes |
| `docs/DEPLOYMENT_INSTRUCTIONS.md` | Detailed deployment guide |
| `docs/BACKEND_IMPLEMENTATION_SUMMARY.md` | What was built |

---

## 🔄 Rollback

**Edge Function:**
```bash
# List deployments
supabase functions list

# Rollback not supported - redeploy previous version
```

**Migrations:**
```bash
# Disable RLS temporarily
ALTER TABLE table_name DISABLE ROW LEVEL SECURITY;

# Drop index
DROP INDEX idx_name;

# Re-apply corrected migration
supabase db push --file path/to/migration.sql
```

---

## ✅ Deployment Checklist

- [ ] Anthropic API key configured in Supabase
- [ ] Migrations applied (RLS + indexes)
- [ ] Edge Function deployed
- [ ] Test Edge Function with curl
- [ ] Check logs for errors
- [ ] Verify RLS policies working
- [ ] Monitor Anthropic costs
- [ ] Frontend env vars set (Vercel)

---

## 📖 Full Documentation

- **Deployment:** `docs/DEPLOYMENT_INSTRUCTIONS.md`
- **Architecture:** `docs/backend-development-plan.md`
- **Summary:** `docs/BACKEND_IMPLEMENTATION_SUMMARY.md`
- **Backend:** `supabase/README.md`
