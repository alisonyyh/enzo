# PupPlan - Product Specification

## 1. WHAT are we building?

**Product name:** PupPlan

**One-line description:** An AI-powered web app that generates personalized daily routines for new puppies and lets families collaboratively track the puppy's habits and progress.

---

### Core Features

#### F1: Onboarding Questionnaire
**Priority: P0 (Launch Blocker)**

**Description:** A multi-step questionnaire (4 screens) the primary owner completes after authenticating for the first time. Captures essential information about the puppy and the owner's living situation to generate an AI-tailored routine. The app is opinionated about training goals - all goals (potty training, crate training, obedience, socialization, sleep schedule, leash training) are included by default.

**Questionnaire Fields:**
- Puppy's name
- Breed (with search/autocomplete, including "Mixed/Unknown")
- Photo (optional, upload from device)
- Age in months (integer input, required)
- Age in weeks (integer input, required) — both fields displayed together (e.g., 3 months, 2 weeks)
- Weight (current, lbs or kg toggle)
- Living situation (apartment, house with yard, house without yard)
- Owner's typical work arrangement (work from home, office/hybrid, shift work, stay at home/retired)
- Typical wake-up time
- Typical bedtime

**Behavior:**
- User sees the questionnaire only after authenticating via Google Sign-In as a new user
- Progress bar at the top of each screen shows completion (e.g., step 2 of 4)
- User can go back to previous steps to edit answers
- Questionnaire data is synced to backend immediately (user is already authenticated)

**Acceptance Criteria:**
- All required fields must be completed before proceeding to the next step
- Breed autocomplete returns results within 200ms
- Age fields accept integers only (no decimals, no text). Months >= 0, weeks >= 0, total age must be > 0
- Questionnaire state persists if user closes and reopens the app before completing
- Progress bar accurately reflects current step (1-4)

---

#### F2: Authentication (Google Sign-In)
**Priority: P0 (Launch Blocker)**

**Description:** Authentication is the first action a user takes in the app. The welcome screen presents Sign in with Google as the sole authentication method. This handles both new account creation and returning user sign-in via Google OAuth. All users are treated as primary owners by default unless they have accepted an invite link from a primary owner. During OAuth, the user's Google profile picture is automatically captured and stored.

**Behavior:**
- User opens the app and sees the welcome screen with the Google Sign-In button
- Tapping triggers the Google OAuth flow (redirects to Google's consent screen)
- Backend captures user's `name`, `email`, and `picture` URL from Google OAuth response
- If the user is new (no existing PupPlan account): account is created with Google profile picture, user is routed to the onboarding questionnaire (F1)
- If the user is returning (existing account): user is signed in and routed directly to the daily routine view (F4)
- If the user opened the app via an invite deep link: after auth, user is routed to the invite acceptance screen (F7) instead of onboarding

**Acceptance Criteria:**
- Google Sign-In works via Supabase OAuth
- Google profile picture URL is captured and stored in `User.google_profile_picture_url`
- New users are correctly identified and routed to onboarding
- Returning users bypass onboarding and land on the daily routine
- Auth fails gracefully with clear error messages (network error, cancelled by user)
- Invite deep link context is preserved through the auth flow

---

#### F3: AI Routine Generation
**Priority: P0 (Launch Blocker)**

**Description:** Generates a personalized daily routine for the puppy based on questionnaire responses. In v1, this is client-side logic with breed/age-appropriate rules (mock AI); true LLM integration is deferred to P1.

**Behavior:**
- After completing the onboarding questionnaire, user sees a loading/generation screen (with engaging puppy animation or progress messaging like "Analyzing your puppy's needs...")
- Client-side algorithm generates a structured daily routine including:
  - Wake-up time and morning routine
  - Feeding times and portions (age/breed appropriate)
  - Potty break schedule
  - Exercise/play sessions (duration and type appropriate to breed and age)
  - Training session windows (short, age-appropriate)
  - Nap/crate time
  - Evening wind-down and bedtime
- Routine is displayed as a timeline/schedule view for the current day
- Each routine item shows: time, activity name, duration, and brief guidance note (e.g., "15 min walk - keep it gentle, puppy joints are still developing")

**Acceptance Criteria:**
- Routine generates within 10 seconds
- Routine is medically/behaviorally sound for the puppy's age and breed
- Routine respects the owner's stated schedule (e.g., doesn't schedule mid-day walks if owner is at office)
- Routine items are displayed in chronological order
- If generation fails, user sees a retry option with a clear error message

**Decision (D4):** Users can edit the AI-generated routine minimally in v1 — adjust activity times (tap to change) and toggle activities on/off. Custom activity creation is P1.

**Technical Note:** v1 uses client-side breed/age rules. Future iterations will use Anthropic Claude API server-side for true AI personalization.

---

#### F4: Daily Routine View & Tracking
**Priority: P0 (Launch Blocker)**

**Description:** The main screen of the app. Displays today's routine as a checklist/timeline and allows any user (owner or caretaker) to mark activities as completed. Uses profile pictures with green dot indicators to show completion attribution.

**Behavior:**
- Shows today's date and the puppy's routine as a vertical timeline
- Each activity has:
  - Time slot
  - Activity icon and name (with colored category dot: green for potty, orange for feeding, purple for training, blue for play, brown for rest)
  - Status: upcoming, in-progress (current time window), completed, missed
  - **Completion indicator:**
    - **Uncompleted tasks:** Empty checkbox
    - **Completed tasks:** Checkbox is replaced by the completer's circular profile picture with a green dot indicator at the top-right corner
  - Optional: add a quick note (e.g., "she had an accident during potty break")
- Activities auto-advance based on time (upcoming → in-progress → missed if not marked)
- Profile picture attribution provides instant visual accountability (scan timeline to see who did what)
- Pull-to-refresh updates the view
- Tapping a task opens bottom sheet with details, guidance, and "Mark as Complete" button

