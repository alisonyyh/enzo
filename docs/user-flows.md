# PupPlan - User Flows

## Flow 1: Primary Owner - First Time Setup

### Step 1: App Launch & Authentication
```
Screen: Welcome Screen
- App logo + tagline: "A smarter routine for your new puppy"
- [Sign in with Google] (Google OAuth button)
  -> Triggers Google OAuth sign-in flow
  -> If user has an existing PupPlan account: sign in and route to
     main app (daily routine view)
  -> If user is new (no existing account): create account and route
     to onboarding questionnaire (Step 2)
- All users are treated as primary owners by default unless they
  have accepted an invite link from another primary owner
- Terms of Service + Privacy Policy links at bottom
```

### Step 2: Onboarding Questionnaire (New Primary Owners Only)
```
Screen: Questionnaire (multi-step, 4 screens)
- Progress bar at the top of each screen showing completion
  (e.g., filled segments: ██░░ 1 of 4)
- Progress bar persists across all steps so the user can
  estimate how long the onboarding will take

Step 1/4 - "Tell us about your puppy"
  - Puppy's name (text input, required)
  - Breed (searchable dropdown, required, includes "Mixed/Unknown")
  - Upload a photo (optional, camera or photo library)

Step 2/4 - "How old is your puppy?"
  - Months (integer input field, required)
  - Weeks (integer input field, required)
    Note: Both fields displayed together. User enters e.g.
    Months: 3, Weeks: 2 for a puppy that is 3 months and 2 weeks old.
    Input restricted to integers only (no decimals, no text).
    Validation: months >= 0, weeks >= 0, total age must be > 0.
  - Current weight (lbs or kg toggle)

Step 3/4 - "Where does your puppy live?"
  - Living situation (single select):
    [ ] Apartment
    [ ] House with yard
    [ ] House without yard

Step 4/4 - "Tell us about your schedule"
  - Typical work arrangement (single select):
    [ ] Work from home
    [ ] Office/hybrid (specify days in office)
    [ ] Shift work (specify typical hours)
    [ ] Stay at home / retired
  - What time do you usually wake up? (time picker)
  - What time do you usually go to bed? (time picker)

-> CTA: "Generate My Puppy's Routine"
```

### Step 4: AI Routine Generation
```
Screen: Generation Loading
- Animated puppy illustration
- Rotating messages:
  "Analyzing [Puppy Name]'s breed characteristics..."
  "Calculating age-appropriate exercise needs..."
  "Building a personalized daily routine..."
  "Almost ready!"
- Progress bar (cosmetic, ~8-10 seconds)

-> Auto-transition to routine view on completion
```

### Step 5: Routine Reveal
```
Screen: Your Puppy's Routine (Main Screen)
- Header: "[Puppy Name]'s Day" + today's date
- Celebration moment: "Your routine is ready!" (dismiss after 3 sec or tap)
- Timeline view showing all activities for the day
- Floating tooltip: "Tap any activity to mark it done" (first-time only)
- Bottom tab: option to view Progress or Settings
```

---

## Flow 2: Primary Owner - Daily Usage

### Opening the App
```
Screen: Daily Routine (Main Screen)
- Header: "[Puppy Name]'s Day - [Day of Week], [Date]"
- Current time indicator line on the timeline
- Activities grouped by time:

  6:30 AM  [ ] Wake up & potty break                    🟢 Upcoming
  7:00 AM  [👤+🟢] Breakfast (1/2 cup kibble)            ✅ Completed
  7:30 AM  [ ] Morning play session (15 min)             🔵 In Progress
  8:30 AM  [ ] Potty break                               ⚪ Upcoming
  9:00 AM  [ ] Crate time / nap (1 hr)                   ⚪ Upcoming
  ...
  10:00 PM [ ] Final potty break & bedtime               ⚪ Upcoming

Note on completion indicators:
- Completed tasks show the profile picture of the person who
  completed them (👤) with a green dot (🟢) at the top-right corner
- Example: If Sarah completed "Breakfast," her profile picture
  appears in place of the checkbox with a green completion dot
- This provides instant visual attribution of who did what
- Uncompleted tasks show an empty checkbox [ ]
```

### Completing an Activity
```
Completion is done by tapping the status icon (circle) on the
RIGHT side of the task card — NOT by tapping the card itself.

User taps the circle icon (○) on "Morning play session"

-> Activity completion indicator updates:
   • Instead of a simple checkmark, the UI displays the profile
     picture of the user who completed the task (either primary
     owner or caretaker)
   • A green dot indicator appears at the top-right corner of
     the profile picture to signify completion status
-> Next activity highlights as current

To undo: User taps the completed avatar icon again
-> Completion is reversed, empty circle reappears

Note: Tapping the CARD itself (not the status icon) opens the
"Edit Task" bottom sheet where the user can adjust time, activity
type, and notes. See Flow 6A for full details.

Visual attribution benefit:
- Users can scan the timeline and immediately see who completed
  which tasks without tapping into each activity
- Creates team accountability and visibility of shared effort
- Works for both single-user (reinforces personal accomplishment)
  and multi-user households (shows division of labor)
```

