# PupPlan - Technical Decisions Log

## Stage Assessment: 0→1

This is a greenfield product with a **web app prototype** as the initial platform to validate product-market fit. An **iOS app** will follow once we prove the concept with real users. Priority is to ship fast, validate the idea, and avoid over-engineering. Every decision below optimizes for speed-to-launch while keeping the architecture clean enough to scale and port to iOS.

**Current Platform:** Web app (Vite + React + TypeScript + Supabase)
**Future Platform:** iOS app (Swift + SwiftUI, shares Supabase backend)

---

## Decisions Made

| # | Decision | Choice | Rationale |
|---|---|---|---|
| **BACKEND (Shared across Web + iOS)** ||||
| D1 | Backend Platform | **Supabase** (Postgres + Auth + Realtime + Edge Functions + Storage) | Our data model is relational (users, puppies, memberships, routines, activity logs). Postgres is the natural fit. Supabase gives us Auth (Google OAuth), Realtime subscriptions (for cross-user activity sync), Row Level Security (permission enforcement), Edge Functions (server-side AI calls), and Storage (photos) — all in one platform. Firebase's NoSQL model would fight our relational data. A custom backend would take 3-4x longer to ship. Works identically for web and future iOS app. |
| D2 | Authentication | **Google Sign-In only** | Single auth method. Simplifies the welcome screen to one button, eliminates email/password management, password reset flows, and email verification. Google OAuth works across web and mobile, most users already have a Google account. Supabase has built-in Google OAuth support. No Apple Sign-In, no Email/Password in v1. **Web:** Uses `supabase.auth.signInWithOAuth()`. **iOS (future):** Will use Supabase Swift SDK with same OAuth flow. |
| D3 | AI Provider | **Anthropic Claude API (claude-sonnet-4-5-20250929)** | Routine generation happens once per puppy (not per session), so cost per user is ~$0.01-0.03. Quality matters more than cost here — a bad routine recommendation could harm a puppy's development. Claude's instruction-following is excellent for structured JSON output (our routine schema). Called server-side via Supabase Edge Function to protect the API key. |
| D4 | Routine Editing (v1) | **Time adjustment + toggle on/off only** | If AI generates a 6:30 AM wake-up but the owner wakes at 7:00, they need to adjust. Allow: tap to change activity time, toggle activities on/off (hide unwanted ones). Do NOT allow creating custom activities in v1 — that's P1. Keeps the UI simple. |
| D5 | Multi-Role Support | **Yes — one user can be owner for Puppy A and caretaker for Puppy B** | Data model supports this via PuppyMembership table. Common real-world scenario. App shows a puppy switcher when user has access to multiple puppies. |
| D6 | Image Storage | **Supabase Storage** | Puppy photos and profile pictures uploaded to Supabase Storage buckets. Keeps all data in one platform. **Web:** Uses `supabase.storage.upload()` via JavaScript SDK. **iOS (future):** Will use Swift SDK for same storage buckets. |
| D7 | Monetization | **Free in v1. No paywall, no IAP.** | Get users hooked on the value first. Validate product-market fit. Monetize in v1.1+ with a freemium model (premium unlocks: multiple puppies, more caretakers, advanced analytics, push reminders). |
| D8 | Invite Delivery | **Link-based (no in-app messaging integration)** | Per product requirements. Owner generates link, shares via platform share mechanism. **Web:** Native `navigator.share()` or copy-to-clipboard. **iOS (future):** UIActivityViewController. No in-app messaging needed — users already use iMessage/WhatsApp. |
| D9 | Max Caretakers (v1) | **1 per puppy** | Per product requirements. Simplifies permissions model. PuppyMembership table supports expansion to N caretakers later. |
| **WEB APP (Current Platform)** ||||
| D10 | Web Stack | **Vite + React + TypeScript** | Vite: Zero-config, fast dev server, fast builds. React: Widely adopted, mature ecosystem, easy to hire for. TypeScript: Type safety prevents bugs, better DX with autocomplete. No frameworks like Next.js in 0→1 — keep it simple. |
| D11 | Styling System | **Tailwind CSS v4** with `@theme` CSS variables | Utility-first CSS. Fast to write, no context switching between CSS files. v4 uses CSS variables for design tokens (colors, spacing) for consistency. **shadcn/ui components** written inline (not via CLI, since no Node.js installed locally). Radix UI primitives for accessibility. |
| D12 | Routing | **State-based routing** (screen enum in App.tsx) | No react-router for 0→1. Simple enum (`"welcome" | "questionnaire" | "dashboard" | "settings"`) in state controls which screen renders. Fewer dependencies, easier to debug. Will migrate to react-router when we add multi-page flows (P1). |
| D13 | State Management | **React useState + useEffect** (no Redux, no Zustand) | Component-local state is sufficient for MVP. User state managed in App.tsx, passed down via props. Supabase handles real-time sync (no need for complex state management). Will add Zustand if state complexity grows. |
| D14 | Offline Support | **IndexedDB via Supabase SDK** | Supabase JavaScript SDK handles offline queuing for mutations. Activity completions are queued locally if offline, synced when connection returns. No custom offline layer needed. |
| D15 | Breed Data | **Static JSON array in codebase** | AKC breed list (~200 breeds) stored as a TypeScript const array. No API call needed for breed autocomplete. Fast, offline-capable, and the list rarely changes. **iOS (future):** Will bundle same JSON in app. |
| D16 | Profile Picture Fallback | **Google OAuth avatar (primary) + Initials avatar (fallback)** | Google OAuth automatically captures `avatar_url` via Supabase database trigger (`handle_new_user()`). No custom upload in v1 (P1 feature). If avatar missing/broken, show initials on colored circle (first letter of display name, consistent color via string hash). Ensures all users have visual attribution. |
| D17 | Completion Attribution UI | **Profile picture replaces checkbox** (not adjacent) | When task is marked complete, the checkbox is replaced by completer's profile picture with green dot indicator (#4a9b5e, 6px diameter) at top-right corner. Stronger social signal than text labels. Users scan timeline and instantly see who did what (visual pattern of faces). Green dot provides universal completion signaling. **Implementation:** `CompletionAvatar` component, CSS overlay for green dot, 24px avatar size (mobile), lazy-load with initials fallback. |
| D18 | Real-time Profile Data | **SQL join on load, separate fetch on real-time update** | `getTodayLogs()` joins `activity_logs` with `profiles` table (one query gets both). Supabase Realtime doesn't support joins, so when activity updates arrive via WebSocket, we fetch completer's profile separately (extra query). Acceptable trade-off for 0→1 — keeps code simple. **iOS (future):** Same strategy with Swift SDK. |
| **iOS APP (Future Platform)** ||||
| D19 | iOS Platform | **iOS only (iPhone), minimum iOS 17** | Once we validate product-market fit with web app, iOS will be the primary mobile experience. iOS 17 (not 16) for native SwiftData, improved SwiftUI navigation, better async/await patterns. iOS 17 adoption is >85% of active devices as of early 2025. |
| D20 | iOS Stack | **Swift + SwiftUI** | Native iOS development. SwiftUI for all UI (no UIKit bridging unless absolutely necessary). Swift concurrency (async/await) for all network calls. Supabase Swift SDK for backend communication. |
| D21 | iOS Local Persistence | **SwiftData** | Apple's native persistence framework (successor to Core Data). Simpler API, works seamlessly with SwiftUI, supports offline-first pattern. Stores routine and activity data locally so the app works without network. |
| D22 | iOS Deep Linking | **Apple Universal Links + Supabase token management** | Invite links use Universal Links format (`https://pupplan.app/invite/{token}`). For deferred deep linking (user doesn't have app installed → App Store → install → invite auto-applied), we store the invite token in the clipboard or use `NSUserActivity` continuation. No third-party deep linking SDK in v1 — keep it simple. |
| **FLOW 6: TASK MANAGEMENT (Edit, Delete, Add Tasks)** ||||
| D23 | Real-Time Sync Backend | **Firebase Firestore** (hybrid with Supabase) | Task editing requires <3-second cross-device sync with offline-first architecture. Firestore provides built-in real-time listeners, automatic offline persistence (IndexedDB), and optimistic updates out-of-the-box. Supabase Realtime requires manual offline queuing and doesn't handle optimistic UI as cleanly. **Hybrid approach:** Supabase for structured data (users, puppies, routines), Firestore exclusively for `tasks` collection (daily task instances). Firebase Auth uses same Google OAuth token via Custom Token generation. Trade-off: Two backends increases complexity, but Firestore's real-time capabilities are significantly better for collaborative editing. |
| D24 | Conflict Resolution Strategy | **Last-write-wins** (server timestamp) | When Sarah and Mike both edit same task while offline, whoever's edit reaches Firestore server last wins (based on `last_edited_at` server timestamp). No UI for conflict resolution in v1 — conflicts are rare (requires simultaneous offline edits of same task). Firestore's server timestamp ensures deterministic resolution. Alternative (operational transforms) is over-engineering for 0→1. P1: Add toast notification "Mike edited this task after you" for visibility. |
| D25 | Optimistic UI Updates | **Client-first with background sync** | When user edits task, UI updates instantly (< 100ms), change writes to Firestore in background. User sees immediate feedback, no loading spinners. If write fails (network error), revert UI and show error banner. Firestore SDK handles retry logic automatically. This pattern is critical for mobile UX — perceived performance matters more than actual sync latency. |
| D26 | Swipe-to-Delete Gesture | **react-swipeable library** | Mobile users expect swipe-to-delete (iOS Mail pattern). `react-swipeable` provides cross-browser touch/mouse event handling with configurable swipe threshold (60px minimum to prevent accidental triggers). Swipe LEFT reveals red "Delete" button, tap to confirm. Long-press (500ms) shows context menu for accessibility (users who can't swipe). No custom gesture code — use battle-tested library. |
| D27 | Activity Types (v1) | **Pre-defined enum only** | Task activity dropdown shows 7 fixed options: Potty Break, Meal, Training, Nap, Calm Time, Play Time, Walk. No custom activity creation in v1 — keeps UI simple, ensures consistency across users, prevents data pollution. P1: Add "Other" with text input for edge cases. Stored as enum in Firestore for type safety and analytics queries. |
| D28 | Multi-Day Task Editing | **Today only** (no past/future editing) | User can only edit tasks for current date (`date === today`). Prevents confusion ("did I edit yesterday or today?"), simplifies sync logic, avoids historical data corruption. P1: Enable editing past 7 days for corrections ("forgot to log yesterday's walk"). Future days: not editable (routine regeneration handles that). |
| D29 | Task Management Permissions | **Equal for owner + caretaker** | Both primary owner and caretaker can edit task times, change activity types, delete tasks, and add new tasks. No permission differentiation in v1 — household members are trusted collaborators. Firestore security rules check `puppyId` membership (owner OR caretaker), no role-based restrictions. P1: Add granular permissions (view-only caretaker role) if customers request it. |
| D30 | Real-Time Sync Target | **3 seconds** (WebSocket latency) | When Sarah edits task, Mike's device updates within 3 seconds. Firestore real-time listeners use WebSocket (low-latency persistent connection). Acceptable delay for asynchronous collaboration — not chat-app-instant, but fast enough to prevent conflicts. Benchmarked at ~500ms-2s on good networks, up to 5s on slow mobile. Banner shows "Syncing..." during updates for transparency. |
| D31 | Network Status UI | **Top banner with 4 states** | Persistent banner across app shows connectivity state: (1) **Connected:** No banner or "✓ Synced" auto-dismisses after 1s, (2) **Offline:** Yellow banner "⚠️ You're offline. Changes will sync when connected." (persistent), (3) **Syncing:** Blue banner "⏳ Syncing changes..." (brief, < 2s), (4) **Failed:** Red banner "❌ Couldn't sync. [Retry]" (persistent until retry succeeds). Uses Firestore connection state listener (`onSnapshot` error handling). Critical for user trust — they must know when edits are/aren't synced. |
| D32 | Firestore Data Model | **Flat collection: `tasks/{taskId}`** | Each task is a top-level document in Firestore `tasks` collection. Query pattern: `tasks` where `puppyId == current` AND `date == today`. Flat structure (not nested under `puppies/{puppyId}/tasks`) enables atomic cross-puppy queries and simpler security rules. Task document includes: `puppyId` (FK), `scheduledTime` (original AI time), `actualTime` (user-edited), `activityType` (enum), `isEdited`, `isUserAdded`, `isCompleted`, `completedBy`, `lastEditedBy`, `lastEditedAt` (server timestamp), `date` (YYYY-MM-DD). |
| D33 | Offline Queue Strategy | **Firestore built-in persistence** | Firestore SDK automatically queues writes when offline (uses IndexedDB under the hood). No custom offline queue needed. On reconnect, Firestore flushes queue to server in order. If write fails (permission denied, validation error), SDK fires error callback — we show error banner. This is **significantly simpler** than building custom offline logic with Supabase. |
| D34 | Firebase Auth Integration | **Custom Token from Supabase** | User authenticates with Google via Supabase (existing flow). Backend generates Firebase Custom Token using Supabase user UID, exchanges it for Firebase Auth session. Client uses Firebase Auth token for Firestore security rules. One Google sign-in, two backends. Supabase Edge Function handles token generation (`getFirebaseToken()`). Slightly complex setup but keeps single sign-in UX. Alternative (dual OAuth) confuses users. |
| D45 | Custom Task Edit UX | **Reuse "Add Custom Task" bottom sheet in edit mode** (no inline card expansion) | When user taps a custom (user-added) task, the app opens the same bottom sheet modal used by the FAB "Add New Task" flow — pre-populated with the task's existing time and activity type. Title changes to "Edit Task", button reads "Save Changes", and save updates the existing task instead of creating a new one. **Removes inline expandable card for custom tasks entirely.** Rationale: (1) Consistent UX — create and edit use the same interface, reducing cognitive load. (2) The bottom sheet's emoji-labeled activity grid is more spacious and touch-friendly than the cramped inline card with its HTML time input and dropdown. (3) Simpler component architecture — `AddTaskFAB` accepts an optional `editTask` prop to switch between add/edit modes, eliminating the `TaskCard` inline expansion code. Trade-off: Extra modal overlay on edit vs. in-place editing, but the UX consistency outweighs the minor interaction cost. Documented in user-flows.md (Flow 6A) and product-spec.md (F10). |
| **UNIVERSAL TAP-TO-EDIT + NOTES FIELD (F10 Extension)** ||||
| D46 | Universal Tap-to-Edit | **ALL task types (AI-generated + custom) open the same Edit Task bottom sheet** | Previously only custom tasks supported tap-to-edit (D45). Now AI-generated routine items also open the bottom sheet when tapped on the card body. Tapping the status icon (circle/avatar) on the right side still toggles completion via `e.stopPropagation()`. Rationale: (1) Users expect all cards to behave identically — having some tappable and others not is confusing. (2) AI-generated tasks need editing even more than custom tasks (puppies deviate from AI schedules constantly). (3) Eliminates the mental model distinction between "AI cards" and "custom cards" — they all behave the same. Implementation: Dashboard.tsx routine card `<div>` gets `onClick` handler + `cursor-pointer active:scale-[0.98]` classes. Documented in user-flows.md (Flow 6A, Scenario 2) and product-spec.md (F10 Section 1). |
| D47 | Notes Field in Bottom Sheet | **Multiline textarea below Activity Type grid, 200-char max, auto-grows to 3 lines** | Added a "Notes" field to the AddTaskFAB bottom sheet (both Add and Edit modes). For AI-generated tasks: pre-populated with the AI description (e.g., "Take outside 15-30 minutes after eating"). For custom tasks: empty unless user previously saved a note. For new tasks via FAB: empty with placeholder "Add a note...". Auto-grows up to 3 lines (72px), then scrolls. Max 200 characters with live character counter. Optional field — saving with empty notes is valid. Rationale: (1) AI descriptions are valuable guidance but users need to customize them. (2) Users want to log context ("accident near the back door") without a separate notes app. (3) 200-char limit keeps notes concise and prevents the field from dominating the bottom sheet. Implementation: `useRef` + `useEffect` for auto-resize, `maxLength={200}`, `overflow-y-auto` after max height. |
| D48 | Routine Item Edit Persistence | **Firebase `editedRoutineItems` collection (overlay pattern)** | AI-generated routine items live in Supabase (`routine_items` table) and are read-only from the client. When a user edits an AI routine item's time, activity, or notes, the override is stored in a new Firestore collection `editedRoutineItems/{docId}`. This mirrors the established pattern used by `deletedRoutineItems` (which persists routine item deletions in Firebase). Deterministic doc ID: `{puppyId}_{routineItemId}_{date}` enables upsert via `setDoc()`. Dashboard subscribes to both collections and applies edits as an overlay before rendering. Rationale: (1) Cannot write back to Supabase `routine_items` from the client (read-only). (2) Consistent with existing deletion overlay pattern — proven architecture. (3) Keeps all user-generated edits in Firebase (single real-time sync layer). (4) Deterministic doc ID means repeated edits to the same item overwrite cleanly (no duplicate documents). Trade-off: Another Firestore collection adds to the hybrid backend complexity, but follows established patterns and keeps the data layer predictable. |
| D49 | Discriminated Union for Editing State | **`EditingItem = EditingRoutineItem \| EditingCustomTask`** | The bottom sheet needs to handle two fundamentally different data sources: custom tasks (Firebase `Task` objects with Firestore doc IDs) and AI routine items (Supabase data with routine item IDs). A TypeScript discriminated union (`type: 'routine' | 'custom'`) cleanly separates the two paths. Dashboard sets `editingItem` state; AddTaskFAB switches behavior based on `editingItem.type`. On save: custom tasks call `editTask()`, routine items call `saveRoutineItemEdit()`. Rationale: (1) Type-safe — TypeScript narrows the type in each branch, preventing accidental field access. (2) Single state variable in Dashboard (replaces old `editingTask: Task \| null`). (3) AddTaskFAB becomes a tri-mode component: Add Custom / Edit Custom / Edit Routine. |
| D50 | Category-to-Activity Mapping | **Static `CATEGORY_TO_ACTIVITY` map in AddTaskFAB** | Supabase routine items use categories like `feeding`, `potty`, `exercise`, `play`, `training`, `rest`, `bonding`, `sleep`. Firebase tasks use activity types like `meal`, `potty_break`, `walk`, `play_time`, `training`, `nap`, `calm_time`. When editing a routine item, the category must be mapped to the closest activity type for the emoji grid pre-selection. Mapping: `feeding→meal`, `potty→potty_break`, `exercise→walk`, `play→play_time`, `training→training`, `rest→nap`, `bonding→calm_time`, `sleep→nap`. Default fallback: `nap`. Rationale: (1) Static map is simple, fast, and type-safe. (2) Mapping lives in AddTaskFAB where it's consumed — no unnecessary abstraction. (3) Covers all known Supabase categories. If new categories are added in the AI routine generator, the fallback ensures graceful degradation. |
| D51 | Description Field Handling | **`!== undefined` check (not truthy)** for description updates | Both `editTask()` and `addTask()` in `tasks.ts` use `updates.description !== undefined` instead of a truthy check. This intentional pattern allows users to clear notes by setting description to an empty string `""`. A truthy check (`if (updates.description)`) would treat `""` as falsy and skip the update, making it impossible to remove notes from a task. Same pattern applied in the Firestore `addDoc()` call for new tasks. |
| **POTTY DETAILS — POOP & PEE TRACKING (F11 / Flow 6H)** ||||
| D52 | Potty Details Data Model | **Optional `pottyDetails?: { poop: boolean; pee: boolean }` field on Task and RoutineItemEdit** | Two independent booleans rather than a single enum or string. Rationale: (1) Poop and pee are not mutually exclusive — a puppy can do both in one trip. An enum (`'poop' | 'pee' | 'both' | 'none'`) is clunky and grows combinatorially if more detail types are added later. (2) Booleans are the most compact Firestore representation and cheapest to query. (3) The field is optional (`?`) — omitted entirely for non-potty tasks, rather than stored as `{ poop: false, pee: false }`. This keeps Firestore documents lean (D32). (4) Added to both the `Task` interface (custom tasks) and the `RoutineItemEdit` data shape (AI-generated tasks edited via the overlay pattern, D48). No migration needed — existing tasks simply lack the field, which is handled as "no details selected." |
| D53 | Conditional Details UI | **Activity-type-gated section in AddTaskFAB bottom sheet** | The "Details" section (containing 💩/💦 toggles) renders conditionally based on `selectedActivity === 'potty_break'`. Position: between the Activity Type grid and the Notes textarea. Rationale: (1) Only Potty tasks need structured detail input — showing it for all activity types would confuse users. (2) Conditional rendering (not hidden with CSS) means the DOM is clean and screen readers don't encounter irrelevant content. (3) When the user switches activity type away from Potty, the Details section unmounts and `pottyDetails` state resets to `{ poop: false, pee: false }`. On save, if `activityType !== 'potty_break'`, the `pottyDetails` field is omitted from the Firestore write entirely (not set to null). (4) Uses the same bottom sheet layout flow as Notes (D47) — no new layout patterns introduced. |
| D54 | Emoji Toggle Interaction | **Independent toggle buttons (not checkboxes, not radio buttons)** | Each emoji (💩, 💦) is a standalone tappable button that toggles between selected and unselected states. Rationale: (1) Emoji toggles are faster than checkboxes for a 2-option binary choice — one tap, no label reading required. (2) Visual states: unselected = reduced opacity + no border, selected = full opacity + highlighted border/background. This matches the existing Activity Type grid's visual language (emoji + label in a tappable cell). (3) Not radio buttons because both can be active simultaneously. (4) Not checkboxes because the emoji IS the affordance — a checkbox next to an emoji adds visual noise. (5) Touch target: each toggle button is at least 44×44px (accessibility minimum). (6) Neither toggle is required — saving with both unselected is valid (e.g., user records a potty trip attempt where nothing happened). |
| D55 | Activity Type Label Rename Scope | **"Potty" in grid buttons only; "Potty Break" persists in timeline titles** | The Activity Type grid in the bottom sheet shows "🚽 Potty" instead of "🚽 Potty Break". However, task titles in the timeline still render as "Potty Break". Rationale: (1) The grid button label "Potty Break" is unnecessarily long — "Potty" is clearer at the grid cell's constrained width and matches the brevity of other labels (Meal, Walk, Nap). (2) The underlying `activityType` enum value remains `"potty_break"` — no data migration, no backend changes, no breaking existing Firestore documents. (3) Timeline titles derive from `ACTIVITY_CONFIG[activityType].label` which keeps "Potty Break" for readability in the card context. (4) The grid and timeline use separate label lookups, so this is a display-only change scoped to the `ACTIVITIES` array in AddTaskFAB. |
| D56 | Potty Emoji Display on Task Cards | **Inline after title text, before edit indicator** | Selected potty detail emojis (💩, 💦, or both) display inline on the TaskCard component, appended to the task title. Rationale: (1) Inline display is the most compact — no extra row, no badge, no tooltip. Users scanning the timeline can instantly see what happened at each potty event. (2) Order is always 💩 then 💦 (alphabetical by label: Pee < Poop reversed to match common logging convention — solids first). (3) Position after title but before ✏️ edit indicator maintains the existing card information hierarchy: time → status → title → details → edit marker. (4) Only rendered when `task.pottyDetails?.poop` or `task.pottyDetails?.pee` is true AND `activityType === 'potty_break'`. Non-potty tasks are completely unaffected. (5) No potty details saved = no emojis shown (clean default). |
| D57 | Potty Details Persistence Path | **Same Firestore collections as other task fields (no new collection)** | `pottyDetails` is stored as a field within existing Firestore documents — `tasks/{taskId}` for custom tasks and `editedRoutineItems/{docId}` for AI-generated routine item edits (D48). Rationale: (1) Potty details are a property of a task, not a separate entity — storing them in a separate collection would violate the flat document model (D32) and add unnecessary query complexity. (2) Real-time sync, offline persistence, and conflict resolution all come for free — `pottyDetails` travels with the task document through Firestore's existing sync infrastructure (D30, D33). (3) `saveRoutineItemEdit()` already handles arbitrary field additions via the spread operator — adding `pottyDetails` to the edit payload requires no structural changes to the overlay pattern. (4) Firestore charges per document read/write, not per field — adding a field has zero cost impact. |

---

## Technical Architecture

### Stack Summary (Current: Web App)

```
┌──────────────────────────────────────────────────────────────┐
│          Web App (Vite + React + TypeScript)                  │
│                                                               │
│  React State  ←→  Supabase JS SDK  ←→  Firebase JS SDK       │
│  (in-memory)      (auth, users,         (tasks collection    │
│                    puppies, routines)    real-time sync)      │
│                                                               │
│  UI: Tailwind v4 + shadcn/ui + Radix + react-swipeable       │
│  Routing: State-based (screen enum)                          │
└────────────────┬────────────────────────┬────────────────────┘
                 │                        │
                 │ HTTPS (WebSocket)      │ WebSocket (real-time)
                 ▼                        ▼
┌─────────────────────────────┐  ┌─────────────────────────────┐
│  Supabase Platform          │  │  Firebase Firestore         │
│  (Primary Backend)          │  │  (Task Sync Only)           │
│                             │  │                             │
│  Auth (Google OAuth)        │  │  Collection: tasks/         │
│  Postgres:                  │  │  - puppyId, date,           │
│    - users, puppies         │  │    scheduledTime,           │
│    - routines, routine_items│  │    actualTime,              │
│    - puppy_memberships      │  │    activityType, isEdited,  │
│    - invites, profiles      │  │    isUserAdded, isCompleted │
│  Realtime (other features)  │  │  Collection: editedRoutineItems/│
│  Edge Functions:            │  │  - Routine edit overlays (D48)  │
│    - generate-routine       │  │  - Real-time listeners      │
│                             │  │  - Offline persistence      │
│    - getFirebaseToken       │  │                             │
│  Storage (photos)           │  │  Auth: Custom Tokens from   │
│  RLS Policies               │  │        Supabase Edge Fn     │
└──────────────┬──────────────┘  └─────────────────────────────┘
               │
               │ Server-side only
               ▼
┌─────────────────────────────────────────────────┐
│         Anthropic Claude API (Sonnet 4.5)        │
│  (called from Edge Function only, key protected) │
└─────────────────────────────────────────────────┘
```

**Hybrid Backend Rationale:**
- **Supabase:** Structured relational data (users, puppies, routines), RLS permissions, Google OAuth, storage
- **Firestore:** Real-time task editing with automatic offline-first sync (simpler than building custom queue)
- **Trade-off:** Two backends = more complexity, but Firestore's collaborative editing features save significant dev time

### Stack Summary (Future: iOS App)

```
┌─────────────────────────────────────────────────┐
│          iOS App (Swift + SwiftUI)               │
│                                                  │
│  SwiftData (local) ←→  Supabase Swift SDK        │
│  for offline-first     (auth, DB, realtime)      │
└─────────────────┬───────────────────────────────┘
                  │ HTTPS
                  ▼
         (same Supabase backend)
```

**Key Point:** Web and iOS apps share the **same Supabase backend**. Database schema, RLS policies, Edge Functions, and Storage buckets are identical. Only the client-side code differs (React vs. SwiftUI).

### Project Structure (Web App - Current)

```
puppy_daycare/
├── src/
│   ├── main.tsx                     # Vite entry point
│   ├── app/
│   │   ├── App.tsx                  # Root component, state-based routing
│   │   └── components/
│   │       ├── WelcomeScreen.tsx    # Google Sign-In button
│   │       ├── OnboardingQuestionnaire.tsx  # 4-step questionnaire
│   │       ├── AIRoutineGenerator.tsx       # Loading/animation screen
│   │       ├── Dashboard.tsx        # Main timeline view (daily routine)
│   │       ├── CompletionAvatar.tsx # Profile picture + green dot component
│   │       ├── RoutineReveal.tsx    # First-time routine reveal overlay
│   │       ├── Settings.tsx         # Settings screen
│   │       └── ui/                  # shadcn/ui components (inline)
│   │           ├── button.tsx
│   │           ├── input.tsx
│   │           ├── select.tsx
│   │           └── ...
│   └── lib/
│       ├── supabase.ts              # Supabase client singleton
│       ├── firebase.ts              # Firebase client singleton (Firestore only)
│       ├── database.types.ts        # Auto-generated TypeScript types (Supabase)
│       └── services/
│           ├── auth.ts              # Google Sign-In, sign out, getProfile
│           ├── puppies.ts           # createPuppy, getUserPuppies
│           ├── routines.ts          # saveRoutine, getActiveRoutine
│           ├── activity-logs.ts     # completeActivity, getTodayLogs (with profiles join)
│           ├── invites.ts           # generateInvite, acceptInvite
│           ├── tasks.ts             # editTask, deleteTask, addTask, completeTask (Firestore)
│           ├── deleted-routine-items.ts  # Persist routine item deletions (Firestore overlay)
│           └── edited-routine-items.ts   # Persist routine item edits (Firestore overlay, D48)
├── supabase/
│   ├── migrations/
│   │   ├── 001_initial_schema.sql   # Tables, triggers, RLS policies
│   │   ├── 002_fix_rls_recursion.sql
│   │   └── ...
│   └── functions/
│       ├── generate-routine/
│       │   └── index.ts             # Edge Function: Claude API integration
│       └── get-firebase-token/
│           └── index.ts             # NEW: Generate Firebase Custom Token
├── firebase/
│   └── firestore.rules              # Firestore security rules for tasks collection
├── docs/
│   ├── product-spec.md              # PM handoff document
│   ├── user-flows.md                # User journey flows
│   ├── decisions-log.md             # This file
│   └── backend-development-plan.md  # Backend implementation plan
├── vite.config.ts
├── tailwind.config.js
├── package.json
└── tsconfig.json
```

### Project Structure (iOS App - Future)

```
PupPlan-iOS/
├── PupPlanApp.swift                 # App entry point, routing logic
├── Info.plist                       # Universal Links config
├── Models/
│   ├── User.swift                   # SwiftData model
│   ├── Puppy.swift                  # SwiftData model
│   ├── Routine.swift                # SwiftData model
│   └── ...
├── Services/
│   ├── AuthService.swift            # Google Sign-In + Supabase auth
│   ├── SupabaseService.swift        # Supabase Swift SDK client
│   └── SyncService.swift            # Local ↔ remote data sync
├── Views/
│   ├── WelcomeView.swift
│   ├── OnboardingView.swift
│   ├── DailyRoutineView.swift
│   └── ...
└── ViewModels/
    └── ...

(Will be created after web app validates product-market fit)
```

**Note:** Supabase backend (database, Edge Functions, Storage) is shared between web and iOS.

---

## Database Schema (Supabase / Postgres)

### Row Level Security Strategy

| Table | Owner Access | Caretaker Access |
|---|---|---|
| `puppies` | Full CRUD | Read only (via membership) |
| `routines` | Full CRUD | Read only |
| `routine_items` | Full CRUD | Read only |
| `activity_logs` | Full CRUD | Insert (mark complete) + Read |
| `invites` | Full CRUD (own invites) | Read (own invite) |
| `puppy_memberships` | Full CRUD | Read (own membership) |

RLS policies use `auth.uid()` joined through `puppy_memberships` to determine access. This means permission enforcement happens at the database level — the iOS app doesn't need to implement permission checks beyond hiding UI elements.

### Realtime Subscriptions

The app subscribes to two Supabase Realtime channels:
1. **`activity_logs` table** — filtered by `puppy_id`. When the caretaker marks an activity complete, the owner's app updates within seconds (and vice versa).
2. **`invites` table** — filtered by `puppy_id`. Owner gets real-time update when caretaker accepts invite.

---

## AI Routine Generation — Prompt Strategy

The Edge Function sends the questionnaire data to Claude with a structured prompt that:
1. Takes breed, age, weight, living situation, and owner schedule as inputs
2. Returns a JSON array of routine items with: `activity_type`, `title`, `description`, `scheduled_time`, `duration_minutes`
3. Enforces breed-specific and age-specific guidelines (e.g., exercise limits for large breed puppies, potty frequency for young puppies)
4. Respects the owner's wake/bed times and work schedule
5. Includes all training goals by default (potty, crate, obedience, socialization, sleep, leash)

Response format is strictly JSON — no prose, no markdown. The Edge Function validates the response schema before returning to the client.

---

## Offline-First Strategy

1. **SwiftData** stores all routine and activity data locally
2. On app open, the app loads from SwiftData immediately (fast, no network wait)
3. **SyncService** runs in the background:
   - Pulls latest data from Supabase on app foreground
   - Pushes any locally-queued activity completions
   - Conflict resolution: **last-write-wins** on the same activity log entry (timestamp-based)
4. If the user completes an activity while offline:
   - Written to SwiftData immediately
   - Queued for sync
   - UI updates instantly
   - Synced when network returns
5. Realtime subscription reconnects automatically on network recovery

---

## Development Plan

### Phase 1: Web App MVP (Current - In Progress)

**Status:** ✅ Mostly complete. Profile picture completion attribution implemented.

```
✅ Step 1: Project scaffold + Supabase setup
  - Created Vite + React + TypeScript project
  - Set up Supabase project (database, auth, storage)
  - Ran Postgres migrations for all tables
  - Configured Google Sign-In in Supabase Auth

✅ Step 2: Auth flow
  - WelcomeScreen with Google Sign-In button
  - AuthService: signInWithGoogle, signOut, getProfile
  - App.tsx routing: new user → onboarding, returning user → dashboard

✅ Step 3: Onboarding questionnaire
  - 4-step questionnaire UI with progress bar
  - Validation logic, breed autocomplete
  - Save questionnaire data to Supabase on completion

✅ Step 4: AI routine generation (client-side mock for now)
  - AIRoutineGenerator component (loading animation)
  - Client-side breed/age rules generate routine
  - Parse response → insert Routine + RoutineItems into Supabase
  → Backend AI integration (Claude API via Edge Function) is P1

✅ Step 5: Daily routine view + activity tracking
  - Dashboard component (timeline UI)
  - Activity cards with status: upcoming/in-progress/completed/missed
  - Mark complete, undo functionality
  - Write ActivityLog entries to Supabase
  - Realtime subscription for cross-user updates

✅ Step 6: Profile picture completion attribution
  - getTodayLogs() joins activity_logs with profiles table
  - CompletionAvatar component: shows profile picture + green dot
  - Dashboard conditionally renders avatar (completed) vs checkbox (uncompleted)
  - Fallback: initials avatar if no profile picture
  - Real-time sync fetches profile data on updates

✅ Step 7: Task Management - Edit, Delete, Add Tasks (P0 - Flow 6)
  - Firebase project setup + Firestore configuration
  - Firebase Custom Token generation (Supabase Edge Function)
  - TasksService: editTask, deleteTask, addTask (Firestore operations)
  - AddTaskFAB bottom sheet (tri-mode: "Add New Task" + "Edit Custom" + "Edit Routine")
    - Tapping ANY task (custom or AI-generated) opens same bottom sheet (D45, D46)
    - No inline expandable card for any task type
    - Notes field: multiline textarea, 200-char max, auto-grows 3 lines (D47)
    - Discriminated union type EditingItem for dual data source handling (D49)
    - Category-to-activity mapping for Supabase→Firebase translation (D50)
  - editedRoutineItems Firestore collection for AI task edit persistence (D48)
  - Swipe-to-delete gesture (react-swipeable) + long-press accessibility
  - Floating Action Button (FAB) for adding tasks
  - Real-time sync via Firestore listeners (3-second target)
  - Optimistic UI updates with offline queue
  - Network status banner (4 states: connected/offline/syncing/failed)
  - Firestore security rules (puppyId membership check)
  → Unblocks: Real-world usage (puppies don't follow static routines)

🔲 Step 7b: Potty Details — Poop & Pee Tracking (P0 - Flow 6H / F11)
  - Add pottyDetails field to Task interface and RoutineItemEdit shape (D52)
  - Conditional "Details" section in AddTaskFAB (activity-type-gated, D53)
  - 💩/💦 emoji toggle buttons with selected/unselected states (D54)
  - Rename "Potty Break" → "Potty" in Activity Type grid (D55)
  - Inline potty emoji display on TaskCard timeline (D56)
  - Persist pottyDetails via existing Firestore collections (D57)
  - Pre-populate toggles when editing existing Potty tasks
  - Clear pottyDetails when activity type switches away from Potty
  → Unblocks: Structured housebreaking progress tracking

🔲 Step 8: Progress tracking (P1)
  - Weekly summary view
  - Completion rate calculation, streaks, activity breakdown
  - Team activity split (owner vs. caretaker)

🔲 Step 9: Invite system (P1)
  - InviteService: generate token, create Supabase record
  - Settings page: generate link, share via navigator.share()
  - AcceptInviteView: caretaker acceptance flow
  - RLS policies enforcement for caretaker role

🔲 Step 10: Deploy to Vercel (P0)
  - Connect GitHub repo to Vercel
  - Set environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_FIREBASE_CONFIG)
  - Deploy to production
  → Unblocks: user testing, validation

🔲 Step 11: AI routine generation backend (P1)
  - Supabase Edge Function (generate-routine)
  - Claude API integration with structured prompt
  - Replace client-side generateRoutine() with Edge Function call
```

### Phase 2: iOS App (Future - After PMF Validation)

```
Step 1: iOS project setup
  - Create Xcode project (Swift + SwiftUI, iOS 17+)
  - Install Supabase Swift SDK
  - Configure Universal Links (apple-app-site-association)
  - Bundle breeds.json

Step 2: Port core screens to SwiftUI
  - WelcomeView, OnboardingView, DailyRoutineView
  - Reuse design system (colors, spacing match web app)
  - Implement SwiftData for local persistence

Step 3: Supabase integration
  - Auth flow (Google Sign-In via Supabase Swift SDK)
  - Realtime subscriptions
  - Image upload to same Supabase Storage buckets

Step 4: App Store submission
  - App icon, launch screen
  - Screenshots, metadata
  - TestFlight beta testing
  - Submit for review
```

---

## External Setup Required

These require account creation or configuration outside the codebase:

| What | Why | Platform | Who |
|---|---|---|---|
| **Google Cloud Console** (free) | Required to configure Google OAuth credentials (Client ID + Secret) for Supabase Auth | Web + iOS | CTO sets up |
| **Supabase Project** (free tier sufficient for MVP) | Backend hosting. Free tier: 500MB database, 1GB storage, 50K monthly active users | Web + iOS | CTO sets up |
| **Firebase Project** (free Spark tier) | Firestore for real-time task sync. Free tier: 1GB storage, 50K reads/day, 20K writes/day (sufficient for 50 users) | Web + iOS | CTO sets up |
| **Anthropic API Key** (P1) | Claude API for routine generation. Pay-per-use, ~$0.01-0.03 per routine generation | Web + iOS | CTO sets up, stored as Supabase Edge Function secret |
| **Vercel Account** (free tier) | Web app hosting. Auto-deploys from GitHub, edge functions for static assets, preview deploys | Web only | CTO sets up |
| **Domain** (`pupplan.app` or similar) | Custom domain for production web app. Optional for web, required for iOS Universal Links | Web + iOS | CTO configures DNS, Vercel custom domain |
| **Apple App Store Connect** (future) | iOS app listing, screenshots, metadata for submission | iOS only | Product owner provides copy, CTO configures |

---

## Cost Estimate (MVP, first 50 users)

### Web App (Current)

| Service | Cost | Notes |
|---|---|---|
| Supabase (free tier) | $0/month | 50 users is well within free tier limits (500MB DB, 1GB storage, 50K MAU) |
| Firebase (Spark tier) | $0/month | Free tier: 1GB storage, 50K reads/day, 20K writes/day. 50 users × ~100 task operations/day = 5K operations (well under limit). |
| Vercel (Hobby tier) | $0/month | Free tier includes: 100GB bandwidth, unlimited sites, automatic HTTPS |
| Anthropic Claude API (P1) | ~$0.50-1.50 total | 50 routine generations × ~$0.01-0.03 each. One-time cost per puppy, not recurring. Not needed in v1 (using client-side generation). |
| Google Cloud Console | $0/month | Free OAuth credentials, no cost for authentication |
| Domain (`pupplan.app`) | ~$15/year (~$1.25/month) | Optional for MVP, recommended for production |
| **Total (MVP)** | **$0-1.25/month** | Can launch with $0/month on free tiers. Domain is optional. |

### iOS App (Future, after web validation)

| Additional Service | Cost | Notes |
|---|---|---|
| Apple Developer Program | $99/year (~$8.25/month) | Required to publish iOS apps to App Store |
| **Total (Web + iOS)** | **~$9.50/month** | Once we add iOS, monthly cost increases by ~$8. |

**Cost scales with users:**
- 1000 users: Supabase Pro ($25/mo) + Firebase Blaze pay-as-you-go (~$15/mo for task operations) + Anthropic API (~$30/mo) = ~$70/mo
- Break-even with freemium: ~120 paying users at $4.99/mo (or ~85 users at $6.99/mo)

---

## Flow 6: Task Management - Firestore Data Model

### Firestore Collection: `tasks`

```typescript
interface Task {
  id: string;                    // Firestore auto-generated document ID
  puppyId: string;               // FK to Supabase puppies.id (for security rules)
  date: string;                  // YYYY-MM-DD format (e.g., "2025-02-11")

  // Timing
  scheduledTime: Timestamp;      // Original AI-generated time (Firestore Timestamp)
  actualTime: Timestamp;         // User-edited time (defaults to scheduledTime)

  // Activity
  activityType: ActivityType;    // Enum: potty_break | meal | training | nap | calm_time | play_time | walk
  title: string;                 // "Breakfast", "Morning potty break", etc.
  description?: string;          // Optional guidance text from AI routine
  pottyDetails?: {               // Only present when activityType = potty_break (D52)
    poop: boolean;               // True if 💩 was selected
    pee: boolean;                // True if 💦 was selected
  };

  // State flags
  isCompleted: boolean;
  isEdited: boolean;             // True if actualTime !== scheduledTime OR activityType changed
  isUserAdded: boolean;          // True if created via + FAB (not from AI routine)

  // Attribution
  completedBy?: string;          // Supabase user.id who completed task (nullable)
  completedAt?: Timestamp;       // When task was completed (nullable)
  lastEditedBy: string;          // Supabase user.id who last edited
  lastEditedAt: FieldValue;      // serverTimestamp() for conflict resolution

  // Metadata
  createdAt: Timestamp;
  updatedAt: FieldValue;         // serverTimestamp() on every write
}

enum ActivityType {
  potty_break = "potty_break",
  meal = "meal",
  training = "training",
  nap = "nap",
  calm_time = "calm_time",
  play_time = "play_time",
  walk = "walk"
}
```

### Firestore Collection: `editedRoutineItems` (D48)

```typescript
interface RoutineItemEdit {
  routineItemId: string;       // FK to Supabase routine_items.id
  puppyId: string;             // FK to Supabase puppies.id
  date: string;                // YYYY-MM-DD (scoped to today)
  time: string;                // HH:mm format (user-edited time)
  activityType: string;        // Firebase activity type (mapped from Supabase category)
  title: string;               // Display name (e.g., "Breakfast")
  description: string;         // Notes field content (can be empty string)
  pottyDetails?: {             // Only present when activityType = potty_break (D52, D57)
    poop: boolean;
    pee: boolean;
  };
  editedBy: string;            // Supabase user.id who edited
  editedAt: FieldValue;        // serverTimestamp()
}

// Document ID: deterministic `{puppyId}_{routineItemId}_{date}`
// Uses setDoc() for upsert — repeated edits overwrite cleanly
// Query: editedRoutineItems WHERE puppyId == X AND date == today
```

**Relationship to `deletedRoutineItems`:** Both collections follow the same Firebase overlay pattern. Supabase `routine_items` are read-only from the client. Deletions go to `deletedRoutineItems`, edits go to `editedRoutineItems`. Dashboard subscribes to both and applies overlays before rendering.

### Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper function: Check if user has access to puppy
    function hasPuppyAccess(puppyId) {
      // Query Supabase via Custom Claims (set during Firebase token generation)
      // Custom claim format: { puppyIds: ["uuid1", "uuid2", ...] }
      return request.auth != null
        && request.auth.token.puppyIds.hasAny([puppyId]);
    }

    // Tasks collection
    match /tasks/{taskId} {
      // Read: User must have access to the puppy
      allow read: if hasPuppyAccess(resource.data.puppyId);

      // Create: User must have access to puppy AND provide required fields
      allow create: if hasPuppyAccess(request.resource.data.puppyId)
        && request.resource.data.keys().hasAll([
          'puppyId', 'date', 'scheduledTime', 'actualTime',
          'activityType', 'title', 'isCompleted', 'isEdited',
          'isUserAdded', 'lastEditedBy', 'createdAt'
        ])
        && request.resource.data.lastEditedBy == request.auth.uid
        && request.resource.data.lastEditedAt == request.time;

      // Update: User must have access to puppy
      allow update: if hasPuppyAccess(resource.data.puppyId)
        && request.resource.data.lastEditedBy == request.auth.uid
        && request.resource.data.lastEditedAt == request.time;

      // Delete: User must have access to puppy
      allow delete: if hasPuppyAccess(resource.data.puppyId);
    }
  }
}
```

### Custom Claims Strategy

**Problem:** Firestore security rules can't query external databases (Supabase). We need to know which puppies a user can access.

**Solution:** When generating Firebase Custom Token (Supabase Edge Function), include `puppyIds` array in custom claims:

```typescript
// Supabase Edge Function: get-firebase-token
const userPuppyIds = await getUserPuppyIds(supabaseUserId);
// Returns: ["uuid-1", "uuid-2"] (puppies user owns or is caretaker for)