**Acceptance Criteria:**
- Routine loads within 2 seconds
- Completing an activity syncs across all users (owner + caretaker) within 5 seconds
- Profile picture with green dot replaces checkbox within 100ms of marking complete
- Uncompleted tasks show empty checkbox (no profile picture, no green dot)
- Green dot is visible on all profile picture backgrounds
- Missed activities are visually distinct (e.g., faded or red/warning color)
- User can see past days' routines by swiping or using a date picker
- Works offline: completions are queued and synced when connectivity returns
- Activity left-border color coding matches category (orange for feeding, green for potty, etc.)

---

#### F5: Progress Tracking
**Priority: P0 (Launch Blocker)**

**Description:** A summary view showing the puppy's adherence to the routine over time. Progress is unified across all household members - no role-based split in the summary card.

**Behavior:**
- **Dashboard "Today's Progress" Card:**
  - Unified task counter (e.g., "8/17") - shows total completed / total scheduled, aggregated across all users
  - Circular percentage completion indicator (e.g., "47%")
  - NO role-based breakdown (owner vs. caretaker)
  - NO "Logged in as Owner" badge or role indicator
  - Updates in real-time as tasks are completed by any household member
- **Weekly Progress View:**
  - Completion rate (% of activities completed)
  - Streaks (consecutive days with 100% completion)
  - Activity breakdown (which activities are consistently done vs. missed)
  - Team contribution chart (owner vs. caretaker activity distribution - shown in detailed view, not summary card)
- Simple visuals: progress rings or bar charts, nothing overly complex

**Acceptance Criteria:**
- Progress data is accurate and matches actual completion records
- Unified counter aggregates completions from all users (owner + caretakers)
- Percentage circle updates in sync with task counter
- Week-over-week trend is visible in detailed view
- Data loads within 3 seconds
- Handles edge case: first day of use shows partial data without errors
- Summary card is visually clean with no role indicators

**Design Rationale:** Unified progress reduces cognitive overhead and avoids creating scorekeeping dynamics in households. Task-level attribution (profile pictures) provides accountability without splitting the summary.

---

#### F6: Caretaker Invite System
**Priority: P0 (Launch Blocker)**

**Description:** The primary owner can generate an invite link and share it with one caretaker. No in-app messaging integration required.

**Behavior:**
- Owner navigates to Settings > Manage Caretakers
- Taps "Invite Caretaker" which generates a unique deep link
- Web share API or native share sheet appears (user can copy link, send via iMessage, WhatsApp, etc.)
- Link is valid for 72 hours, single-use
- Owner can see invite status: Pending, Accepted, or Expired
- Owner can revoke a pending invite or remove an accepted caretaker
- Maximum 1 caretaker per puppy in v1

**Invite Link Behavior:**
- If recipient has the app open in a browser: deep link opens the app with an accept-invite flow
- If recipient doesn't have the link yet: link opens app in browser, after navigating the invite context is preserved

**Acceptance Criteria:**
- Invite link generates instantly
- Deep link correctly routes to accept-invite screen in-app
- Owner sees real-time status update when caretaker accepts
- Revoking an invite invalidates the link immediately
- Attempting to use an expired or revoked link shows a clear error

---

#### F7: Caretaker Onboarding
**Priority: P0 (Launch Blocker)**

**Description:** The flow a caretaker goes through when accepting an invite.

**Behavior:**
- Caretaker taps invite link -> app opens in browser
- Caretaker sees: "You've been invited to help care for [Puppy Name]!" with puppy's photo (if available) and the owner's name
- Caretaker authenticates via Google Sign-In (same welcome screen as primary owner flow) or signs in if they already have an account
- Google profile picture is captured during OAuth
- On acceptance, caretaker immediately sees the puppy's daily routine
- Caretaker has read + track access (can view routine and mark activities complete)
- Caretaker's profile picture appears next to tasks they complete
- Caretaker cannot: edit routine, change puppy profile, invite others, or modify settings

**Acceptance Criteria:**
- Caretaker can go from link tap to viewing the routine in under 2 minutes
- Caretaker's Google profile picture is captured and stored
- Caretaker permissions are correctly enforced (no access to settings/edit)
- If the caretaker already has an account with their own puppy, the invited puppy appears as a second profile they can switch to

**Decision (D5):** Yes. A user account can have multiple roles across different puppies (owner for Puppy A, caretaker for Puppy B). The app shows a puppy switcher when a user has access to multiple puppies.

---

#### F8: Task Completion Attribution (Profile Pictures with Green Dot Indicator)
**Priority: P0 (Launch Blocker)**

**Description:** Visual accountability system that shows who completed each task using profile pictures with a green dot completion indicator. The profile picture **replaces the checkbox** when a task is marked complete, providing instant visual attribution. This design transforms the standard checkbox pattern into a social accountability signal.

**Behavior:**
- **Uncompleted tasks:** Show a standard empty checkbox in the timeline
- **When a user marks a task as complete:** The checkbox is replaced by their circular profile picture with a small green dot indicator overlaid at the top-right corner of the avatar
- The green dot (6px diameter) signifies completion status and is positioned at approximately 2 o'clock on the avatar circle
- Default profile picture: Google OAuth profile picture (captured during sign-in)
- If user later uploads a custom profile picture, all their task completions update to show the new picture with green dot
- Multiple users completing different tasks show their respective profile pictures with green dots
- Fallback for missing/broken profile pictures: Initials avatar (first letter of first + last name on colored circle background) with green dot
- **If task is unchecked/undone:** Profile picture disappears, standard checkbox returns