### Viewing Progress
```
User taps "Progress" tab

Screen: Weekly Progress
- This Week's Score: 78% (circular progress ring)
- Streak: 3 days in a row 🔥
- Daily breakdown (horizontal bar per day):
  Mon: ████████░░ 80%
  Tue: ██████████ 100%
  Wed: ███████░░░ 70%
  Thu: (today, in progress)

- Activity Breakdown:
  Potty breaks:  95% completion
  Feeding:       100% completion
  Training:      45% completion  ⚠️
  Exercise:      80% completion

- Team Activity:
  Sarah: 62% of completions
  Mike:  38% of completions
```

---

## Flow 3: Inviting a Caretaker

### Owner Sends Invite
```
Screen: Settings > Manage Caretakers

Current Caretakers: None yet

[+ Invite a Caretaker]

User taps "Invite a Caretaker"
-> Bottom sheet:
  "Invite someone to help care for [Puppy Name]"
  "They'll be able to view the routine and mark
   activities as done, but can't change settings."

  [Generate Invite Link]

User taps "Generate Invite Link"
-> iOS Share Sheet appears with the link
-> User can copy, iMessage, WhatsApp, etc.

After sharing:
-> Manage Caretakers screen shows:
  Pending Invites:
  🔗 Invite sent (expires in 72 hours)  [Revoke]
```

### Owner Sees Acceptance
```
Screen: Settings > Manage Caretakers

Caretakers:
  👤 Mike (mike@email.com)
  Role: Caretaker
  Joined: Feb 7, 2025
  [Remove]

-> Push notification (P1): "Mike accepted your invite
   to help care for [Puppy Name]!"
```

---

## Flow 4: Caretaker - Accept Invite & Onboarding

### Step 1: Receiving the Link
```
Caretaker receives a message (iMessage, WhatsApp, etc.):
"Hey, I set up a routine for Biscuit! Download PupPlan
 and help me track his schedule: https://pupplan.app/invite/abc123"
```

### Step 2a: App Not Installed
```
Tap link -> Safari opens
-> App Store redirect (with deferred deep link stored)
-> User downloads and installs PupPlan
-> Opens app for first time
-> App detects deferred deep link
-> Shows invite screen (Step 3)
```

### Step 2b: App Already Installed
```
Tap link -> Universal Link opens PupPlan directly
-> Shows invite screen (Step 3)
```

### Step 3: Accept Invite Screen
```
Screen: You've Been Invited!

  [Puppy Photo]
  "Sarah invited you to help care for Biscuit!"
  Breed: Golden Retriever
  Age: 10 weeks

  "As a caretaker, you can view Biscuit's daily routine
   and mark activities as complete."

  [Accept Invite] (primary button)
  [Decline] (text link)

User taps "Accept Invite"
-> If not signed in: Welcome screen with Google Sign-In
   (same as primary owner flow, but after auth the user
   is routed back to accept the invite rather than onboarding)
-> If already signed in: invite accepted immediately

-> Transition to Biscuit's daily routine view
```

### Step 4: Caretaker Daily View
```
Screen: Daily Routine (same as owner view)

Differences from owner view:
- No "Settings" access for the puppy
- No "Edit Routine" option
- No "Invite Caretaker" option
- Can mark activities complete
- Can add notes to activities
- Can view progress

Bottom nav shows:
  [Routine] [Progress]

(No settings tab for the puppy - only personal account settings)
```

---

## Flow 5: Error & Edge Cases

### Expired Invite Link
```
Caretaker taps an expired invite link

Screen: Invite Expired
  "This invite link has expired."
  "Ask [Owner Name] to send you a new invite."
  [OK]
```

### Revoked Invite
```
Caretaker taps a revoked invite link

Screen: Invite No Longer Valid
  "This invite is no longer active."
  "Contact the puppy's owner for a new invite."
  [OK]
```

### Offline Mode
```
User opens app without internet connection

Screen: Daily Routine (loaded from local cache)
- Banner at top: "You're offline. Changes will sync when connected."
- User can still mark activities complete
- Completions are queued locally
- When connectivity returns:
  -> Sync happens in background
  -> Banner dismisses
  -> Any conflicts resolved (last-write-wins for same activity)
```

### Caretaker Removed
```
Owner removes caretaker from Settings

Caretaker's next app open:
Screen: Access Removed
  "You no longer have access to [Puppy Name]'s routine."
  "Contact [Owner Name] if you think this is a mistake."
  [OK]

-> Caretaker's app returns to empty state or their own puppy (if they have one)
```

