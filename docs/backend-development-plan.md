# PupPlan Backend Development Plan

**Document Version:** 1.0
**Created:** 2026-02-11
**Status:** Draft
**Stage:** 0→1 (Launch MVP)

---

## Executive Summary

This document outlines the backend architecture and implementation plan for **PupPlan**, an AI-powered puppy care routine web app. The backend will replace the current client-side mock routine generation with a production-ready system using **Supabase** for data persistence, auth, real-time sync, and **Anthropic Claude API** for intelligent routine generation.

**Current State:**
- Frontend prototype complete (Vite + React + TypeScript)
- Supabase integration partially implemented (auth, database schema, basic CRUD)
- Client-side mock routine generation (breed/age rules)
- No AI integration yet

**Target State:**
- Production-ready backend with Supabase Edge Functions
- Real AI routine generation via Claude Sonnet 4.5
- Robust API layer for all frontend operations
- Scalable architecture ready for 1→100 growth

---

## 1. Technology Stack

### 1.1 Backend Platform: **Supabase**
**Rationale:** Already partially integrated, provides auth, Postgres, real-time sync, storage, and Edge Functions in one platform. Zero ops overhead for 0→1 stage.

**Components:**
- **Postgres Database:** Primary data store
- **Supabase Auth:** Google OAuth (already configured)
- **Supabase Realtime:** WebSocket-based live updates for activity completions
- **Supabase Storage:** Profile pictures and puppy photos
- **Supabase Edge Functions (Deno):** Serverless API endpoints for AI generation and business logic

### 1.2 AI/LLM: **Anthropic Claude API (claude-sonnet-4-5-20250929)**
**Rationale:** Sonnet 4.5 is the most capable model for generating structured, safe, and personalized puppy care routines. Fast, reliable, and cost-effective for production use.

**Use Cases:**
- Routine generation based on questionnaire data
- Future: routine adjustment recommendations, Q&A about puppy care

### 1.3 API Layer: **Supabase Edge Functions (TypeScript/Deno)**
**Rationale:** Native Supabase integration, auto-scales, zero cold start cost, TypeScript for type safety.

**Key Endpoints:**
- `POST /functions/v1/generate-routine` - AI routine generation
- `POST /functions/v1/accept-invite` - Caretaker invite acceptance flow
- (Future) `POST /functions/v1/adjust-routine` - Routine modifications

### 1.4 Development Tools
- **Language:** TypeScript (both Edge Functions and frontend already use it)
- **Type Safety:** Supabase auto-generates types from database schema
- **Testing:** Deno's built-in test runner for Edge Functions
- **Local Dev:** Supabase CLI for local database and Edge Function development

---

## 2. Database Architecture

### 2.1 Current Schema (Already Implemented)

The database schema is **already defined** in Supabase and typed in `src/lib/database.types.ts`. Key tables:

```sql
-- Users (handled by Supabase Auth)
-- Extended by profiles table

profiles
  - id (UUID, FK to auth.users)
  - display_name (text, nullable)
  - avatar_url (text, nullable)
  - created_at (timestamp)

puppies
  - id (UUID, PK)
  - name (text)
  - breed (text)
  - age_months (integer)
  - age_weeks (integer)
  - weight_value (numeric, nullable)
  - weight_unit (text)
  - living_situation (text)
  - photo_url (text, nullable)
  - questionnaire_data (jsonb, nullable)
  - created_at (timestamp)

puppy_memberships
  - id (UUID, PK)
  - puppy_id (UUID, FK → puppies)
  - user_id (UUID, FK → auth.users)
  - role ('owner' | 'caretaker')
  - status ('active' | 'removed')
  - joined_at (timestamp)

routines
  - id (UUID, PK)
  - puppy_id (UUID, FK → puppies)
  - generated_at (timestamp)
  - source (text: 'ai_generated' | 'user_modified')
  - is_active (boolean)

routine_items
  - id (UUID, PK)
  - routine_id (UUID, FK → routines)
  - activity_type (text)
  - title (text)
  - description (text, nullable)
  - scheduled_time (time)
  - duration_minutes (integer, nullable)
  - sort_order (integer, nullable)
  - is_enabled (boolean)

activity_logs
  - id (UUID, PK)
  - routine_item_id (UUID, FK → routine_items)
  - puppy_id (UUID, FK → puppies)
  - date (date)
  - status ('completed' | 'missed' | 'skipped')
  - completed_by (UUID, FK → auth.users, nullable)
  - completed_at (timestamp, nullable)
  - note (text, nullable)
  - created_at (timestamp)

invites
  - id (UUID, PK)
  - puppy_id (UUID, FK → puppies)
  - invited_by (UUID, FK → auth.users)
  - invite_token (text, unique)
  - status ('pending' | 'accepted' | 'expired' | 'revoked')
  - accepted_by (UUID, FK → auth.users, nullable)
  - expires_at (timestamp)
  - created_at (timestamp)
```

### 2.2 Required Row-Level Security (RLS) Policies

**Critical for production.** RLS must be enabled on all tables to prevent unauthorized access.

```sql
-- profiles: Users can read all, update own
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- puppies: Only members can read/update
ALTER TABLE puppies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view puppies they have access to"
  ON puppies FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM puppy_memberships
      WHERE puppy_id = puppies.id
        AND user_id = auth.uid()
        AND status = 'active'
    )
  );

CREATE POLICY "Owners can update their puppies"
  ON puppies FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM puppy_memberships
      WHERE puppy_id = puppies.id
        AND user_id = auth.uid()
        AND role = 'owner'
        AND status = 'active'
    )
  );

-- puppy_memberships: Members can read own, owners can insert/update
ALTER TABLE puppy_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view memberships for their puppies"
  ON puppy_memberships FOR SELECT
  USING (
    puppy_id IN (
      SELECT puppy_id FROM puppy_memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- routines, routine_items, activity_logs: Similar member-based access
-- (Full policies available in migration files)
```

### 2.3 Missing Indexes (Performance Optimization)

Add these indexes for query performance:

```sql
-- Speed up membership lookups (critical for RLS)
CREATE INDEX idx_puppy_memberships_user_puppy
  ON puppy_memberships(user_id, puppy_id)
  WHERE status = 'active';

-- Speed up routine fetching
CREATE INDEX idx_routines_puppy_active
  ON routines(puppy_id, is_active)
  WHERE is_active = true;

-- Speed up activity log queries (dashboard loads)
CREATE INDEX idx_activity_logs_puppy_date
  ON activity_logs(puppy_id, date);

-- Speed up invite token lookups
CREATE INDEX idx_invites_token
  ON invites(invite_token)
  WHERE status = 'pending';
```

---

## 3. API Design

### 3.1 Core Endpoint: AI Routine Generation

**Endpoint:** `POST /functions/v1/generate-routine`

**Purpose:** Replace the client-side `generateRoutine()` function with real AI-powered routine generation.

**Request:**
```typescript
{
  puppyId: string;          // UUID of newly created puppy
  questionnaireData: {
    puppyName: string;
    breed: string;
    ageMonths: number;
    ageWeeks: number;
    weight: number | null;
    weightUnit: 'lbs' | 'kg';
    livingSituation: string;
    workArrangement: string;
    wakeUpTime: string;      // HH:MM
    bedTime: string;         // HH:MM
  }
}
```

**Response:**
```typescript
{
  routine: {
    id: string;              // Routine UUID
    puppy_id: string;
    generated_at: string;
    source: 'ai_generated';
    is_active: true;
    routine_items: [
      {
        id: string;
        activity_type: string;
        title: string;
        description: string;
        scheduled_time: string;  // HH:MM:SS
        duration_minutes: number | null;
        sort_order: number;
        is_enabled: true;
      }
    ]
  }
}
```