**Acceptance Criteria:**
- Profile picture with green dot replaces checkbox within 100ms of marking task complete (instant visual feedback)
- Green dot indicator is clearly visible against all profile picture backgrounds (uses white border/shadow if needed)
- Profile pictures pull from `User.google_profile_picture_url` by default
- Custom profile pictures override Google default (uses `User.custom_profile_picture_url`)
- Profile picture updates propagate to all existing task completions within 1 second
- Unchecking a task removes profile picture and restores empty checkbox
- Works for multiple users: each user's picture appears only on tasks they completed
- Fallback initials avatar displays with green dot if profile picture URL is broken or missing
- Green dot position is consistent across all avatars (top-right corner, same offset)

**UI Specifications:**
- **Avatar size:** 24px × 24px (mobile), 32px × 32px (tablet+)
- **Avatar shape:** Circle with 2px white border
- **Green dot size:** 6px diameter (mobile), 8px diameter (tablet+)
- **Green dot color:** #4a9b5e (matches app's completion green)
- **Green dot position:** Top-right corner of avatar circle, overlaid with 1px white border for visibility
- **Placement in timeline:** Replaces the checkbox position entirely (time → avatar with green dot → task name)
- **Empty state (uncompleted):** Standard empty checkbox (no avatar, no green dot)
- **Hover/long-press tooltip:** Shows text "Completed by [Name] at [Time]" for accessibility and detail

**Technical Implementation Notes:**
- Green dot is a CSS overlay/pseudo-element, not baked into the image asset
- Avatar must be cached locally for offline mode (users see completion attribution even without connectivity)
- Avatar images lazy-load with initials fallback showing immediately
- Green dot uses box-shadow for white border effect: `box-shadow: 0 0 0 1px white`

**Design Rationale:**
Replacing the checkbox with a profile picture creates a stronger social signal than placing the picture "next to" the checkbox. Users can instantly scan the timeline and see a visual pattern: "My partner did the morning tasks (their face repeated 3 times), I did the afternoon ones." The green dot provides universal completion signaling that works across all image backgrounds. This design feels warmer and more human than text labels like "Completed by Sarah" while being faster to visually parse.

---

#### F9: Profile Picture Management (Settings)
**Priority: P1 (Needed Soon After Launch)**

**Description:** Settings page feature that allows users to view and update their profile picture. Default is Google OAuth picture; users can upload custom images to override.

**Behavior:**
- Settings page includes "Profile Picture" section showing current profile picture
- Current picture displays at 80×80px with label indicating source ("From Google Account" or "Custom")
- "Change Picture" button opens file picker (accepts .jpg, .png, .gif, max 5MB)
- After upload, image is cropped to square and resized to 200×200px
- Preview shows immediately after upload, with "Save" and "Cancel" options
- "Reset to Google Picture" option available if custom picture exists - restores Google OAuth default
- Profile picture changes propagate to all existing task completions immediately

**Acceptance Criteria:**
- File picker accepts .jpg, .png, .gif formats only
- File size validation: max 5MB, rejected with clear error if exceeded
- Image crop interface allows user to adjust square crop before upload
- Uploaded images stored in Supabase Storage
- Save updates `User.custom_profile_picture_url` field
- Reset clears custom URL, reverts to `google_profile_picture_url`
- All task completions by this user update to show new picture within 1 second
- Works offline: upload queued and synced when connectivity returns

**UI Flow:**
1. User taps Settings icon → Settings page
2. Sees "Profile Picture" section with current picture
3. Taps "Change Picture"
4. File picker opens → user selects image
5. Crop interface appears → user adjusts crop → taps "Save"
6. Upload progress indicator
7. Success message: "Profile picture updated"
8. Returns to Settings, sees new picture

---

#### F10: Task Management - Edit, Delete, and Add Tasks
**Priority: P0 (Launch Blocker)**

**Description:** Real-time task editing system that allows users (primary owners and caretakers) to adjust today's routine when puppies deviate from the planned schedule. Users can edit task times and activity types, delete tasks that didn't happen, and add unplanned tasks. All changes sync across devices in real-time using Firebase Firestore.

**Context:** Puppies are unpredictable. They don't always eat on schedule, need surprise potty breaks, or skip planned activities. A static routine that can't be adjusted makes the app feel disconnected from reality and reduces daily engagement.

**Core Capabilities:**

**1. Edit Existing Task (Expandable Card Interface)**
- **Trigger:** Tap anywhere on a task card (excluding checkbox/profile picture)
- **Behavior:** Card expands inline with 200ms smooth animation, revealing:
  - Time picker (defaults to current scheduled/actual time, 12-hour AM/PM format)
  - Activity type dropdown (pre-defined options: Potty Break, Meal, Training, Nap, Calm Time, Play Time, Walk)
  - "Save Changes" and "Cancel" buttons
- **State preservation:** Editing a completed task does NOT uncheck it - completion status and profile picture remain
- **Visual indicator:** After save, task shows pencil icon (✏️) to indicate it's been edited
- **Reordering:** If time is changed, task list automatically reorders chronologically with smooth animation

**2. Delete Task (Swipe-to-Delete with Confirmation)**
- **Scope:** Applies to ALL task types on the dashboard — both AI-generated routine items and user-added custom tasks. Every task card in the timeline supports swipe-to-delete.
- **Trigger:** Swipe LEFT on any task card (minimum 60px swipe distance)
- **Behavior:** Red "Delete" button appears on right side
- **Confirmation:** Tapping Delete shows modal: "Delete this task? This cannot be undone" with Cancel/Delete options
- **Result:** Task fades out (300ms animation), removed from list and database. For routine items, deletion is persisted so the task does not reappear on refresh.
- **Empty state:** If all tasks deleted, shows: "🐾 No tasks for today. Tap + to add a task"
- **Accessibility alternative:** Long-press (500ms) on task card shows context menu with "Edit Task" and "Delete Task" options