---

## Flow 6: Task Management - Edit, Delete, and Add Tasks

**Context:** Puppies don't always follow their planned routine. Users (both primary owners and caretakers) need to adjust today's task list to reflect what actually happened. This includes editing task times and activity types, deleting tasks that didn't happen, and adding unplanned tasks.

### Flow 6A: Edit Any Task (Custom or AI-Generated)

**Context:** All tasks — both custom (user-added) and AI-generated routine tasks — are edited using the same bottom sheet modal. Tapping any task card in the timeline opens the "Edit Task" bottom sheet pre-populated with the task's current data. This provides a consistent, spacious editing experience regardless of task origin.

The bottom sheet includes three fields: Time, Activity Type, and Notes. For AI-generated tasks, the Notes field is pre-populated with the AI description (e.g., "Take outside 15-30 minutes after eating"). For custom tasks, Notes is empty unless the user has previously saved a note.

#### Scenario 1: User edits a custom task's time

```
Screen: Daily Routine

User sees:
  11:30 AM  [ ] Potty Break  ✏️  (custom task)

User taps on the "Potty Break" task card (NOT the status icon)

-> Bottom sheet slides up (same component as "Add Custom Task"):

  ┌─────────────────────────────────────────────┐
  │              Edit Task                       │
  │                                             │
  │ Time                                        │
  │ [🕐 11:30 AM]  (pre-populated with task's  │
  │                  current time)              │
  │                                             │
  │ Activity Type                               │
  │ ┌──────────────┐  ┌──────────────┐         │
  │ │ 🚽 Potty     │  │ 🍽️ Meal      │         │
  │ │ Break  [SEL] │  │              │         │
  │ └──────────────┘  └──────────────┘         │
  │ ┌──────────────┐  ┌──────────────┐         │
  │ │ 🎓 Training  │  │ 😴 Nap       │         │
  │ └──────────────┘  └──────────────┘         │
  │ ┌──────────────┐  ┌──────────────┐         │
  │ │ 🧘 Calm Time │  │ 🎾 Play Time │         │
  │ └──────────────┘  └──────────────┘         │
  │ ┌──────────────┐                           │
  │ │ 🚶 Walk      │                           │
  │ └──────────────┘                           │
  │                                             │
  │ Notes                                       │
  │ ┌───────────────────────────────────────┐   │
  │ │                                       │   │
  │ │  (empty — no description for this     │   │
  │ │   custom task)                        │   │
  │ │                                       │   │
  │ └───────────────────────────────────────┘   │
  │                                             │
  │ [Cancel]              [Save Changes]       │
  └─────────────────────────────────────────────┘

User changes time from 11:30 AM to 11:45 AM
User changes activity from "Potty Break" to "Walk"
User taps "Save Changes"

-> Bottom sheet dismisses
-> Task updates in timeline:
  11:45 AM  [ ] Walk  ✏️

-> Task list automatically reorders chronologically (if needed)
-> Changes sync to all users (owner & caretakers) within 3 seconds
```

#### Scenario 2: User edits an AI-generated task

```
Screen: Daily Routine

User sees:
  7:00 AM  [ ] Breakfast
                1/2 cup kibble — wait 30 min before play

User taps on the "Breakfast" task card (NOT the status icon)

-> Bottom sheet slides up:

  ┌─────────────────────────────────────────────┐
  │              Edit Task                       │
  │                                             │
  │ Time                                        │
  │ [🕐 7:00 AM]  (pre-populated from routine) │
  │                                             │
  │ Activity Type                               │
  │ ┌──────────────┐  ┌──────────────┐         │
  │ │ 🚽 Potty     │  │ 🍽️ Meal      │         │
  │ │ Break        │  │       [SEL]  │         │
  │ └──────────────┘  └──────────────┘         │
  │ ┌──────────────┐  ┌──────────────┐         │
  │ │ 🎓 Training  │  │ 😴 Nap       │         │
  │ └──────────────┘  └──────────────┘         │
  │ ┌──────────────┐  ┌──────────────┐         │
  │ │ 🧘 Calm Time │  │ 🎾 Play Time │         │
  │ └──────────────┘  └──────────────┘         │
  │ ┌──────────────┐                           │
  │ │ 🚶 Walk      │                           │
  │ └──────────────┘                           │
  │                                             │
  │ Notes                                       │
  │ ┌───────────────────────────────────────┐   │
  │ │ 1/2 cup kibble — wait 30 min before  │   │
  │ │ play                                  │   │
  │ │                                       │   │
  │ └───────────────────────────────────────┘   │
  │   ↑ Pre-populated with AI description.     │
  │     User can edit or replace this text.    │
  │                                             │
  │ [Cancel]              [Save Changes]       │
  └─────────────────────────────────────────────┘

User changes time from 7:00 AM to 7:15 AM
User edits notes from "1/2 cup kibble — wait 30 min before play"
  to "1/2 cup kibble + a spoon of pumpkin"
User taps "Save Changes"

-> Bottom sheet dismisses
-> Task updates in timeline:
  7:15 AM  [ ] Breakfast  ✏️
                1/2 cup kibble + a spoon of pumpkin

-> ✏️ indicator appears (task has been edited from original)
-> Changes sync to all users (owner & caretakers) within 3 seconds
-> Other users see the updated time and notes
```

