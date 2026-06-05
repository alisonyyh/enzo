# Enzo (PupPlan) — Backend Development Plan

**Version:** 2.0
**Created:** 2026-02-11
**Last Updated:** 2026-06-05
**Stage:** 0→1 (Pre-launch, approaching MVP completion)

---

## Executive Summary

This document is the definitive backend implementation plan for **Enzo** (formerly PupPlan), an AI-powered puppy care routine app. It maps every product spec feature to its backend status, documents the production architecture, and lays out remaining work for launch.

**Current state:** The backend is substantially complete. All 14 product spec features (F1–F14) have backend support implemented. The system uses a hybrid Supabase + Firebase architecture with three Edge Functions, comprehensive RLS policies, and a two-layer AI routine generation system.

**Remaining work:** Verification, bug fixes, production hardening, and deployment. No greenfield backend features remain for v1.

---

## 1. Architecture Overview

### 1.1 Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Database (primary)** | Supabase PostgreSQL | Users, puppies, routines, activity logs, weight logs, breed profiles, invite codes |
| **Database (real-time overlay)** | Firebase Firestore | Task edits, task deletions, custom tasks — offline-first with built-in sync |
| **Auth (primary)** | Supabase Auth (Google OAuth) | All user authentication, JWT tokens |
| **Auth (secondary)** | Firebase Auth (Custom Tokens) | Firestore security rules — Custom Claims carry `puppyIds` array |
| **Serverless API** | Supabase Edge Functions (Deno) | AI routine generation, invite validation, Firebase token minting |
| **AI** | Anthropic Claude API (claude-sonnet-4-6) | Schedule assembly from pre-computed parameters |
| **Storage** | Supabase Storage | Puppy photos (`puppy-photos`), user avatars (`user-avatars`) |
| **Storage (profile photos)** | Firebase Storage | Custom profile photos (`users/{userId}/profile_photo.jpg`) |
| **Analytics** | PostHog | Product analytics |
| **Mobile** | Capacitor | iOS native wrapper |
| **Frontend** | Vite + React + TypeScript + Tailwind v4 | Mobile-first web app |

### 1.2 Hybrid Backend Architecture

```
Frontend (React)
  ├── Supabase Client
  │     ├── Auth (Google OAuth)
  │     ├── Database (Postgres via PostgREST)
  │     ├── Realtime (WebSocket subscriptions for activity_logs, profiles)
  │     ├── Storage (puppy photos, user avatars)
  │     └── Edge Functions (generate-routine, validate-invite-code, get-firebase-token)
  │
  └── Firebase Client
        ├── Auth (Custom Token from get-firebase-token Edge Function)
        ├── Firestore (editedRoutineItems, deletedRoutineItems, tasks collections)
        └── Storage (custom profile photos)
```

**Why hybrid:** Firestore provides built-in offline persistence, optimistic updates, and real-time listeners for task editing — building equivalent functionality with Supabase Realtime would have taken 3-4x longer. Supabase remains primary for relational data (users, puppies, routines). The dual-auth bridge (Supabase JWT → Firebase Custom Token with `puppyIds` claim) is handled by the `get-firebase-token` Edge Function.

### 1.3 Data Flow

**Routine generation (onboarding):**
```
Questionnaire Submit
  → Edge Function: generate-routine
    → computeScheduleParams(DOB, breed, energy, brachy) → deterministic params
    → Claude API: assemble timeline from params → structured JSON
    → Map category → duration_minutes via getDurationForActivity()
    → Insert routine + routine_items to Supabase
  → Dashboard renders routine with durations
```

**Routine generation (weekly regeneration, F14):**
```
Dashboard Load
  → Check: routine.valid_until < now?
    → Yes: triggerRegeneration()
      → Edge Function: generate-routine (isRegeneration: true)
        → Acquire lock (regeneration_status = 'in_progress')
        → Aggregate activity_logs for past 7 days (completion summary)
        → computeScheduleParams() with fresh age bracket from DOB
        → Claude API with completion context in prompt
        → Insert new routine (valid_until = now + 7 days)
        → Deactivate old routine, release lock
      → Clean up Firebase overlays for old routine item IDs
    → No: show existing routine
```

**Task editing (real-time):**
```
User taps task → Edit bottom sheet
  → Save changes → Firestore: editedRoutineItems/{puppyId}_{itemId}_{date}
  → Realtime subscription → All household members see update within 3 seconds
  → Dashboard merge: Supabase routine_items + Firebase edits/deletes + custom tasks
```

**Auth flow (Supabase → Firebase bridge):**
```
1. User signs in via Supabase Google OAuth → gets Supabase JWT
2. Client calls get-firebase-token Edge Function with Supabase JWT
3. Edge Function:
   a. Verifies JWT via Supabase JWKS endpoint (ES256)
   b. Queries puppy_memberships for user's puppyIds
   c. Creates Firebase Custom Token with { puppyIds: [...] } claim
4. Client calls signInWithCustomToken(firebaseAuth, token)
5. Firestore rules: hasPuppyAccess(puppyId) checks auth.token.puppyIds
```