const firebaseToken = await firebaseAdmin.auth().createCustomToken(supabaseUserId, {
  puppyIds: userPuppyIds
});
```

**Security:** Custom claims are trusted (generated server-side). Firestore rules check `request.auth.token.puppyIds.hasAny([resource.data.puppyId])` to enforce access.

**Limitation:** If user's puppy access changes (invited to new puppy, removed as caretaker), custom claims are stale until next Firebase token refresh. **Mitigation:** Force token refresh on membership changes (P1 improvement).

### Query Patterns

```typescript
// Get today's tasks for current puppy
const tasksQuery = query(
  collection(db, 'tasks'),
  where('puppyId', '==', currentPuppyId),
  where('date', '==', todayString), // "2025-02-11"
  orderBy('actualTime', 'asc')
);

// Real-time listener
const unsubscribe = onSnapshot(tasksQuery, (snapshot) => {
  snapshot.docChanges().forEach((change) => {
    if (change.type === 'added') { /* new task */ }
    if (change.type === 'modified') { /* task edited */ }
    if (change.type === 'removed') { /* task deleted */ }
  });
});
```

### Offline Persistence

```typescript
// Enable offline persistence (IndexedDB)
import { enableIndexedDbPersistence } from 'firebase/firestore';

enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    console.warn('Multiple tabs open, persistence enabled in first tab only');
  } else if (err.code === 'unimplemented') {
    console.warn('Browser does not support persistence');
  }
});
```

Firestore automatically:
- Queues writes when offline
- Serves reads from local cache
- Syncs changes when connection restored
- Handles conflicts via last-write-wins (server timestamp)

### Performance Optimization

**Index requirements:**
```
Collection: tasks
Indexes:
  - puppyId (ascending) + date (ascending) + actualTime (ascending)
    → Composite index for query pattern above