#### Key differences from "Add New Task" mode:
```
- Title: "Edit Task" (not "Add Custom Task")
- Time picker: Pre-populated with existing time (not current time)
- Activity grid: Current activity type pre-selected/highlighted
- Notes: Pre-populated with description (AI tasks) or empty (custom tasks)
- Primary button: "Save Changes" (not "Add Task")
- Save behavior: Updates existing task (not creates new one)

State during editing:
- If task was already completed (✓), it stays completed after edit
- Editing does NOT uncheck the task
- ✏️ indicator appears after any edit (always present on custom tasks,
  added to AI tasks once edited)
- Tapping outside the sheet or "Cancel" dismisses with no changes
```

#### Bottom Sheet Fields (Edit Mode)
```
The bottom sheet reuses the same AddTaskFAB component with an
"edit mode" flag and the existing task data passed as props:

1. Time Picker
   - Pre-populated with the task's current time
   - Allows selection of any time today
   - Format: 12-hour with AM/PM

2. Activity Type Grid (2-column emoji grid)
   - Same 7 pre-defined options as "Add New Task":
     🚽 Potty Break | 🍽️ Meal
     🎓 Training    | 😴 Nap
     🧘 Calm Time   | 🎾 Play Time
     🚶 Walk
   - Current activity type is pre-selected (highlighted)
   - User can tap a different option to change it

3. Notes (multiline text input)
   - Label: "Notes"
   - Placeholder: "Add a note..." (shown when empty)
   - For AI-generated tasks: pre-populated with the task's
     description (e.g., "Take outside 15-30 minutes after eating")
   - For custom tasks: empty unless user previously saved a note
   - Multiline text area, auto-grows up to 3 lines, then scrolls
   - Max length: 200 characters
   - Optional — can be left empty or cleared entirely

4. Buttons
   - Cancel: Dismisses sheet, no changes saved
   - Save Changes: Updates existing task (time, activity type,
     and notes), syncs to all users, dismisses sheet
```

#### Multi-User Sync Behavior
```
Sarah edits "Breakfast" from 7:00 AM → 7:15 AM at 7:20 AM

Mike's device (3 seconds later):
-> Task automatically updates to show 7:15 AM
-> Edited indicator (✏️) appears
-> If Mike taps into task details: "Last edited by Sarah at 7:20 AM"
-> No notification sound (silent sync to avoid disruption)

Offline handling:
- If Sarah edits while offline:
  -> Change appears immediately on her device
  -> Banner shows: "You're offline. Changes will sync when connected."
  -> When connectivity returns, change syncs to server and other devices

Conflict resolution (rare):
- Sarah and Mike both edit same task while offline
- Last-write-wins: Whoever's edit reaches server last becomes the final value
- No conflict UI in v1 (accepted trade-off for simplicity)
```

---

### Flow 6B: Delete a Task

**Applies to all task types:** Both AI-generated routine tasks and user-added custom tasks can be deleted using the same swipe-to-delete interaction.

#### Scenario: Puppy skipped afternoon training session entirely

```
Screen: Daily Routine

User sees:
  2:00 PM  [ ] Training session (10 min)

User swipes LEFT on the task card
-> Swipe gesture reveals red "Delete" button (min 60px swipe distance)

  ┌───────────────────────────────────┬─────────┐
  │ 2:00 PM  [ ] Training session     │ Delete  │
  │          (10 min)                  │         │
  └───────────────────────────────────┴─────────┘
                                        ↑ Red button

User taps "Delete"

-> Confirmation modal appears:

  ┌─────────────────────────────────────────────┐
  │              Delete Task?                   │
  │                                             │
  │  Are you sure you want to delete this task? │
  │  This action cannot be undone.              │
  │                                             │
  │         [Cancel]    [Delete]                │
  │                      ↑ Red, destructive     │
  └─────────────────────────────────────────────┘

User taps "Delete" (confirming)

-> Modal dismisses
-> Task card fades out (300ms animation)
-> Task removed from list
-> Deletion syncs to all users within 3 seconds
-> If all tasks are deleted: Empty state appears

Empty state:
  ┌─────────────────────────────────────────────┐
  │         🐾                                  │
  │    No tasks for today                      │
  │    Tap + to add a task                     │
  └─────────────────────────────────────────────┘
```