---

## 2. Database Schema (Current)

### 2.1 Supabase PostgreSQL

All tables have Row Level Security (RLS) enabled. Helper functions `is_puppy_owner()` and `is_puppy_member()` use `SECURITY DEFINER` to avoid recursive RLS checks.

#### Tables

**`profiles`** — Extends Supabase `auth.users`
| Column | Type | Constraints |
|--------|------|------------|
| id | UUID PK | FK → auth.users |
| display_name | TEXT | nullable |
| avatar_url | TEXT | nullable |
| created_at | TIMESTAMPTZ | default now() |

**`breed_profiles`** — Reference data, seed-only (30 breeds)
| Column | Type | Constraints |
|--------|------|------------|
| id | UUID PK | gen_random_uuid() |
| breed_name | TEXT NOT NULL | UNIQUE |
| breed_size | TEXT NOT NULL | CHECK (toy\|small\|medium\|large\|giant) |
| energy_level | TEXT NOT NULL | CHECK (high\|moderate\|low) |
| is_brachycephalic | BOOLEAN | default false |
| created_at | TIMESTAMPTZ | default now() |

**`puppies`** — Puppy profile
| Column | Type | Constraints |
|--------|------|------------|
| id | UUID PK | gen_random_uuid() |
| name | TEXT NOT NULL | |
| breed | TEXT NOT NULL | |
| date_of_birth | DATE | nullable (required for new puppies, D69) |
| age_months | INT | legacy, default 0 |
| age_weeks | INT | legacy, default 0 |
| breed_size | TEXT | nullable (copied from breed_profiles at creation, D72) |
| energy_level | TEXT | nullable (copied from breed_profiles at creation, D72) |
| is_brachycephalic | BOOLEAN | default false |
| weight_value | DECIMAL | nullable |
| weight_unit | TEXT | default 'lbs' |
| photo_url | TEXT | nullable |
| questionnaire_data | JSONB | nullable — { wakeUpTime, bedTime } |
| created_at | TIMESTAMPTZ | default now() |

**`puppy_memberships`** — User-puppy relationship
| Column | Type | Constraints |
|--------|------|------------|
| id | UUID PK | gen_random_uuid() |
| puppy_id | UUID | FK → puppies (CASCADE) |
| user_id | UUID | FK → auth.users (CASCADE) |
| role | TEXT NOT NULL | CHECK (owner\|caretaker) |
| status | TEXT | default 'active', CHECK (active\|removed) |
| joined_at | TIMESTAMPTZ | default now() |
| | | UNIQUE(puppy_id, user_id) |

**`routines`** — Generated daily schedules
| Column | Type | Constraints |
|--------|------|------------|
| id | UUID PK | gen_random_uuid() |
| puppy_id | UUID | FK → puppies (CASCADE) |
| generated_at | TIMESTAMPTZ | default now() |
| source | TEXT | default 'ai_generated' |
| is_active | BOOLEAN | default true |
| valid_until | TIMESTAMPTZ | nullable — generated_at + 7 days (F14) |
| regeneration_status | TEXT | nullable — 'in_progress' or null (F14 lock) |
| generation_context | JSONB | nullable — age_bracket, age_weeks, completion_summary, schedule_params (F14) |

**`routine_items`** — Activities in a routine
| Column | Type | Constraints |
|--------|------|------------|
| id | UUID PK | gen_random_uuid() |
| routine_id | UUID | FK → routines (CASCADE) |
| activity_type | TEXT NOT NULL | feeding\|potty\|exercise\|training\|rest\|play\|bonding |
| title | TEXT NOT NULL | |
| description | TEXT | nullable (always null per D73 — no LLM commentary) |
| scheduled_time | TIME NOT NULL | |
| duration_minutes | INT | nullable — set for exercise/training/rest/play/bonding |
| sort_order | INT | nullable |
| is_enabled | BOOLEAN | default true |

**`activity_logs`** — Task completion tracking
| Column | Type | Constraints |
|--------|------|------------|
| id | UUID PK | gen_random_uuid() |
| routine_item_id | UUID | FK → routine_items (CASCADE) |
| puppy_id | UUID | FK → puppies (CASCADE) |
| date | DATE NOT NULL | |
| status | TEXT | CHECK (completed\|missed\|skipped) |
| completed_by | UUID | FK → auth.users (CASCADE), nullable |
| completed_at | TIMESTAMPTZ | nullable |
| note | TEXT | nullable |
| created_at | TIMESTAMPTZ | default now() |
| | | UNIQUE(routine_item_id, date) |

**`invite_codes`** — Household invite system
| Column | Type | Constraints |
|--------|------|------------|
| id | UUID PK | gen_random_uuid() |
| puppy_id | UUID | FK → puppies (CASCADE), UNIQUE |
| code | TEXT NOT NULL | UNIQUE (format: WORD-ALPHANUMERIC) |
| created_by | UUID | FK → auth.users |
| created_at | TIMESTAMPTZ | default now() |

