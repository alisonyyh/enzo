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
  pottyDetails?: {        // D52: Only present when activityType = potty_break
    poop: boolean;
    pee: boolean;
  };
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

#### Step 5: Display-Only Task Card Component
**Duration:** 2 hours
**Updated:** 2026-02-18 (D45 — removed inline expansion, now display-only with `onEdit` callback)

Create `src/app/components/TaskCard.tsx`:

```tsx
import { CheckCircle2, Circle } from 'lucide-react';
import { Task } from '../../lib/services/tasks';

// Category dot colors matching the Dashboard's CATEGORY_COLORS
function getCategoryColor(activityType: string): string {
  const colors: Record<string, string> = {
    potty_break: '#4A9B5E',
    meal: '#E8722A',
    training: '#8B6FC0',
    nap: '#8B7355',
    calm_time: '#8B7355',
    play_time: '#5B8FD4',
    walk: '#5B8FD4',
  };
  return colors[activityType] || '#8B7355';
}

// Format time to 12-hour display
function formatDisplayTime(date: Date): string {
  const hour = date.getHours();
  const minute = date.getMinutes();
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${minute.toString().padStart(2, "0")} ${period}`;
}

interface TaskCardProps {
  task: Task;
  /** Called when the user taps the card (opens edit bottom sheet). */
  onEdit?: (task: Task) => void;
}