#### Multi-User Deletion Sync
```
Sarah deletes "Training session" at 2:05 PM

Mike's device (3 seconds later):
-> "Training session" task disappears with fade animation
-> No confirmation modal on Mike's side (already confirmed by Sarah)
-> Task list reflows to fill the gap

Offline deletion:
- Sarah deletes while offline
- Task disappears immediately on her device
- Banner: "You're offline. Changes will sync when connected."
- When reconnected, deletion syncs to server and Mike's device
```

#### Accessibility Alternative to Swipe
```
For users who cannot perform swipe gestures:

Long-press (500ms) on task card triggers context menu:
  ┌─────────────────────────────────────────────┐
  │  • Edit Task                                │
  │  • Delete Task                              │
  │  • Cancel                                   │
  └─────────────────────────────────────────────┘

Tapping "Delete Task" shows same confirmation modal as swipe-to-delete
```

---

### Flow 6C: Add a New Task

#### Scenario: Puppy had an unplanned potty accident at 11:30 AM

```
Screen: Daily Routine

User sees floating action button (FAB) at bottom-right corner:

  ┌─────────────────────────────────────────────┐
  │                                             │
  │  Task list here...                          │
  │                                             │
  │                                             │
  │                                    [ + ]    │ <- FAB
  │                                             │
  └─────────────────────────────────────────────┘

FAB specs:
- Position: 16px from bottom, 16px from right edge
- Above device safe area (respects iOS home indicator)
- Visible only on Dashboard/Daily Routine screen
- Circular button, 56px diameter
- Blue background (primary color), white "+" icon

User taps "+" FAB

-> Modal/bottom sheet slides up:

  ┌─────────────────────────────────────────────┐
  │           Add Custom Task                   │
  │                                             │
  │ Time                                        │
  │ [🕐 11:30 AM ▼]  (defaults to current time)│
  │                                             │
  │ Activity Type                               │
  │ ┌──────────────┐  ┌──────────────┐         │
  │ │ 🚽 Potty     │  │ 🍽️ Meal      │         │
  │ │ Break        │  │              │         │
  │ └──────────────┘  └──────────────┘         │
  │ ┌──────────────┐  ┌──────────────┐         │
  │ │ 🎓 Training  │  │ 😴 Nap       │         │
  │ └──────────────┘  └──────────────┘         │
  │ ┌──────────────┐  ┌──────────────┐         │
  │ │ 🧘 Calm Time │  │ 🎾 Play Time │         │
  │ └──────────────┘  └──────────────┘         │
  │ ┌──────────────┐                           │
  │ │ 🚶 Walk      │                           │
  │ └──────────────┘                           │
  │                                             │
  │ Notes                                       │
  │ ┌───────────────────────────────────────┐   │
  │ │ Add a note...  (placeholder)          │   │
  │ └───────────────────────────────────────┘   │
  │   ↑ Optional. Empty by default for new     │
  │     custom tasks.                          │
  │                                             │
  │ [Cancel]              [Add Task]           │
  │                        ↑ Disabled until    │
  │                          activity selected │
  └─────────────────────────────────────────────┘

User selects "Potty Break" from emoji grid
-> [Add Task] button becomes enabled (changes from gray to primary)

User optionally types a note: "Emergency accident near the door"

User taps "Add Task"

-> Modal dismisses
-> New task appears in chronological position:

  11:00 AM  [✓] Mid-morning nap
  11:30 AM  [ ] Potty Break  ✏️ ← New task with edited indicator
  12:00 PM  [ ] Lunch

-> Task list reorders with smooth animation
-> New task syncs to all users within 3 seconds
-> Task shows edited indicator (✏️) to distinguish from AI-generated tasks
```

#### New Task Attributes
```
When user adds a task:
- scheduledTime: Set to user-selected time
- actualTime: Same as scheduledTime
- activityType: User-selected from emoji grid
- description: User-entered notes (optional, can be empty string)
- isCompleted: false (unchecked by default)
- isEdited: true (always true for user-added tasks)
- isUserAdded: true (distinguishes from AI-generated)
- lastEditedBy: Current user's ID
- lastEditedAt: Current timestamp
- createdAt: Current timestamp
```

#### Multi-User Add Task Sync
```
Sarah adds "Potty Break" at 11:30 AM

Mike's device (3 seconds later):
-> New "11:30 AM Potty Break" task appears in chronological order
-> Animated insertion (slides in from top/bottom depending on position)
-> Edited indicator (✏️) shows it's user-added, not AI-generated
-> Mike can immediately check it off, edit it, or delete it
```