**`weight_logs`** — Weight tracking (F12)
| Column | Type | Constraints |
|--------|------|------------|
| id | UUID PK | gen_random_uuid() |
| puppy_id | UUID | FK → puppies (CASCADE) |
| weight_value | DECIMAL NOT NULL | CHECK (0 < weight ≤ 300) |
| weight_unit | TEXT NOT NULL | default 'lbs' |
| logged_at | DATE NOT NULL | default CURRENT_DATE |
| logged_by | UUID | FK → auth.users, nullable |
| note | TEXT | nullable, max 200 chars |
| is_onboarding | BOOLEAN NOT NULL | default false |
| created_at | TIMESTAMPTZ | default now() |
| updated_at | TIMESTAMPTZ | default now() |

#### Indexes

```sql
-- Membership lookups (critical for RLS)
idx_puppy_memberships_user_puppy    ON (user_id, puppy_id) WHERE active
idx_puppy_memberships_puppy_user    ON (puppy_id, user_id) WHERE active
idx_puppy_memberships_role          ON (puppy_id, role) WHERE active

-- Routine fetching
idx_routines_puppy_active           ON (puppy_id, is_active) WHERE is_active=true
idx_routines_puppy_generated        ON (puppy_id, generated_at DESC)

-- Routine items
idx_routine_items_routine           ON (routine_id, scheduled_time)
idx_routine_items_time              ON (scheduled_time) WHERE is_enabled=true

-- Activity logs (dashboard + progress)
idx_activity_logs_puppy_date        ON (puppy_id, date DESC)
idx_activity_logs_routine_item_date ON (routine_item_id, date)
idx_activity_logs_completed_by      ON (completed_by, puppy_id, date) WHERE completed_by NOT NULL
idx_activity_logs_date_range        ON (puppy_id, date, status)
idx_activity_logs_dashboard         ON (puppy_id, date, completed_by) WHERE completed_by NOT NULL

-- Invites
idx_invites_token                   ON (invite_token) WHERE status=pending
idx_invites_puppy_status            ON (puppy_id, status, created_at DESC)
idx_invites_expires                 ON (expires_at) WHERE status=pending

-- Weight logs
idx_weight_logs_puppy_date          ON (puppy_id, logged_at DESC)

-- Profiles
idx_profiles_id                     ON (id)
```

#### Storage Buckets

| Bucket | Access | Path Pattern |
|--------|--------|-------------|
| `puppy-photos` | Public read, authenticated write | `{userId}/{filename}` |
| `user-avatars` | Public read, authenticated write | `{userId}/avatar.{ext}` |

#### Realtime Publications

`supabase_realtime` publishes: `activity_logs`, `invites`, `profiles` (with REPLICA IDENTITY FULL for profiles)

### 2.2 Firebase Firestore

Three collections, all secured by `hasPuppyAccess(puppyId)` which checks `auth.token.puppyIds` Custom Claim.

**`editedRoutineItems/{docId}`** — Task edit overlays
- docId format: `{puppyId}_{routineItemId}_{YYYY-MM-DD}`
- Fields: puppyId, routineItemId, date, time, activityType, title, description, pottyDetails, durationMinutes, editedBy, editedAt

**`deletedRoutineItems/{docId}`** — Task deletion overlays
- docId format: `{puppyId}_{routineItemId}_{YYYY-MM-DD}`
- Fields: puppyId, routineItemId, date, deletedBy, deletedAt

**`tasks/{taskId}`** — User-added custom tasks
- Fields: puppyId, date, scheduledTime, actualTime, activityType, title, isCompleted, isEdited, isUserAdded, lastEditedBy, lastEditedAt, createdAt
- Validated on create: all required fields present, activityType in enum, lastEditedBy = auth.uid

---

## 3. Edge Functions (API Layer)

### 3.1 `POST /functions/v1/generate-routine`

**Purpose:** Two-layer AI routine generation — deterministic parameter computation + Claude schedule assembly.

**File:** `supabase/functions/generate-routine/index.ts` + `schedule-params.ts`

**Request:**
```typescript
{
  puppyId: string;
  questionnaireData: {
    puppyName: string;
    breed: string;
    dateOfBirth: string;       // YYYY-MM-DD
    weight: number | null;
    weightUnit: 'lbs' | 'kg';
    wakeUpTime: string;        // HH:MM
    bedTime: string;           // HH:MM
  };
  isRegeneration?: boolean;    // true = weekly regeneration (F14)
}
```

**Response:**
```typescript
{
  routine: {
    id: string;
    puppy_id: string;
    generated_at: string;
    is_active: true;
    valid_until: string;       // generated_at + 7 days
    generation_context: {
      age_bracket: string;
      age_weeks: number;
      completion_summary: Record<string, { completed: number; total: number }> | null;
      schedule_params: ScheduleParams;
    };
    routine_items: Array<{
      id: string;
      activity_type: string;
      title: string;
      description: null;         // D73: always null
      scheduled_time: string;    // HH:MM:SS
      duration_minutes: number | null;  // set for exercise/training/rest/play/bonding
      sort_order: number;
      is_enabled: true;
    }>;
  }
}
```