```

Firestore automatically creates this index when first query runs (shows warning in console with index creation link).

**Estimated operations (50 users):**
- 50 users × 15 tasks/day × 2 reads (initial load + real-time updates) = **1,500 reads/day**
- 50 users × 15 routine items/day × 2 reads (editedRoutineItems + deletedRoutineItems) = **1,500 reads/day**
- 50 users × 5 task edits/day × 1 write = **250 writes/day**
- 50 users × 2 routine edits/day × 1 write = **100 writes/day**
- Total: ~3,000 reads/day, ~350 writes/day — well under free tier limits (50K reads, 20K writes)

---

## Flow 6: Network Status Banner Implementation

### Connection State Detection

```typescript
import { onSnapshot, enableNetwork, disableNetwork } from 'firebase/firestore';

// Listen to Firestore connection state
const metadataRef = doc(db, '.info', 'connected'); // Special Firestore metadata
onSnapshot(metadataRef, (snapshot) => {
  const isConnected = snapshot.data()?.connected ?? false;

  if (isConnected) {
    setBannerState('connected'); // Hide banner or show "✓ Synced"
  } else {
    setBannerState('offline'); // Show yellow banner
  }
});

// Listen for sync errors
onSnapshot(tasksQuery,
  (snapshot) => { /* success */ },
  (error) => {
    console.error('Firestore sync error:', error);
    setBannerState('failed'); // Show red banner with retry
  }
);
```

### Banner Component States

```tsx
function NetworkStatusBanner({ state }: { state: 'connected' | 'offline' | 'syncing' | 'failed' }) {
  if (state === 'connected') {
    return (
      <div className="bg-green-50 border-b border-green-200 px-4 py-2 text-sm text-green-800">
        ✓ Synced
      </div>
    ); // Auto-dismiss after 1s
  }

  if (state === 'offline') {
    return (
      <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-3 text-sm text-yellow-800">
        ⚠️ You're offline. Changes will sync when connected.
      </div>
    ); // Persistent
  }

  if (state === 'syncing') {
    return (
      <div className="bg-blue-50 border-b border-blue-200 px-4 py-2 text-sm text-blue-800">
        ⏳ Syncing changes...
      </div>
    ); // Brief (< 2s)
  }

  if (state === 'failed') {
    return (
      <div className="bg-red-50 border-b border-red-200 px-4 py-3 text-sm text-red-800 flex items-center justify-between">
        <span>❌ Couldn't sync changes. Check your connection.</span>
        <button onClick={handleRetry} className="underline">Retry</button>
      </div>
    ); // Persistent until retry succeeds
  }

  return null;
}
```

**Critical UX principle:** Users must always know sync state. Showing "Syncing..." during writes builds trust, even if sync is fast.

---

## Flow 7 / F9 — Profile Picture Management

### Summary

Flow 7 adds the ability for users to set a custom profile photo from the Settings screen. Tapping "Edit" opens an action sheet with camera and photo library options. The selected image is uploaded to Supabase Storage and the URL is written back to the `profiles` table.

---

### Decisions

| # | Decision | Choice | Rationale |
|---|---|---|---|
| D35 | Avatar Storage Backend | **Supabase Storage (`user-avatars` bucket)** | The product spec draft referenced Firebase Storage, but the actual implementation uses Supabase Storage to keep all user data in one platform (consistent with D6). Firebase Storage would require a separate SDK, separate auth token, and additional bundle weight. Supabase Storage is already initialized and available. The `user-avatars` bucket is public-read, private-write (enforced by RLS on the bucket). |
| D36 | Avatar Storage Path | **`{userId}/avatar.{ext}`** | Deterministic path per user — no timestamped filenames. Every upload overwrites the previous file. Pros: simple, no orphan files accumulating, no cleanup job needed. Con: requires cache-busting since the URL stays the same. Handled by D37. |
| D37 | Avatar URL Cache-Busting | **Append `?v={Date.now()}` after upload** | Supabase Storage URLs are deterministic (same path = same URL). Without cache-busting, browsers serve the old image from cache even after a new one is uploaded. Appending `?v={Date.now()}` forces a fresh fetch. This is stored in the `profiles.avatar_url` column and in component state. Simple, zero infrastructure cost. Alternative (random UUID in path) would cause unbounded storage growth. |
| D38 | Avatar DB Write | **`updateProfile(userId, { avatar_url })` after storage upload** | The `profiles` table holds the canonical avatar URL. Writing it to the DB means it survives page refreshes and is available on all devices. Upload-then-write order: storage upload succeeds first, then DB is updated. If DB write fails, the image exists in storage but the profile won't show it — acceptable failure mode (user can retry). |
| D39 | Photo Source Selection UX | **Action sheet (bottom sheet overlay)** | iOS-native convention: tapping a photo triggers an action sheet with "Take a Photo", "Choose from Photo Library", "Cancel". Implemented as a custom overlay (`fixed inset-0` backdrop + `fixed bottom-0` panel) rather than a native `<dialog>` or third-party modal library. Keeps dependencies minimal. Matches the Figma design at node 13-2. |
| D40 | Camera vs. Library on Web | **`capture="user"` attribute on `<input type="file">`** | Web has no separate camera API. Setting `capture="user"` on a hidden file input hints mobile browsers to open the front-facing camera directly. Removing the attribute opens the standard file picker (which includes photo library access on mobile). The action sheet swaps the attribute before programmatically triggering the input's `.click()`. Works on iOS Safari and Android Chrome. Desktop browsers fall back to file picker for both options — acceptable since desktop camera use is rare. |
| D41 | File Validation | **5MB max, client-side before upload** | Checked in `handleFileSelected()` before any network call. JPEG, PNG, HEIC, HEIF accepted (matching mobile camera output formats). Oversized files get a toast error and the upload is aborted. No server-side size enforcement in v1 — Supabase Storage enforces limits at the bucket level as a backstop. |
| D42 | Upload Spinner | **Overlay on avatar image during upload** | A semi-transparent spinner overlays the current avatar while the new image is uploading. This is optimistic UI without premature optimism — we show progress but don't swap the image until upload succeeds. Prevents double-taps and gives clear feedback on a potentially slow mobile upload. |
| D43 | `avatarUrl` State Location | **App.tsx** (top-level, passed down via props) | The avatar URL needs to be accessible in both Settings (where it's edited) and Dashboard (where it may be displayed in future). Storing it in App.tsx alongside `user` and `profile` state keeps it consistent with the existing pattern (D13). Seeded from `profile.avatar_url` on initial load. Cleared to `null` on sign out. Updated via `onAvatarUpdate` callback prop passed to Settings. |
| D44 | `onAvatarUpdate` Callback Pattern | **Prop callback from App.tsx → Settings.tsx** | After a successful upload, Settings calls `onAvatarUpdate(newUrl)` to update App.tsx state. This is the same prop-drilling pattern used throughout the app (D13 — no global state manager). Avoids re-fetching the full profile from Supabase after every upload. The new URL is immediately reflected in the UI without a round-trip. |

---

### Implementation Notes

**Service function added** (`src/lib/services/auth.ts`):
```typescript
export async function uploadUserAvatar(userId: string, file: File): Promise<string> {
  const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const fileName = `${userId}/avatar.${fileExt}`;
  const { error: uploadError } = await supabase.storage
    .from('user-avatars')
    .upload(fileName, file, { upsert: true });
  if (uploadError) throw uploadError;
  const { data: { publicUrl } } = supabase.storage
    .from('user-avatars')
    .getPublicUrl(fileName);
  return `${publicUrl}?v=${Date.now()}`;
}
```

**Supabase bucket setup required:** A public `user-avatars` bucket must exist in Supabase Storage. Created manually in the Supabase dashboard (Storage → New bucket → `user-avatars` → Public). Not scripted in v1 — document in the README and onboarding checklist.

**iOS future note:** The action sheet UX maps directly to `UIImagePickerController` (camera) and `PHPickerViewController` (library) on iOS. The web `capture="user"` hint is the closest web equivalent. The service layer (`uploadUserAvatar`) will be re-implemented in Swift using the Supabase Swift SDK with the same storage bucket and path convention.

---

## Flow 6H / F11 — Potty Details (Poop & Pee Tracking)

### Summary

Flow 6H adds structured potty detail tracking to the task editing flow. When a user selects "Potty" as the activity type in the Edit Task or Add Custom Task bottom sheet, a conditional "Details" section appears with two emoji toggle buttons (💩 Poop, 💦 Pee). Selected details are persisted to Firestore and displayed inline on the task card in the timeline.

### Decisions

| # | Decision | Choice | Rationale |
|---|---|---|---|
| D52 | Data model | `pottyDetails?: { poop: boolean; pee: boolean }` | Independent booleans — not mutually exclusive. Optional field omitted for non-potty tasks. |
| D53 | Conditional UI | Activity-type-gated render in AddTaskFAB | Conditional render (not CSS hidden). Unmounts and resets state on activity switch. |
| D54 | Toggle interaction | Independent emoji toggle buttons | Not checkboxes, not radio buttons. 44×44px minimum touch target. Neither required. |
| D55 | Label rename scope | "Potty" in grid only | Underlying enum stays `"potty_break"`. Timeline title stays "Potty Break". No migration. |
| D56 | Timeline display | Inline after title, before ✏️ | 💩 always before 💦. Only shown when pottyDetails has true values. |
| D57 | Persistence path | Existing Firestore collections | `tasks/{taskId}` for custom, `editedRoutineItems/{docId}` for AI edits. No new collection. |

### Data Model Changes

```typescript
// Task interface (src/lib/services/tasks.ts)
export interface Task {
  // ... existing fields (D32)
  pottyDetails?: {
    poop: boolean;  // True if 💩 selected
    pee: boolean;   // True if 💦 selected
  };
}