#### Validation Rules
```
Time Picker:
- Must select a time within today (cannot add tasks to past/future dates in v1)
- Warning if time is >2 hours in the past: "This was a while ago. Confirm?"
- No restriction on adding tasks in the future (e.g., "Puppy needs extra nap at 3pm")

Activity Type:
- Required field (cannot save without selecting)
- Dropdown initially shows "Select activity" placeholder
- [Add Task] button disabled (gray, unclickable) until selection made

Cancel behavior:
- Tapping "Cancel" dismisses modal
- No data saved, no sync occurs
- Tapping outside modal also dismisses (same as cancel)
```

---

### Flow 6D: Task State Indicators

#### Visual Indicators Summary
```
Task cards show multiple states through visual indicators:

1. Completion Status:
   [ ]  = Uncompleted (empty checkbox)
   [✓]  = Completed (with user profile picture + green dot)

2. Edit Status:
   ✏️  = Task has been edited (time changed, activity changed, or user-added)
   (No indicator = Original AI-generated task, unmodified)

3. User Attribution (for completed tasks):
   👤 = Profile picture of user who completed it
   🟢 = Green completion dot overlay on profile picture

Example task states:

Original AI task, uncompleted:
  7:00 AM  [ ] Breakfast

Original AI task, completed by Sarah:
  7:00 AM  [👤+🟢] Breakfast

Edited AI task (time changed), completed:
  7:15 AM  [👤+🟢] Breakfast  ✏️

User-added task, uncompleted:
  11:30 AM  [ ] Potty Break  ✏️

User-added task, completed by Mike:
  11:30 AM  [👤+🟢] Potty Break  ✏️
```

#### Task Tap Behavior (Universal Edit)
```
Tapping ANY task card — whether AI-generated or custom — opens
the "Edit Task" bottom sheet directly. There is no separate
read-only "detail view." All tasks go straight to the editable
bottom sheet. See Flow 6A for the full Edit Task experience.

  AI-generated tasks:
  - Bottom sheet pre-populates with the task's time, activity
    type (mapped to the closest emoji grid option), and the
    AI description in the Notes field.
  - User can adjust any field and save.

  Custom tasks:
  - Bottom sheet pre-populates with the task's time and activity
    type. Notes field is empty unless previously saved.

  Deletion of any task is handled via swipe-to-delete
  (Flow 6B) or long-press context menu.
```

---

### Flow 6E: Real-Time Sync Edge Cases

#### Scenario 1: Simultaneous Edits (Conflict)
```
Rare case: Sarah and Mike both edit same task while offline

Timeline:
11:30 AM - Sarah goes offline, edits "Lunch" from 12:00 PM → 12:15 PM
11:32 AM - Mike goes offline, edits "Lunch" from 12:00 PM → 12:30 PM
11:35 AM - Sarah reconnects, her edit syncs (server shows 12:15 PM)
11:36 AM - Mike reconnects, his edit syncs (server shows 12:30 PM, overwrites Sarah's)

Result:
- Last-write-wins: Mike's 12:30 PM is final
- No conflict modal or notification in v1
- Sarah's device updates to show 12:30 PM when it syncs
- Accepted trade-off: Conflicts are rare in typical usage

Future consideration (v2):
- Timestamp-based conflict detection
- Show notification: "Mike edited this task after you. Updated to 12:30 PM."
```

#### Scenario 2: Editing While Sync In Progress
```
Sarah edits "Breakfast" time, taps Save
-> Optimistic update: Change appears immediately on Sarah's screen
-> Sync indicator appears (subtle spinner in header or on task card)
-> Mike's edit arrives from server before Sarah's completes

Behavior:
- Sarah's local change stays visible (optimistic UI)
- When server confirms, indicator disappears
- If Mike's conflicting edit arrives, last-write-wins applies
- Sarah sees her change temporarily, then Mike's change replaces it
```

#### Scenario 3: Deleted Task User Tries to Edit
```
Sarah deletes "Training" task
Mike is currently viewing expanded "Training" card (editing it)
Deletion syncs to Mike's device

Mike's experience:
-> Card automatically collapses
-> Toast notification: "This task was deleted by Sarah"
-> Task disappears from list
-> Mike's unsaved edits are discarded
```

#### Scenario 4: Network Status Indicators
```
Top banner states:

Connected:
  (No banner, or subtle "✓ Synced" that auto-dismisses)

Offline:
  ⚠️ You're offline. Changes will sync when connected.
  (Yellow banner, persistent)

Syncing:
  ⏳ Syncing changes...
  (Blue banner, appears briefly during sync)

Sync failed (rare):
  ❌ Couldn't sync changes. Check your connection.
  [Retry]
  (Red banner, persistent until retry succeeds)
```

---

## Flow 7: Edit Profile Picture