**Implementation flow:**
1. Verify auth header + user membership
2. Fetch puppy record (date_of_birth, breed_size, energy_level, is_brachycephalic)
3. If `isRegeneration`: acquire lock, aggregate past-week completion summary from activity_logs
4. `computeScheduleParams()` → all scheduling parameters (deterministic, no LLM)
5. Build system + user prompts (slim ~50 lines, includes pre-computed params)
6. Call Claude Sonnet 4.6 via tool_use (`generate_schedule`) → structured JSON
7. Validate response (10-50 activities, valid categories, HH:MM format)
8. Map each activity category to `duration_minutes` via `getDurationForActivity()`:
   - `exercise` → `walkDurationMinutes`
   - `training` → `trainingSessionMinutes`
   - `rest` → `napDurationMinutes`
   - `play` → `playSessionMinutes`
   - `bonding` → `calmBondingMinutes`
   - all others → `null`
9. Deactivate old routine, insert new routine + items
10. Set `valid_until = now + 7 days`, store `generation_context`
11. If `isRegeneration`: release lock on old routine

**Error handling:** 401 (no auth), 403 (not a member), 404 (no puppy), 500 (Claude failure)

#### `computeScheduleParams()` — Deterministic Parameter Engine

**File:** `supabase/functions/generate-routine/schedule-params.ts`

Pure TypeScript function. No network calls, no LLM. Takes breed profile + current age → returns every scheduling parameter.

**Input:** `DogProfile` — dateOfBirth, breedSize, energyLevel, isBrachycephalic, wakeUpTime, bedTime

**Output:** `ScheduleParams` — 20+ fields including:
- `ageBracket` (1 of 9 tiers: newborn 8-10w → young_adult 52+w)
- `pottyModel` (event_based for brackets 0-4, time_based for 5-8)
- `mealsPerDay` + pre-computed `mealTimes[]`
- `walkDurationMinutes`, `walkSessionsPerDay`
- `trainingSessionMinutes`, `trainingSessionsPerDay`
- `napDurationMinutes`, `napsPerDay`, `awakeWindowMinutes`
- `playSessionMinutes`, `playSessionsPerDay`
- `calmBondingMinutes`, `calmBondingSessions`

**Breed modifiers:**
- Brachycephalic: walk capped at 15 min
- Toy breeds: +1 meal in newborn/early_puppy (hypoglycemia)
- Giant breeds: stay at 3 meals in adolescent+ (bloat prevention)
- High energy: +25% play duration; Low energy: -17% play duration
- Young adult walk: resolved by energy level (52/37/20 min)

### 3.2 `POST /functions/v1/validate-invite-code`

**Purpose:** Caretaker join flow — validates invite code, creates membership.

**File:** `supabase/functions/validate-invite-code/index.ts`

**Request:** `{ code: string }`

**Response:**
```typescript
{
  success: true;
  puppy: { id, name, breed, ageDisplay, photoUrl };
  membership: { id, puppyId, userId, role: 'caretaker', status: 'active' };
}
```