export function TaskCard({ task, onEdit }: TaskCardProps) {
  const categoryColor = getCategoryColor(task.activityType);
  const taskDate = task.actualTime.toDate();

  return (
    <div
      onClick={() => onEdit?.(task)}
      className={`
        bg-card rounded-xl p-4 min-h-[64px] flex gap-3 transition-all cursor-pointer active:scale-[0.98]
        ${task.isCompleted ? 'opacity-60' : ''}
      `}
      style={{
        backgroundColor: '#FFFFFF',
        boxShadow: '0 2px 8px rgba(45, 27, 14, 0.06)'
      }}
    >
      {/* Time on LEFT */}
      <div className="flex-shrink-0 pt-0.5">
        <div className="text-sm font-bold text-foreground w-14 text-left">
          {formatDisplayTime(taskDate)}
        </div>
      </div>

      {/* Activity Content in MIDDLE */}
      <div className="flex-1 text-left">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <div
                className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5"
                style={{ backgroundColor: categoryColor }}
              />
              <h3 className={`font-medium text-base text-foreground ${task.isCompleted ? 'line-through' : ''}`}>
                {task.title}
              </h3>
            </div>
            <p className="text-[13px] text-muted-foreground mt-0.5 ml-3.5" style={{ lineHeight: '1.5' }}>
              {task.activityType.replace(/_/g, ' ')}
              {task.isEdited && ' · edited'}
              {task.isUserAdded && ' · custom'}
            </p>
          </div>

          {/* Status Icon on RIGHT */}
          <div className="flex-shrink-0 pt-0.5">
            {task.isCompleted ? (
              <CheckCircle2 className="size-6 text-secondary" />
            ) : (
              <Circle className="size-6 text-border" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Key change (D45):** TaskCard is now a pure display component with zero local state. Tapping calls `onEdit(task)` which the parent (Dashboard) uses to open the AddTaskFAB bottom sheet in edit mode. All inline expansion, time picker, activity dropdown, save/cancel buttons have been removed.

**Deliverable:** Display-only task card with `onEdit` callback

**Unblocks:** Step 6 (swipe-to-delete)

---

#### Step 6: Swipe-to-Delete Gesture
**Duration:** 2 hours
**Updated:** 2026-02-18 (D45 — added `onEdit` prop passthrough to TaskCard)

**Install dependency:**
```bash
npm install react-swipeable
```

Create `src/app/components/SwipeableTaskCard.tsx`:

```tsx
import { useSwipeable } from 'react-swipeable';
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Task, deleteTask } from '../../lib/services/tasks';
import { TaskCard } from './TaskCard';

interface SwipeableTaskCardProps {
  task: Task;
  /** Called when the user taps the card (opens edit bottom sheet). */
  onEdit?: (task: Task) => void;
}

/**
 * Wraps a custom task card with swipe-to-delete.
 * Swiping left reveals a circular trash icon button to the right of the card.
 * Tapping the trash icon immediately deletes the task (no confirmation).
 */
export function SwipeableTaskCard({ task, onEdit }: SwipeableTaskCardProps) {
  const [swipeOffset, setSwipeOffset] = useState(0);

  const handlers = useSwipeable({
    onSwiping: (eventData) => {
      if (eventData.dir === 'Left' && eventData.deltaX < 0) {
        setSwipeOffset(Math.max(eventData.deltaX, -80));
      }
    },
    onSwiped: (eventData) => {
      if (eventData.dir === 'Left' && Math.abs(eventData.deltaX) > 60) {
        setSwipeOffset(-80);
      } else {
        setSwipeOffset(0);
      }
    },
    trackMouse: true,
  });

  const handleDelete = async () => {
    try {
      await deleteTask(task.id);
    } catch (error) {
      console.error('Failed to delete task:', error);
      alert('Failed to delete task. Please try again.');
    }
  };

  return (
    <div className="relative flex items-center">
      {/* Circular delete button — positioned to the right, vertically centered */}
      <div
        className="absolute right-0 flex items-center justify-center"
        style={{
          opacity: swipeOffset < 0 ? Math.min(1, Math.abs(swipeOffset) / 60) : 0,
          transform: `scale(${swipeOffset < 0 ? Math.min(1, Math.abs(swipeOffset) / 60) : 0})`,
          transition: swipeOffset === 0 ? 'all 0.3s ease-out' : 'none',
        }}
      >
        <button
          onClick={handleDelete}
          className="w-14 h-14 rounded-full bg-destructive flex items-center justify-center shadow-lg active:scale-95 transition-transform"
          style={{ boxShadow: '0 2px 8px rgba(212, 87, 78, 0.3)' }}
        >
          <Trash2 className="size-5 text-destructive-foreground" />
        </button>
      </div>

      {/* Task card (swipeable) */}
      <div
        {...handlers}
        style={{
          transform: `translateX(${swipeOffset}px)`,
          transition: swipeOffset === 0 ? 'transform 0.3s ease-out' : 'none',
        }}
        className="relative z-10 w-full"
      >
        <TaskCard task={task} onEdit={onEdit} />
      </div>
    </div>
  );
}
```

**Key change (D45):** Added `onEdit` prop to interface, passed through to `<TaskCard onEdit={onEdit} />`. Also simplified delete to immediate (no confirmation modal) with circular trash icon instead of text button.

**Deliverable:** Swipe-to-delete with `onEdit` passthrough

**Unblocks:** Step 7 (FAB button)

---

#### Step 7: Floating Action Button — Dual-Mode Bottom Sheet (Add / Edit)
**Duration:** 3 hours
**Updated:** 2026-02-18 (D45 — dual-mode: add new task + edit existing task via same bottom sheet)

Create `src/app/components/AddTaskFAB.tsx`:

```tsx
import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { addTask, editTask, Task } from '../../lib/services/tasks';
import { format } from 'date-fns';

const ACTIVITY_OPTIONS = [
  { value: 'potty_break', label: 'Potty', emoji: '🚽' },  // D55: "Potty" in grid, "Potty Break" in timeline titles
  { value: 'meal', label: 'Meal', emoji: '🍽️' },
  { value: 'training', label: 'Training', emoji: '🎓' },
  { value: 'nap', label: 'Nap', emoji: '😴' },
  { value: 'calm_time', label: 'Calm Time', emoji: '🧘' },
  { value: 'play_time', label: 'Play Time', emoji: '🎾' },
  { value: 'walk', label: 'Walk', emoji: '🚶' },
];

interface AddTaskFABProps {
  puppyId: string;
  /** When set, the bottom sheet opens in "Edit Task" mode pre-populated with this task's data. */
  editingTask?: Task | null;
  /** Called when the edit sheet closes (save or cancel) so the parent can clear editingTask. */
  onEditDone?: () => void;
}

export function AddTaskFAB({ puppyId, editingTask, onEditDone }: AddTaskFABProps) {
  const [showModal, setShowModal] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState('');
  const [selectedTime, setSelectedTime] = useState(
    new Date().toTimeString().slice(0, 5)
  );
  const [isSaving, setIsSaving] = useState(false);

  const isEditMode = !!editingTask;

  // Open the sheet and pre-populate when editingTask is set
  useEffect(() => {
    if (editingTask) {
      setSelectedActivity(editingTask.activityType);
      setSelectedTime(format(editingTask.actualTime.toDate(), 'HH:mm'));
      setShowModal(true);
    }
  }, [editingTask]);

  const resetAndClose = () => {
    setSelectedActivity('');
    setSelectedTime(new Date().toTimeString().slice(0, 5));
    setShowModal(false);
    onEditDone?.();
  };

  const handleSubmit = async () => {
    if (!selectedActivity) return;

    setIsSaving(true);
    try {
      const [hours, minutes] = selectedTime.split(':').map(Number);
      const time = new Date();
      time.setHours(hours, minutes, 0, 0);

      if (isEditMode && editingTask) {
        // Edit mode: update existing task (including title)
        const activityLabel = ACTIVITY_OPTIONS.find(
          (opt) => opt.value === selectedActivity
        )?.label || selectedActivity;

        await editTask(editingTask.id, {
          actualTime: time,
          activityType: selectedActivity as Task['activityType'],
          title: activityLabel,
        });
      } else {
        // Add mode: create new task
        const activityLabel = ACTIVITY_OPTIONS.find(
          (opt) => opt.value === selectedActivity
        )?.label || selectedActivity;

        await addTask(puppyId, selectedActivity as any, time, activityLabel);
      }

      resetAndClose();
    } catch (error) {
      console.error(isEditMode ? 'Failed to edit task:' : 'Failed to add task:', error);
      alert(isEditMode ? 'Failed to save changes. Please try again.' : 'Failed to add task. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // When opening via FAB (not edit mode), reset fields to defaults
  const handleFABClick = () => {
    setSelectedActivity('');
    setSelectedTime(new Date().toTimeString().slice(0, 5));
    setShowModal(true);
  };

  return (
    <>
      {/* FAB Button */}
      <button
        onClick={handleFABClick}
        className="fixed bottom-10 right-6 w-14 h-14 bg-primary text-primary-foreground rounded-full flex items-center justify-center hover:bg-primary/90 active:scale-95 transition-all z-40"
        style={{ boxShadow: '0 4px 16px rgba(232, 114, 42, 0.35)' }}
        aria-label="Add new task"
      >
        <Plus className="size-6" strokeWidth={2.5} />
      </button>

      {/* Bottom Sheet (dual-mode: Add / Edit) */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-end"
          onClick={resetAndClose}
        >
          <div
            className="bg-background rounded-t-3xl p-6 w-full max-w-[390px] mx-auto"
            style={{ boxShadow: '0 -4px 24px rgba(45, 27, 14, 0.15)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-4" />

            <h3 className="text-xl font-bold text-foreground mb-5">
              {isEditMode ? 'Edit Task' : 'Add Custom Task'}
            </h3>

            <div className="space-y-4">
              {/* Time Picker */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Time</label>
                <input
                  type="time"
                  value={selectedTime}
                  onChange={(e) => setSelectedTime(e.target.value)}
                  className="w-full px-3 py-2.5 bg-accent border border-border rounded-xl text-foreground text-sm"
                />
              </div>

              {/* Activity Type Grid (2-column emoji-labeled buttons) */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Activity Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {ACTIVITY_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setSelectedActivity(option.value)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-left transition-all ${
                        selectedActivity === option.value
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-accent text-foreground hover:bg-accent/80'
                      }`}
                    >
                      <span>{option.emoji}</span>
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={resetAndClose}
                  disabled={isSaving}
                  className="flex-1 py-3 px-4 text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!selectedActivity || isSaving}
                  className="flex-1 py-3 px-4 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 disabled:opacity-40 transition-all"
                >
                  {isSaving
                    ? (isEditMode ? 'Saving...' : 'Adding...')
                    : (isEditMode ? 'Save Changes' : 'Add Task')
                  }
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

**Key change (D45):** AddTaskFAB is now dual-mode. When `editingTask` is provided, the bottom sheet opens pre-populated with the task's current time and activity type, title reads "Edit Task", button reads "Save Changes", and it calls `editTask()` instead of `addTask()`. The `onEditDone` callback lets Dashboard clear the editing state on save or cancel.

**Dashboard wiring (in Dashboard.tsx):**
```tsx
const [editingTask, setEditingTask] = useState<Task | null>(null);

// In task list rendering:
<SwipeableTaskCard
  task={entry.task}
  onEdit={(task) => setEditingTask(task)}
/>

// At component root:
<AddTaskFAB
  puppyId={puppyId}
  editingTask={editingTask}
  onEditDone={() => setEditingTask(null)}
/>
```

**Deliverable:** Dual-mode FAB + bottom sheet (add and edit)

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

## 18. Flow 7 / F9: Profile Picture Management — Backend Plan

**Added:** 2026-02-17
**Priority:** P0 (Launch Blocker)
**Complexity:** Low (Supabase Storage + profiles table update)

---

### 18.1 Overview

Flow 7 allows users to upload a custom profile photo from the Settings screen. The photo is stored in Supabase Storage and its URL is written back to the `profiles` table. The frontend then propagates the new URL to all UI surfaces that display it (settings avatar, task completion indicators).

**What is already built (frontend):**
- `uploadUserAvatar()` in `src/lib/services/auth.ts` — uploads file to Supabase Storage `user-avatars` bucket, returns cache-busted URL
- `updateProfile()` in `src/lib/services/auth.ts` — writes `avatar_url` to `profiles` table
- Action sheet UI in `Settings.tsx` with "Take a Photo", "Choose from Photo Library", "Cancel"
- `avatarUrl` state in `App.tsx`, seeded from profile on load, cleared on sign out
- `onAvatarUpdate` callback propagates new URL to all consumers

**What still needs to be done (backend):**
1. Confirm `user-avatars` Supabase Storage bucket exists with correct RLS policies
2. Confirm `profiles.avatar_url` column exists and is writable by the owner
3. Add a Supabase Storage RLS policy so users can only write to their own folder
4. Verify the profiles RLS `UPDATE` policy covers `avatar_url`
5. Add a Supabase Realtime subscription on `profiles.avatar_url` so other users' views update when a profile picture changes

---

### 18.2 Data Model Changes

No new tables required. Flow 7 uses existing schema:

```
profiles
  - id           (UUID, FK → auth.users)  ← used as storage path prefix
  - avatar_url   (text, nullable)          ← written after upload
  - display_name (text, nullable)
  - created_at   (timestamp)
```

**Storage bucket:** `user-avatars` (already created manually per D35)

**Storage path convention:** `{userId}/avatar.{ext}` (deterministic, upserted on each upload — see D36)

---

### 18.3 Supabase Storage RLS Policies

The `user-avatars` bucket must enforce that users can only read all objects (public) but only write their own folder. Add these policies in the Supabase dashboard under **Storage → Policies**, or via a migration.

#### Migration file: `supabase/migrations/20260217000001_user_avatars_storage_rls.sql`

```sql
-- Allow any authenticated user to read from user-avatars bucket
-- (bucket is public, but we still add a policy for completeness)
CREATE POLICY "Avatar images are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'user-avatars');

-- Allow authenticated users to upload/update ONLY their own folder
-- Storage path format: {userId}/avatar.{ext}
-- We check that the first path segment matches the authenticated user's ID.
CREATE POLICY "Users can upload their own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'user-avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update their own avatar"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'user-avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own avatar"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'user-avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
```

**How `storage.foldername()` works:**
- For path `abc-123/avatar.jpg`, `storage.foldername(name)` returns `['abc-123', 'avatar.jpg']`
- Index `[1]` is the first segment — the user's UUID
- This ensures user `abc-123` can only write to `abc-123/*` and cannot overwrite other users' avatars

---

### 18.4 Profiles Table RLS Verification

The existing `profiles` UPDATE policy (from Phase 4 / Section 2.2) already covers `avatar_url`:

```sql
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);
```

This policy allows updating any column on the user's own row, including `avatar_url`. No change needed.

**Verify it's in place:**
```sql
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'profiles' AND cmd = 'UPDATE';
```

Expected output: one row with `policyname = 'Users can update own profile'` and `qual = '(auth.uid() = id)'`.

---

### 18.5 Supabase Realtime: Profile Picture Propagation

The product spec requires that when a user updates their profile picture, other household members' views (task completion indicators) update within 1 second. This requires a Realtime subscription on the `profiles` table.

**Enable Realtime on `profiles` table:**

By default, Supabase Realtime only broadcasts changes for tables with `REPLICA IDENTITY FULL`. Add this migration:

#### Migration file: `supabase/migrations/20260217000002_profiles_realtime.sql`

```sql
-- Enable full row replication for Realtime change detection on profiles
ALTER TABLE profiles REPLICA IDENTITY FULL;

-- Add profiles to the Supabase Realtime publication
-- (This makes INSERT/UPDATE/DELETE events available via the Realtime API)
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
```

**Frontend subscription** (`src/lib/services/auth.ts` — add this function):

```typescript
// Subscribe to profile picture changes for a list of user IDs
// Used by Dashboard to update task completion indicators when a co-user changes their avatar
export function subscribeToProfileChanges(
  userIds: string[],
  callback: (userId: string, newAvatarUrl: string | null) => void
): () => void {
  const channel = supabase
    .channel('profile-avatar-changes')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `id=in.(${userIds.join(',')})`,
      },
      (payload) => {
        const { id, avatar_url } = payload.new as { id: string; avatar_url: string | null };
        callback(id, avatar_url);
      }
    )
    .subscribe();

  // Return unsubscribe function
  return () => {
    supabase.removeChannel(channel);
  };
}
```

**Where to call this in the Dashboard:**

The Dashboard already has a `routine` prop with `completed_by` user IDs on each task item. After loading the routine, subscribe to profile changes for all unique `completed_by` values:

```typescript
// In Dashboard.tsx — add alongside existing Supabase Realtime subscription
useEffect(() => {
  if (!routine) return;

  // Collect unique user IDs who have completed tasks
  const userIds = [
    ...new Set(
      activityLogs
        .filter((log) => log.completed_by)
        .map((log) => log.completed_by as string)
    ),
  ];

  if (userIds.length === 0) return;

  const unsubscribe = subscribeToProfileChanges(userIds, (userId, newAvatarUrl) => {
    // Update the local avatarCache map so task indicators re-render
    setAvatarCache((prev) => ({ ...prev, [userId]: newAvatarUrl }));
  });

  return unsubscribe;
}, [routine, activityLogs]);
```

> **Note:** The exact integration point depends on how task completion indicators are currently rendered in `Dashboard.tsx`. The pattern above shows the intent — read the current Dashboard implementation before wiring this in.

---

### 18.6 Implementation Steps

```
Step 1: Apply Storage RLS migration
  File: supabase/migrations/20260217000001_user_avatars_storage_rls.sql
  Command: supabase db push
  Verify: Attempt to upload to another user's folder → expect 403
  → Unblocks: Secure avatar upload in production

Step 2: Apply Realtime migration
  File: supabase/migrations/20260217000002_profiles_realtime.sql
  Command: supabase db push
  Verify: supabase dashboard → Database → Replication → confirm profiles table listed
  → Unblocks: Real-time avatar propagation to other users

Step 3: Add subscribeToProfileChanges() to auth.ts
  File: src/lib/services/auth.ts
  → Unblocks: Dashboard can listen for avatar updates

Step 4: Wire subscription into Dashboard
  File: src/app/components/Dashboard.tsx
  Pattern: collect completed_by userIds → call subscribeToProfileChanges → update avatarCache state
  → Unblocks: Task completion indicators auto-update when co-user changes photo

Step 5: Verify profiles RLS UPDATE policy exists
  Query: SELECT policyname FROM pg_policies WHERE tablename = 'profiles' AND cmd = 'UPDATE';
  If missing: add policy from Section 2.2 (already in migrations)
  → Unblocks: updateProfile() call succeeds in production

Step 6: End-to-end test
  Scenario A: User uploads photo → Settings avatar updates → toast appears
  Scenario B: User uploads photo → co-user's Dashboard task indicators update within 1s
  Scenario C: User uploads file >5MB → client-side rejection, no upload
  Scenario D: User attempts to upload to another user's storage path → 403 from Supabase
```

---

### 18.7 Deployment Checklist

**Supabase Storage:**
- [ ] `user-avatars` bucket exists (public read)
- [ ] Storage RLS migration applied (`20260217000001_user_avatars_storage_rls.sql`)
- [ ] Test: authenticated user can upload to own path, blocked from other paths

**Supabase Database:**
- [ ] `profiles.avatar_url` column exists (type: `text`, nullable)
- [ ] `profiles` UPDATE RLS policy exists (`Users can update own profile`)
- [ ] Realtime migration applied (`20260217000002_profiles_realtime.sql`)
- [ ] `profiles` table listed in Supabase Realtime replication settings

**Frontend (already implemented):**
- [ ] `uploadUserAvatar()` in `auth.ts`
- [ ] `updateProfile()` in `auth.ts`
- [ ] `subscribeToProfileChanges()` in `auth.ts` (Step 3 above)
- [ ] Avatar upload UI in `Settings.tsx`
- [ ] `avatarUrl` state in `App.tsx`
- [ ] Dashboard wired to `subscribeToProfileChanges` (Step 4 above)

**Testing:**
- [ ] Upload flow on mobile (iOS Safari camera + library paths)
- [ ] Upload flow on desktop (file picker)
- [ ] 5MB limit enforced client-side
- [ ] HEIC/PNG/JPEG all accepted
- [ ] Co-user avatar update propagation verified in two browser tabs
- [ ] Offline upload attempt: graceful failure, error toast shown

---

### 18.8 Cost Impact

**Supabase Storage:**
- Bucket: `user-avatars`, average file size ~100KB (400×400px JPEG)
- 1000 users × 100KB = 100MB storage total
- Supabase Pro includes 100GB storage — negligible cost
- Each upload: 1 storage write + 1 profiles DB update = minimal Supabase usage

**Supabase Realtime:**
- 1 additional Realtime channel per active Dashboard session (profile-avatar-changes)
- Low message frequency (only triggers when a user changes their photo)
- No meaningful cost impact within free/Pro tier limits

---

### 18.9 Known Limitations & Future Improvements

**v1 Limitations:**
- No server-side image resizing to 400×400px (spec calls for it, but `react-image-crop` is not yet integrated — client sends raw file)
- No "Reset to Google picture" option (deferred to P1 per Out of Scope table)
- HEIC files are accepted by the file input but browser support for rendering HEIC is inconsistent on non-Apple devices — acceptable for v1, add server-side conversion in P1

**P1 Improvements:**
- Server-side image resizing via Supabase Edge Function (`resize-avatar`) — receives raw upload, resizes to 400×400, stores optimized JPEG, returns URL
- "Reset to Google OAuth picture" — store original Google picture URL at sign-up in `profiles.google_avatar_url`, allow revert
- Image format normalization — convert HEIC → JPEG server-side for cross-platform compatibility

**P2 Improvements:**
- CDN cache invalidation strategy (current `?v=timestamp` approach works but bypasses CDN — use Supabase Storage transform API for proper cache control)
- Profile picture propagation via Firestore Custom Claims update (so task completion indicators in the Firestore-backed task list also refresh without a page reload)

---

## 19. D45: Custom Task Edit UX — Backend Assessment

**Added:** 2026-02-18
**Decision Reference:** D45 (decisions-log.md)
**Priority:** P0 (Launch Blocker — frontend already implemented)
**Complexity:** Minimal (one service function update + frontend wiring fix)

---

### 19.1 Overview

**Change:** Tapping a custom (user-added) task now opens the "Add Custom Task" bottom sheet in edit mode (pre-populated with the task's current time and activity type) instead of showing an inline expandable card. The frontend implementation is complete (D45). This section assesses backend changes needed.

**Frontend Components Updated (already shipped):**
- `AddTaskFAB.tsx` — Dual-mode bottom sheet (add/edit) via `editingTask` and `onEditDone` props
- `TaskCard.tsx` — Simplified to display-only (removed all inline expansion state and edit logic)
- `SwipeableTaskCard.tsx` — Added `onEdit` prop passthrough to TaskCard
- `Dashboard.tsx` — Added `editingTask` state, wires TaskCard → AddTaskFAB

---

### 19.2 Backend Assessment

#### Firestore Security Rules: No Changes Needed

The existing `firestore.rules` already permit task updates by authenticated users with puppy access:

```javascript
// Update: User must have access
allow update: if hasPuppyAccess(resource.data.puppyId)
  && request.resource.data.lastEditedBy == request.auth.uid
  && request.resource.data.lastEditedAt == request.time;
```

The update rule validates:
1. User has puppy access via Custom Claims (`hasPuppyAccess`)
2. `lastEditedBy` matches the authenticated user
3. `lastEditedAt` matches `request.time` (server timestamp)

These rules apply identically whether the edit originates from an inline card or a bottom sheet — the Firestore document update is the same `updateDoc()` call. **No rule changes needed.**

#### Data Model: No Changes Needed

The `tasks` collection schema remains unchanged. The D45 change affects only the UI surface through which edits are triggered — the underlying Firestore document fields (`actualTime`, `activityType`, `isEdited`, `lastEditedBy`, `lastEditedAt`) are identical.

#### Service Function: One Fix Required

**Gap identified:** The existing `editTask()` function in `src/lib/services/tasks.ts` updates `actualTime` and `activityType` but does **not** update the `title` field. When a user changes the activity type in the edit bottom sheet (e.g., from "Potty Break" to "Walk"), the document's `title` field retains the old value ("Potty Break") while `activityType` changes to `walk`.

This causes a display mismatch: TaskCard renders `task.title` as the primary label, so the card would show "Potty Break" with a "walk" activity type subtitle.

**Fix:** Add `title` to the `editTask()` updates parameter and pass the derived title from `AddTaskFAB.tsx`.

---

### 19.3 Implementation Steps

```
Step 1: Update editTask() service function
  File: src/lib/services/tasks.ts
  Change: Add optional `title` field to the updates parameter
  Verify: TypeScript compiles, existing editTask callers unaffected (title is optional)
  Duration: 5 minutes
  → Unblocks: Step 2

Step 2: Update AddTaskFAB to pass title on edit
  File: src/app/components/AddTaskFAB.tsx
  Change: In handleSubmit() edit branch, derive title from ACTIVITY_OPTIONS
          and pass it to editTask()
  Verify: Edit a task, change activity type → title updates in Firestore
  Duration: 5 minutes
  → Unblocks: End-to-end verification

Step 3: Verify (no deployment needed)
  Firestore rules: unchanged, no deploy
  Edge Functions: unchanged, no deploy
  Database: unchanged, no migration
  Test: Edit a custom task via bottom sheet → confirm title, time, activityType
        all update correctly in Firestore
```

---

### 19.4 Section 17 Code Samples — Updated for D45

The code samples in Section 17 Steps 5, 6, and 7 have been updated in-place to reflect the D45 changes (display-only TaskCard, SwipeableTaskCard with `onEdit` prop, dual-mode AddTaskFAB). See those steps for current implementation reference.

---

### 19.5 Summary

| Component | Change Required | Status |
|---|---|---|
| Firestore Security Rules | None | Already supports task updates |
| Data Model (tasks collection) | None | Schema unchanged |
| Firebase Custom Token Edge Function | None | Claims unchanged |
| `editTask()` service function | Add `title` to updates | **Needs fix** |
| `AddTaskFAB.tsx` (frontend) | Pass title in edit mode | **Needs fix** |
| Supabase Edge Functions | None | Not involved in task CRUD |
| Deployment | None required | All changes are client-side |

**Bottom line:** The D45 UX change is almost entirely a frontend concern. The only backend-adjacent fix is adding `title` to the `editTask()` service function so that changing the activity type also updates the displayed task name. No Firestore rules, no migrations, no Edge Function changes, no deployment needed.

---

## 20. F11 / Flow 6H: Potty Details (Poop & Pee Tracking) — Backend Plan

**Added:** 2026-02-19
**Decision References:** D52–D57 (decisions-log.md)
**Priority:** P0 (Launch Blocker — frontend already implemented)
**Complexity:** Minimal (Firestore rules validation update only)

---

### 20.1 Overview

Flow 6H adds structured potty detail tracking to the task editing flow. When a user selects "Potty" as the activity type in the Edit Task or Add Custom Task bottom sheet, a conditional "Details" section appears with two emoji toggle buttons (💩 Poop, 💦 Pee). Selected details are persisted to Firestore and displayed inline on the task card in the timeline.

**Frontend Components Updated (already shipped):**
- `AddTaskFAB.tsx` — Renamed "Potty Break" → "Potty" in activity grid (D55), added conditional Details section with 💩/💦 emoji toggle buttons (D53, D54), wired `pottyDetails` into save logic for all three paths (add custom, edit custom, edit routine item)
- `TaskCard.tsx` — Shows potty emojis inline after task title for custom tasks (D56)
- `Dashboard.tsx` — Passes `pottyDetails` from editedRoutineItems overlay, shows emojis on routine cards, passes `pottyDetails` when opening edit sheet
- `tasks.ts` (service layer) — Added `pottyDetails` to Task interface, `addTask()`, and `editTask()` (D52)
- `edited-routine-items.ts` (service layer) — Added `pottyDetails` to RoutineItemEdit interface and `saveRoutineItemEdit()` (D52, D57)

---

### 20.2 Backend Assessment

#### Firestore Security Rules: Minor Update Recommended

**Current state:** The `validTaskData()` function in `firebase/firestore.rules` validates required fields using `hasAll()`:

```javascript
function validTaskData() {
  let data = request.resource.data;
  return data.keys().hasAll([
    'puppyId', 'date', 'scheduledTime', 'actualTime',
    'activityType', 'title', 'isCompleted', 'isEdited',
    'isUserAdded', 'lastEditedBy', 'createdAt'
  ])
  && data.puppyId is string
  && data.date is string
  && data.activityType in ['potty_break', 'meal', 'training', 'nap', 'calm_time', 'play_time', 'walk']
  && data.lastEditedBy == request.auth.uid
  && data.lastEditedAt == request.time;
}
```

**Impact analysis:**
- `hasAll()` checks that required keys are present — it does **not** reject extra keys. Adding `pottyDetails` to the document won't break this check.
- `pottyDetails` is optional (`?` in TypeScript) — tasks without it (all non-potty tasks, all existing tasks) continue to pass validation.
- The `create` rule calls `validTaskData()`, so new tasks with `pottyDetails` will pass.
- The `update` rule does **not** call `validTaskData()`, so editing tasks to add `pottyDetails` is also fine.

**Recommendation:** Add optional `pottyDetails` structure validation to `validTaskData()`. This prevents a malicious client from writing arbitrary data into the `pottyDetails` field (e.g., `pottyDetails: "hacked"` instead of `{ poop: true, pee: false }`). For 0→1 this is a nice-to-have, but the cost is minimal.

**Updated `validTaskData()` function:**

```javascript
function validTaskData() {
  let data = request.resource.data;
  return data.keys().hasAll([
    'puppyId', 'date', 'scheduledTime', 'actualTime',
    'activityType', 'title', 'isCompleted', 'isEdited',
    'isUserAdded', 'lastEditedBy', 'createdAt'
  ])
  && data.puppyId is string
  && data.date is string
  && data.activityType in ['potty_break', 'meal', 'training', 'nap', 'calm_time', 'play_time', 'walk']
  && data.lastEditedBy == request.auth.uid
  && data.lastEditedAt == request.time
  // Potty details validation (D52): if present, must be a map with boolean fields
  && (!('pottyDetails' in data.keys()) || (
    data.pottyDetails is map
    && data.pottyDetails.keys().hasAll(['poop', 'pee'])
    && data.pottyDetails.poop is bool
    && data.pottyDetails.pee is bool
  ));
}
```

**Note:** This validation only applies to `create` operations on the `tasks` collection. The `update` rule and the `editedRoutineItems` rules do not call `validTaskData()`, so they are unaffected. For v1, this is acceptable — the `editedRoutineItems` collection has its own access control (`editedBy == request.auth.uid`) and the update rule already validates `lastEditedBy` and `lastEditedAt`.

#### editedRoutineItems Rules: No Changes Needed

The `editedRoutineItems` collection rules validate:
1. `hasPuppyAccess(request.resource.data.puppyId)` — puppy membership check
2. `request.resource.data.editedBy == request.auth.uid` — user identity check

There is no field-level validation for this collection (consistent with D48's overlay pattern). `pottyDetails` is just another field in the `setDoc()` payload. No rule changes needed.

#### Data Model: No Migration Needed

Firestore is schema-less. Adding `pottyDetails` to documents happens automatically when the frontend writes it. Existing documents without `pottyDetails` are handled gracefully:
- TypeScript: `task.pottyDetails?.poop ?? false` (optional chaining + nullish coalescing)
- Firestore rules: `!('pottyDetails' in data.keys())` handles documents without the field

No Firestore indexes are needed for `pottyDetails`. The field is not used in any query `where()` clause — it's only read after the document is fetched.

#### Supabase Edge Functions: No Changes Needed

| Edge Function | Affected? | Reason |
|---|---|---|
| `generate-routine` | No | Generates Supabase `routine_items`, not Firestore tasks |
| `accept-invite` | No | Creates `puppy_memberships`, doesn't touch tasks |
| `get-firebase-token` | No | Generates Custom Token with `puppyIds` claim — no field-level awareness |

#### Supabase Database: No Changes Needed

The Supabase `routine_items` table (source of AI-generated routines) does **not** need a `potty_details` column. Potty details are only captured when a user **edits** a routine item — this edit is stored in the Firestore `editedRoutineItems` collection, not in Supabase. The AI routine generator doesn't produce potty details — it generates the schedule; the user fills in details after the fact.

#### Firebase Custom Token Claims: No Changes Needed

The `get-firebase-token` Edge Function embeds `puppyIds` in Custom Claims. `pottyDetails` is a field within existing documents, not a new collection, so no claim changes are needed.

---

### 20.3 Implementation Steps

```
Step 1: Update Firestore security rules (optional — recommended)
  File: firebase/firestore.rules
  Change: Add pottyDetails structure validation to validTaskData()
  Deploy: firebase deploy --only firestore:rules
  Verify: Create a task with pottyDetails → succeeds
          Create a task with pottyDetails: "invalid" → rejected
  Duration: 15 minutes
  → Unblocks: Secure pottyDetails field validation

Step 2: Verify existing rules still work
  Test: Create a non-potty task (no pottyDetails field) → succeeds
  Test: Update a potty task to add pottyDetails → succeeds
  Test: Update a non-potty task (no pottyDetails) → succeeds
  Duration: 10 minutes
  → Unblocks: Confidence that existing functionality is unbroken

Step 3: End-to-end verification
  Test A: Add custom potty task with 💩 selected → verify pottyDetails in Firestore document
  Test B: Edit routine item to potty with 💦 selected → verify pottyDetails in editedRoutineItems document
  Test C: Switch activity type away from potty → verify pottyDetails omitted from write
  Test D: Multi-user sync: User A adds potty details → User B sees emojis within 3s
  Duration: 15 minutes
  → Unblocks: Production confidence
```

**Total backend effort: ~40 minutes** (optional rules update + verification)

---

### 20.4 Firestore Rules Update

If applying the optional `pottyDetails` validation (Step 1), update `firebase/firestore.rules`:

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
      && data.lastEditedAt == request.time
      // Potty details: optional, but if present must be valid (D52)
      && (!('pottyDetails' in data.keys()) || (
        data.pottyDetails is map
        && data.pottyDetails.keys().hasAll(['poop', 'pee'])
        && data.pottyDetails.poop is bool
        && data.pottyDetails.pee is bool
      ));
    }

    // ... (rest of rules unchanged)
  }
}
```

---

### 20.5 Section 17 Code Samples — Updated for F11

The Task interface code sample in Section 17.4 Step 4 should be updated to include `pottyDetails`. The current production code (`src/lib/services/tasks.ts`) already includes this field:

```typescript
export interface Task {
  id: string;
  puppyId: string;
  date: string;
  scheduledTime: Timestamp;
  actualTime: Timestamp;
  activityType: 'potty_break' | 'meal' | 'training' | 'nap' | 'calm_time' | 'play_time' | 'walk';
  title: string;
  description?: string;
  pottyDetails?: {        // D52: Only present when activityType = potty_break
    poop: boolean;        // True if 💩 was selected
    pee: boolean;         // True if 💦 was selected
  };
  isCompleted: boolean;
  isEdited: boolean;
  isUserAdded: boolean;
  completedBy?: string;
  completedAt?: Timestamp;
  lastEditedBy: string;
  lastEditedAt: Timestamp;
  createdAt: Timestamp;
}
```

The `addTask()` and `editTask()` functions in the code sample have also been updated to accept `pottyDetails` as an optional parameter. See the current source files for production implementation.

---

### 20.6 Summary

| Component | Change Required | Status |
|---|---|---|
| Firestore Security Rules (`validTaskData()`) | Add optional `pottyDetails` structure validation | **Recommended** (not blocking) |
| Firestore Security Rules (`editedRoutineItems`) | None | Already supports arbitrary edit fields |
| Firestore Security Rules (`tasks` update rule) | None | Doesn't call `validTaskData()` |
| Data Model (`tasks` collection) | None | Firestore is schema-less, `pottyDetails` auto-accepted |
| Data Model (`editedRoutineItems` collection) | None | Same as above |
| Firestore Indexes | None | `pottyDetails` not used in queries |
| Firebase Custom Token Edge Function | None | Claims unchanged |
| `generate-routine` Edge Function | None | Generates Supabase data, not Firestore tasks |
| `accept-invite` Edge Function | None | Not involved in task CRUD |
| Supabase Database (`routine_items` table) | None | Potty details captured at edit time, not generation time |
| Supabase RLS Policies | None | Tasks are Firestore-only |
| Frontend Service Layer (`tasks.ts`) | Already shipped | `pottyDetails` in interface, `addTask()`, `editTask()` |
| Frontend Service Layer (`edited-routine-items.ts`) | Already shipped | `pottyDetails` in interface, `saveRoutineItemEdit()` |
| Frontend Components | Already shipped | AddTaskFAB, TaskCard, Dashboard all updated |
| Deployment | `firebase deploy --only firestore:rules` (if applying validation) | **One command** |

**Bottom line:** The Potty Details feature is a frontend-heavy change with near-zero backend impact. The only recommended backend action is adding optional field validation to the Firestore security rules to prevent malformed `pottyDetails` data. No new collections, no new Edge Functions, no Supabase changes, no migrations. Total backend effort: ~40 minutes.

---

### 20.7 Cost Impact

**Zero additional cost.** `pottyDetails` is a field within existing Firestore documents. Firestore charges per document read/write, not per field (D57). Adding 2 booleans to a document has no measurable impact on:
- Read/write costs
- Document size (adds ~30 bytes per document with `pottyDetails`)
- Bandwidth (negligible for real-time sync)
- Storage (well within free tier limits)

---

### 20.8 Deployment Checklist

**Firestore:**
- [ ] Updated `firebase/firestore.rules` with `pottyDetails` validation in `validTaskData()` (optional)
- [ ] Deployed rules: `firebase deploy --only firestore:rules`
- [ ] Verified: task create with valid `pottyDetails` succeeds
- [ ] Verified: task create without `pottyDetails` still succeeds
- [ ] Verified: task create with malformed `pottyDetails` is rejected (if validation applied)

**Frontend (already shipped):**
- [ ] `Task` interface includes `pottyDetails?: { poop: boolean; pee: boolean }`
- [ ] `RoutineItemEdit` interface includes `pottyDetails`
- [ ] `addTask()` accepts and persists `pottyDetails`
- [ ] `editTask()` accepts and persists `pottyDetails`
- [ ] `saveRoutineItemEdit()` accepts and persists `pottyDetails`
- [ ] AddTaskFAB shows "Potty" label and conditional Details section
- [ ] TaskCard shows inline potty emojis
- [ ] Dashboard shows inline potty emojis on routine cards
- [ ] Dashboard passes `pottyDetails` to edit bottom sheet

**Testing:**
- [ ] Add potty task with 💩 only → "Potty Break 💩" on timeline
- [ ] Add potty task with 💦 only → "Potty Break 💦" on timeline
- [ ] Add potty task with both → "Potty Break 💩💦" on timeline
- [ ] Add potty task with neither → "Potty Break" (no emojis) on timeline
- [ ] Edit routine item to potty with details → emojis appear on routine card
- [ ] Switch activity type away from potty → pottyDetails cleared, no emojis
- [ ] Multi-user sync: potty details appear on co-user's device within 3s
- [ ] Offline: add potty details offline → sync when reconnected
- [ ] Build succeeds: `npx vite build` with no errors in modified files

---

## 21. F12 / Flow 8: Day Navigation — Calendar Picker — Backend Plan

**Added:** 2026-02-20
**Decision References:** D58–D69 (decisions-log.md)
**Priority:** P0 (Launch Blocker — frontend already implemented)
**Complexity:** Minimal (zero backend changes required)

---

### 21.1 Overview

Flow 8 / F12 adds a calendar picker that lets users browse past and future task lists. Tapping the date header opens a monthly calendar bottom sheet. Users can select any date from the puppy's creation date through tomorrow. Non-today views are strictly read-only — no FAB, no swipe-to-delete, no completion toggling, no task editing. A "← Today" pill button provides instant return to the live view.

**Frontend Components Updated (already shipped):**
- `CalendarPicker.tsx` — New component. Custom monthly calendar bottom sheet with 7-column CSS grid, month navigation with boundary enforcement, today highlight (orange ring), selected date (filled orange), disabled dates (grayed out), "Go to Today" + "Close" footer buttons. ~237 lines, zero external dependencies (D66).
- `Dashboard.tsx` — Major update. Added `selectedDate`, `isCalendarOpen`, `viewingItem` state. Added `isViewingToday` derived boolean. Made date header tappable with ChevronDown icon. Added "← Today" pill button. Conditional progress stats card (hidden on non-today, replaced with read-only banner). Updated timeline rendering: read-only cards for non-today (no swipe, no completion). Conditional FAB (hidden on non-today). Added view-only Task Details bottom sheet for past day inspection.
- `App.tsx` — Added `puppyCreatedAt={currentPuppy.created_at}` prop to Dashboard.

**Service Layer Updates (already shipped):**
- `tasks.ts` — `getTodayString()` exported with optional `Date` param, `subscribeToTasks()` accepts optional `date` param, `addTask()` accepts optional `date` param, new `getTasksForDate()` static fetch function (D63, D64).
- `activity-logs.ts` — `getTodayLogs()` accepts optional `date` param (D63).
- `edited-routine-items.ts` — `subscribeToEditedRoutineItems()` accepts optional `date` param, new `getEditedRoutineItemsForDate()` static fetch function (D63, D64).
- `deleted-routine-items.ts` — `subscribeToDeletedRoutineItems()` accepts optional `date` param, new `getDeletedRoutineItemsForDate()` static fetch function (D63, D64).

---

### 21.2 Backend Assessment

#### Firestore Security Rules: No Changes Needed

The existing Firestore security rules already support date-parameterized queries. The rules validate puppy access via Custom Claims (`hasPuppyAccess(puppyId)`) and user identity — they do **not** enforce any date-based restrictions. This is correct because:

1. **Read rules for `tasks`:** `allow read: if hasPuppyAccess(resource.data.puppyId)` — user can read any task for their puppy, regardless of the `date` field value. This already supports reading historical tasks.
2. **Read rules for `editedRoutineItems`:** Same pattern — access is gated by `puppyId`, not by date.
3. **Read rules for `deletedRoutineItems`:** Same pattern — access is gated by `puppyId`, not by date.
4. **Write rules remain unchanged:** Non-today views are strictly read-only on the client (D60). The `isViewingToday` boolean in `Dashboard.tsx` prevents all mutation paths. If a malicious client bypasses this and attempts to write to a past date, the existing rules still enforce valid data constraints (e.g., `lastEditedBy == request.auth.uid`, `lastEditedAt == request.time`). There is no backend rule preventing writes to past dates — this is acceptable for 0→1 because the client enforces it and the worst case is a user writing a valid task with a past date, which causes no harm.

**No rule changes needed.**

#### Firestore Indexes: No Changes Needed

All Firestore queries used by day navigation are identical in structure to existing today-only queries:

```
// Existing query pattern (works for any date value):
tasks collection: where('puppyId', '==', X) AND where('date', '==', Y) orderBy('actualTime', 'asc')
editedRoutineItems: where('puppyId', '==', X) AND where('date', '==', Y)
deletedRoutineItems: where('puppyId', '==', X) AND where('date', '==', Y)
```

The `date` field is already used as a filter in all these queries. Changing the date value from today's string to a past or future date string uses the exact same index. Firestore composite indexes (auto-created on first query) handle `puppyId + date` combinations regardless of the specific date value.

**No new indexes needed.**

#### Supabase Database: No Changes Needed

The `activity_logs` table already has an index on `(puppy_id, date)` (see Section 2.3: `idx_activity_logs_puppy_date`). Historical activity log queries for past dates use this existing index:

```sql
-- Existing query (already works for any date):
SELECT al.*, p.display_name, p.avatar_url
FROM activity_logs al
LEFT JOIN profiles p ON p.id = al.completed_by
WHERE al.puppy_id = $1 AND al.date = $2;
```

The `routine_items` table is fetched once per puppy (not per date) and is already loaded in the Dashboard — no additional query needed for non-today views. The base routine template is the same for all dates.

**No schema changes, no new indexes, no migrations needed.**

#### Supabase RLS Policies: No Changes Needed

The existing `activity_logs` RLS policy allows members to read logs for their puppies:

```sql
-- Existing policy (already supports reading any date):
CREATE POLICY "Members can view activity logs for their puppies"
  ON activity_logs FOR SELECT
  USING (
    puppy_id IN (
      SELECT puppy_id FROM puppy_memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );
```

This policy does not restrict by date — a member can read activity logs for any past date. This is the correct behavior for day navigation.

**No RLS policy changes needed.**

#### Supabase Edge Functions: No Changes Needed

| Edge Function | Affected? | Reason |
|---|---|---|
| `generate-routine` | No | Generates routine items — not involved in day navigation |
| `accept-invite` | No | Creates memberships — not involved in day navigation |
| `get-firebase-token` | No | Generates Custom Token with `puppyIds` — no date awareness needed |

#### Firebase Custom Token Claims: No Changes Needed

The `get-firebase-token` Edge Function embeds `puppyIds` in Custom Claims for Firestore security rules. Day navigation queries are authorized by `puppyId` membership, not by date. No claim changes needed.

---

### 21.3 Data Flow: Today vs. Non-Today

Understanding the two data fetching strategies is key to this feature's backend implications:

**Today (live view — real-time subscriptions):**
```
Dashboard
  ├─ subscribeToTasks(puppyId, callback, onError)           → Firestore onSnapshot listener
  ├─ subscribeToEditedRoutineItems(puppyId, callback)        → Firestore onSnapshot listener
  ├─ subscribeToDeletedRoutineItems(puppyId, callback)       → Firestore onSnapshot listener
  └─ getTodayLogs(puppyId)                                   → Supabase SELECT + Realtime channel
```

**Non-Today (static view — one-time fetch, D64):**
```
Dashboard
  ├─ getTasksForDate(puppyId, dateString)                    → Firestore getDocs (one-time)
  ├─ getEditedRoutineItemsForDate(puppyId, dateString)       → Firestore getDocs (one-time)
  ├─ getDeletedRoutineItemsForDate(puppyId, dateString)      → Firestore getDocs (one-time)
  └─ getTodayLogs(puppyId, dateString)                       → Supabase SELECT (one-time, no Realtime)
```

The key difference: non-today views use `getDocs()` (one-time read) instead of `onSnapshot()` (persistent listener). This reduces Firestore read operations and WebSocket connections. The backend does not need to distinguish between these two patterns — both use the same Firestore queries, and both are authorized by the same security rules.

---

### 21.4 Historical Routine Accuracy Trade-off

**Accepted limitation for v1:** Past days display the **current active routine** as the base template, not the routine that was active on that historical date. If the user regenerated the routine after the puppy aged up, past days before regeneration may show mismatched routine items.

**What IS accurate for past dates:**
- Custom tasks (stored in Firestore `tasks` collection with date-stamped `date` field)
- Activity logs / completions (stored in Supabase `activity_logs` with `date` column)
- Routine item edits (stored in Firestore `editedRoutineItems` with `date` field)
- Routine item deletions (stored in Firestore `deletedRoutineItems` with `date` field)

**What MAY be inaccurate:**
- Base routine items (times, titles, descriptions) for dates before a routine regeneration — these reflect the current routine structure, not what was originally scheduled.

**Why this is acceptable:** Most users won't regenerate routines frequently (it's a one-time onboarding action), and the completion/edit data (which IS accurate) is what users primarily want to review when browsing past days.

**P2 improvement:** Add a `routine_snapshots` table that stores a copy of the routine items each day (nightly cron job or on-regeneration trigger). This would enable fully accurate historical views. Estimated schema:

```sql
-- Future (P2): Store daily routine snapshots for historical accuracy
routine_snapshots
  - id (UUID, PK)
  - routine_id (UUID, FK → routines)
  - puppy_id (UUID, FK → puppies)
  - snapshot_date (date)
  - items (jsonb)  -- Serialized array of routine items
  - created_at (timestamp)

CREATE INDEX idx_routine_snapshots_puppy_date
  ON routine_snapshots(puppy_id, snapshot_date);
```

Not implementing in v1 — adds ~15-20 rows/day/puppy with nightly cron complexity.

---

### 21.5 Service Function Parameterization Details

All four date-filtered service functions were updated with the same backward-compatible pattern (D63). Below is the before/after for reference:

**tasks.ts:**
```typescript
// BEFORE:
function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}
export function subscribeToTasks(puppyId, callback, onError?) { ... }

// AFTER:
export function getTodayString(date?: Date): string {
  return (date || new Date()).toISOString().split('T')[0];
}
export function subscribeToTasks(puppyId, callback, onError?, date?: string) {
  const dateString = date || getTodayString();
  // ... rest unchanged, uses dateString in query
}
// NEW: One-time static fetch for non-today views
export async function getTasksForDate(puppyId: string, date: string): Promise<Task[]> {
  // Uses getDocs() instead of onSnapshot()
}
```

**activity-logs.ts:**
```typescript
// BEFORE:
export async function getTodayLogs(puppyId: string): Promise<ActivityLogWithProfile[]> {
  const today = new Date().toISOString().split('T')[0];
  // ...
}

// AFTER:
export async function getTodayLogs(puppyId: string, date?: string): Promise<ActivityLogWithProfile[]> {
  const dateString = date || new Date().toISOString().split('T')[0];
  // ... uses dateString in WHERE clause
}
```

**edited-routine-items.ts:**
```typescript
// Same pattern: optional date param added to subscribeToEditedRoutineItems()
// NEW: getEditedRoutineItemsForDate() for one-time static fetch
```

**deleted-routine-items.ts:**
```typescript
// Same pattern: optional date param added to subscribeToDeletedRoutineItems()
// NEW: getDeletedRoutineItemsForDate() for one-time static fetch
```

All existing callers remain unaffected (date param defaults to today when omitted).

---

### 21.6 Firestore Read Impact Analysis

**Read impact (50 users, assuming 30% use day navigation daily):**

| Metric | Value |
|---|---|
| Users navigating per day | 15 (30% of 50) |
| Avg date navigations per session | 2 |
| Reads per date navigation | ~20 (tasks + edits + deletions) |
| **Additional reads/day** | **600** |
| Current daily reads (without day nav) | ~3,000 |
| **New total daily reads** | **~3,600** |
| Firestore free tier limit | 50,000 reads/day |
| **Headroom** | **~93% remaining** |

**Write impact:** Zero. Non-today views are read-only (D60). No additional Firestore writes from this feature.

**Supabase query impact:**
- 15 users × 2 navigations × 1 `getTodayLogs()` call each = 30 additional Supabase queries/day
- Each query hits the `idx_activity_logs_puppy_date` index — fast, <50ms
- Negligible impact on Supabase usage

---

### 21.7 Implementation Steps

Since the frontend implementation is already complete and no backend changes are required, the only steps are verification:

```
Step 1: Verify Firestore security rules support historical reads
  Action: Open app → Navigate to a past date → Confirm task list loads
  Expected: Tasks, edits, and deletions for the selected date display correctly
  If fails: Check Firestore rules allow read access for all dates (they should)
  Duration: 5 minutes
  → Unblocks: Step 2

Step 2: Verify Supabase activity logs query works for past dates
  Action: Navigate to a past date with completed activities
  Expected: Completion indicators (profile pictures, timestamps) display correctly
  If fails: Check activity_logs index on (puppy_id, date) exists
  Duration: 5 minutes
  → Unblocks: Step 3

Step 3: Verify non-today views don't establish real-time listeners
  Action: Open browser DevTools → Network tab → Navigate to past date
  Expected: No WebSocket frames for Firestore listeners on non-today dates
           Only one-time HTTP reads (getDocs) visible in network log
  Duration: 10 minutes
  → Unblocks: Step 4

Step 4: Verify mutation prevention on non-today views
  Action: Navigate to past date → Confirm: FAB hidden, swipe disabled,
          completion tap disabled, task tap opens read-only sheet
  Expected: All mutation paths blocked by isViewingToday boolean
  Duration: 5 minutes
  → Unblocks: Step 5

Step 5: Verify date boundary enforcement
  Action: Open calendar → Try to navigate before puppy creation date
  Expected: Previous month arrow disabled, dates before creation are grayed out
  Action: Try to navigate past tomorrow
  Expected: Next month arrow disabled, dates after tomorrow are grayed out
  Duration: 5 minutes
  → Unblocks: Step 6

Step 6: Verify "← Today" pill button and calendar "Today" button
  Action: Navigate to past date → Tap "← Today" pill
  Expected: Returns to today's live view with real-time subscriptions
  Action: Open calendar → Tap "Go to Today" button
  Expected: Same behavior, calendar closes, today's view restores
  Duration: 5 minutes
  → Unblocks: Step 7

Step 7: Verify tomorrow view
  Action: Navigate to tomorrow
  Expected: Base routine template displayed (all tasks unchecked)
           No custom tasks, no edits, no deletions (no data for future date)
           Read-only banner visible, no FAB, no interactions
  Duration: 5 minutes
  → Unblocks: Production confidence

Step 8: End-to-end multi-user verification
  Action: Open app in two tabs (different accounts, same puppy)
          Tab 1: Navigate to past date → observe task list
          Tab 2: On today view, complete a task
  Expected: Tab 1 (past date) is unaffected by Tab 2's today activity
           Tab 2 (today) shows real-time updates normally
  Duration: 10 minutes
  → Unblocks: Full confidence
```

**Total backend effort: ~50 minutes** (all verification, zero implementation)

---

### 21.8 Deployment Checklist

**Firestore:**
- [ ] No rule changes needed — existing rules support historical reads
- [ ] No new indexes needed — existing `puppyId + date` queries work for all dates
- [ ] No deployment commands required

**Supabase:**
- [ ] No schema changes needed
- [ ] No new migrations needed
- [ ] No RLS policy changes needed
- [ ] No Edge Function changes needed
- [ ] Existing `idx_activity_logs_puppy_date` index covers historical queries

**Frontend (already shipped):**
- [ ] `CalendarPicker.tsx` — Custom calendar bottom sheet component
- [ ] `Dashboard.tsx` — `selectedDate` state, `isViewingToday` derived boolean, conditional rendering
- [ ] `App.tsx` — `puppyCreatedAt` prop passed to Dashboard
- [ ] `tasks.ts` — `getTodayString()` exported, `subscribeToTasks()` parameterized, `getTasksForDate()` added
- [ ] `activity-logs.ts` — `getTodayLogs()` parameterized with optional `date`
- [ ] `edited-routine-items.ts` — `subscribeToEditedRoutineItems()` parameterized, `getEditedRoutineItemsForDate()` added
- [ ] `deleted-routine-items.ts` — `subscribeToDeletedRoutineItems()` parameterized, `getDeletedRoutineItemsForDate()` added

**Testing:**
- [ ] Past date navigation loads correct task list
- [ ] Past date shows completion attribution (who completed, when)
- [ ] Tomorrow shows base routine template (all unchecked)
- [ ] Non-today views are read-only (no FAB, no swipe, no completion, no edit)
- [ ] Task card tap on past day opens read-only "Task Details" sheet
- [ ] "← Today" pill returns to live today view
- [ ] Calendar "Go to Today" button returns to live today view
- [ ] Calendar date range enforced (puppy creation → tomorrow)
- [ ] Calendar disabled dates are non-tappable
- [ ] Real-time subscriptions only active on today (not past/future)
- [ ] Multi-user: navigating dates in one tab doesn't affect another tab's today view
- [ ] Build succeeds: `npx vite build` with no errors in modified files

---

### 21.9 Cost Impact

**Zero additional infrastructure cost.** Day navigation uses existing Firestore queries and Supabase indexes. The only measurable impact is ~600 additional Firestore reads/day (for 50 users), which is well within the free tier limit of 50K reads/day. Non-today views generate zero writes (read-only mode, D60). No new Supabase Realtime channels are needed for non-today views (D64).

| Resource | Current Usage | Additional Usage | Free Tier Limit |
|---|---|---|---|
| Firestore reads/day | ~3,000 | +600 (~20%) | 50,000 |
| Firestore writes/day | ~250 | +0 | 20,000 |
| Supabase queries/day | ~1,500 | +30 | Unlimited (Pro plan) |
| Firestore WebSocket connections | ~50 concurrent | +0 (no real-time on non-today) | 1M concurrent |

---

### 21.10 Section 17 Code Samples — Updated for F12

The service function code samples in Section 17.4 Step 4 should be noted as outdated with respect to the `subscribeToTasks()` and `getTodayString()` function signatures. The current production code in `src/lib/services/tasks.ts` includes:

1. **`getTodayString(date?: Date)`** — Now exported and accepts an optional `Date` parameter
2. **`subscribeToTasks(puppyId, callback, onError?, date?)`** — Now accepts an optional `date` string parameter
3. **`addTask(..., date?)`** — Now accepts an optional `date` string parameter
4. **`getTasksForDate(puppyId, date)`** — New function for one-time static fetch using `getDocs()`

The original code samples in Section 17.4 remain valid for the today-only flow (all new parameters default to today when omitted). The parameterized versions are in the current source files.

---

### 21.11 Known Limitations & Future Improvements

**v1 Limitations:**
- Historical routine accuracy: past days show current routine structure, not the routine that was active on that date (see Section 21.4)
- No data caching between date navigations (D65) — each navigation triggers a fresh fetch
- No real-time updates on non-today views (D64) — if another user completes a task on a past date via a hypothetical future feature, it won't appear until the next navigation
- Tomorrow shows the same base routine as today — no way to pre-plan or customize tomorrow's schedule
- Calendar only supports puppy creation date → tomorrow range — no historical browsing before the puppy was added to the app

**P1 Improvements:**
- Retroactive task completion: allow marking past tasks as "completed (backdated)" with a clear visual indicator — requires removing the read-only restriction (D60) for completion only, adding a `backdated: boolean` flag to the completion payload
- LRU date cache: cache last 7 viewed dates in memory to speed up re-navigation (D65)
- View-only progress stats: show completion percentage on non-today views (currently hidden per D68)

**P2 Improvements:**
- Routine snapshots: nightly cron job or on-regeneration trigger to store daily routine copies for accurate historical display (see Section 21.4)
- Extended future range: show next 7 days instead of just tomorrow (D59 — requires routine snapshot concept for custom day-level planning)
- Multi-day task editing: allow editing past 7 days for corrections ("forgot to log yesterday's walk")
- Historical data export: download task history for a date range as CSV/PDF

---

### 21.12 Summary

| Component | Change Required | Status |
|---|---|---|
| Firestore Security Rules | None | Already supports reads for any date |
| Firestore Security Rules (`editedRoutineItems`) | None | Already supports reads for any date |
| Firestore Security Rules (`deletedRoutineItems`) | None | Already supports reads for any date |
| Firestore Indexes | None | `puppyId + date` queries work for all dates |
| Firebase Custom Token Edge Function | None | Claims unchanged |
| `generate-routine` Edge Function | None | Not involved in day navigation |
| `accept-invite` Edge Function | None | Not involved in day navigation |
| Supabase Database Schema | None | No new tables, columns, or constraints |
| Supabase RLS Policies | None | `activity_logs` already readable by members for any date |
| Supabase Indexes | None | `idx_activity_logs_puppy_date` already covers historical queries |
| Frontend Service Layer | Already shipped | All 4 service files parameterized with optional `date` param |
| Frontend Components | Already shipped | CalendarPicker, Dashboard, App all updated |
| Deployment | **None required** | Zero backend deployment for this feature |

**Bottom line:** The Day Navigation / Calendar Picker feature (F12 / Flow 8) is entirely a frontend concern with **zero backend changes required**. The existing Firestore security rules, indexes, Supabase schema, RLS policies, and Edge Functions all support date-parameterized queries without modification. The only backend-related work is verification testing (~50 minutes) to confirm that historical reads work correctly through the existing infrastructure. This is the cleanest backend assessment of any feature in this document — a testament to the original data model design (D32, D48) which used date-string filtering from the start, making day navigation a natural extension of the existing architecture.

---

## 22. F6 / F7: Invite Code System — Backend Plan

**Added:** 2026-03-02
**Priority:** P0 (Launch Blocker)
**Complexity:** Medium
**Decisions:** D70 (Invite Link → Invite Code), D71 (Code Format), D72 (Choice Screen Routing), D73 (Server-Side Validation)
**Supersedes:** Section 3.2 (old `accept-invite` endpoint), Phase 6 (old invite system backend), `invites` table in Section 2.1

---

### 22.1 Overview

The invite system has been redesigned from invite links to invite codes (D70). This eliminates deep link infrastructure, share sheets, invite lifecycle states, and expiration logic. The new system uses a persistent, human-readable code per household that the owner copies and shares out-of-band.

**What changed from the original plan:**
- `invites` table → `invite_codes` table (simpler schema: no status, no expiry, no accepted_by)
- `POST /functions/v1/accept-invite` → `POST /functions/v1/validate-invite-code` (different request/response shape)
- Invite token generation (random UUID) → Code generation (`{WORD}-{ALPHANUMERIC}` format, D71)
- `src/lib/services/invites.ts` → `src/lib/services/invite-codes.ts` (complete rewrite)
- No invite lifecycle management (no pending/accepted/expired/revoked states)
- Code is auto-generated at puppy creation time (no "generate invite" action)

**Frontend already implemented:**
- `NewUserChoiceScreen.tsx` — Choice screen after first-time OAuth
- `InviteCodeEntryScreen.tsx` — Code entry with validation, error display, auto-capitalize
- `InviteCodeSuccessScreen.tsx` — Success screen with puppy details
- `App.tsx` routing — `"choice"` → `"invite-code-entry"` → `"invite-success"` → `"dashboard"`
- `handleInviteCodeSubmit` placeholder in App.tsx (currently returns invalid for all codes)

**Backend work required:**
1. Create `invite_codes` table (replace `invites` table)
2. Create `validate-invite-code` Edge Function
3. Auto-generate invite code on puppy creation (DB trigger or application code)
4. Create `src/lib/services/invite-codes.ts` (replace `invites.ts`)
5. Wire frontend `handleInviteCodeSubmit` to the Edge Function
6. Add owner-side UI for viewing/copying the code (Settings > Caretakers)
7. RLS policies for `invite_codes` table

---

### 22.2 Database Changes

#### 22.2.1 New Table: `invite_codes` (replaces `invites`)

```sql
-- Drop the old invites table (or leave it — it has no production data at 0→1 stage)
-- CREATE TABLE IF NOT EXISTS invite_codes ...

CREATE TABLE invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  puppy_id UUID NOT NULL REFERENCES puppies(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint: one invite code per puppy (enforced at DB level)
CREATE UNIQUE INDEX idx_invite_codes_puppy_id ON invite_codes(puppy_id);

-- Fast lookups by code (used by validate-invite-code Edge Function)
CREATE INDEX idx_invite_codes_code ON invite_codes(code);

COMMENT ON TABLE invite_codes IS 'Persistent, unique invite codes per household. Replaces the old invites table (D70).';
COMMENT ON COLUMN invite_codes.code IS 'Format: {WORD}-{ALPHANUMERIC}, e.g., BISCUIT-7X2K. Case-insensitive (stored uppercase). See D71.';
```

**Schema comparison (old → new):**

| Old `invites` table | New `invite_codes` table | Notes |
|---|---|---|
| `id` (UUID, PK) | `id` (UUID, PK) | Same |
| `puppy_id` (FK → puppies) | `puppy_id` (FK → puppies, UNIQUE) | Added unique constraint — one code per puppy |
| `invited_by` (FK → auth.users) | `created_by` (FK → auth.users) | Renamed for clarity |
| `invite_token` (text, unique) | `code` (text, unique) | Renamed; new format (D71) |
| `status` (enum) | _(removed)_ | No lifecycle states needed |
| `accepted_by` (FK, nullable) | _(removed)_ | Tracked via `puppy_memberships` instead |
| `expires_at` (timestamp) | _(removed)_ | Codes never expire (D70) |
| `created_at` (timestamp) | `created_at` (timestamptz) | Same |

#### 22.2.2 Code Generation (D71)

Format: `{WORD}-{ALPHANUMERIC}` (e.g., `BISCUIT-7X2K`)

```sql
-- Database function to generate invite codes
CREATE OR REPLACE FUNCTION generate_invite_code(puppy_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  word TEXT;
  suffix TEXT;
  full_code TEXT;
  attempts INT := 0;
BEGIN
  -- First segment: puppy name, uppercased, truncated to 8 chars, non-alpha stripped
  word := UPPER(SUBSTRING(REGEXP_REPLACE(puppy_name, '[^a-zA-Z]', '', 'g') FROM 1 FOR 8));

  -- Fallback if puppy name has no alpha characters
  IF LENGTH(word) = 0 THEN
    word := 'PUPPY';
  END IF;

  LOOP
    -- Second segment: random 4-char alphanumeric (A-Z, 0-9)
    suffix := UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4));

    -- Replace any ambiguous characters (0/O, 1/I/L) for readability
    suffix := REPLACE(suffix, '0', 'X');
    suffix := REPLACE(suffix, '1', 'Y');

    full_code := word || '-' || suffix;

    -- Check for uniqueness
    IF NOT EXISTS (SELECT 1 FROM invite_codes WHERE code = full_code) THEN
      RETURN full_code;
    END IF;

    attempts := attempts + 1;
    IF attempts > 10 THEN
      -- Extremely unlikely (36^4 = 1.6M combinations per word), but safety valve
      RAISE EXCEPTION 'Failed to generate unique invite code after 10 attempts';
    END IF;
  END LOOP;
END;
$$;
```

#### 22.2.3 Auto-Generation Trigger

The invite code is generated automatically when a puppy is created (owner completes onboarding). This is implemented as a Postgres trigger:

```sql
-- Trigger: auto-generate invite code when a puppy is created
CREATE OR REPLACE FUNCTION trigger_create_invite_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  owner_id UUID;
BEGIN
  -- Find the owner from puppy_memberships (created in the same transaction)
  SELECT user_id INTO owner_id
  FROM puppy_memberships
  WHERE puppy_id = NEW.id AND role = 'owner'
  LIMIT 1;

  -- If no membership yet (trigger fires before membership insert), use a deferred approach
  -- We'll handle this in the Edge Function / application code instead
  IF owner_id IS NOT NULL THEN
    INSERT INTO invite_codes (puppy_id, code, created_by)
    VALUES (NEW.id, generate_invite_code(NEW.name), owner_id);
  END IF;

  RETURN NEW;
END;
$$;

-- NOTE: The trigger approach has a timing issue — the puppy_memberships row
-- may not exist yet when the puppy is created (they're inserted in sequence).
-- Alternative: generate the invite code in the application code (createPuppy service)
-- immediately after the puppy and membership are created. See Section 22.4 for the
-- recommended approach.
```

**Recommended approach: Application-level code generation** (not trigger)

The trigger has a timing dependency on `puppy_memberships`. Instead, generate the invite code in the `createPuppy` service function, immediately after the puppy and membership are created:

```typescript
// In src/lib/services/puppies.ts — after createPuppy inserts puppy + membership:
const code = await generateInviteCode(puppy.id, puppy.name, user.id);
```

This is simpler, avoids trigger ordering issues, and keeps the logic visible in application code.

#### 22.2.4 RLS Policies for `invite_codes`

```sql
ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;

-- Owners can read their own puppy's invite code (for Settings > Caretakers display)
CREATE POLICY "Owners can view invite codes for their puppies"
  ON invite_codes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM puppy_memberships
      WHERE puppy_id = invite_codes.puppy_id
        AND user_id = auth.uid()
        AND role = 'owner'
        AND status = 'active'
    )
  );

-- No direct INSERT/UPDATE/DELETE from client — all mutations go through Edge Function
-- or application code with service_role key.
-- Caretakers should NOT be able to read invite codes (they don't need them).
-- The validate-invite-code Edge Function uses the service_role key to bypass RLS.
```

#### 22.2.5 Updated Index (replaces Section 2.3 invite index)

The old index `idx_invites_token` on `invites(invite_token) WHERE status = 'pending'` is no longer needed. Replace with:

```sql
-- Already defined in 22.2.1:
CREATE INDEX idx_invite_codes_code ON invite_codes(code);
CREATE UNIQUE INDEX idx_invite_codes_puppy_id ON invite_codes(puppy_id);
```

---

### 22.3 Edge Function: `validate-invite-code`

**Replaces:** Section 3.2 (`accept-invite` endpoint)

**Endpoint:** `POST /functions/v1/validate-invite-code`

**Purpose:** Validate an invite code, create a caretaker membership, and return puppy details.

**Request:**
```typescript
{
  code: string;  // e.g., "BISCUIT-7X2K" (case-insensitive, whitespace-trimmed)
}
```

**Response (success — 200):**
```typescript
{
  success: true;
  puppy: {
    id: string;
    name: string;
    breed: string;
    age_weeks: number;       // Total weeks (age_months * 4 + age_weeks)
    photo_url: string | null;
  };
  membership: {
    id: string;
    role: "caretaker";
    joined_at: string;
  };
}
```

**Response (errors):**
```typescript
// 400 Bad Request — missing or empty code
{ error: "Invite code is required." }

// 401 Unauthorized — no valid auth token
{ error: "Not authenticated." }

// 404 Not Found — code doesn't match any household
{ error: "That code doesn't match any household. Please check with the puppy's owner and try again." }

// 409 Conflict — user already a member, or caretaker limit reached
{ error: "You're already a member of this household." }
{ error: "This household already has the maximum number of caretakers." }

// 500 Internal Server Error
{ error: "Something went wrong. Please try again." }
```

**Implementation:**

```typescript
// supabase/functions/validate-invite-code/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Parse request
    const { code } = await req.json();
    if (!code || typeof code !== "string" || code.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Invite code is required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalizedCode = code.trim().toUpperCase();

    // 2. Verify auth
    const authHeader = req.headers.get("Authorization")!;
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Not authenticated." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Use service_role client for DB operations (bypasses RLS)
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 4. Look up invite code
    const { data: inviteCode, error: lookupError } = await adminClient
      .from("invite_codes")
      .select("id, puppy_id")
      .eq("code", normalizedCode)
      .single();

    if (lookupError || !inviteCode) {
      return new Response(
        JSON.stringify({
          error: "That code doesn't match any household. Please check with the puppy's owner and try again.",
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Check if user is already a member
    const { data: existingMembership } = await adminClient
      .from("puppy_memberships")
      .select("id")
      .eq("puppy_id", inviteCode.puppy_id)
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    if (existingMembership) {
      return new Response(
        JSON.stringify({ error: "You're already a member of this household." }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. Check caretaker limit (max 1 in v1)
    const { count: caretakerCount } = await adminClient
      .from("puppy_memberships")
      .select("id", { count: "exact", head: true })
      .eq("puppy_id", inviteCode.puppy_id)
      .eq("role", "caretaker")
      .eq("status", "active");

    if (caretakerCount && caretakerCount >= 1) {
      return new Response(
        JSON.stringify({
          error: "This household already has the maximum number of caretakers.",
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 7. Create caretaker membership
    const { data: membership, error: membershipError } = await adminClient
      .from("puppy_memberships")
      .insert({
        puppy_id: inviteCode.puppy_id,
        user_id: user.id,
        role: "caretaker",
        status: "active",
      })
      .select("id, role, joined_at")
      .single();

    if (membershipError) {
      console.error("Failed to create membership:", membershipError);
      return new Response(
        JSON.stringify({ error: "Something went wrong. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 8. Fetch puppy details for the success screen
    const { data: puppy, error: puppyError } = await adminClient
      .from("puppies")
      .select("id, name, breed, age_months, age_weeks, photo_url")
      .eq("id", inviteCode.puppy_id)
      .single();

    if (puppyError || !puppy) {
      console.error("Failed to fetch puppy:", puppyError);
      // Membership was already created — return success with minimal data
      return new Response(
        JSON.stringify({
          success: true,
          puppy: { id: inviteCode.puppy_id, name: "Your puppy", breed: "", age_weeks: 0, photo_url: null },
          membership,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 9. Return success with puppy details
    return new Response(
      JSON.stringify({
        success: true,
        puppy: {
          id: puppy.id,
          name: puppy.name,
          breed: puppy.breed,
          age_weeks: puppy.age_months * 4 + puppy.age_weeks,
          photo_url: puppy.photo_url,
        },
        membership: {
          id: membership.id,
          role: membership.role,
          joined_at: membership.joined_at,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("validate-invite-code error:", err);
    return new Response(
      JSON.stringify({ error: "Something went wrong. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
```

**Deploy:**
```bash
supabase functions deploy validate-invite-code
```

---

### 22.4 Frontend Service: `invite-codes.ts`

**Replaces:** `src/lib/services/invites.ts`

```typescript
// src/lib/services/invite-codes.ts

import { supabase } from "../supabase";

/**
 * Validate an invite code via the Edge Function.
 * Called by App.tsx handleInviteCodeSubmit.
 */
export async function validateInviteCode(code: string): Promise<{
  success: boolean;
  error?: string;
  puppy?: {
    id: string;
    name: string;
    breed: string;
    age_weeks: number;
    photo_url: string | null;
  };
  membership?: {
    id: string;
    role: string;
    joined_at: string;
  };
}> {
  const { data, error } = await supabase.functions.invoke("validate-invite-code", {
    body: { code },
  });

  if (error) {
    // Supabase functions.invoke wraps non-2xx responses as errors
    return {
      success: false,
      error: data?.error || "Something went wrong. Please try again.",
    };
  }

  return data;
}

/**
 * Get the invite code for a puppy (owner view in Settings > Caretakers).
 * Uses the client Supabase client (RLS enforces owner-only access).
 */
export async function getInviteCode(puppyId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("invite_codes")
    .select("code")
    .eq("puppy_id", puppyId)
    .single();

  if (error || !data) return null;
  return data.code;
}

/**
 * Generate an invite code for a puppy.
 * Called after puppy creation during onboarding.
 * Uses the service role via Edge Function to bypass RLS.
 *
 * NOTE: This could also be done via a Postgres trigger (see 22.2.3),
 * but application-level generation avoids trigger timing issues.
 */
export async function createInviteCode(
  puppyId: string,
  puppyName: string,
  userId: string
): Promise<string> {
  // Generate code format: {WORD}-{ALPHANUMERIC}
  const word = puppyName
    .replace(/[^a-zA-Z]/g, "")
    .toUpperCase()
    .slice(0, 8) || "PUPPY";

  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // Exclude ambiguous: 0/O, 1/I/L
  let suffix = "";
  for (let i = 0; i < 4; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }

  const code = `${word}-${suffix}`;

  const { error } = await supabase
    .from("invite_codes")
    .insert({
      puppy_id: puppyId,
      code,
      created_by: userId,
    });

  if (error) {
    // If uniqueness collision, retry with new suffix
    if (error.code === "23505") {
      return createInviteCode(puppyId, puppyName, userId);
    }
    throw error;
  }

  return code;
}
```

---

### 22.5 Frontend Integration: App.tsx Changes

**Update `handleInviteCodeSubmit` to call the Edge Function:**

```typescript
// In App.tsx — replace the placeholder handleInviteCodeSubmit:

import { validateInviteCode } from "../lib/services/invite-codes";

const handleInviteCodeSubmit = async (
  code: string
): Promise<{ success: boolean; error?: string }> => {
  if (!user) return { success: false, error: "Not authenticated." };

  try {
    const result = await validateInviteCode(code);

    if (result.success && result.puppy) {
      // Call onSuccess with puppy data for the success screen
      // This is handled via the onSuccess prop on InviteCodeEntryScreen
      return { success: true };
    }

    return {
      success: false,
      error: result.error || "That code doesn't match any household.",
    };
  } catch (err) {
    console.error("handleInviteCodeSubmit: error:", err);
    return { success: false, error: "Something went wrong. Please try again." };
  }
};
```

**Note on data flow:** The `InviteCodeEntryScreen` currently expects `onSubmit` to return `{ success, error }` and separately calls `onSuccess(puppyData)`. The Edge Function returns both the success status and the puppy data in one response. The `handleInviteCodeSubmit` function needs to be updated to:
1. Call the Edge Function
2. If successful, store the puppy data and call the `onSuccess` callback
3. Return the success/error status

The exact wiring:
```typescript
// Updated flow in App.tsx:
const handleInviteCodeSubmit = async (code: string) => {
  if (!user) return { success: false, error: "Not authenticated." };

  const result = await validateInviteCode(code);

  if (result.success && result.puppy) {
    // Store puppy data for the success screen, then InviteCodeEntryScreen
    // will call onSuccess which transitions to invite-success state
    setJoinedPuppyData({
      puppyName: result.puppy.name,
      breed: result.puppy.breed,
      ageWeeks: result.puppy.age_weeks,
      photoUrl: result.puppy.photo_url,
    });
  }

  return { success: result.success, error: result.error };
};
```

And the `InviteCodeEntryScreen` `onSubmit` handler needs a small update — currently `onSuccess` is never called because the submit handler only checks `result.success` from `onSubmit` but doesn't trigger `onSuccess`. The fix: after `onSubmit` returns success, the screen should call `onSuccess` with the stored puppy data. This means `handleInviteCodeSubmit` should set `joinedPuppyData` (state in App.tsx) before returning, and `onSuccess` should read from that state. The current wiring in App.tsx already does this:

```tsx
<InviteCodeEntryScreen
  onBack={() => setAppState("choice")}
  onSubmit={handleInviteCodeSubmit}
  onSuccess={(puppyData) => {
    setJoinedPuppyData(puppyData);
    setAppState("invite-success");
  }}
/>
```

**Issue:** `onSuccess` is never called by `InviteCodeEntryScreen` — the component's `handleSubmit` only checks `result.success` but doesn't invoke `onSuccess`. Fix: update `InviteCodeEntryScreen.handleSubmit` to call `onSuccess` when the submit returns success. This requires the Edge Function response to flow through. Two options:

**Option A (Recommended):** Change `onSubmit` return type to include puppy data:
```typescript
interface InviteCodeEntryScreenProps {
  onBack: () => void;
  onSubmit: (code: string) => Promise<{
    success: boolean;
    error?: string;
    puppyData?: PuppyJoinData;  // Added
  }>;
  onSuccess: (puppyData: PuppyJoinData) => void;
}
```

Then in `handleSubmit`:
```typescript
const result = await onSubmit(trimmedCode.toUpperCase());
if (result.success && result.puppyData) {
  onSuccess(result.puppyData);
} else if (!result.success) {
  setError(result.error || "...");
}
```

**Option B:** Have `handleInviteCodeSubmit` in App.tsx set state and transition directly, bypassing `onSuccess`. Less clean but fewer component changes.

**Recommendation:** Option A. It keeps the data flow explicit and the component self-contained.

---

### 22.6 Invite Code Generation During Onboarding

The invite code must be created when the owner finishes onboarding (puppy is created). This happens in `App.tsx handleQuestionnaireComplete` → `createPuppy()`. Add the invite code generation call after the puppy is created:

```typescript
// In App.tsx handleQuestionnaireComplete, inside the async IIFE:
const puppy = await createPuppy(user.id, { ... });

// Generate invite code for this puppy
try {
  await createInviteCode(puppy.id, data.puppyName, user.id);
  console.log("Invite code created for puppy:", puppy.id);
} catch (err) {
  // Non-blocking — the code can be generated later if this fails
  console.error("Failed to create invite code:", err);
}
```

Alternatively, this can be handled by the `createPuppy` service function itself, which already creates the puppy and membership in sequence. Adding the invite code as a third step keeps all creation logic in one place.

---

### 22.7 Owner-Side UI: Settings > Caretakers

**Not yet implemented.** The owner needs to see their invite code in Settings > Caretakers. This is a frontend task but depends on the `getInviteCode()` service function (Section 22.4).

**Implementation outline:**
1. Add a "Caretakers" section to the Settings screen
2. On mount, call `getInviteCode(puppyId)` to fetch the code
3. Display the code in a card with a [Copy] button
4. Copy button uses `navigator.clipboard.writeText(code)` with visual feedback ("Copied!" for 2s)
5. Below the code, list current caretakers (query `puppy_memberships` where `role = 'caretaker'`)
6. Owner can remove a caretaker (update `puppy_memberships.status = 'removed'`)

This is frontend-only work — the backend support (RLS policy, service function) is defined in Sections 22.2.4 and 22.4.

---

### 22.8 Firebase Custom Token: Claims Update

When a caretaker joins via invite code, they need Firestore access for task sync. The `get-firebase-token` Edge Function already includes `puppyIds` in the Firebase Custom Claims (Section 17.3, Step 3). However, the token is generated at sign-in time — **before** the caretaker has joined a household.

**Solution:** After the caretaker successfully validates the invite code and the membership is created, the frontend should re-fetch the Firebase token to update the Custom Claims with the new `puppyId`:

```typescript
// In App.tsx handleInviteSuccess (after membership is confirmed):
import { signInToFirebase } from "../lib/firebase";

const handleInviteSuccess = async () => {
  if (!user) return;

  // Re-authenticate with Firebase to get updated Custom Claims (includes new puppyId)
  try {
    await signInToFirebase();
  } catch (err) {
    console.error("Failed to refresh Firebase token:", err);
    // Non-blocking — will be refreshed on next app load
  }

  // Reload user data which will now find the new membership
  await loadUserData(user);
};
```

No changes needed to the `get-firebase-token` Edge Function itself — it already queries all active memberships.

---

### 22.9 Implementation Steps

```
Step 1: Database migration — create invite_codes table, indexes, RLS
  → File: supabase/migrations/YYYYMMDD_invite_codes.sql
  → Unblocks: Steps 2, 3, 4

Step 2: Create validate-invite-code Edge Function
  → File: supabase/functions/validate-invite-code/index.ts
  → Deploy: supabase functions deploy validate-invite-code
  → Unblocks: Step 4

Step 3: Create invite-codes.ts service layer
  → File: src/lib/services/invite-codes.ts
  → Functions: validateInviteCode(), getInviteCode(), createInviteCode()
  → Unblocks: Steps 4, 5, 6

Step 4: Wire frontend handleInviteCodeSubmit to Edge Function
  → File: src/app/App.tsx
  → Update: handleInviteCodeSubmit, handleInviteSuccess
  → Update: InviteCodeEntryScreen onSubmit return type (add puppyData)
  → Unblocks: Step 7 (E2E testing)

Step 5: Add invite code generation to onboarding flow
  → File: src/app/App.tsx (handleQuestionnaireComplete) or
          src/lib/services/puppies.ts (createPuppy)
  → Unblocks: Step 6

Step 6: Owner-side Settings > Caretakers UI
  → File: src/app/components/Settings.tsx (add Caretakers section)
  → Uses: getInviteCode(), navigator.clipboard
  → Unblocks: Step 7

Step 7: E2E testing — full invite code flow
  → Owner creates puppy → code auto-generated
  → Owner sees code in Settings > Caretakers → copies it
  → Caretaker signs in → choice screen → enters code → success screen → dashboard
  → Both users see the same routine
  → Caretaker can complete tasks (Firestore sync works)
  → Unblocks: Deployment
```

---

### 22.10 Migration from `invites` to `invite_codes`

The old `invites` table (Section 2.1) has no production data (0→1 stage). The migration strategy is:

1. **Create `invite_codes` table** alongside `invites` (non-destructive)
2. **Update all references** in application code (`invites.ts` → `invite-codes.ts`)
3. **Update `database.types.ts`** to include `invite_codes` type (regenerate with `supabase gen types`)
4. **Drop `invites` table** after confirming no code references remain
5. **Remove `src/lib/services/invites.ts`** (replaced by `invite-codes.ts`)

```sql
-- Migration file: supabase/migrations/YYYYMMDD_invite_codes.sql

-- 1. Create new table
CREATE TABLE invite_codes ( ... );  -- Full DDL in Section 22.2.1

-- 2. Create code generation function
CREATE OR REPLACE FUNCTION generate_invite_code(...);  -- Section 22.2.2

-- 3. RLS policies
ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners can view invite codes for their puppies" ...;  -- Section 22.2.4

-- 4. Drop old table (safe — no production data)
DROP TABLE IF EXISTS invites;
```

---

### 22.11 Testing Plan

**Unit Tests (Edge Function):**
- Valid code → 200, membership created, puppy details returned
- Invalid code → 404, correct error message
- Empty code → 400
- No auth token → 401
- User already a member → 409
- Caretaker limit exceeded → 409
- Code with extra whitespace/lowercase → normalized correctly

**Integration Tests:**
1. Owner completes onboarding → invite code exists in `invite_codes` table
2. Caretaker enters valid code → membership created → can view puppy data
3. Caretaker enters invalid code → error displayed → can retry
4. Second caretaker tries same code → 409 (limit exceeded in v1)
5. Owner sees caretaker in Settings after they join
6. Caretaker has Firestore access after joining (Custom Claims updated)

**Manual Smoke Test:**
1. Create account A (owner), complete onboarding for "Biscuit"
2. Open Settings > Caretakers → verify code displayed (e.g., "BISCUIT-7X2K")
3. Copy code
4. Create account B (caretaker) in incognito window
5. Choice screen → "I have an invite code" → enter copied code → Submit
6. Verify success screen shows Biscuit's details
7. Tap "View Routine" → verify dashboard loads with Biscuit's routine
8. Complete a task as caretaker → verify owner sees it in real-time

---

### 22.12 Error Handling Summary

| Scenario | Error Code | User-Facing Message | Recovery |
|---|---|---|---|
| Empty code submitted | 400 | "Invite code is required." | Re-enter code |
| Code doesn't match | 404 | "That code doesn't match any household. Please check with the puppy's owner and try again." | Re-enter code |
| Already a member | 409 | "You're already a member of this household." | Navigate to dashboard |
| Caretaker limit hit | 409 | "This household already has the maximum number of caretakers." | Contact owner |
| Network error | — | "Something went wrong. Please try again." | Retry |
| Not authenticated | 401 | "Not authenticated." | Re-sign in |

---

### 22.13 Cost Impact

| Component | Change | Cost Impact |
|---|---|---|
| Supabase Database | 1 new table (`invite_codes`), ~100 rows at scale | Negligible |
| Supabase Edge Function | `validate-invite-code`: ~1 invocation per new caretaker | Negligible (within free tier) |
| Firestore | No change (existing task sync) | None |
| Anthropic Claude API | No change (not involved) | None |

**Total additional cost: $0.** The invite code system adds one lightweight table and one Edge Function that is called rarely (once per caretaker join).

---

### 22.14 Deployment Checklist

- [ ] Database migration applied: `invite_codes` table created
- [ ] `generate_invite_code` function created in Postgres
- [ ] RLS policies enabled on `invite_codes`
- [ ] `validate-invite-code` Edge Function deployed
- [ ] `src/lib/services/invite-codes.ts` created
- [ ] `src/lib/services/invites.ts` removed (old file)
- [ ] `database.types.ts` regenerated (includes `invite_codes`)
- [ ] `handleInviteCodeSubmit` in App.tsx updated to call Edge Function
- [ ] `InviteCodeEntryScreen` updated: `onSubmit` returns `puppyData` on success
- [ ] Invite code auto-generated during onboarding (`createPuppy` flow)
- [ ] Settings > Caretakers UI shows invite code with Copy button
- [ ] Firebase token refreshed after caretaker joins (Custom Claims update)
- [ ] Old `invites` table dropped
- [ ] E2E smoke test passed (owner → code → caretaker → dashboard)

---

### 22.15 Summary

| Component | Change Required | Status |
|---|---|---|
| Database: `invite_codes` table | **New table** (replaces `invites`) | Not started |
| Database: `generate_invite_code` function | **New function** | Not started |
| Database: RLS policies | **New policy** (owner-only read) | Not started |
| Edge Function: `validate-invite-code` | **New function** (replaces `accept-invite`) | Not started |
| Service: `invite-codes.ts` | **New file** (replaces `invites.ts`) | Not started |
| Service: `invites.ts` | **Delete** | Not started |
| App.tsx: `handleInviteCodeSubmit` | **Update** (call Edge Function) | Placeholder exists |
| App.tsx: `handleQuestionnaireComplete` | **Update** (add code generation) | Not started |
| App.tsx: `handleInviteSuccess` | **Update** (refresh Firebase token) | Partially exists |
| InviteCodeEntryScreen.tsx | **Update** (`onSubmit` return type) | Component exists |
| Settings.tsx | **Update** (add Caretakers section) | Not started |
| Frontend: NewUserChoiceScreen.tsx | None | Already shipped |
| Frontend: InviteCodeSuccessScreen.tsx | None | Already shipped |
| Frontend: App.tsx routing | None | Already shipped |

**Bottom line:** The invite code backend (F6/F7) requires 1 new database table, 1 new Edge Function, 1 new service file, and updates to 3 existing files. The frontend screens are already implemented. The system is dramatically simpler than the original invite link design — no deep links, no invite lifecycle states, no expiration, no share sheets. Total new server-side code: ~150 lines (Edge Function) + ~80 lines (service layer) + ~50 lines (SQL migration).

---

**End of Backend Development Plan**

*This document will be updated as implementation progresses. All technical decisions are subject to revision based on real-world testing and user feedback.*