// RoutineItemEdit shape (for editedRoutineItems collection, D48)
// pottyDetails is included in the edit payload alongside
// editedTime, editedActivity, description
```

### Component Changes

**AddTaskFAB.tsx:**
- Add `pottyPoop` and `pottyPee` boolean state (default `false`)
- Render "Details" section between Activity Type grid and Notes when `selectedActivity === 'potty_break'`
- Two emoji toggle buttons with selected/unselected visual states
- On activity type change away from potty_break: reset both to `false`
- On save: include `pottyDetails: { poop: pottyPoop, pee: pottyPee }` only when `selectedActivity === 'potty_break'`
- On edit mode open for potty task: pre-populate from `editingItem.pottyDetails`
- Rename "Potty Break" to "Potty" in the `ACTIVITIES` array label

**TaskCard.tsx:**
- After the task title text, conditionally render potty emojis:
  ```tsx
  {task.activityType === 'potty_break' && task.pottyDetails && (
    <span>
      {task.pottyDetails.poop && '💩'}
      {task.pottyDetails.pee && '💦'}
    </span>
  )}
  ```
- Position: after title, before ✏️ edit indicator

**tasks.ts (service layer):**
- `addTask()`: Include `pottyDetails` in `addDoc()` payload when present
- `editTask()`: Include `pottyDetails` in `updateDoc()` payload using same `!== undefined` pattern (D51)
- No changes to `deleteTask()` or query functions

**edited-routine-items.ts (service layer):**
- `saveRoutineItemEdit()`: Include `pottyDetails` in the `setDoc()` payload
- Existing spread pattern handles the new field without structural changes

### Firestore Security Rules

No changes needed. Existing rules allow authenticated users to read/write documents in `tasks` and `editedRoutineItems` collections where they are the puppy's owner or caretaker. `pottyDetails` is just another field on those documents — Firestore rules operate at the document level, not the field level.