**Context:** Users want to personalize their account by setting or updating their profile picture. This photo appears on completed task cards throughout the daily routine view, giving visual attribution to who did what. Keeping it up to date improves the multi-user experience.

### Flow 7A: Navigate to Profile Picture Settings

```
Screen: Any screen with bottom navigation

User taps the Settings icon (gear icon) in the bottom nav

-> Navigates to: Settings Screen

Settings Screen layout:
  ┌─────────────────────────────────────────────┐
  │  Settings                                   │
  │                                             │
  │  ┌──────────────────────────────────────┐  │
  │  │                                      │  │
  │  │            [Profile Photo]           │  │
  │  │           (circular avatar,          │  │
  │  │            80px diameter)            │  │
  │  │                                      │  │
  │  │               [Edit]                 │  │  <- Button below photo
  │  │                                      │  │
  │  └──────────────────────────────────────┘  │
  │                                             │
  │  Display Name: Sarah                        │
  │  Email: sarah@gmail.com                     │
  │                                             │
  │  Manage Caretakers                          │
  │  Notifications                              │
  │  ...                                        │
  └─────────────────────────────────────────────┘

Profile photo display:
- If user has set a photo: shows their current profile picture
- If no photo set: shows default avatar (initials or generic icon)
- [Edit] button appears below the photo at all times
```

### Flow 7B: Tap "Edit" - Photo Source Selection

```
User taps [Edit] below their profile picture

-> Action sheet slides up from the bottom of the screen:

  ┌─────────────────────────────────────────────┐
  │                                             │
  │          Change Profile Photo               │
  │                                             │
  │  ┌───────────────────────────────────────┐  │
  │  │          Take a Photo                 │  │
  │  └───────────────────────────────────────┘  │
  │                                             │
  │  ┌───────────────────────────────────────┐  │
  │  │       Choose from Photo Library       │  │
  │  └───────────────────────────────────────┘  │
  │                                             │
  │  ┌───────────────────────────────────────┐  │
  │  │              Cancel                   │  │
  │  └───────────────────────────────────────┘  │
  │                                             │
  └─────────────────────────────────────────────┘

Options:
- "Take a Photo" → Opens device camera (Flow 7C)
- "Choose from Photo Library" → Opens photo picker (Flow 7D)
- "Cancel" → Dismisses action sheet, returns to Settings
```

### Flow 7C: Take a Photo

```
User taps "Take a Photo"

-> System camera permission prompt appears (if not already granted):
   "PupPlan would like to access the camera"
   [Don't Allow]  [Allow]

If permission denied:
-> Action sheet dismisses
-> Alert shown: "Camera access is required to take a photo.
   Enable it in Settings > PupPlan > Camera."
   [Open Settings]  [Cancel]

If permission granted (or already granted):
-> Native camera UI opens
-> User frames their photo and taps the shutter button
-> Preview screen shows:
   - Captured photo with circular crop overlay
   - [Retake] (top left)
   - [Use Photo] (top right)

User taps "Use Photo"
-> Proceeds to confirmation step (Flow 7E)

User taps "Retake"
-> Returns to live camera view
```

### Flow 7D: Choose from Photo Library

```
User taps "Choose from Photo Library"

-> System photo permission prompt appears (if not already granted):
   "PupPlan would like to access your photos"
   [Don't Allow]  [Allow]  [Select Photos...]

If permission denied:
-> Action sheet dismisses
-> Alert shown: "Photo library access is required to select a photo.
   Enable it in Settings > PupPlan > Photos."
   [Open Settings]  [Cancel]

If permission granted (or already granted):
-> Native photo picker opens
-> User browses and selects a photo

-> Preview screen shows:
   - Selected photo with circular crop overlay
   - Crop/zoom controls (pinch-to-zoom, drag to reposition)
   - [Cancel] (top left)
   - [Choose] (top right)

User taps "Choose"
-> Proceeds to confirmation step (Flow 7E)

User taps "Cancel"
-> Dismisses picker
-> Returns to Settings screen
```

### Flow 7E: Photo Upload & Profile Update

```
After user confirms photo (from camera or library):

-> Settings screen returns to focus
-> Profile photo area shows upload state:

  ┌──────────────────────────────────────────┐
  │                                          │
  │         [New Photo + Loading Spinner]    │
  │            (circular, 80px)              │
  │                                          │
  │              Updating...                 │
  │                                          │
  └──────────────────────────────────────────┘

-> Photo uploads to storage in background
-> On success:

  ┌──────────────────────────────────────────┐
  │                                          │
  │            [New Profile Photo]           │
  │             (circular, 80px)             │
  │                                          │
  │               [Edit]                     │
  │                                          │
  └──────────────────────────────────────────┘

-> Toast notification: "Profile photo updated"
   (appears at bottom, auto-dismisses after 2 seconds)

-> Profile photo immediately updates everywhere it is used:
   • Settings screen avatar
   • Completed task attribution indicators throughout the daily routine
   • Any caretaker-visible views that show this user's completions

On upload failure:
-> Spinner disappears
-> Previous photo is restored
-> Toast notification: "Couldn't update photo. Please try again."
   (red, auto-dismisses after 3 seconds)
```