**3. Add New Task (Floating Action Button)**
- **UI element:** Circular FAB with "+" icon, positioned bottom-right (16px from edges, above safe area)
- **Specs:** 56px diameter, primary blue background, white icon
- **Trigger:** Tap FAB opens modal/bottom sheet
- **Modal fields:**
  - Time picker (defaults to current time)
  - Activity type dropdown (no default - user must select)
  - "Add Task" button (disabled until activity selected, gray → blue when enabled)
  - "Cancel" button
- **Result:** New task inserts in chronological position with smooth animation
- **Visual indicator:** New task shows pencil icon (✏️) to distinguish from AI-generated tasks
- **Validation:** Warning if time is >2 hours in past: "This was a while ago. Confirm?"

**4. Real-Time Multi-User Sync (Firebase Firestore)**
- **Sync speed:** Changes appear on all users' devices within 3 seconds
- **Optimistic updates:** Changes appear immediately for editing user, then sync in background
- **Conflict resolution:** Last-write-wins (whoever's edit reaches server last becomes final)
- **Offline support:** Changes queue locally, sync when connectivity restored
- **Network indicators:**
  - Connected: Subtle "✓ Synced" badge (auto-dismisses)
  - Offline: "⚠️ You're offline. Changes will sync when connected." (yellow banner, persistent)
  - Syncing: "⏳ Syncing changes..." (blue banner, brief)
  - Failed: "❌ Couldn't sync changes. Check your connection. [Retry]" (red banner, persistent)

**Acceptance Criteria:**
- Expandable card animation is smooth (200ms, no jank on mid-range mobile devices)
- Time picker and activity dropdown are touch-friendly (min 44px touch targets)
- Edited tasks show pencil icon (✏️) immediately after save
- Completed tasks remain checked when edited (checkbox/profile picture persists)
- Task list reorders chronologically without jarring jumps
- Swipe-to-delete works with minimum 60px swipe, doesn't conflict with scroll
- Delete confirmation modal prevents accidental deletions
- Long-press alternative works for accessibility (context menu appears after 500ms)
- FAB is visible on Dashboard only, positioned above device safe area
- Add Task button stays disabled (gray) until activity type selected
- New tasks insert in correct chronological position
- All changes sync to other users' devices within 3 seconds (when online)
- Optimistic UI updates appear within 100ms of user action
- Offline changes queue and sync automatically when reconnected
- Conflict resolution (last-write-wins) works without data corruption
- Network status banners appear/dismiss correctly
- Deleted task user tries to edit: card auto-collapses, toast: "This task was deleted by [Name]"
- Works with 20+ tasks without performance degradation

**Permissions:**
- **Both primary owner AND caretaker** can edit, delete, and add tasks (equal permissions in v1)
- Task edits/additions show attribution: "Last edited by [Name] at [Time]" in task detail view

**Visual States:**
```
Uncompleted, unedited:     7:00 AM  [ ] Breakfast
Uncompleted, edited:       7:15 AM  [ ] Breakfast  ✏️
Completed, unedited:       7:00 AM  [👤+🟢] Breakfast
Completed, edited:         7:15 AM  [👤+🟢] Breakfast  ✏️
User-added, uncompleted:   11:30 AM  [ ] Potty Break  ✏️
User-added, completed:     11:30 AM  [👤+🟢] Potty Break  ✏️
```

**Technical Implementation:**
- **Backend:** Firebase Firestore for real-time sync (recommended for v1)
  - Alternative: Custom Node.js + PostgreSQL + WebSockets (longer dev time)
- **Firestore structure:** `puppies/{puppyId}/tasks/{taskId}`
- **Security rules:** Users can read/write if they're primary owner OR in `sharedWith` array
- **Offline-first:** IndexedDB queue for edits, Firestore offline persistence enabled
- **Real-time listeners:** Automatic sync via Firestore real-time listeners
- **Animations:** CSS transitions (no heavy libraries)
- **Gestures:** react-swipeable or similar for swipe-to-delete

**Out of Scope (v1):**
- Multi-day task editing (only today's tasks editable)
- Undo/redo functionality
- Task notes/comments field
- Task duration tracking
- Recurring task templates
- Bulk operations (select multiple to delete)
- Version history/audit log (who edited what when - P1)
- Granular conflict resolution UI (last-write-wins is sufficient for v1)

---

### Out of Scope (v1)

| Feature | Rationale |
|---|---|
| Native mobile app (iOS/Android) | Web-first to reduce scope and enable cross-platform access. Evaluate native apps after validating product-market fit. |
| True AI routine generation (Claude API) | Client-side breed/age rules sufficient for v1. LLM integration adds cost/complexity - defer to P1 after validating core workflow. |
| More than 1 caretaker | Keep permissions simple. Expand to multi-caretaker in v1.1 based on demand. |
| In-app messaging between owner and caretaker | Adds significant complexity. Users already have iMessage/WhatsApp. |
| Vet appointment scheduling | Different problem space. Could be P2. |
| Puppy health records / medical log | Related but separate feature. P2. |
| Push notification reminders | P1. Important but not a launch blocker - the routine view itself is the MVP. |
| AI routine auto-adjustment over time | P1. The AI generates once; manual adjustments are available. Auto-learning comes later. |
| Multi-puppy support for a single owner | P1. Focus on the single-puppy experience first. |
| Social features (sharing progress with friends) | P2. Not core to the pain point. |
| Puppy photo/video journal | P2. Nice-to-have, not core. |
| Animated profile pictures | GIFs allowed in upload but displayed as static first frame. Animation is P2. |
| Profile picture galleries or avatar libraries | Must upload own image or use Google default. Pre-made avatars are P2. |
| Task completion history/changelog | Who completed → uncompleted → re-completed tracking is P2. |
| Multi-day task editing | Only today's tasks are editable in v1. Editing past/future days is P1. |
| Custom activity types | Pre-defined activity list only (Potty Break, Meal, Training, etc.). Custom activities are P1. |
| Task notes/comments on edited tasks | Users can add notes when completing tasks, but not when editing task time/type. Notes on edits are P1. |
| Task duration tracking | Tracking how long an activity actually took (vs. scheduled duration) is P2. |
| Undo/redo for task edits | Once saved, edits are permanent. Undo is P1. |
| Bulk task operations | Select multiple tasks to delete/edit at once is P2. |
| Granular task edit conflict resolution | Last-write-wins is sufficient for v1. UI showing "Mike edited this after you" is P1. |
| Recurring task templates | "Apply this change to all future occurrences" is P2. |
| Task edit version history/audit log | Full audit trail (who edited, what changed, when) is P1. Detail view shows "Last edited by" only. |

---

### Key User Flows

#### Flow 1: Primary Owner - First Time Setup
```
Open app (first launch)
  -> Welcome screen with Sign in with Google
  -> Authenticate via Google Sign-In (new account created, profile picture captured)
  -> Onboarding questionnaire (4 steps with progress bar)
  -> Complete questionnaire
  -> AI routine generation (loading screen, ~5-10 sec)
  -> View generated daily routine (main screen with unified progress tracker)
  -> (Optional) Tap settings -> Invite Caretaker -> Share link
```

#### Flow 2: Primary Owner - Daily Usage
```
Open app
  -> See today's routine (timeline view)
  -> See "Today's Progress" card: unified counter "3/17" + 18% circle
  -> Current activity is highlighted (orange left border for in-progress feeding task)
  -> Tap activity to open bottom sheet
  -> Tap "Mark as Complete" button
  -> Checkbox is replaced by user's profile picture with green dot at top-right corner
  -> Add optional note (if desired)
  -> Bottom sheet dismisses
  -> Timeline updates: completion visible as avatar with green dot
  -> Partner opens app → sees same unified progress + user's picture with green dot on completed tasks
  -> Partner can instantly scan timeline: "Sarah (her face) did morning tasks, I'll handle afternoon"
```

#### Flow 3: Caretaker - Accept Invite & Daily Usage
```
Receive invite link via message
  -> Tap link
  -> App opens in browser
  -> See invite screen ("Help care for [Puppy Name]!")
  -> Authenticate via Google Sign-In (if not already signed in, profile picture captured)
  -> Accept invite
  -> View today's routine (same view as owner, but no edit/settings access)
  -> Tap tasks to mark complete → checkbox replaced by caretaker's profile picture with green dot
  -> Owner opens app → sees unified progress + caretaker's picture with green dot on tasks they completed
  -> Visual coordination: Owner sees caretaker already did 7:00 AM Breakfast (caretaker's face), skips to next task
```

#### Flow 4: User Updates Profile Picture
```
User in app
  -> Taps Settings icon
  -> Settings page opens, shows "Profile Picture" section
  -> Current picture displayed (Google default) with "From Google Account" label
  -> Taps "Change Picture"
  -> File picker opens → selects photo
  -> Crop interface appears → adjusts crop → taps "Save"
  -> Upload progress
  -> Success: "Profile picture updated"
  -> Navigates to Dashboard
  -> All previously completed tasks now show new profile picture
```

#### Flow 5: User Edits Task When Puppy Deviates From Routine
```
Scenario: Puppy's breakfast happened 15 minutes late

User opens app
  -> Sees Daily Routine with:
     7:00 AM  [✓] Breakfast  ← Shows partner's profile picture with green dot
  -> Realizes breakfast actually happened at 7:15 AM (puppy was sleepy)
  -> Taps on "Breakfast" task card (NOT the checkbox)
  -> Card expands inline with time picker (7:00 AM) and activity dropdown (Meal)
  -> Changes time from 7:00 AM to 7:15 AM
  -> Taps "Save Changes"
  -> Card collapses, task now shows:
     7:15 AM  [✓] Breakfast  ✏️ ← Updated time + pencil icon + partner's picture still shows
  -> Task list reorders chronologically
  -> Change syncs to partner's device within 3 seconds
  -> Partner opens app → sees updated 7:15 AM time with ✏️ indicator
  -> Partner taps task detail → sees "Last edited by Sarah at 7:20 AM"
```

#### Flow 6: User Deletes Task That Didn't Happen
```
Scenario: Puppy skipped afternoon training session

User opens app
  -> Sees Daily Routine with:
     2:00 PM  [ ] Training session (10 min)
  -> Puppy was too tired, training didn't happen
  -> Swipes LEFT on task card
  -> Red "Delete" button appears
  -> Taps "Delete"
  -> Confirmation modal: "Delete this task? This cannot be undone"
  -> Taps "Delete" (confirming)
  -> Task fades out and disappears
  -> Deletion syncs to partner's device
  -> Partner opens app → task is gone
```

#### Flow 7: User Adds Unplanned Task
```
Scenario: Puppy had unexpected potty accident at 11:30 AM

User is with puppy
  -> Puppy has potty accident
  -> Opens app, sees routine with scheduled tasks
  -> Taps "+" FAB button at bottom-right
  -> Modal opens with:
     - Time picker (defaults to 11:30 AM, current time)
     - Activity dropdown (no selection, shows "Select activity")
     - "Add Task" button (grayed out, disabled)
  -> Selects "Potty Break" from dropdown
  -> "Add Task" button turns blue (enabled)
  -> Taps "Add Task"
  -> Modal dismisses
  -> New task appears in timeline:
     11:00 AM  [✓] Mid-morning nap
     11:30 AM  [ ] Potty Break  ✏️ ← New task with pencil indicator
     12:00 PM  [ ] Lunch
  -> New task syncs to partner's device within 3 seconds
  -> Partner sees the unplanned potty break in timeline
  -> Partner understands puppy had accident, adjusts expectations
```

---

### Data Model (High-Level)

```
User
  - id (UUID)
  - email
  - display_name
  - google_profile_picture_url (captured from Google OAuth)
  - custom_profile_picture_url (nullable, from user upload)
  - auth_provider (google)
  - created_at
  - updated_at

  computed field:
  - profile_picture_url = custom_profile_picture_url ?? google_profile_picture_url

Puppy
  - id (UUID)
  - name
  - breed
  - age_months (integer, at time of onboarding)
  - age_weeks (integer, at time of onboarding)
  - weight_kg
  - onboarding_date
  - owner_id (FK -> User) [primary owner]
  - questionnaire_data (JSON)
  - created_at

PuppyMembership
  - id (UUID)
  - puppy_id (FK -> Puppy)
  - user_id (FK -> User)
  - role (owner | caretaker)
  - status (active | removed)
  - joined_at

Invite
  - id (UUID)
  - puppy_id (FK -> Puppy)
  - invited_by (FK -> User)
  - invite_token (unique string)
  - status (pending | accepted | expired | revoked)
  - expires_at
  - accepted_by (FK -> User, nullable)
  - created_at

Routine
  - id (UUID)
  - puppy_id (FK -> Puppy)
  - generated_at
  - source (ai_generated | user_modified)
  - is_active (boolean)

RoutineItem
  - id (UUID)
  - routine_id (FK -> Routine)
  - activity_type (feeding | potty | exercise | training | nap | play | bedtime)
  - title
  - description
  - scheduled_time (original AI-generated time)
  - duration_minutes
  - sort_order

Task (daily instance of RoutineItem, supports editing)
  - id (UUID)
  - routine_item_id (FK -> RoutineItem, nullable if user-added)
  - puppy_id (FK -> Puppy)
  - date (YYYY-MM-DD, always today in v1)
  - scheduled_time (original time from AI routine)
  - actual_time (user-edited time, defaults to scheduled_time)
  - activity_type (potty_break | meal | training | nap | calm_time | play_time | walk)
  - title
  - description
  - is_completed (boolean)
  - is_edited (boolean, true if actual_time ≠ scheduled_time OR activity_type changed)
  - is_user_added (boolean, true if created via + FAB, not from AI routine)
  - completed_by_user_id (FK -> User, nullable) ← tracks who completed the task
  - completed_at (timestamp, nullable) ← tracks when task was completed
  - last_edited_by (FK -> User) ← tracks who last edited the task
  - last_edited_at (timestamp) ← tracks when task was last edited
  - created_at (timestamp)
  - updated_at (timestamp)
  - note (text, optional)

Relationships:
  - User has many TaskCompletions (as completer)
  - RoutineItem has many TaskCompletions (one per day)
  - TaskCompletion belongs to User and RoutineItem
  - Query for Dashboard joins TaskCompletion → User to fetch profile_picture_url

ProgressSummary (computed/cached)
  - puppy_id
  - week_start_date
  - completion_rate (unified across all users)
  - streak_days
  - activities_by_user (JSON - for detailed breakdown view, not summary card)
```

**Query Example for Dashboard:**
```sql
SELECT
  routine_items.*,
  task_completions.completed_at,
  users.profile_picture_url AS completer_profile_picture
FROM routine_items
LEFT JOIN task_completions ON routine_items.id = task_completions.routine_item_id
LEFT JOIN users ON task_completions.completed_by_user_id = users.id
WHERE routine_items.scheduled_date = CURRENT_DATE
  AND routine_items.puppy_id = :current_puppy_id
ORDER BY routine_items.scheduled_time ASC
```

---

### Technical Constraints & Requirements

| Requirement | Detail |
|---|---|
| Platform | Mobile-first web app. Responsive design with max-width constraint for desktop preview. |
| Language/Framework | **Vite + React + TypeScript** for frontend. Modern, fast dev experience with strong typing. |
| Styling | **Tailwind CSS v4** with `@theme` CSS variables for design tokens. **shadcn/ui** components written inline (not via CLI). |
| Routing | **State-based routing** (simple screen enum in App.tsx). No react-router to minimize dependencies. |
| Backend | **Supabase** (Postgres + Auth + Realtime + Edge Functions + Storage) for user/puppy data. **Firebase Firestore** for real-time task sync (task editing feature only). Hybrid approach: Supabase for structured data, Firestore for real-time collaboration. |
| AI Integration | **Client-side breed/age rules in v1** (mock AI). Future: Anthropic Claude API (claude-sonnet-4-5) server-side via Supabase Edge Function. |
| Auth | **Google OAuth only** via Supabase Auth. Captures `email`, `name`, `picture` from OAuth response. Single auth method simplifies flow and works universally. Firebase uses same Google auth token for security rules. |
| Deep Linking | URL-based invite flow with query parameters. Web-native, no app store deferred deep linking required. |
| Image Storage | **Supabase Storage** for custom profile pictures. Google profile pictures stored as URLs only (Google hosts). |
| Image Processing | Client-side crop/resize before upload (use library like `react-image-crop`). Max 5MB, allowed types: .jpg, .png, .gif. Server-side validation. |
| Offline Support | Core routine view and activity completion work offline with local-first data. **Firestore offline persistence** for task edits (built-in). IndexedDB or localStorage for other data. Background sync when reconnected. |
| Real-time Sync | **Task edits, deletions, additions sync within 3 seconds** via Firestore real-time listeners. Activity completions and profile picture updates sync within 5 seconds via Supabase Realtime. |
| Task Management Gestures | **Swipe-to-delete** using react-swipeable or similar. **Long-press (500ms)** context menu for accessibility. Touch targets min 44px. |
| Conflict Resolution | **Last-write-wins** for task edits (Firestore server timestamp determines final value). No UI for conflict resolution in v1. |
| Performance | Dashboard query < 500ms even with 50+ tasks. Profile pictures lazy-load, cached client-side. Task list handles 20+ tasks without jank on mid-range mobile. Animations run at 60fps. |
| Data Privacy | COPPA not applicable (users are adults). Standard privacy policy required. Puppy data is not sensitive PII but should be encrypted at rest. |
| Browser Support | Modern browsers: Chrome, Safari, Firefox, Edge. Minimum iOS Safari 15+, Android Chrome 90+. |
| Accessibility | WCAG 2.1 AA compliance. Keyboard navigation, screen reader support, sufficient color contrast. Long-press alternative to swipe gesture for motor accessibility. |

---

## 2. WHY are we building this?

### Problem Statement

New puppy owners are overwhelmed. They face a firehose of conflicting advice from Google, YouTube, breeders, and well-meaning friends about how to raise their puppy. The result is inconsistency - irregular feeding times, missed potty breaks, skipped training sessions - which leads to behavioral problems and a stressed household. When multiple family members or partners share puppy duties, the lack of coordination makes it worse: nobody knows if the puppy has been fed, when the last potty break was, or whether training happened today.

**The deeper problem:** Even when owners have a plan (AI-generated or otherwise), puppies don't follow it. A puppy skips breakfast, needs an unplanned potty break, or falls asleep during training time. A static routine that can't be adjusted to reflect reality becomes "decoration" rather than a useful tool. Users stop opening the app after a few days because it shows what *should* happen, not what *actually* happened. Without the ability to edit tasks, users resort to keeping separate notes in their Notes app or texting their partner ("BTW he didn't eat lunch, did it at 2 instead"), defeating the purpose of a shared tracking tool. There is no simple tool that says "here's exactly what to do today" AND lets users adapt when reality diverges, all while keeping the whole household on the same page without creating scorekeeping dynamics.

### Impact Hypothesis

We believe that **providing new puppy owners with a personalized daily routine, real-time task editing, and a shared tracking tool with visual attribution** will **reduce the anxiety of puppy ownership, improve consistency in puppy care routines, and increase daily app engagement**. We will know we are right when:
- 60%+ of users who complete onboarding are still using the app daily after 2 weeks
- **At least 60% of users edit or add at least one task per day within the first week** (validates that task editing solves a real pain)
- **7-day retention improves by 25%** compared to static routine baseline (task editing reduces abandonment)
- Users report reduced stress in puppy care (in-app survey, NPS > 40)
- Caretaker invite conversion rate > 30% (owners invite, caretakers accept and use)
- Reduced "Did you feed the puppy?" messages between household members (measurable via user surveys)
- Qualitative feedback indicating the app "feels more helpful" or "adapts to my puppy" (validates flexibility value)

### Opportunity Size

- **Large market:** ~6.5 million puppies are brought home annually in the US alone. The "new puppy" window (0-12 months) is a high-intent, high-anxiety period where owners actively seek guidance.
- **High willingness to pay:** Puppy owners already spend $1,500-$3,000 in the first year on supplies, vet visits, and training. A $5-10/month app is a rounding error.
- **Viral potential:** Every puppy owner has family members, partners, or roommates involved in care - the caretaker invite is a built-in growth loop.
- **Multi-caretaker households:** 60-70% of users (estimated from market research). Profile picture attribution directly addresses coordination needs for this majority segment.

### Competitive Landscape

| Competitor | What it does | Why it's insufficient |
|---|---|---|
| Puppy Coach App | Training video library | Passive content, no personalized routine, no collaborative tracking |
| Pupford | Training courses + treats | Course-based, not a daily routine tool. No family coordination. |
| Generic to-do apps (Todoist, etc.) | Task lists | No puppy-specific intelligence. Manual setup. No AI. Uses text labels for attribution (clunky on mobile). |
| Spreadsheets/whiteboards | DIY tracking | Fragile, not mobile-friendly, no intelligence, quickly abandoned |
| Breeders' printed schedules | Static PDF routines | One-size-fits-all, not personalized, can't track against it |
| Household management apps (Cozi, OurHome) | Use avatars for assignments but not completion attribution. Not pet-specific. |

**Key differentiator:** No existing product combines AI-personalized routine generation with collaborative real-time tracking and visual attribution (profile pictures) purpose-built for puppy care. Profile pictures provide faster visual scanning than text labels, reducing friction in multi-caretaker coordination.

---

## 3. WHO are we building for?

### Primary Persona: Sarah, the First-Time Puppy Owner

- **Age:** 28-35
- **Situation:** Lives with a partner in a 2-bedroom apartment. Just brought home a 10-week-old Golden Retriever named Biscuit.
- **Context:** Sarah works from home 3 days a week, in-office 2 days. Her partner works full-time in an office. On in-office days, Biscuit is alone from 8am-12pm when a neighbor checks in.
- **Goals:** Potty train Biscuit within 4 weeks. Establish a consistent feeding and sleep schedule. Make sure Biscuit gets enough socialization and exercise without overdoing it (she read about puppy joint damage from over-exercise).
- **Frustrations:**
  - "Every website says something different about how often to feed a 10-week-old puppy."
  - "My partner fed Biscuit at 6pm but I didn't know, so I fed him again at 7pm."
  - "I don't know if 30 minutes of walking is too much for his age."
  - "I feel guilty when I realize we missed a training session because the day got away from us."
  - "I hate texting my partner mid-meeting to ask 'Did you walk Biscuit?'"
  - **"Biscuit didn't eat breakfast on schedule - he was sleepy and ate at 7:30 instead of 7:00. Now the app is wrong and I can't fix it."**
  - **"The app says he should have a potty break at 10am, but he already had an accident at 9:30. I want to log that but I can't add it."**
  - **"I'm just checking off tasks at the wrong times because the app won't let me adjust. This defeats the whole purpose."**
- **Current workaround:** A shared Google Doc titled "Biscuit Schedule" that was filled in enthusiastically on day 1 and abandoned by day 4 because it's clunky to check on a phone. Now she texts her partner when things happen off-schedule and keeps notes in her Notes app about "what actually happened" vs. the plan.
- **Why profile pictures solve coordination:** Sarah opens the app, sees her partner's picture next to "7:00 AM Breakfast" - instant relief, no text needed. She trusts the system and can focus on work.
- **Why task editing solves flexibility:** Biscuit ate at 7:30 instead of 7:00. Sarah taps the task, changes the time to 7:30, saves. Now the app reflects reality. Her partner sees "7:30 AM Breakfast ✏️" and knows what actually happened. No dual systems, no notes app, no confusion.

### Secondary Persona: Mike, the Caretaker (Sarah's Partner)

- **Age:** 30
- **Situation:** Works full-time in an office. Handles morning and evening puppy duties. Wants to help but doesn't want to research puppy care deeply - he trusts Sarah to set the plan.
- **Goals:** Know exactly what to do and when. Mark things done so Sarah knows he handled it. Not mess things up. Get credit for the work he's doing without seeming petty.
- **Frustrations:**
  - "I don't know if I should take him out for a potty break now or if Sarah already did."
  - "I want to help but I don't want to accidentally do the wrong thing."
  - "Sarah texts 'did you feed him?' when I already checked it off - she didn't look at the app."
  - **"Biscuit refused to eat lunch at noon - he was playing and wouldn't come inside. I fed him at 1pm but the app still says noon. Now Sarah will think I forgot."**
  - **"I want to log that Biscuit had an accident at 11am so Sarah knows, but I can't add it to the timeline."**
- **Needs from the app:** Open it, see what's next, do it, check it off. If timing changes, adjust it quickly. That's it.
- **Why profile pictures solve coordination:** Mike checks off tasks throughout the day; his picture auto-populates. Sarah sees his picture, doesn't need to ask. Mike feels trusted, Sarah feels informed.
- **Why task editing solves flexibility:** Biscuit refused lunch at noon, Mike fed him at 1pm. Mike taps task, changes time to 1pm, saves. Sarah opens app, sees "1:00 PM Lunch ✏️" with Mike's picture. She knows what happened without a text. Mike feels competent, not anxious.

### Anti-Persona: NOT for

- **Professional dog trainers:** They have their own methodologies and client management tools. This app is not a trainer-client platform.
- **Experienced multi-dog owners:** They've developed their own systems and don't need AI guidance.
- **Puppy mill operators or breeders managing litters:** This is a consumer app for household pet owners.
- **Cat owners:** (Obviously, but worth stating - the AI models, routines, and content are entirely dog-specific.)
- **Single dog owners living alone:** Profile picture attribution provides minimal value (always their own picture). However, the feature doesn't hurt them - just neutral.

---

## 4. WHAT pain point does this solve?

### Core Pain

**New puppy owners lack a clear, personalized, and *adaptable* shared daily plan for their puppy, leading to inconsistent care and household friction. Co-caretakers waste mental energy re-confirming task completion because they lack passive visibility into who did what. Static routines that can't be adjusted when puppies deviate make apps feel disconnected from reality, causing users to abandon the tool and revert to fragmented workarounds (notes apps, texting).**

### Pain Severity: **High**

This is major daily friction. Inconsistent routines directly cause behavioral problems (potty accidents, destructive chewing, sleep disruption), which are the #1 reason puppies are returned to shelters in their first year. The stakes feel high to owners even though the solution is "just be consistent" - the problem is that consistency is hard without a tool. The coordination pain creates low-grade relationship friction multiple times daily.

### Current Workaround

Owners cobble together advice from Google, Reddit, breeder handouts, and YouTube into a mental model or a shared doc/spreadsheet. For coordination, they text/call each other ("Did you walk the dog yet?"), check physical notes (whiteboards, sticky notes), or just assume and risk duplication/missed tasks. **When puppies deviate from the plan, users either (1) ignore the deviations and check off tasks at the wrong times (corrupts tracking data), (2) keep separate notes in Notes app or on paper about what actually happened (defeats purpose of shared tool), or (3) stop using the app entirely after a few days because it doesn't reflect reality.** The workaround fails because:
- It requires manual research and synthesis (time-consuming, error-prone)
- It's not personalized to their specific breed, age, and living situation
- Shared docs are clunky on mobile and nobody updates them consistently
- **Static plans can't be adjusted when puppies are unpredictable, making the tool feel useless**
- There's no feedback loop - no way to see if you're actually sticking to the plan OR what actually happened vs. what was planned
- Manual communication interrupts work, meetings, sleep and doesn't scale (if you add a third caretaker, group chats become chaotic)
- Keeping dual systems (app for planned routine + notes for actuals) is too much cognitive overhead

### Pain Frequency: **Multiple times daily**

Every feeding, potty break, walk, training session, and nap is an opportunity for confusion or inconsistency. A puppy owner faces 10-15 of these decision points per day. Coordination checks happen 3-5 times per day in multi-caretaker households, peaking during transition times (morning handoff, evening return).

### Emotional Dimension

- **Anxiety:** "Am I doing this right? Is my puppy developing normally?" "What if something critical was missed?"
- **Guilt:** "I forgot the afternoon training session again." "I don't want to nag, but I need to know."
- **Frustration:** "My partner didn't log anything, so I don't know what happened today." "I shouldn't have to ask - the app should just tell me."
- **Overwhelm:** "There's so much conflicting information, I don't even know where to start."
- **Fear:** "If I mess up the critical early months, will my dog have behavioral problems forever?"
- **Mistrust/Relationship Friction:** "I don't want to seem controlling by asking if he fed the puppy."
- **Desired emotion:** **Calm confidence** — Open app, see partner's picture next to completed task, think "Oh good, he handled breakfast," close app and move on with day.

New puppy owners experience a phenomenon often called the "puppy blues" - a period of regret and overwhelm in the first weeks. A clear, trustworthy daily plan with passive visibility directly addresses this by replacing uncertainty with structure and reducing coordination overhead.