**Flow:**
1. Verify auth, look up invite code (case-insensitive)
2. Check: user not already in household, caretaker limit (max 1 per puppy)
3. Create membership (uses service_role to bypass RLS — user isn't a member yet)
4. Return puppy details for UI

**Error handling:** 400 (missing code), 401 (not auth), 404 (code not found), 409 (duplicate/limit)

### 3.3 `POST /functions/v1/get-firebase-token`

**Purpose:** Mint Firebase Custom Token from Supabase JWT for Firestore access.

**File:** `supabase/functions/get-firebase-token/index.ts`

**Request:** (no body — auth via Authorization header)

**Response:** `{ firebaseToken: string }`

**Flow:**
1. Verify Supabase JWT via JWKS endpoint (ES256 asymmetric)
2. Query puppy_memberships for user's active puppyIds
3. Create Firebase Custom Token with `{ puppyIds: [...] }` claim
4. Return token (client calls `signInWithCustomToken()`)

---

## 4. Service Layer (Client-Side)

All services live in `src/lib/services/`. They wrap Supabase/Firebase operations for the React components.

| Service | File | Responsibility |
|---------|------|---------------|
| **auth** | `auth.ts` | Google OAuth sign-in (desktop + Capacitor), sign-out, profile CRUD, avatar upload, profile change subscriptions |
| **routines** | `routines.ts` | getActiveRoutine, saveRoutine, generateRoutineWithAI (calls Edge Function), toggleRoutineItem |
| **routine-evolution** | `routine-evolution.ts` | needsRegeneration, isRegenerationInProgress, clearStaleLock, triggerRegeneration, cleanupFirebaseOverlays (F14) |
| **activity-logs** | `activity-logs.ts` | getTodayLogs, completeActivity, skipActivity, undoActivity, real-time subscription, getLogsForDateRange |
| **puppies** | `puppies.ts` | createPuppy (+ owner membership + invite code), getUserPuppies, getPuppy, uploadPuppyPhoto, fetchBreedProfiles, computeAgeDisplay |
| **weight-logs** | `weight-logs.ts` | getWeightLogs, addWeightLog, updateWeightLog, deleteWeightLog, ensureOnboardingWeight |
| **invite-codes** | `invite-codes.ts` | createInviteCode, getInviteCode, validateInviteCode (calls Edge Function) |
| **edited-routine-items** | `edited-routine-items.ts` | Subscribe to / save edits in Firestore (time, activityType, pottyDetails, durationMinutes) |
| **deleted-routine-items** | `deleted-routine-items.ts` | Subscribe to / save deletions in Firestore |
| **tasks** | `tasks.ts` | Subscribe to / CRUD custom user-added tasks in Firestore |

---

## 5. Feature Implementation Status

### Status Legend
- ✅ **Complete** — Backend fully implemented and deployed
- ⚠️ **Needs verification** — Code exists but needs end-to-end testing
- 🔧 **Needs fix** — Known issue or gap identified
- ❌ **Not started** — No backend work done

### Feature Matrix

| Feature | Status | Backend Components | Notes |
|---------|--------|-------------------|-------|
| **F1: Onboarding** | ✅ | breed_profiles table (30 breeds seeded), puppies table with DOB + breed fields, createPuppy service | Breed dropdown loads from DB; fallback to cached list |
| **F2: Auth** | ✅ | Supabase Google OAuth, Firebase Custom Token bridge, Capacitor deep link handler | Dual auth working for both web and iOS |
| **F3: AI Routine Generation** | ⚠️ | generate-routine Edge Function, schedule-params.ts, getDurationForActivity() mapping | **Duration passthrough pipeline needs verification** — spec updated to require duration on all applicable AI-generated tasks. Code maps category→duration; need to confirm it reaches the dashboard. |
| **F4: Daily Routine View** | ✅ | getActiveRoutine, activity_logs subscription, editedRoutineItems/deletedRoutineItems subscriptions | Dashboard merges Supabase routine + Firebase overlays |
| **F5: Progress Tracking** | ✅ | activity_logs with date range queries, completion counts | Aggregation done client-side. No server-side ProgressSummary cache needed for v1. |
| **F6: Caretaker Invite** | ✅ | invite_codes table, createInviteCode in puppies service | Uses word-based codes (BISCUIT-7X2K) instead of deep link URLs — simpler, same UX |
| **F7: Caretaker Onboarding** | ✅ | validate-invite-code Edge Function, membership creation with service_role | Bypasses RLS since user isn't a member yet |
| **F8: Completion Attribution** | ✅ | completed_by on activity_logs, profile picture fetching, real-time profile subscriptions | Green dot overlay is CSS-only (frontend) |
| **F9: Profile Pictures** | ✅ | user-avatars storage bucket, uploadUserAvatar, Firebase Storage for custom photos | Google OAuth picture + custom upload supported |
| **F10: Task Management** | ✅ | editedRoutineItems + deletedRoutineItems + tasks Firestore collections, Firestore rules | Full CRUD with real-time sync, offline persistence |
| **F11: Potty Details** | ✅ | pottyDetails field in editedRoutineItems (Firebase), task card display | 💩/💦 toggles stored as `{ poop: bool, pee: bool }` |
| **F12: Weight Tracking** | ✅ | weight_logs Supabase table, full CRUD service, onboarding migration | Delete protected for is_onboarding entries via RLS |
| **F13: Activity Duration** | ⚠️ | duration_minutes on routine_items (Supabase), durationMinutes on editedRoutineItems (Firebase) | **Verify**: AI-generated durations display on dashboard at generation time. The `getDurationForActivity()` mapping exists in Edge Function; `legacyRoutine` conversion in App.tsx preserves `durationMinutes`. |
| **F14: Weekly Routine Evolution** | ⚠️ | valid_until + regeneration_status + generation_context columns, routine-evolution.ts service, Edge Function lock mechanism, completion aggregation | Migration deployed. **Needs end-to-end testing**: regeneration trigger, lock acquisition/release, completion summary in prompt, Firebase overlay cleanup. |

---

## 6. Remaining Backend Work

### 6.1 Priority 1: Verification & Bug Fixes

**Step 1: Verify AI-generated duration pipeline (F3 + F13)**
- Files: `supabase/functions/generate-routine/index.ts:442-467`, `src/app/App.tsx:510-525`, `src/app/components/Dashboard.tsx:38-45,160-164`
- Test: Generate a routine for a 10-week-old Golden Retriever. Confirm that walk, nap, play, training, and calm bonding tasks all have non-null `duration_minutes` in the database and display duration inline on dashboard cards.
- Expected: "3:00 PM · 15 min  Walk" not just "3:00 PM  Walk"
- Check: `getDurationForActivity()` maps all 5 applicable categories. `legacyRoutine` conversion preserves `durationMinutes`. Dashboard `formatDuration()` renders when `durationMinutes != null && durationMinutes > 0`.
→ Unblocks: confidence that F13 acceptance criteria are met

**Step 2: End-to-end test weekly regeneration (F14)**
- Test scenarios:
  1. Fresh routine (< 7 days old): no regeneration triggers
  2. Expired routine (> 7 days): regeneration triggers, banner shows, new routine appears
  3. Null `valid_until` (legacy): treated as expired, regeneration triggers
  4. Concurrent dashboard loads: only one regeneration proceeds (lock deduplication)
  5. Lock stale > 5 min: lock is cleared, regeneration retries
  6. Age bracket transition: puppy crosses bracket boundary → new parameters used
  7. Completion context: low-completion categories appear in Claude prompt
  8. Failure: old routine stays active, no error shown, lock released
  9. Firebase overlay cleanup: old edits/deletes removed, custom tasks preserved
- Files: `src/lib/services/routine-evolution.ts`, `supabase/functions/generate-routine/index.ts`, `src/app/App.tsx` (dashboard useEffect)
→ Unblocks: confidence that F14 works in production

**Step 3: Verify duration pre-selection in edit bottom sheet (F13)**
- When user taps an AI-generated walk/nap/play/training/calm task to edit, the Duration section in the bottom sheet should pre-select the correct chip (or show the custom value).
- Files: `src/app/components/TaskManagementDashboard.tsx` (or TaskCard)
- Check: edit bottom sheet receives `durationMinutes` from the task data and maps to the correct preset chip.
→ Unblocks: F13 acceptance criteria for edit pre-selection

### 6.2 Priority 2: Production Hardening

**Step 4: RLS policy audit**
- Recent migration `20260601000001_tighten_profiles_select.sql` restricted profiles SELECT. Verify:
  - Users can still read co-member profiles (needed for completion attribution)
  - Users cannot read profiles of unrelated users
  - All tables pass RLS smoke test with multiple accounts
- Run through the app as: owner, caretaker, and unrelated user
→ Unblocks: security confidence

**Step 5: Edge Function error handling review**
- Verify all three Edge Functions handle edge cases:
  - `generate-routine`: Claude API timeout, malformed response, puppyId not found, empty breed fields
  - `validate-invite-code`: invalid code format, already-used code, caretaker limit exceeded
  - `get-firebase-token`: expired Supabase JWT, JWKS fetch failure
- Ensure no unhandled promise rejections or 500s with leaked stack traces
→ Unblocks: production reliability

**Step 6: Firebase token refresh on membership changes**
- When a caretaker joins (new puppyId added), the Firebase Custom Token must be refreshed to include the new puppyId in claims
- Verify: after invite acceptance, `signInToFirebase()` is called to refresh token
- File: `src/app/App.tsx` (handleInviteSuccess)
→ Unblocks: caretaker real-time sync working immediately after join

### 6.3 Priority 3: Deployment

**Step 7: Production deployment checklist**
- [ ] All Supabase migrations applied to production
- [ ] Edge Functions deployed: `supabase functions deploy generate-routine validate-invite-code get-firebase-token`
- [ ] Supabase secrets set: `ANTHROPIC_API_KEY`, `FIREBASE_SERVICE_ACCOUNT`, `FIREBASE_API_KEY`
- [ ] Firebase Firestore rules deployed: `firebase deploy --only firestore:rules`
- [ ] Environment variables set in Vercel/hosting: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_FIREBASE_*`
- [ ] PostHog configured for production
- [ ] Storage buckets have correct CORS and access policies
- [ ] Test full flow with fresh account: sign in → onboarding → routine generation → task editing → invite → caretaker join
- [ ] Monitor: Supabase logs, Anthropic usage dashboard, Firebase console

---

## 7. Security

### 7.1 Authentication

| Concern | Mitigation |
|---------|-----------|
| JWT validation | Edge Functions verify Supabase JWT; get-firebase-token uses JWKS (ES256 asymmetric) |
| Token refresh | Supabase auto-refreshes; Firebase token refreshed on membership changes |
| API key exposure | ANTHROPIC_API_KEY stored in Supabase secrets, never in client code |
| Firebase service account | Stored as Supabase secret, accessed only in get-firebase-token Edge Function |

### 7.2 Authorization (RLS)

| Table | Owner | Caretaker | Unauthenticated |
|-------|-------|-----------|-----------------|
| profiles | Read own + co-members, Update own | Read co-members | None |
| puppies | CRUD (own puppies) | Read only | None |
| puppy_memberships | Read all for own puppies, Insert | Read own | None |
| routines | Read + Create + Update | Read only | None |
| routine_items | Read + Create + Update | Read only | None |
| activity_logs | Read + Insert + Update own | Read + Insert + Update own | None |
| invite_codes | Read + Insert | None (joins via Edge Function) | None |
| breed_profiles | Read | Read | None |
| weight_logs | Full CRUD (delete blocked for is_onboarding) | Full CRUD (same) | None |

### 7.3 Firestore Security

- All collections gated by `hasPuppyAccess(puppyId)` which checks `auth.token.puppyIds` Custom Claim
- Write validation on `tasks` collection enforces required fields and `lastEditedBy = auth.uid`
- No admin/public access rules

### 7.4 Input Validation

- Edge Functions validate request bodies (auth check, UUID format, required fields)
- Breed names validated against `breed_profiles` table (not hardcoded)
- DOB validation: not future, puppy must be ≥ 8 weeks old
- Weight validation: > 0, ≤ 300 lbs / 136 kg
- Notes: max 200 characters
- LLM output: validated structure (10-50 activities, valid categories, HH:MM times)

---

## 8. Performance

### 8.1 Database Query Optimization

| Query | Index Used | Target Latency |
|-------|-----------|---------------|
| Dashboard: get active routine + items | `idx_routines_puppy_active` + `idx_routine_items_routine` | < 200ms |
| Dashboard: today's activity logs | `idx_activity_logs_dashboard` | < 100ms |
| Progress: date range logs | `idx_activity_logs_date_range` | < 200ms |
| Weight history | `idx_weight_logs_puppy_date` | < 100ms |
| Membership check (RLS) | `idx_puppy_memberships_user_puppy` | < 10ms |

### 8.2 AI Generation Performance

| Metric | Target |
|--------|--------|
| `computeScheduleParams()` | < 1ms (pure computation) |
| Claude API call | < 8 seconds |
| Total routine generation | < 10 seconds |
| Weekly regeneration (with completion query) | < 12 seconds |

### 8.3 Real-Time Sync

| Channel | Technology | Latency Target |
|---------|-----------|---------------|
| Task edits/deletions | Firestore real-time | < 3 seconds |
| Activity completions | Supabase Realtime (postgres_changes) | < 5 seconds |
| Profile picture updates | Supabase Realtime (profiles) | < 5 seconds |

---

## 9. Cost Projections

### Monthly Costs (1,000 Active Users)

| Service | Usage | Cost |
|---------|-------|------|
| Supabase Pro | 8GB DB, 50GB storage, 2M Edge Function invocations | $25/mo |
| Anthropic Claude API | 1,000 onboarding + ~4,000 weekly regenerations (~2K tokens/gen) | $60-80/mo |
| Firebase Firestore | 50K reads/day + 20K writes/day (free tier) | $0 |
| Vercel | Hobby plan (100GB bandwidth) | $0 |
| PostHog | Free tier (1M events/mo) | $0 |
| **Total** | | **~$85-105/mo** |

### Scaling (10K Users)
- Supabase: Team plan ($599/mo)
- Claude API: ~$600-800/mo
- Firestore: ~$25/mo (exceeds free tier)
- **Total:** ~$1,225-1,425/mo

---

## 10. Migrations Log

| Migration | Date | Purpose |
|-----------|------|---------|
| `001_initial_schema.sql` | 2026-02-01 | Core tables: profiles, puppies, puppy_memberships, routines, routine_items, activity_logs, invites |
| `002_fix_rls_recursion.sql` | 2026-02-01 | Fix recursive RLS policy on puppy_memberships |
| `003_fix_insert_policies.sql` | 2026-02-01 | Fix INSERT policies for authenticated users |
| `004_nuclear_rls_fix.sql` | 2026-02-01 | Comprehensive RLS rewrite with SECURITY DEFINER helpers |
| `005_definitive_rls_fix.sql` | 2026-02-01 | Final RLS policy set |
| `006_fix_user_deletion.sql` | 2026-02-01 | Fix CASCADE on user deletion |
| `20260101000005_fix_insert_for_anon.sql` | 2026-02-01 | Fix anon insert policy |
| `20260211000001_rls_policies.sql` | 2026-02-11 | Production RLS policies |
| `20260211000002_indexes.sql` | 2026-02-11 | Performance indexes for all tables |
| `20260217000001_user_avatars_storage_rls.sql` | 2026-02-17 | Storage bucket RLS for user avatars |
| `20260217000002_profiles_realtime.sql` | 2026-02-17 | Enable Realtime for profiles |
| `20260302000001_drop_living_situation.sql` | 2026-03-02 | Remove unused column |
| `20260302000001_weight_logs.sql` | 2026-03-02 | Weight tracking table (F12) |
| `20260302000002_invite_codes.sql` | 2026-03-02 | Invite codes table |
| `20260525000001_breed_profiles.sql` | 2026-05-25 | Breed profiles reference table + 30 breeds seed (D68) |
| `20260525000002_puppy_dob_fields.sql` | 2026-05-25 | Add DOB + breed fields to puppies (D69, D72) |
| `20260525000003_backfill_existing.sql` | 2026-05-25 | Backfill DOB + breed fields for existing puppies |
| `20260601000001_tighten_profiles_select.sql` | 2026-06-01 | Restrict profiles SELECT to co-members only |
| `20260605000001_add_routine_evolution_columns.sql` | 2026-06-05 | Add valid_until, regeneration_status, generation_context to routines (F14) |

---

## 11. Key Technical Decisions

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| D68 | Breed data source | `breed_profiles` Supabase table | Single source of truth, seed-only, queryable for onboarding dropdown |
| D69 | Age tracking | `date_of_birth` (replaces age_months/age_weeks) | Enables automatic age progression — routine adapts as puppy grows |
| D70 | Parameter computation | Deterministic TypeScript function | All scheduling math happens server-side without LLM — consistent, testable, auditable |
| D71 | LLM role | Schedule assembly only | LLM receives pre-computed params (~50 lines) and arranges activities into a timeline. No breed classification, no arithmetic. |
| D72 | Breed fields on puppy | Denormalized (copied from breed_profiles at creation) | Edge Function reads puppy record directly — no JOIN needed |
| D73 | Task descriptions | Always null | No LLM-generated commentary or coaching advice in task descriptions |
| Hybrid | Backend architecture | Supabase + Firebase | Supabase for relational data, Firebase for real-time task sync with offline persistence |
| Codes | Invite mechanism | Word-based codes (BISCUIT-7X2K) | Simpler than deep links, works across platforms, easy to share verbally |
| Lock | Regeneration dedup | `regeneration_status` column | Conditional UPDATE prevents duplicate Claude API calls |
| Lazy | Regeneration trigger | Client-side check on dashboard load | Zero cost for inactive users, no cron infrastructure needed |

---

## 12. File Map

```
supabase/
├── functions/
│   ├── generate-routine/
│   │   ├── index.ts              ← Edge Function: AI routine generation (410 lines)
│   │   └── schedule-params.ts    ← Deterministic parameter engine (310 lines)
│   ├── validate-invite-code/
│   │   └── index.ts              ← Edge Function: caretaker invite validation (174 lines)
│   └── get-firebase-token/
│       └── index.ts              ← Edge Function: Firebase Custom Token minting (124 lines)
├── migrations/                   ← 19 SQL migrations (see Section 10)
└── .temp/linked-project.json

src/lib/
├── supabase.ts                   ← Supabase client initialization
├── firebase.ts                   ← Firebase client + signInToFirebase()
├── posthog.ts                    ← PostHog analytics
├── database.types.ts             ← Supabase-generated TypeScript types
└── services/
    ├── auth.ts                   ← Google OAuth, profile CRUD, avatar upload
    ├── routines.ts               ← Routine fetching + AI generation
    ├── routine-evolution.ts      ← Weekly regeneration (F14)
    ├── activity-logs.ts          ← Task completion tracking + real-time
    ├── puppies.ts                ← Puppy CRUD + breed profiles
    ├── weight-logs.ts            ← Weight tracking (F12)
    ├── invite-codes.ts           ← Invite code generation + validation
    ├── edited-routine-items.ts   ← Firebase: task edit overlays
    ├── deleted-routine-items.ts  ← Firebase: task deletion overlays
    ├── tasks.ts                  ← Firebase: custom user-added tasks
    └── index.ts                  ← Service exports

firebase/
├── firestore.rules               ← Firestore security rules (72 lines)
└── firestore.indexes.json

src/app/
├── App.tsx                       ← Main app: routing, auth flow, data loading (500+ lines)
└── components/
    ├── Dashboard.tsx             ← Routine display, duration formatting, progress card
    ├── TaskManagementDashboard.tsx ← Edit/add/delete task bottom sheets
    ├── OnboardingQuestionnaire.tsx ← 3-step onboarding form
    ├── AIRoutineGenerator.tsx    ← Calls Edge Function, handles fallback
    ├── Settings.tsx              ← Puppy profile, caretakers, profile photo
    ├── WeightHistory.tsx         ← Growth chart + weight log list
    └── ...
```

---

## 13. Post-v1 Backend Roadmap

### P1 (Needed Soon After Launch)
| Feature | Backend Work | Complexity |
|---------|-------------|-----------|
| Push notifications | Expo Push API integration, cron Edge Function for daily wake-up reminder | Medium |
| Multi-puppy support | UI only — backend already supports multiple puppy_memberships per user | Low |
| Custom activity types | Add `custom_activity_types` table, update Firestore validation | Medium |
| Task edit version history | Add `task_edit_history` Firestore subcollection | Low |

### P2 (Future)
| Feature | Backend Work | Complexity |
|---------|-------------|-----------|
| Breed-specific growth curves | Seed reference data per breed, serve via API | Medium |
| Weight-based routine regeneration | Trigger regeneration when weight changes > 20% | Low |
| Potty analytics | Server-side aggregation of pottyDetails data | Medium |
| Duration analytics | Average nap/walk/training time per week | Low |
| Social features | New Supabase tables + Realtime channels | High |

---

*This document reflects the actual codebase as of 2026-06-05. All technical decisions have been implemented unless marked otherwise in Section 5.*