### Flow 7F: State & Permission Summary

```
Who can edit their profile picture:
✓ Primary Owner
✓ Caretaker

Both roles have full access to edit their own profile photo.
Neither role can edit another user's profile photo.

Photo specs (for engineering):
- Accepted formats: JPEG, PNG, HEIC
- Max upload size: 5MB (client-side validation before upload)
- Stored resolution: 400x400px (cropped square, resized on upload)
- Display sizes:
  • Settings avatar: 80px diameter (circular)
  • Task completion indicator: ~28px diameter (circular)
- Storage: Firebase Storage under users/{userId}/profile_photo.jpg
- Firestore field: users/{userId}.profilePhotoUrl (updated on upload success)

Error states:
- File too large: "Photo must be under 5MB. Please choose a smaller image."
- Unsupported format: "Please choose a JPEG or PNG image."
- Network failure: "Couldn't update photo. Please try again."
- Permission denied (camera): Direct to app settings
- Permission denied (photos): Direct to app settings
```

---

## Flow 6F: Data Persistence & Architecture Notes

### Backend Requirements (for engineering team)

```
Real-time sync implementation:
- Recommended: Firebase Firestore for v1 (real-time listeners, offline support built-in)
- Alternative: Custom Node.js + PostgreSQL + WebSockets

Firestore structure:
puppies/{puppyId}/tasks/{taskId}
  - Automatic real-time listeners on collection
  - Offline persistence enabled
  - Security rules enforce access control

Security Rules Example:
match /puppies/{puppyId}/tasks/{taskId} {
  allow read, write: if request.auth != null &&
    (request.auth.uid == get(/databases/$(database)/documents/puppies/$(puppyId)).data.primaryOwnerId ||
     request.auth.uid in get(/databases/$(database)/documents/puppies/$(puppyId)).data.sharedWith);
}
```

### Task Data Model
```typescript
interface Task {
  id: string;
  puppyProfileId: string;
  scheduledTime: Date;        // Original AI time
  actualTime: Date;           // User-edited time (defaults to scheduledTime)
  activityType: ActivityType; // Enum: PottyBreak | Meal | Training | etc.
  title: string;              // Display name (e.g., "Breakfast", "Potty Break")
  description?: string;       // Notes field (AI description or user-entered notes)
  isCompleted: boolean;
  isEdited: boolean;          // True if actualTime ≠ scheduledTime or activity changed
  isUserAdded: boolean;       // True if created via + FAB
  completedBy?: string;       // User.id who completed it
  completedAt?: Date;
  lastEditedBy: string;       // User.id
  lastEditedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  date: string;               // YYYY-MM-DD (always today in v1)
}

enum ActivityType {
  PottyBreak = "potty_break",
  Meal = "meal",
  Training = "training",
  Nap = "nap",
  CalmTime = "calm_time",
  PlayTime = "play_time",
  Walk = "walk"
}
```

### Offline-First Strategy
```
User actions while offline:
1. Edit task → Update local state immediately (optimistic UI)
2. Store edit in IndexedDB queue
3. Show "Offline" banner
4. When reconnected:
   - Flush queue to Firestore
   - Firestore real-time listener updates UI with server truth
   - If conflict (rare), server value wins, local UI updates

Libraries:
- Firestore offline persistence (built-in, no additional library)
- Service Worker for app shell caching (PWA)
```

---

## Flow 6G: Permissions & Access Control

### Who Can Edit Tasks?

```
Primary Owner:
✓ Edit task time
✓ Edit activity type
✓ Edit task notes (including AI-generated descriptions)
✓ Delete tasks
✓ Add new tasks
✓ Complete tasks
✓ Edit tasks even after completion

Caretaker:
✓ Edit task time
✓ Edit activity type
✓ Edit task notes (including AI-generated descriptions)
✓ Delete tasks
✓ Add new tasks
✓ Complete tasks
✓ Edit tasks even after completion

(Both roles have equal task management permissions in v1)
```

### What Caretakers CANNOT Do
```
✗ Edit puppy profile (name, breed, age, photo)
✗ Change routine settings
✗ Invite/remove other caretakers
✗ Delete the entire routine
✗ Access primary owner's account settings
```

### Future Consideration (v2)
```
Granular permissions:
- View-only caretakers (can see routine, cannot edit)
- Temporary access (expires after X days)
- Activity-specific permissions (can only mark tasks complete, not edit/delete)
```