**Implementation Flow:**
1. Validate request (auth check, puppy ownership)
2. Build Claude prompt from questionnaire data
3. Call Claude API with structured output schema
4. Parse and validate Claude response
5. Save routine + items to database (transaction)
6. Return complete routine

**Claude Prompt Strategy:**
```typescript
const prompt = `You are a certified dog trainer and veterinary advisor. Generate a personalized daily routine for a puppy based on the following information:

Puppy Details:
- Name: ${data.puppyName}
- Breed: ${data.breed}
- Age: ${data.ageMonths} months, ${data.ageWeeks} weeks
- Weight: ${data.weight} ${data.weightUnit}
- Living Situation: ${data.livingSituation}
- Owner's Schedule: ${data.workArrangement}
- Wake-up Time: ${data.wakeUpTime}
- Bedtime: ${data.bedTime}

Generate a daily routine with 15-20 activities covering:
- Feeding (age-appropriate frequency and portions)
- Potty breaks (frequent for young puppies)
- Exercise (breed and age appropriate - avoid over-exercising)
- Training sessions (short, positive reinforcement)
- Nap/crate time
- Play sessions
- Socialization opportunities

Format as a JSON array of activities. Each activity must have:
- time: "HH:MM" (24-hour format, aligned with owner's schedule)
- activity: short title (e.g., "Morning Walk")
- category: one of [feeding, potty, exercise, training, rest, play, bonding]
- description: 1-2 sentence guidance (include safety tips for young puppies)

Ensure:
- Potty breaks are frequent (every 2-3 hours for puppies under 12 weeks)
- Feeding matches breed size and age (3-4 meals for young puppies, 2-3 for older)
- Exercise is gentle and age-appropriate (5 min per month of age, max)
- Training sessions are short (5-10 minutes max)
- Schedule respects owner's work arrangement (no mid-day walks if they work in office)
- Evening wind-down before bedtime

Return ONLY valid JSON, no other text.`;
```

**Error Handling:**
- 401: Not authenticated
- 403: Not authorized (user doesn't own puppy)
- 400: Invalid request (missing fields, invalid data)
- 500: Claude API error (log and return generic error)
- 503: Claude rate limit (retry with exponential backoff)

**Cost Estimation:**
- Claude Sonnet 4.5: $3.00 per million input tokens, $15.00 per million output tokens
- Estimated prompt size: ~500 tokens input, ~2000 tokens output
- Cost per routine: ~$0.03
- For 1000 users/month: ~$30/month in AI costs (negligible)

---

### 3.2 Invite Acceptance Endpoint

**Endpoint:** `POST /functions/v1/accept-invite`

**Purpose:** Handle caretaker invite acceptance (validate token, create membership).

**Request:**
```typescript
{
  inviteToken: string;     // From URL query param
}
```

**Response:**
```typescript
{
  success: true;
  puppy: {
    id: string;
    name: string;
    photo_url: string | null;
    owner_name: string;    // Display name of owner
  };
  membership: {
    id: string;
    role: 'caretaker';
    joined_at: string;
  }
}
```

**Implementation Flow:**
1. Validate token (exists, not expired, status = 'pending')
2. Check user isn't already a member
3. Create puppy_membership record (role = 'caretaker')
4. Update invite (status = 'accepted', accepted_by = user_id)
5. Return puppy details for UI display

**Error Handling:**
- 400: Invalid or expired token
- 409: User already a member
- 500: Database error

---

### 3.3 Future Endpoints (Post-MVP)

**Routine Adjustment:**
- `POST /functions/v1/adjust-routine` - AI-powered routine tweaks
- Use Claude to suggest adjustments based on completion patterns

**Progress Insights:**
- `GET /functions/v1/insights/{puppyId}` - Weekly progress summary
- Aggregate activity_logs for trends

---

## 4. Authentication & Authorization

### 4.1 Current State (Already Implemented)
- **Google OAuth** via Supabase Auth
- Frontend uses `supabase.auth.signInWithOAuth({ provider: 'google' })`
- User profile created automatically via database trigger

### 4.2 Authorization Model

**Roles:**
- **Owner:** Full access (CRUD on puppy, routine, settings, invites)
- **Caretaker:** Read + track access (view routine, complete activities)

**Enforcement:**
- **Database RLS:** Postgres policies enforce access at query level
- **Edge Functions:** Validate user role before mutations
- **Frontend:** UI hides unavailable actions (defense in depth)

**Example Check:**
```typescript
// In Edge Function: verify user is owner before allowing routine edit
const { data: membership } = await supabase
  .from('puppy_memberships')
  .select('role')
  .eq('puppy_id', puppyId)
  .eq('user_id', user.id)
  .eq('status', 'active')
  .single();

if (!membership || membership.role !== 'owner') {
  return new Response('Forbidden', { status: 403 });
}
```

---

## 5. AI Integration Details

### 5.1 Claude API Configuration

**Model:** `claude-sonnet-4-5-20250929`
**Max Tokens:** 4096 (routine generation outputs ~2000 tokens)
**Temperature:** 0.7 (balanced creativity and consistency)
**System Prompt:** Define role as puppy care expert, safety guidelines

**Structured Output:**
Use Claude's built-in JSON mode to ensure valid schema:
```typescript
const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-5-20250929',
  max_tokens: 4096,
  temperature: 0.7,
  system: 'You are a certified dog trainer...',
  messages: [
    { role: 'user', content: prompt }
  ]
});

const routine = JSON.parse(response.content[0].text);
```

**Validation:**
After parsing, validate:
- All activities have required fields (time, activity, category, description)
- Times are chronological and within wake/bed window
- Categories match allowed values
- Age-appropriate recommendations (e.g., no 60-min runs for 8-week puppy)

**Fallback Strategy:**
If Claude call fails (rate limit, network error):
1. Log error to Supabase (errors table)
2. Fall back to client-side rule-based generation (existing `generateRoutine()`)
3. Mark routine source as 'fallback_generated'
4. Show user a notice: "We're experiencing high demand. Your routine was generated using our backup system."

---

### 5.2 Safety & Content Moderation

**Input Validation:**
- Breed names: check against allowlist (AKC recognized breeds + "Mixed")
- Sanitize all text inputs (strip HTML, limit length)
- Use zod schemas in Edge Functions

```typescript
import { z } from 'zod';

const requestSchema = z.object({
  puppyId: z.string().uuid(),
  questionnaireData: z.object({
    puppyName: z.string().max(50),
    breed: z.string().max(100),
    ageMonths: z.number().int().min(0).max(12),
    // ...
  })
});
```

---

### 5.3 Rate Limiting
**Threat:** Abuse (user spamming "Regenerate routine" to rack up AI costs).

**Mitigation:**
- Supabase Edge Functions have built-in rate limiting (100 req/min per IP)
- Add application-level limit: 1 routine generation per puppy per 5 minutes
- Track in database: `routine_generation_requests` table with timestamps

---

## 6. Deployment Architecture

### 6.1 Infrastructure (Supabase Cloud)

**Components:**
- **Database:** Supabase-managed Postgres (auto-backups, point-in-time recovery)
- **Edge Functions:** Deployed via Supabase CLI (`supabase functions deploy`)
- **Storage:** Supabase Storage with CDN for images
- **Auth:** Supabase Auth (Google OAuth configured)

**Environment Variables:**
```env
# Supabase (already configured)
VITE_SUPABASE_URL=https://[project].supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Edge Function secrets (set via CLI)
ANTHROPIC_API_KEY=sk-ant-... (set in Supabase dashboard)
```

**Regions:**
- **Database:** us-east-1 (Supabase default, can migrate to us-west-2 for latency)
- **Edge Functions:** Auto-deploy to nearest region (Deno Deploy)

---

### 6.2 Frontend Hosting: **Vercel**

**Rationale:** Already using Vite, Vercel offers zero-config deployment, edge functions for static assets, auto-preview deploys.

**Setup:**
```bash
# Connect Vercel to GitHub repo
vercel link

# Auto-deploys on push to main
# Preview deploys for PRs
```

**Environment Variables (Vercel):**
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

**Build Config (`vercel.json`):**
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite"
}
```

---

### 6.3 CI/CD Pipeline

**0→1 Stage:** Keep it simple. No CI/CD needed yet.

**Manual Deploy Process:**
1. **Frontend:** `git push` → Vercel auto-deploys
2. **Edge Functions:** `supabase functions deploy generate-routine`
3. **Database Migrations:** `supabase db push` (run manually, review SQL first)

**1→100 Stage (Future):**
- GitHub Actions for automated testing
- Staging environment (separate Supabase project)
- Database migration CI (check for breaking changes)

---

### 6.4 Monitoring & Logging

**Supabase Built-In:**
- **Database Logs:** Query performance, slow queries, errors
- **Edge Function Logs:** Console output, errors, latency
- **Auth Logs:** Sign-ins, failures, OAuth errors

**External (Future):**
- **Sentry:** Frontend and Edge Function error tracking
- **Anthropic Dashboard:** Claude API usage, rate limits, costs

**Alerts (Manual for Now):**
- Check Supabase dashboard daily for errors
- Monitor Anthropic usage to avoid surprise bills

---

## 7. Development Phases

### Phase 1: Backend Foundation (Week 1)
**Goal:** Get Edge Functions working locally, set up dev environment.

**Tasks:**
1. Install Supabase CLI: `npm install -g supabase`
2. Initialize local Supabase: `supabase init`
3. Start local Supabase: `supabase start` (Postgres + Edge Functions)
4. Create `supabase/functions/generate-routine/index.ts`
5. Test Edge Function locally with mock data
6. **Deliverable:** Edge Function responds to POST with hardcoded routine

**Unblocks:** Phase 2 (AI integration)

---

### Phase 2: AI Integration (Week 1-2)
**Goal:** Claude API integration, structured output, validation.

**Tasks:**
1. Sign up for Anthropic API key
2. Add `ANTHROPIC_API_KEY` to Supabase secrets
3. Install Anthropic SDK in Edge Function: `import Anthropic from '@anthropic-ai/sdk'`
4. Build Claude prompt from request data
5. Call Claude API, parse JSON response
6. Validate routine structure (times, categories, safety checks)
7. Test with real questionnaire data (various breeds, ages)
8. **Deliverable:** Edge Function generates AI routines

**Unblocks:** Phase 3 (database integration)

---

### Phase 3: Database Integration (Week 2)
**Goal:** Save AI-generated routines to Supabase, replace client-side logic.

**Tasks:**
1. Update Edge Function to save routine + items to database (transaction)
2. Add error handling (duplicate routines, invalid puppy IDs)
3. Update frontend `AIRoutineGenerator` to call Edge Function instead of `generateRoutine()`
4. Remove client-side `generateRoutine()` function (keep as fallback)
5. Test end-to-end flow: questionnaire → Edge Function → database → dashboard
6. **Deliverable:** Production routine generation

**Unblocks:** Phase 4 (production hardening)

---

### Phase 4: Production Hardening (Week 2-3)
**Goal:** RLS policies, error handling, performance optimization.

**Tasks:**
1. Enable RLS on all tables
2. Write and test RLS policies (use `supabase/migrations/`)
3. Add database indexes (see Section 2.3)
4. Implement fallback logic (Claude fails → client-side generation)
5. Add request validation (zod schemas)
6. Test error paths (invalid tokens, network failures, rate limits)
7. Load test: simulate 100 concurrent routine generations
8. **Deliverable:** Production-ready backend

**Unblocks:** Phase 5 (deployment)

---

### Phase 5: Deployment (Week 3)
**Goal:** Deploy to production, verify E2E.

**Tasks:**
1. Deploy Edge Functions: `supabase functions deploy generate-routine`
2. Run database migrations on production: `supabase db push --db-url <prod>`
3. Update frontend env vars to point to production Supabase
4. Deploy frontend to Vercel
5. Create test account, run through onboarding flow
6. Monitor logs for errors
7. **Deliverable:** Live production app

**Unblocks:** Phase 6 (invite system)

---

### Phase 6: Invite System Backend (Week 3-4)
**Goal:** Implement `/accept-invite` Edge Function.

**Tasks:**
1. Create `supabase/functions/accept-invite/index.ts`
2. Validate invite token (check expiry, status)
3. Create puppy_membership record
4. Update invite status
5. Test invite flow end-to-end
6. Add RLS policy for invite table
7. **Deliverable:** Working caretaker invite system

**Unblocks:** Launch 🚀

---

## 8. Key Technical Decisions

### Decision 1: Supabase vs. Custom Backend
**Choice:** Supabase
**Rationale:** 0→1 speed. Supabase provides auth, database, realtime, storage, and serverless functions in one platform. Building a custom Node/Express backend would take 3-4x longer and require managing infra (hosting, DB, auth provider integration). Supabase scales to millions of users, so we won't outgrow it.

**Trade-off:** Vendor lock-in, but migration path exists (Postgres dump + rewrite Edge Functions as standard Node.js).

---

### Decision 2: Claude Sonnet 4.5 vs. GPT-4
**Choice:** Claude Sonnet 4.5
**Rationale:** Sonnet 4.5 is the most capable model as of 2026-02, excels at structured output (JSON), has strong safety filters, and costs less than GPT-4 Turbo. Claude's longer context window (200K) allows richer prompts with breed-specific examples.

**Trade-off:** Single vendor dependency, but fallback to client-side rules mitigates risk.

---

### Decision 3: Edge Functions vs. Traditional API Server
**Choice:** Supabase Edge Functions (Deno)
**Rationale:** Zero cold start, auto-scaling, TypeScript native, integrated with Supabase auth/db. No need to manage Express server, deploy to Heroku, configure CORS, etc. For 0→1, serverless is the obvious choice.

**Trade-off:** Deno ecosystem smaller than Node, but Anthropic SDK works fine.

---

### Decision 4: Client-Side Fallback vs. Error Page
**Choice:** Client-side fallback
**Rationale:** If Claude API is down (rare but possible), showing an error page is a terrible UX for a new user completing onboarding. Falling back to rule-based generation (existing `generateRoutine()`) ensures they get *some* routine immediately. We can mark it as "fallback_generated" and offer a "Regenerate with AI" button later.

**Trade-off:** More code to maintain, but dramatically better UX.

---

### Decision 5: Realtime Sync vs. Polling
**Choice:** Supabase Realtime
**Rationale:** Already implemented in frontend (`subscribeToActivityLogs`). Provides <1s sync for activity completions, critical for multi-caretaker households. Polling would add 3-5s delay and unnecessary API load.

**Trade-off:** Realtime connections cost more at scale, but negligible for <10K users.

---

## 9. Migration Strategy (Client → Server AI)

### Current Flow (Client-Side):
```
Questionnaire Submit
  → setAppState('generating-routine')
  → generateRoutine(data) [client-side JS]
  → 8s animation
  → handleRoutineGenerated(routine)
  → saveRoutine(puppyId, items) [Supabase call]
  → setAppState('dashboard')
```

### Target Flow (Server-Side):
```
Questionnaire Submit
  → setAppState('generating-routine')
  → POST /functions/v1/generate-routine [Edge Function]
    → Claude API call
    → Parse + validate
    → Save to database
    → Return routine
  → 8s animation (parallel)
  → handleRoutineGenerated(routine)
  → setAppState('dashboard')
```

### Migration Steps:
1. **Add Edge Function** (non-breaking, runs alongside client-side)
2. **Update frontend** to call Edge Function instead of `generateRoutine()`
3. **Keep `generateRoutine()` as fallback** (called if Edge Function returns 500/503)
4. **Test with feature flag** (env var `VITE_USE_AI_BACKEND=true`)
5. **Deploy to staging** (separate Supabase project)
6. **Deploy to production**
7. **Remove client-side `generateRoutine()`** after 1 week of stable AI generation

**Rollback Plan:**
- If Edge Function has >5% error rate, flip feature flag back to client-side
- Client-side code remains untouched during migration

---

## 10. Cost Projections

### Monthly Costs (1000 Active Users)

| Service | Usage | Cost |
|---------|-------|------|
| **Supabase** | Pro plan (8GB DB, 50GB storage, 2M Edge Function invocations) | $25/mo |
| **Anthropic Claude API** | 1000 routine generations/mo (~2K tokens/gen) | $30/mo |
| **Vercel** | Hobby plan (100GB bandwidth) | $0 (free tier) |
| **Supabase Storage** | 10GB puppy photos (assuming 50% upload rate, 1MB avg) | Included in Pro |
| **Total** | | **~$55/mo** |

### Scaling (10K Users)
- Supabase: Upgrade to Team plan ($599/mo for dedicated resources)
- Claude API: ~$300/mo (10K routines)
- Vercel: Pro plan ($20/mo)
- **Total:** ~$920/mo

**Revenue Model (Future):**
- Freemium: Basic routine free, AI adjustments behind paywall ($4.99/mo)
- Premium: Unlimited AI regenerations, custom goals ($9.99/mo)
- Break-even: ~100 paying users

---

## 11. Security Considerations

### 11.1 Input Validation
**Threat:** Prompt injection via fake breed names, malicious questionnaire data.

**Mitigation:**
- Validate breed against allowlist (AKC recognized breeds + "Mixed")
- Sanitize all text inputs (strip HTML, limit length)
- Use zod schemas in Edge Functions

### 11.2 Data Privacy
**Compliance:** COPPA not applicable (users are adults, puppy data is not PII).

**Best Practices:**
- Encrypt at rest (Supabase default)
- TLS in transit (HTTPS everywhere)
- No third-party analytics (avoid leaking user data)
- User data deletion: implement account deletion (GDPR compliance)

### 11.3 API Key Security
**Threat:** Exposed `ANTHROPIC_API_KEY` in client code or logs.

**Mitigation:**
- Store in Supabase secrets (never in Git, env files)
- Access via `Deno.env.get('ANTHROPIC_API_KEY')` in Edge Functions only
- Rotate keys quarterly
- Monitor Anthropic usage dashboard for anomalies

---

## 12. Testing Strategy

### 12.1 Unit Tests (Edge Functions)
**Framework:** Deno's built-in test runner

**Test Coverage:**
- Input validation (invalid puppyId, missing fields)
- Claude response parsing (valid/invalid JSON)
- Database transactions (rollback on error)
- RLS policy enforcement (unauthorized access)

**Example:**
```typescript
// supabase/functions/generate-routine/index.test.ts
Deno.test("rejects invalid puppyId", async () => {
  const req = new Request('http://localhost', {
    method: 'POST',
    body: JSON.stringify({ puppyId: 'not-a-uuid' })
  });
  const res = await handler(req);
  assertEquals(res.status, 400);
});
```

---

### 12.2 Integration Tests
**Scope:** E2E flows (onboarding → AI generation → dashboard).

**Tools:** Playwright (headless browser testing)

**Key Scenarios:**
1. New user signs in → completes questionnaire → sees AI routine
2. Owner invites caretaker → caretaker accepts → both see same routine
3. Caretaker completes task → owner sees update in <5s (realtime)

**Run Frequency:** Pre-deploy (manual), post-deploy (smoke test)

---

### 12.3 Load Testing
**Goal:** Validate Edge Function handles 100 concurrent routine generations.

**Tool:** `wrk` or `artillery`

**Test Plan:**
```bash
# 100 concurrent users, 10 seconds
wrk -t10 -c100 -d10s --timeout 30s \
  -s post.lua \
  https://[project].supabase.co/functions/v1/generate-routine
```

**Success Criteria:**
- <5% error rate
- p99 latency <10s (Claude API is the bottleneck)
- No database connection pool exhaustion

---

## 13. Rollout Plan

### Pre-Launch Checklist
- [ ] RLS policies enabled on all tables
- [ ] Database indexes created
- [ ] Edge Function deployed to production
- [ ] Frontend env vars updated (production Supabase URL)
- [ ] Anthropic API key configured in Supabase secrets
- [ ] Test account created, onboarding flow verified
- [ ] Error monitoring configured (Supabase logs)
- [ ] Invite flow tested (owner → caretaker)
- [ ] Realtime sync verified (activity completion propagation)
- [ ] Fallback logic tested (Claude API disabled → client-side generation)

### Launch Day
1. Deploy frontend to Vercel (main branch)
2. Monitor Supabase logs for errors
3. Monitor Anthropic dashboard for API usage
4. Test E2E flow on production
5. Invite 5 beta users (friends/family)
6. Watch for errors, gather feedback

### Week 1 Post-Launch
- Daily log review (catch errors early)
- User feedback sessions (UX issues, AI routine quality)
- Iterate on Claude prompt (improve routine quality)
- Monitor costs (Anthropic usage)

---

## 14. Future Enhancements (Post-MVP)

### P1 (Needed Soon After Launch)
1. **Push Notifications**
   - Edge Function cron job (daily at wake-up time)
   - Send notification via Expo Push API
   - "Good morning! Biscuit's routine is ready."

2. **AI Routine Adjustments**
   - User requests change (e.g., "Move dinner to 7pm")
   - POST /functions/v1/adjust-routine
   - Claude rewrites routine with constraint

3. **Progress Insights**
   - Weekly email summary (% completion, trends)
   - Edge Function cron job (Sundays)
   - Anthropic API for natural language insights

### P2 (Future)
- Multi-puppy support (switch between puppies)
- Routine templates (share routines between users)
- Vet appointment reminders (calendar integration)
- Health records (vaccination tracking)
- Mobile app (React Native, reuse backend)

---

## 15. Open Questions & Risks

### Open Questions
1. **Claude prompt tuning:** How many iterations to get consistently good routines?
   - **Mitigation:** User feedback loop, A/B test prompts
2. **Fallback trigger:** What error rate triggers fallback mode?
   - **Decision:** >5% Edge Function errors in 5-min window
3. **Image optimization:** Should we resize puppy photos server-side?
   - **Decision:** Client-side for now (React Image Crop), server-side in P1

### Risks
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Claude API rate limit hit during launch | Medium | High | Implement queue system (defer routine generation), fallback to client-side |
| Supabase Realtime connection limit | Low | Medium | Monitor connection count, upgrade plan proactively |
| RLS policy bug (data leak) | Low | Critical | Pre-launch security audit, test with multiple accounts |
| Edge Function cold start latency | Medium | Low | Accept it (0→1 stage), warm-up pings in P1 |
| Routine quality issues (unsafe advice) | Low | High | Manual review of first 100 AI routines, add safety validation |

---

## 16. Success Metrics

### Technical Metrics (Week 1)
- [ ] Edge Function p99 latency <10s
- [ ] Error rate <1%
- [ ] Database query p95 <500ms
- [ ] Realtime sync latency <2s
- [ ] Zero RLS policy violations

### Product Metrics (Month 1)
- [ ] 60% of users complete onboarding
- [ ] 40% of routines are AI-generated (vs. fallback)
- [ ] 30% of owners invite a caretaker
- [ ] 50% retention at 2 weeks
- [ ] <5 support tickets about AI routine quality

---

## Appendix A: File Structure

```
puppy_daycare/
├── supabase/
│   ├── functions/
│   │   ├── generate-routine/
│   │   │   ├── index.ts          # Main Edge Function
│   │   │   ├── index.test.ts     # Unit tests
│   │   │   └── prompts.ts        # Claude prompt templates
│   │   └── accept-invite/
│   │       └── index.ts
│   ├── migrations/
│   │   ├── 20260211_rls_policies.sql
│   │   ├── 20260211_indexes.sql
│   │   └── 20260211_triggers.sql
│   └── config.toml               # Supabase local config
├── src/
│   ├── lib/
│   │   ├── supabase.ts           # Supabase client
│   │   ├── database.types.ts     # Auto-generated types
│   │   └── services/
│   │       ├── routines.ts       # Frontend service (calls Edge Function)
│   │       ├── activity-logs.ts
│   │       └── invites.ts
│   └── app/
│       └── components/
│           └── AIRoutineGenerator.tsx  # Updated to call Edge Function
├── .env.local                    # Local dev env vars
└── docs/
    └── backend-development-plan.md  # This document
```

---

## Appendix B: Environment Variables

### Development (.env.local)
```env
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (local)
VITE_USE_AI_BACKEND=true  # Feature flag for testing Edge Function
```

### Production (Vercel + Supabase)
```env
VITE_SUPABASE_URL=https://[project].supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (prod)

# Supabase Secrets (set via dashboard)
ANTHROPIC_API_KEY=sk-ant-...
```

---

## Appendix C: Claude Prompt Example (Full)

```typescript
export function buildRoutinePrompt(data: QuestionnaireData): string {
  const totalWeeks = data.ageMonths * 4 + data.ageWeeks;
  const isYoung = totalWeeks < 16;

  return `You are a certified professional dog trainer (CPDT-KA) and veterinary advisor. Generate a personalized daily care routine for a puppy.

PUPPY DETAILS:
- Name: ${data.puppyName}
- Breed: ${data.breed}
- Age: ${data.ageMonths} months, ${data.ageWeeks} weeks (${totalWeeks} weeks total)
- Weight: ${data.weight || 'unknown'} ${data.weightUnit}
- Living Situation: ${data.livingSituation}
- Owner's Work Schedule: ${data.workArrangement}
- Wake-up Time: ${data.wakeUpTime}
- Bedtime: ${data.bedTime}

CRITICAL SAFETY RULES:
1. Exercise: Max ${Math.min(totalWeeks * 5, 60)} minutes per day (5 min/week of age)
2. Feeding: ${isYoung ? '4 meals/day' : '3 meals/day'} for this age
3. Potty breaks: Every ${isYoung ? '2' : '3'} hours minimum
4. Training sessions: 5-10 minutes max (puppies have short attention spans)
5. Avoid: dog parks until fully vaccinated (16 weeks), jumping/stairs (joint damage)

REQUIRED ACTIVITIES (15-20 total):
- Feeding (age-appropriate portions for ${data.breed})
- Potty breaks (frequent, after meals/play/naps)
- Exercise (gentle walks, no forced running)
- Training (positive reinforcement, basic commands)
- Nap/crate time (puppies need 18-20 hours sleep)
- Play sessions (interactive, mental stimulation)
- Socialization (safe exposure to sounds, surfaces, people)

SCHEDULE CONSTRAINTS:
- Align with owner's wake (${data.wakeUpTime}) and bed (${data.bedTime}) times
- If work arrangement is "office/hybrid", avoid activities requiring owner presence during typical work hours (9am-5pm)
- Space activities evenly throughout waking hours

OUTPUT FORMAT (JSON array):
[
  {
    "time": "07:00",
    "activity": "Morning Potty Break",
    "category": "potty",
    "description": "Take puppy outside immediately after waking. Praise enthusiastically when they go. Young puppies have small bladders—don't delay!"
  },
  ...
]

CATEGORIES (use exactly these):
- feeding
- potty
- exercise
- training
- rest
- play
- bonding

Return ONLY the JSON array. No additional text, explanations, or markdown formatting.`;
}
```

---

---

## 17. Flow 6: Task Management Implementation Plan

**Added:** 2026-02-12
**Priority:** P0 (Launch Blocker)
**Complexity:** High (Hybrid backend architecture)

### 17.1 Overview

Flow 6 introduces real-time collaborative task editing with Firebase Firestore, adding a second backend alongside Supabase. This hybrid approach leverages Firestore's superior real-time sync capabilities for the task editing feature while maintaining Supabase for all other data.

**Key Components:**
1. Firebase Firestore setup for task sync
2. Supabase Edge Function for Firebase Custom Token generation
3. Firestore security rules with Custom Claims
4. Frontend TasksService with real-time listeners
5. Optimistic UI updates with offline queue
6. Task management UI components (swipe-to-delete, expandable cards, FAB)

---

### 17.2 Architecture: Hybrid Backend Strategy

**Why Hybrid?**
- **Firestore:** Built-in real-time listeners, automatic offline persistence (IndexedDB), optimistic updates out-of-the-box. Building equivalent functionality with Supabase Realtime would take 3-4x longer.
- **Supabase:** Remains primary backend for relational data (users, puppies, routines). PostgreSQL is superior for structured data with complex relationships.

**Data Flow:**
```
Frontend
  ├─→ Supabase (users, puppies, routines, activity_logs)
  └─→ Firestore (tasks collection - today's editable task instances)

Authentication:
  Supabase Auth (Google OAuth)
    └─→ Custom Token → Firebase Auth (for Firestore security rules)
```

**Trade-offs:**
- **Complexity:** Two backends to manage, dual auth setup
- **Benefit:** Firestore's real-time features save significant dev time (offline queue, optimistic UI, conflict resolution all built-in)
- **Cost:** Firestore free tier: 50K reads/day, 20K writes/day (sufficient for 50 users @ 100 ops/day each)

---

### 17.3 Firebase Setup

#### Step 1: Firebase Project Creation
**Duration:** 15 minutes

```bash
# 1. Create Firebase project at https://console.firebase.google.com
# Project name: pupplan-prod
# Enable Google Analytics: No (keep it simple for 0→1)

# 2. Install Firebase CLI
npm install -g firebase-tools

# 3. Login and initialize Firebase in project
firebase login
cd /Users/alyeo/Documents/puppy_daycare
firebase init firestore

# Select:
# - Use existing project: pupplan-prod
# - Firestore rules: firebase/firestore.rules
# - Firestore indexes: firebase/firestore.indexes.json
```

**Deliverable:** Firebase project created, Firestore initialized

**Unblocks:** Step 2 (security rules)

---

#### Step 2: Firestore Security Rules
**Duration:** 30 minutes

Create `firebase/firestore.rules`:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper: Check if user has access to puppy (via Custom Claims)
    function hasPuppyAccess(puppyId) {
      return request.auth != null
        && request.auth.token.puppyIds != null
        && request.auth.token.puppyIds.hasAny([puppyId]);
    }

    // Helper: Validate task fields
    function validTaskData() {
      let data = request.resource.data;
      return data.keys().hasAll([
        'puppyId', 'date', 'scheduledTime', 'actualTime',
        'activityType', 'title', 'isCompleted', 'isEdited',
        'isUserAdded', 'lastEditedBy', 'createdAt'
      ])
      && data.puppyId is string
      && data.date is string  // YYYY-MM-DD
      && data.activityType in ['potty_break', 'meal', 'training', 'nap', 'calm_time', 'play_time', 'walk']
      && data.lastEditedBy == request.auth.uid
      && data.lastEditedAt == request.time;
    }

    // Tasks collection
    match /tasks/{taskId} {
      // Read: User must have access to puppy
      allow read: if hasPuppyAccess(resource.data.puppyId);

      // Create: User must have access AND provide valid data
      allow create: if hasPuppyAccess(request.resource.data.puppyId)
        && validTaskData();

      // Update: User must have access
      allow update: if hasPuppyAccess(resource.data.puppyId)
        && request.resource.data.lastEditedBy == request.auth.uid
        && request.resource.data.lastEditedAt == request.time;

      // Delete: User must have access
      allow delete: if hasPuppyAccess(resource.data.puppyId);
    }
  }
}
```

**Deploy rules:**
```bash
firebase deploy --only firestore:rules
```

**Test rules locally:**
```bash
firebase emulators:start --only firestore
# Run tests against localhost:8080
```

**Deliverable:** Firestore security rules deployed, tested

**Unblocks:** Step 3 (Custom Token generation)

---

#### Step 3: Firebase Custom Token Generation (Supabase Edge Function)
**Duration:** 2 hours

**Problem:** Firestore security rules need to know which puppies a user can access, but Firestore can't query Supabase. Solution: Embed `puppyIds` array in Firebase Custom Claims during token generation.

Create `supabase/functions/get-firebase-token/index.ts`:

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as admin from 'https://esm.sh/firebase-admin@11.10.1';

// Initialize Firebase Admin SDK (server-side only)
const serviceAccount = JSON.parse(Deno.env.get('FIREBASE_SERVICE_ACCOUNT')!);
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

serve(async (req) => {
  try {
    // Verify Supabase auth
    const authHeader = req.headers.get('Authorization')!;
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Get user's puppy access (owner OR caretaker)
    const { data: memberships, error: membershipError } = await supabaseClient
      .from('puppy_memberships')
      .select('puppy_id')
      .eq('user_id', user.id)
      .eq('status', 'active');

    if (membershipError) {
      throw membershipError;
    }

    const puppyIds = memberships.map(m => m.puppy_id);

    // Generate Firebase Custom Token with puppyIds claim
    const firebaseToken = await admin.auth().createCustomToken(user.id, {
      puppyIds: puppyIds,
      email: user.email
    });

    return new Response(
      JSON.stringify({ firebaseToken }),
      { headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating Firebase token:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
```

**Deploy Edge Function:**
```bash
# Set Firebase service account in Supabase secrets
# Download service account JSON from Firebase Console → Project Settings → Service Accounts
supabase secrets set FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}'

# Deploy function
supabase functions deploy get-firebase-token
```

**Frontend integration** (`src/lib/firebase.ts`):

```typescript
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { supabase } from './supabase';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
};

const app = initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(app);
export const db = getFirestore(app);

// Enable offline persistence
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    console.warn('Offline persistence: multiple tabs open');
  } else if (err.code === 'unimplemented') {
    console.warn('Offline persistence: not supported in this browser');
  }
});

// Sign in to Firebase with Custom Token from Supabase
export async function signInToFirebase() {
  const { data, error } = await supabase.functions.invoke('get-firebase-token');

  if (error) throw error;

  await signInWithCustomToken(firebaseAuth, data.firebaseToken);
}
```

**Deliverable:** Firebase Custom Token generation working, user authenticated in both Supabase and Firebase

**Unblocks:** Step 4 (Firestore CRUD operations)

---

### 17.4 Frontend Implementation

#### Step 4: TasksService (Firestore CRUD)
**Duration:** 3 hours

Create `src/lib/services/tasks.ts`:

```typescript
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import { db, firebaseAuth } from '../firebase';

export interface Task {
  id: string;
  puppyId: string;
  date: string; // YYYY-MM-DD
  scheduledTime: Timestamp;
  actualTime: Timestamp;
  activityType: 'potty_break' | 'meal' | 'training' | 'nap' | 'calm_time' | 'play_time' | 'walk';
  title: string;
  description?: string;
  isCompleted: boolean;
  isEdited: boolean;
  isUserAdded: boolean;
  completedBy?: string;
  completedAt?: Timestamp;
  lastEditedBy: string;
  lastEditedAt: Timestamp;
  createdAt: Timestamp;
}

// Get today's date in YYYY-MM-DD format
function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

// Subscribe to today's tasks (real-time)
export function subscribeToTasks(
  puppyId: string,
  callback: (tasks: Task[]) => void,
  onError?: (error: Error) => void
) {
  const tasksRef = collection(db, 'tasks');
  const q = query(
    tasksRef,
    where('puppyId', '==', puppyId),
    where('date', '==', getTodayString()),
    orderBy('actualTime', 'asc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const tasks: Task[] = [];
      snapshot.forEach((doc) => {
        tasks.push({ id: doc.id, ...doc.data() } as Task);
      });
      callback(tasks);
    },
    (error) => {
      console.error('Firestore sync error:', error);
      onError?.(error);
    }
  );
}

// Add new task
export async function addTask(
  puppyId: string,
  activityType: Task['activityType'],
  time: Date,
  title: string
): Promise<string> {
  const userId = firebaseAuth.currentUser?.uid;
  if (!userId) throw new Error('Not authenticated');

  const docRef = await addDoc(collection(db, 'tasks'), {
    puppyId,
    date: getTodayString(),
    scheduledTime: Timestamp.fromDate(time),
    actualTime: Timestamp.fromDate(time),
    activityType,
    title,
    isCompleted: false,
    isEdited: true, // User-added tasks are always marked as edited
    isUserAdded: true,
    lastEditedBy: userId,
    lastEditedAt: serverTimestamp(),
    createdAt: Timestamp.now(),
  });

  return docRef.id;
}

// Edit existing task
export async function editTask(
  taskId: string,
  updates: {
    actualTime?: Date;
    activityType?: Task['activityType'];
  }
): Promise<void> {
  const userId = firebaseAuth.currentUser?.uid;
  if (!userId) throw new Error('Not authenticated');

  const taskRef = doc(db, 'tasks', taskId);

  await updateDoc(taskRef, {
    ...(updates.actualTime && { actualTime: Timestamp.fromDate(updates.actualTime) }),
    ...(updates.activityType && { activityType: updates.activityType }),
    isEdited: true,
    lastEditedBy: userId,
    lastEditedAt: serverTimestamp(),
  });
}

// Delete task
export async function deleteTask(taskId: string): Promise<void> {
  const taskRef = doc(db, 'tasks', taskId);
  await deleteDoc(taskRef);
}

// Complete task
export async function completeTask(taskId: string): Promise<void> {
  const userId = firebaseAuth.currentUser?.uid;
  if (!userId) throw new Error('Not authenticated');

  const taskRef = doc(db, 'tasks', taskId);

  await updateDoc(taskRef, {
    isCompleted: true,
    completedBy: userId,
    completedAt: Timestamp.now(),
    lastEditedBy: userId,
    lastEditedAt: serverTimestamp(),
  });
}
```

**Deliverable:** TasksService with real-time listeners, CRUD operations

**Unblocks:** Step 5 (UI components)

---

#### Step 5: Expandable Task Card Component
**Duration:** 4 hours

Create `src/app/components/TaskCard.tsx`:

```tsx
import { useState } from 'react';
import { Task, editTask } from '../../lib/services/tasks';
import { format } from 'date-fns';

const ACTIVITY_OPTIONS = [
  { value: 'potty_break', label: 'Potty Break' },
  { value: 'meal', label: 'Meal' },
  { value: 'training', label: 'Training' },
  { value: 'nap', label: 'Nap' },
  { value: 'calm_time', label: 'Calm Time' },
  { value: 'play_time', label: 'Play Time' },
  { value: 'walk', label: 'Walk' },
];

export function TaskCard({ task }: { task: Task }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [editedTime, setEditedTime] = useState(
    format(task.actualTime.toDate(), 'HH:mm')
  );
  const [editedActivity, setEditedActivity] = useState(task.activityType);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const [hours, minutes] = editedTime.split(':').map(Number);
      const newTime = new Date();
      newTime.setHours(hours, minutes, 0, 0);

      await editTask(task.id, {
        actualTime: newTime,
        activityType: editedActivity,
      });

      setIsExpanded(false);
    } catch (error) {
      console.error('Failed to save task:', error);
      alert('Failed to save changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset to current values
    setEditedTime(format(task.actualTime.toDate(), 'HH:mm'));
    setEditedActivity(task.activityType);
    setIsExpanded(false);
  };

  if (!isExpanded) {
    return (
      <div
        onClick={() => setIsExpanded(true)}
        className="flex items-center gap-4 p-4 bg-white border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
      >
        <input
          type="checkbox"
          checked={task.isCompleted}
          onClick={(e) => e.stopPropagation()}
          className="w-5 h-5"
        />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">
              {format(task.actualTime.toDate(), 'h:mm a')}
            </span>
            <span>{task.title}</span>
            {task.isEdited && <span className="text-gray-400">✏️</span>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-white border-2 border-blue-500 rounded-lg">
      <h3 className="font-semibold mb-4">{task.title}</h3>

      <div className="space-y-4">
        {/* Time Picker */}
        <div>
          <label className="block text-sm font-medium mb-1">Time</label>
          <input
            type="time"
            value={editedTime}
            onChange={(e) => setEditedTime(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>

        {/* Activity Type Dropdown */}
        <div>
          <label className="block text-sm font-medium mb-1">Activity Type</label>
          <select
            value={editedActivity}
            onChange={(e) => setEditedActivity(e.target.value as Task['activityType'])}
            className="w-full px-3 py-2 border rounded-lg"
          >
            {ACTIVITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Buttons */}
        <div className="flex gap-2 justify-end">
          <button
            onClick={handleCancel}
            disabled={isSaving}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Deliverable:** Expandable task card with inline editing

**Unblocks:** Step 6 (swipe-to-delete)

---

#### Step 6: Swipe-to-Delete Gesture
**Duration:** 2 hours

**Install dependency:**
```bash
npm install react-swipeable
```

Create `src/app/components/SwipeableTaskCard.tsx`:

```tsx
import { useSwipeable } from 'react-swipeable';
import { useState } from 'react';
import { Task, deleteTask } from '../../lib/services/tasks';
import { TaskCard } from './TaskCard';

export function SwipeableTaskCard({ task }: { task: Task }) {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handlers = useSwipeable({
    onSwiping: (eventData) => {
      if (eventData.dir === 'Left' && eventData.deltaX < 0) {
        setSwipeOffset(Math.max(eventData.deltaX, -100));
      }
    },
    onSwiped: (eventData) => {
      if (eventData.dir === 'Left' && Math.abs(eventData.deltaX) > 60) {
        setSwipeOffset(-100); // Reveal delete button
      } else {
        setSwipeOffset(0); // Reset
      }
    },
    trackMouse: true, // Enable mouse drag for desktop
  });

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    try {
      await deleteTask(task.id);
    } catch (error) {
      console.error('Failed to delete task:', error);
      alert('Failed to delete task. Please try again.');
    }
  };

  return (
    <>
      <div className="relative overflow-hidden">
        {/* Delete button (revealed on swipe) */}
        <div className="absolute right-0 top-0 h-full w-24 bg-red-500 flex items-center justify-center">
          <button
            onClick={handleDelete}
            className="text-white font-medium"
          >
            Delete
          </button>
        </div>

        {/* Task card (swipeable) */}
        <div
          {...handlers}
          style={{
            transform: `translateX(${swipeOffset}px)`,
            transition: swipeOffset === 0 ? 'transform 0.3s ease-out' : 'none',
          }}
          className="relative z-10 bg-white"
        >
          <TaskCard task={task} />
        </div>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold mb-2">Delete Task?</h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to delete this task? This action cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 text-white bg-red-600 rounded-lg"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

**Deliverable:** Swipe-to-delete with confirmation modal

**Unblocks:** Step 7 (FAB button)

---

#### Step 7: Floating Action Button (Add Task)
**Duration:** 2 hours

Create `src/app/components/AddTaskFAB.tsx`:

```tsx
import { useState } from 'react';
import { addTask } from '../../lib/services/tasks';

const ACTIVITY_OPTIONS = [
  { value: 'potty_break', label: 'Potty Break' },
  { value: 'meal', label: 'Meal' },
  { value: 'training', label: 'Training' },
  { value: 'nap', label: 'Nap' },
  { value: 'calm_time', label: 'Calm Time' },
  { value: 'play_time', label: 'Play Time' },
  { value: 'walk', label: 'Walk' },
];

export function AddTaskFAB({ puppyId }: { puppyId: string }) {
  const [showModal, setShowModal] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState('');
  const [selectedTime, setSelectedTime] = useState(
    new Date().toTimeString().slice(0, 5) // HH:MM
  );
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = async () => {
    if (!selectedActivity) return;

    setIsAdding(true);
    try {
      const [hours, minutes] = selectedTime.split(':').map(Number);
      const time = new Date();
      time.setHours(hours, minutes, 0, 0);

      const activityLabel = ACTIVITY_OPTIONS.find(
        (opt) => opt.value === selectedActivity
      )?.label || selectedActivity;

      await addTask(puppyId, selectedActivity as any, time, activityLabel);

      // Reset form
      setSelectedActivity('');
      setSelectedTime(new Date().toTimeString().slice(0, 5));
      setShowModal(false);
    } catch (error) {
      console.error('Failed to add task:', error);
      alert('Failed to add task. Please try again.');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <>
      {/* FAB Button */}
      <button
        onClick={() => setShowModal(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center text-2xl hover:bg-blue-700 transition-colors z-40"
        aria-label="Add new task"
      >
        +
      </button>

      {/* Add Task Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Add New Task</h3>

            <div className="space-y-4">
              {/* Time Picker */}
              <div>
                <label className="block text-sm font-medium mb-1">Time</label>
                <input
                  type="time"
                  value={selectedTime}
                  onChange={(e) => setSelectedTime(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              {/* Activity Type Dropdown */}
              <div>
                <label className="block text-sm font-medium mb-1">Activity Type</label>
                <select
                  value={selectedActivity}
                  onChange={(e) => setSelectedActivity(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">Select activity</option>
                  {ACTIVITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Buttons */}
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowModal(false)}
                  disabled={isAdding}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdd}
                  disabled={!selectedActivity || isAdding}
                  className="px-4 py-2 text-white bg-blue-600 rounded-lg disabled:bg-gray-300"
                >
                  {isAdding ? 'Adding...' : 'Add Task'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

**Deliverable:** FAB button with add task modal

**Unblocks:** Step 8 (network status banner)

---

#### Step 8: Network Status Banner
**Duration:** 1.5 hours

Create `src/app/components/NetworkStatusBanner.tsx`:

```tsx
import { useState, useEffect } from 'react';
import { onSnapshot, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

type BannerState = 'connected' | 'offline' | 'syncing' | 'failed';

export function NetworkStatusBanner() {
  const [state, setState] = useState<BannerState>('connected');
  const [showConnected, setShowConnected] = useState(false);

  useEffect(() => {
    // Listen to Firestore connection state
    const unsubscribe = onSnapshot(
      doc(db, '.info/connected'),
      (snapshot) => {
        const isConnected = snapshot.data()?.connected ?? false;

        if (isConnected) {
          setState('connected');
          setShowConnected(true);
          setTimeout(() => setShowConnected(false), 2000); // Auto-dismiss after 2s
        } else {
          setState('offline');
        }
      },
      (error) => {
        console.error('Connection state error:', error);
        setState('failed');
      }
    );

    return unsubscribe;
  }, []);

  if (state === 'connected' && !showConnected) {
    return null; // Don't show banner when connected after auto-dismiss
  }

  const bannerConfig = {
    connected: {
      bg: 'bg-green-50',
      border: 'border-green-200',
      text: 'text-green-800',
      message: '✓ Synced',
    },
    offline: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      text: 'text-yellow-800',
      message: '⚠️ You\'re offline. Changes will sync when connected.',
    },
    syncing: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-800',
      message: '⏳ Syncing changes...',
    },
    failed: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-800',
      message: '❌ Couldn\'t sync changes. Check your connection.',
    },
  };

  const config = bannerConfig[state];

  return (
    <div className={`${config.bg} border-b ${config.border} px-4 py-3 text-sm ${config.text} flex items-center justify-between`}>
      <span>{config.message}</span>
      {state === 'failed' && (
        <button
          onClick={() => window.location.reload()}
          className="underline font-medium"
        >
          Retry
        </button>
      )}
    </div>
  );
}
```

**Deliverable:** Network status banner with 4 states

**Unblocks:** Step 9 (integration)

---

### 17.5 Integration & Testing

#### Step 9: Dashboard Integration
**Duration:** 2 hours

Update `src/app/components/Dashboard.tsx` to use Firestore tasks:

```tsx
import { useEffect, useState } from 'react';
import { subscribeToTasks, Task } from '../../lib/services/tasks';
import { signInToFirebase } from '../../lib/firebase';
import { SwipeableTaskCard } from './SwipeableTaskCard';
import { AddTaskFAB } from './AddTaskFAB';
import { NetworkStatusBanner } from './NetworkStatusBanner';

export function Dashboard({ puppyId }: { puppyId: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    async function init() {
      try {
        // Sign in to Firebase (get Custom Token from Supabase)
        await signInToFirebase();

        // Subscribe to tasks
        unsubscribe = subscribeToTasks(
          puppyId,
          (updatedTasks) => {
            setTasks(updatedTasks);
            setIsLoading(false);
          },
          (err) => {
            setError(err.message);
            setIsLoading(false);
          }
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load tasks');
        setIsLoading(false);
      }
    }

    init();

    return () => {
      unsubscribe?.();
    };
  }, [puppyId]);

  if (isLoading) {
    return <div>Loading tasks...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <NetworkStatusBanner />

      <div className="max-w-2xl mx-auto p-4 space-y-2">
        <h1 className="text-2xl font-bold mb-4">Today's Routine</h1>

        {tasks.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <div className="text-4xl mb-2">🐾</div>
            <p>No tasks for today</p>
            <p className="text-sm">Tap + to add a task</p>
          </div>
        ) : (
          tasks.map((task) => (
            <SwipeableTaskCard key={task.id} task={task} />
          ))
        )}
      </div>

      <AddTaskFAB puppyId={puppyId} />
    </div>
  );
}
```

**Deliverable:** Fully integrated Dashboard with Flow 6 features

**Unblocks:** Step 10 (testing)

---

#### Step 10: End-to-End Testing
**Duration:** 3 hours

**Test Scenarios:**

1. **Add Task Flow**
   - Tap FAB → Select activity → Set time → Tap Add
   - Verify: Task appears in chronological order, marked with ✏️

2. **Edit Task Flow**
   - Tap task card → Change time → Tap Save
   - Verify: Task reorders, shows ✏️, changes sync to other devices within 3s

3. **Delete Task Flow**
   - Swipe left → Tap Delete → Confirm
   - Verify: Task disappears, deletion syncs to other devices

4. **Real-Time Sync**
   - Open app in two browser tabs (different accounts)
   - Edit task in Tab 1
   - Verify: Tab 2 updates within 3 seconds

5. **Offline Mode**
   - Disable network (browser DevTools → Offline)
   - Edit task
   - Verify: Yellow banner appears, change appears instantly
   - Re-enable network
   - Verify: Banner changes to "Syncing..." then "Synced", other devices receive update

6. **Conflict Resolution**
   - Two users edit same task offline
   - Both reconnect
   - Verify: Last-write-wins applies, no data corruption

**Acceptance Criteria:**
- All 6 scenarios pass
- No console errors
- Network status banner displays correctly
- Animations are smooth (200ms expansions, 300ms fade-outs)
- Offline queue works (edits sync when reconnected)

**Deliverable:** Flow 6 fully tested and working

**Unblocks:** Production deployment

---

### 17.6 Deployment Checklist

**Firebase:**
- [ ] Firestore security rules deployed (`firebase deploy --only firestore:rules`)
- [ ] Firestore indexes created (auto-generated on first query)
- [ ] Firebase service account JSON added to Supabase secrets

**Supabase:**
- [ ] `get-firebase-token` Edge Function deployed
- [ ] Edge Function tested in production (returns valid Custom Token)

**Frontend:**
- [ ] Firebase config env vars added to Vercel:
  - `VITE_FIREBASE_API_KEY`
  - `VITE_FIREBASE_AUTH_DOMAIN`
  - `VITE_FIREBASE_PROJECT_ID`
- [ ] Build succeeds with no TypeScript errors
- [ ] Deployed to Vercel

**Testing:**
- [ ] E2E test on production (add/edit/delete task)
- [ ] Multi-user sync verified
- [ ] Offline mode verified
- [ ] Mobile responsive (tested on iOS Safari, Android Chrome)

---

### 17.7 Cost Impact

**Firebase Firestore (Free Spark Tier):**
- 50K reads/day, 20K writes/day, 1GB storage
- **Estimated usage (50 users):**
  - 50 users × 15 tasks/day × 2 reads (load + updates) = 1,500 reads/day
  - 50 users × 5 edits/day = 250 writes/day
  - **Well under free tier limits**

**Scaling (1000 users):**
- 30K reads/day, 5K writes/day
- Still under free tier
- **Upgrade to Blaze (pay-as-you-go) at 10K+ users:** ~$15/month

---

### 17.8 Known Limitations & Future Improvements

**v1 Limitations:**
- No undo/redo for task edits
- No conflict resolution UI (last-write-wins is silent)
- Today's tasks only (no multi-day editing)
- Pre-defined activity types only

**P1 Improvements:**
- Conflict notification: "Mike edited this task after you. Updated to [time]."
- Undo button (24-hour window to revert edits)
- Task edit history/audit log

**P2 Improvements:**
- Multi-day task editing (past 7 days)
- Custom activity types
- Task notes/comments
- Recurring task templates

---

**End of Backend Development Plan**

*This document will be updated as implementation progresses. All technical decisions are subject to revision based on real-world testing and user feedback.*
