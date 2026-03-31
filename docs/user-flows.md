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
     to the New User Choice Screen (Step 1B)
- Terms of Service + Privacy Policy links at bottom
```

### Step 1B: New User Choice Screen
```
Screen: Welcome — Choose Your Path

After a new user completes Google OAuth sign-in for the first time,
they see a choice screen before any onboarding begins:

  ┌─────────────────────────────────────────────┐
  │                                             │
  │            Welcome to PupPlan!              │
  │                                             │
  │  ┌───────────────────────────────────────┐  │
  │  │                                       │  │
  │  │       I have an invite code           │  │
  │  │                                       │  │
  │  │  Join someone else's puppy routine    │  │
  │  │                                       │  │
  │  └───────────────────────────────────────┘  │
  │                                             │
  │  ┌───────────────────────────────────────┐  │
  │  │                                       │  │
  │  │    I do not have an invite code       │  │
  │  │                                       │  │
  │  │  Set up a new puppy routine           │  │
  │  │                                       │  │
  │  └───────────────────────────────────────┘  │
  │                                             │
  └─────────────────────────────────────────────┘

Option 1: "I have an invite code"
  -> Routes to the Invite Code Entry Screen (see Flow 4, Step 2)
  -> User enters an invite code to join an existing household
     as a caretaker

Option 2: "I do not have an invite code"
  -> Routes to the Onboarding Questionnaire (Step 2)
  -> User becomes a primary owner and sets up their puppy's routine
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

### Owner Views Invite Code
```
Screen: Settings > Caretakers

The primary owner navigates to Settings > Caretakers to find
their household's unique invite code.

  ┌─────────────────────────────────────────────┐
  │  Caretakers                                 │
  │                                             │
  │  Invite Code                                │
  │  ┌───────────────────────────────────────┐  │
  │  │                                       │  │
  │  │   BISCUIT-7X2K                        │  │
  │  │                          [📋 Copy]   │  │
  │  │                                       │  │
  │  └───────────────────────────────────────┘  │
  │                                             │
  │  Share this code with someone you'd like    │
  │  to help care for [Puppy Name]. They can    │
  │  enter it when they sign up for PupPlan.    │
  │                                             │
  │  ─────────────────────────────────────────  │
  │                                             │
  │  Current Caretakers: None yet               │
  │                                             │
  └─────────────────────────────────────────────┘

Invite code behavior:
- The invite code is unique per household and always visible
- The code is persistent — it does not expire or change
- No "generate" action is needed; the code exists from the
  moment the primary owner completes onboarding
- The [📋 Copy] button copies the code to the device clipboard
- On tap: button text briefly changes to "Copied!" with a
  checkmark (✓) for 2 seconds, then reverts to "Copy"
- The owner can share the code however they prefer (text it,
  say it aloud, write it down, etc.)
```

### Owner Sees Caretaker Join
```
Screen: Settings > Caretakers

After a caretaker successfully enters the invite code and joins:

  ┌─────────────────────────────────────────────┐
  │  Caretakers                                 │
  │                                             │
  │  Invite Code                                │
  │  ┌───────────────────────────────────────┐  │
  │  │   BISCUIT-7X2K              [📋 Copy]│  │
  │  └───────────────────────────────────────┘  │
  │                                             │
  │  Share this code with someone you'd like    │
  │  to help care for [Puppy Name].             │
  │                                             │
  │  ─────────────────────────────────────────  │
  │                                             │
  │  Current Caretakers:                        │
  │  👤 Mike (mike@email.com)                   │
  │  Joined: Feb 7, 2025                        │
  │  [Remove]                                   │
  │                                             │
  └─────────────────────────────────────────────┘

-> Push notification (P1): "Mike joined as a caretaker
   for [Puppy Name]!"
```

---

## Flow 4: Caretaker - Join via Invite Code

### Step 1: Receiving the Code
```
The primary owner shares their invite code with the caretaker
through any channel (text message, in person, email, etc.):

  "Hey, download PupPlan and use my invite code: BISCUIT-7X2K"

No deep link or special URL is involved. The caretaker simply
needs the code and the app.
```

### Step 2: Invite Code Entry Screen
```
After downloading and signing into PupPlan for the first time,
the new user sees the New User Choice Screen (Flow 1, Step 1B).

User taps "I have an invite code"

-> Navigates to the Invite Code Entry Screen:

  ┌─────────────────────────────────────────────┐
  │                                             │
  │            Enter your invite code           │
  │                                             │
  │  Ask the puppy's owner for their invite     │
  │  code. You can find it in their app under   │
  │  Settings > Caretakers.                     │
  │                                             │
  │  ┌───────────────────────────────────────┐  │
  │  │                                       │  │
  │  │   Invite code                         │  │
  │  │   (text input, paste-friendly)        │  │
  │  │                                       │  │
  │  └───────────────────────────────────────┘  │
  │                                             │
  │           [Submit]                          │
  │            ↑ Disabled until field is        │
  │              non-empty                      │
  │                                             │
  │           [← Back]                          │
  │            ↑ Returns to choice screen       │
  │                                             │
  └─────────────────────────────────────────────┘

User pastes or types the invite code (e.g., "BISCUIT-7X2K")
User taps "Submit"

-> Code is validated against the server:

   If VALID:
   -> Success screen (Step 3)

   If INVALID:
   -> Inline error message below the input field:
      "That code doesn't match any household. Please
       check with the puppy's owner and try again."
   -> Input field gets error styling (red border)
   -> User can re-enter and try again

Input behavior:
- Text input, single line
- Auto-capitalizes input (codes are case-insensitive)
- Trims leading/trailing whitespace before validation
- Supports paste from clipboard
- [Submit] button is disabled when the field is empty
- [← Back] returns to the New User Choice Screen (Step 1B)
```

### Step 3: Invite Code Accepted
```
Screen: You're In!

After the code is validated successfully:

  ┌─────────────────────────────────────────────┐
  │                                             │
  │            🎉 You're in!                    │
  │                                             │
  │            [Puppy Photo]                    │
  │                                             │
  │   You've joined as a caretaker for          │
  │   Biscuit!                                  │
  │                                             │
  │   Breed: Golden Retriever                   │
  │   Age: 10 weeks                             │
  │                                             │
  │   "You can view Biscuit's daily routine     │
  │    and mark activities as complete."         │
  │                                             │
  │          [View Routine]                     │
  │           (primary button)                  │
  │                                             │
  └─────────────────────────────────────────────┘

User taps "View Routine"
-> Transition to Biscuit's daily routine view (Step 4)
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

### Invalid Invite Code
```
User enters an invite code that does not match any household

Screen: Invite Code Entry (same screen, inline error)
  -> Inline error message below the input field:
     "That code doesn't match any household. Please
      check with the puppy's owner and try again."
  -> Input field gets error styling (red border)
  -> User can clear the field and re-enter a new code

Common causes:
- Typo in the code
- Owner shared the wrong code
- Code from a deleted household
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

**Potty-specific behavior:** When the selected activity type is "Potty," a conditional "Details" section appears between the Activity Type grid and the Notes field. This section contains two tappable emoji toggles (💩 for poop and 💦 for pee) that allow users to record what type of potty break occurred. Both can be selected simultaneously. The selected emoji(s) are displayed next to the task title in the timeline. See Flow 6H for full details.

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
  │ │       [SEL]  │  │              │         │
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
  │ │              │  │       [SEL]  │         │
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

#### Scenario 3: User edits a Potty task and adds details

```
Screen: Daily Routine

User sees:
  8:30 AM  [ ] Potty Break

User taps on the "Potty Break" task card (NOT the status icon)

-> Bottom sheet slides up with Potty-specific "Details" section:

  ┌─────────────────────────────────────────────┐
  │              Edit Task                       │
  │                                             │
  │ Time                                        │
  │ [🕐 8:30 AM]  (pre-populated from routine) │
  │                                             │
  │ Activity Type                               │
  │ ┌──────────────┐  ┌──────────────┐         │
  │ │ 🚽 Potty     │  │ 🍽️ Meal      │         │
  │ │       [SEL]  │  │              │         │
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
  │ Details          ← Conditional section,    │
  │                    only visible when        │
  │                    activity type = Potty    │
  │ ┌──────────┐  ┌──────────┐                 │
  │ │    💩    │  │    💦    │                 │
  │ │  Poop    │  │   Pee    │                 │
  │ └──────────┘  └──────────┘                 │
  │   ↑ Both toggles are independent.          │
  │     Unselected = dimmed/no border.         │
  │     Selected = highlighted border/bg.      │
  │     Both can be active at the same time.   │
  │                                             │
  │ Notes                                       │
  │ ┌───────────────────────────────────────┐   │
  │ │ Take outside 15-30 minutes after     │   │
  │ │ eating                               │   │
  │ └───────────────────────────────────────┘   │
  │                                             │
  │ [Cancel]              [Save Changes]       │
  └─────────────────────────────────────────────┘

User taps 💩 (poop) toggle → it highlights
User taps 💦 (pee) toggle → it highlights
User taps "Save Changes"

-> Bottom sheet dismisses
-> Task updates in timeline with potty detail emojis:
  8:30 AM  [ ] Potty Break 💩💦

-> Emojis appear inline next to the task title
-> Changes sync to all users (owner & caretakers) within 3 seconds

Note: If user later edits this task and changes activity type
to something other than Potty (e.g., Walk), the Details section
disappears and pottyDetails are cleared from the saved data.
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
     🚽 Potty      | 🍽️ Meal
     🎓 Training    | 😴 Nap
     🧘 Calm Time   | 🎾 Play Time
     🚶 Walk
   - Current activity type is pre-selected (highlighted)
   - User can tap a different option to change it

3. Details (conditional — Potty only)
   - Label: "Details"
   - Only visible when activity type = potty_break (Potty)
   - Contains two tappable emoji toggles in a row:
     💩 Poop  |  💦 Pee
   - Each toggle is independent (both can be on simultaneously)
   - Unselected state: dimmed emoji, no background/border highlight
   - Selected state: full-opacity emoji with highlighted border/background
   - Pre-populated with existing pottyDetails values when editing
   - If user switches activity type away from Potty, this section
     hides and pottyDetails values are cleared on save
   - Optional — user can save a Potty task without selecting either

4. Notes (multiline text input)
   - Label: "Notes"
   - Placeholder: "Add a note..." (shown when empty)
   - For AI-generated tasks: pre-populated with the task's
     description (e.g., "Take outside 15-30 minutes after eating")
   - For custom tasks: empty unless user previously saved a note
   - Multiline text area, auto-grows up to 3 lines, then scrolls
   - Max length: 200 characters
   - Optional — can be left empty or cleared entirely

5. Buttons
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
  │ │              │  │              │         │
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

User selects "Potty" from emoji grid
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

4. Potty Details (for Potty tasks only):
   💩 = Poop was recorded
   💦 = Pee was recorded
   💩💦 = Both poop and pee were recorded
   (No emojis = Potty task with no details selected)
   Emojis appear inline after the task title, before the ✏️ indicator.

Example task states:

Original AI task, uncompleted:
  7:00 AM  [ ] Breakfast

Original AI task, completed by Sarah:
  7:00 AM  [👤+🟢] Breakfast

Edited AI task (time changed), completed:
  7:15 AM  [👤+🟢] Breakfast  ✏️

User-added Potty task with details, uncompleted:
  11:30 AM  [ ] Potty Break 💩💦  ✏️

User-added Potty task with details, completed by Mike:
  11:30 AM  [👤+🟢] Potty Break 💩  ✏️

Potty task with no details selected:
  8:30 AM  [ ] Potty Break

Potty task with pee only, completed:
  8:30 AM  [👤+🟢] Potty Break 💦
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
  pottyDetails?: {             // Only present when activityType = "potty_break"
    poop: boolean;             // True if poop emoji (💩) was selected
    pee: boolean;              // True if pee emoji (💦) was selected
  };
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

---

## Flow 6H: Potty Details — Poop & Pee Tracking

**Context:** Potty breaks are the highest-frequency task type in a puppy's daily routine (6-8 per day for young puppies). Owners and caretakers need to distinguish between pee and poop events to track housebreaking progress and monitor health patterns. Rather than relying on the free-text Notes field, the app provides structured emoji toggles for fast, consistent logging.

### Potty Details UI — "Details" Field

```
The "Details" field is a conditional section that appears in the
"Edit Task" and "Add Custom Task" bottom sheets ONLY when the
selected activity type is "Potty" (🚽).

Position: Between the Activity Type grid and the Notes field.

Layout:
  ┌─────────────────────────────────────────────┐
  │ ...                                         │
  │ Activity Type                               │
  │ [🚽 Potty is selected]                     │
  │                                             │
  │ Details                                     │
  │ ┌──────────────────┐  ┌──────────────────┐ │
  │ │                  │  │                  │ │
  │ │       💩         │  │       💦         │ │
  │ │      Poop        │  │       Pee        │ │
  │ │                  │  │                  │ │
  │ └──────────────────┘  └──────────────────┘ │
  │                                             │
  │ Notes                                       │
  │ ...                                         │
  └─────────────────────────────────────────────┘

Toggle behavior:
- Each emoji button is an independent toggle (on/off)
- Both can be selected at the same time
- Neither is required — user can save without selecting either
- Unselected state: emoji at reduced opacity, no border/background
- Selected state: emoji at full opacity, highlighted border or
  subtle background fill to indicate active state

Conditional visibility:
- Details section appears immediately when user selects "Potty"
  from the Activity Type grid
- Details section hides immediately when user switches to any
  other activity type
- When the Details section hides, any selected pottyDetails
  values are cleared (not persisted if activity type ≠ Potty)
```

### Potty Details on Task Cards (Timeline)

```
When a Potty task has pottyDetails saved, the selected emoji(s)
are displayed inline next to the task title on the task card in
the daily routine timeline.

Display format examples:
  8:30 AM  [ ] Potty Break 💩💦         (both poop and pee)
  8:30 AM  [ ] Potty Break 💩           (poop only)
  8:30 AM  [ ] Potty Break 💦           (pee only)
  8:30 AM  [ ] Potty Break              (no details selected)

Rendering rules:
- Emojis appear after the title text, before the ✏️ edit indicator
- Order is always 💩 first, then 💦 (if both selected)
- Small inline display, same font size as the title or slightly
  smaller
- Only rendered for tasks with activityType = potty_break
- Non-potty tasks are completely unaffected

With completion and edit indicators:
  8:30 AM  [👤+🟢] Potty Break 💩💦  ✏️
  ↑ completed    ↑ title   ↑ details  ↑ edited
```

### Potty Details — Label Rename

```
In the Activity Type grid (both "Edit Task" and "Add Custom Task"
bottom sheets), the button label is renamed:

  Before:  🚽 Potty Break
  After:   🚽 Potty

This change applies ONLY to the activity type button label in the
bottom sheet. The task title displayed in the timeline remains
"Potty Break" (matching existing AI-generated routine task titles)
unless the user manually edits the title.

The underlying activityType value remains "potty_break" — no data
migration is needed.
```

### Potty Details — Data Persistence

```
When saving a Potty task (add or edit), the pottyDetails field is
included in the task data sent to Firebase:

  pottyDetails: {
    poop: true,   // or false
    pee: true     // or false
  }

Persistence rules:
- pottyDetails is only saved when activityType = "potty_break"
- If activityType is changed away from potty_break during edit,
  pottyDetails is set to null/removed from the document
- pottyDetails is optional — a Potty task without any details
  selected saves pottyDetails as { poop: false, pee: false }
  or omits the field entirely
- pottyDetails syncs to all users via real-time Firestore
  listeners (same 3-second sync as other task fields)
- For edited routine items (AI-generated tasks edited via
  saveRoutineItemEdit), pottyDetails is included in the
  RoutineItemEdit data stored in Firebase

Loading behavior:
- When opening "Edit Task" for a Potty task, the Details toggles
  are pre-populated from the saved pottyDetails values
- If pottyDetails is missing/null, both toggles default to off
```

### Potty Details — Multi-User Sync

```
Sarah adds a Potty task with 💩 selected at 11:30 AM

Mike's device (3 seconds later):
-> New "11:30 AM Potty Break 💩" task appears with poop emoji
-> Mike taps the task card to edit
-> "Edit Task" sheet shows 💩 toggle already selected
-> Mike also selects 💦 and taps "Save Changes"
-> Task updates to "Potty Break 💩💦" on both devices

Offline handling:
- Same offline-first behavior as other task fields
- pottyDetails changes queue locally and sync on reconnection
- Last-write-wins for conflicts (same as other task fields)
```

---

## Flow 8: Day Navigation — Calendar Picker for Past & Next Day Tasks

**Context:** Users need to review past task completion and preview tomorrow's schedule without leaving the main routine screen. Currently the app only displays today's tasks with no way to look back or ahead. This feature makes the date header tappable — tapping it opens a calendar picker overlay where users can select any date from the puppy's creation date through tomorrow. Selecting a date loads that day's task list.

### Problem & Motivation

```
Core pain:
- The app resets to a today-only view every day, erasing context
- Users cannot verify whether yesterday's tasks were completed (and by whom)
- Users cannot preview tomorrow's schedule to plan ahead
- Current workaround: texting each other ("did you do the 3pm potty break?")
  or taking screenshots of the timeline before midnight

Pain severity: High — daily friction for every user
Pain frequency: Daily — every morning (planning) and every evening (reviewing)

Impact hypothesis:
We believe that adding a calendar picker for browsing past and next-day
task lists for puppy owners and caretakers will increase daily app opens
and session duration. We will know we are right when users navigate to
non-today views at least 3 times per week on average within the first month.
```

### Flow 8A: Tappable Date Header

```
Screen: Daily Routine (Main Screen)

Current header (before this feature):
  ┌─────────────────────────────────────────────┐
  │            🐾 Biscuit's Day                 │
  │       Wednesday, February 19                │
  └─────────────────────────────────────────────┘

Updated header (date is now tappable):
  ┌─────────────────────────────────────────────┐
  │            🐾 Biscuit's Day                 │
  │                                             │
  │         Wednesday, February 19  ▾           │
  │         (tappable date + chevron indicator)  │
  └─────────────────────────────────────────────┘

Date header specs:
- The entire date text area is tappable (minimum 44pt tap target)
- A small downward chevron (▾) appears to the right of the date
  to signal that tapping opens a picker
- Tap state: subtle press highlight on the date text
- When viewing today: date displays normally
  (e.g., "Wednesday, February 19")
- When viewing a non-today date: date text shows the selected
  date (e.g., "Tuesday, February 18") and a "Today" pill button
  appears below it (see Flow 8E)
```

### Flow 8B: Calendar Picker Overlay

```
User taps the date header text

-> A calendar picker overlay slides up from the bottom of the screen
   (similar to the existing bottom sheet pattern used elsewhere in
   the app, e.g., "Add Custom Task" and "Edit Task" sheets)

  ┌─────────────────────────────────────────────┐
  │                                             │
  │  ┌───────────────────────────────────────┐  │
  │  │          February 2025        ▾      │  │
  │  │     (month/year — tappable to        │  │
  │  │      switch months)                  │  │
  │  │                                       │  │
  │  │  Su   Mo   Tu   We   Th   Fr   Sa   │  │
  │  │  ──   ──   ──   ──   ──   ──   ──   │  │
  │  │                              1     │  │
  │  │   2    3    4    5    6    7    8    │  │
  │  │   9   10   11   12   13   14   15   │  │
  │  │  16   17   18  [19]  20   ··   ··   │  │
  │  │  ··   ··   ··   ··   ··   ··   ··   │  │
  │  │                                       │  │
  │  │  ↑                                    │  │
  │  │  Puppy creation date = Feb 9          │  │
  │  │  Dates before Feb 9 are grayed out    │  │
  │  │  and not tappable                     │  │
  │  │                                       │  │
  │  │  Today (19th) is highlighted with     │  │
  │  │  a filled circle (primary color)      │  │
  │  │                                       │  │
  │  │  Tomorrow (20th) is the last          │  │
  │  │  tappable date — dates after the      │  │
  │  │  20th are grayed out and disabled     │  │
  │  │                                       │  │
  │  └───────────────────────────────────────┘  │
  │                                             │
  │           [Today]        [Close]            │
  │                                             │
  └─────────────────────────────────────────────┘

Calendar picker specs:

Layout:
- Bottom sheet overlay (same animation/behavior as existing sheets)
- Backdrop dim behind the sheet (tap backdrop to dismiss = cancel)
- Month/year header at the top (e.g., "February 2025")
- Standard 7-column grid (Su Mo Tu We Th Fr Sa)
- "Today" button at bottom-left for quick return
- "Close" button at bottom-right to dismiss without changing date

Date range:
- EARLIEST selectable date: the puppy's creation date
  (derived from routines.generated_at or puppies.created_at,
   whichever is earlier)
- LATEST selectable date: tomorrow (today + 1 day)
- Dates outside this range are GRAYED OUT and NOT TAPPABLE

Visual states for dates:
- Disabled (out of range): gray text, no tap response
- Available (in range, not selected): default text color, tappable
- Today: filled circle behind the date number (primary/orange color),
  white text — always visually distinct even when not selected
- Selected (non-today): outlined circle or highlighted background
  (secondary color), to distinguish from the "today" indicator
- Tomorrow: regular available style (no special decoration beyond
  being tappable)

Month navigation:
- Left/right arrows flanking the month/year header
  (e.g., ◀ February 2025 ▶)
- Left arrow navigates to the previous month
- Right arrow navigates to the next month
- Left arrow is DISABLED when viewing the month containing the
  puppy's creation date AND no earlier dates are selectable
- Right arrow is DISABLED when viewing the month containing
  tomorrow's date AND no later dates are selectable
- Swiping left/right on the calendar grid also navigates months

Interaction:
- User taps a date → calendar dismisses → task list loads for
  that date (see Flows 8C and 8D for what loads)
- User taps "Today" → calendar dismisses → returns to today's
  live task view
- User taps "Close" or taps the backdrop → calendar dismisses →
  no date change, stays on previously viewed date
- User taps the already-selected date → no-op (calendar stays
  open, nothing changes)
```

### Flow 8C: View Tomorrow's Tasks via Calendar

```
Screen: Daily Routine → user taps date header → calendar opens

User taps tomorrow's date (e.g., February 20)

-> Calendar picker dismisses
-> Date header updates to tomorrow's date:
   "Thursday, February 20  ▾"
-> "Today" pill button appears below the date header (see Flow 8E)

-> Task list shows the ACTIVE ROUTINE items at their scheduled times
   (same AI-generated routine as today — the base template)

-> All tasks appear UNCHECKED (no completion data for future dates)

-> NO custom tasks appear (custom tasks are date-specific;
   none have been added for tomorrow yet)

-> NO edited routine items apply (edits are date-specific;
   none exist for tomorrow yet)

-> NO deleted routine items apply (deletions are date-specific;
   none exist for tomorrow yet)

Example tomorrow view:
  ┌─────────────────────────────────────────────┐
  │            🐾 Biscuit's Day                 │
  │                                             │
  │         Thursday, February 20  ▾            │
  │              [ ← Today ]                    │
  │              ↑ pill button to return         │
  │                                             │
  │  6:30 AM  [ ] Wake up & potty break        │
  │  7:00 AM  [ ] Breakfast                    │
  │  7:30 AM  [ ] Morning play session         │
  │  8:30 AM  [ ] Potty break                  │
  │  9:00 AM  [ ] Crate time / nap             │
  │  ...                                        │
  │  10:00 PM [ ] Final potty break & bedtime  │
  │                                             │
  │                               (no FAB)      │
  └─────────────────────────────────────────────┘

Key behaviors:
- FAB (+ button) is HIDDEN — cannot add tasks to future dates
- Swipe-to-delete is DISABLED — cannot delete tasks for future dates
- Tapping task cards is DISABLED — cannot edit tasks for future dates
- Tapping the completion circle does NOTHING — cannot pre-complete
- Progress stats card is HIDDEN — no progress to show
- Real-time subscriptions are NOT active for non-today views
```

### Flow 8D: View a Past Day's Tasks via Calendar

```
Screen: Daily Routine → user taps date header → calendar opens

User taps a past date (e.g., February 15)

-> Calendar picker dismisses
-> Date header updates to the selected date:
   "Saturday, February 15  ▾"
-> "Today" pill button appears below the date header (see Flow 8E)

-> Task list shows the routine as it was on that day:
   • AI-generated routine items (base template)
   • PLUS any custom tasks that were added on that date
   • MINUS any routine items that were deleted on that date
   • WITH any edits (time changes, activity type changes, notes)
     that were made on that date
   • WITH completion status — completed tasks show the avatar
     of the user who completed them (+ green dot)
   • WITH potty details (💩💦) if recorded on that date

Example past day view (February 15):
  ┌─────────────────────────────────────────────┐
  │            🐾 Biscuit's Day                 │
  │                                             │
  │         Saturday, February 15  ▾            │
  │              [ ← Today ]                    │
  │                                             │
  │  6:30 AM  [👤+🟢] Wake up & potty break 💦│
  │  7:00 AM  [👤+🟢] Breakfast                │
  │  7:30 AM  [👤+🟢] Morning play session     │
  │  8:30 AM  [ ] Potty break       ← missed   │
  │  9:00 AM  [👤+🟢] Crate time / nap        │
  │  11:30 AM [👤+🟢] Potty Break 💩💦  ✏️    │
  │           ↑ custom task added that day      │
  │  ...                                        │
  │  10:00 PM [👤+🟢] Final potty break 💦     │
  │                                             │
  │                               (no FAB)      │
  └─────────────────────────────────────────────┘

Key behaviors:
- FAB (+ button) is HIDDEN — cannot add tasks to past dates
- Swipe-to-delete is DISABLED — cannot delete past tasks
- Tapping task cards opens a READ-ONLY detail view (see Flow 8F)
- Tapping the completion circle does NOTHING — cannot change past
  completion status
- Progress stats card is HIDDEN — past progress is not shown
  in the day navigation view (available in the Progress tab)
- Real-time subscriptions are NOT active for non-today views

Jumping to a distant date:
- Unlike arrow-based navigation, the calendar lets users jump
  directly to any valid date (e.g., from today to 3 weeks ago)
  in a single tap — no need to step through one day at a time
```

### Flow 8E: Return to Today

```
When viewing any non-today date, the user can return to today via:

Option 1: "Today" pill button (fastest)
- A small pill-shaped button labeled "← Today" appears directly
  below the date header text when viewing a non-today date
- Tapping it immediately jumps back to today's live view
- The pill disappears when viewing today (since you're already there)

  Pill specs:
  - Position: centered below the date header text, 4px gap
  - Style: small rounded pill, secondary/muted background,
    text: "← Today" in primary text color
  - Tap target: minimum 44pt height
  - Only visible when selectedDate ≠ today

Option 2: Open calendar and tap "Today" button
- User taps the date header → calendar opens → taps the "Today"
  button at the bottom-left of the calendar sheet
- Calendar dismisses → returns to today's live view

Option 3: Open calendar and tap today's date
- User taps the date header → calendar opens → taps today's
  date cell (the filled circle) → calendar dismisses → returns
  to today's live view

When returning to today:
-> Date header shows today's date
-> "Today" pill button disappears
-> FAB reappears
-> Task completion is re-enabled
-> Swipe-to-delete is re-enabled
-> Task card tapping opens editable bottom sheet again
-> Progress stats card reappears
-> Real-time subscriptions reactivate
-> Any changes that occurred while browsing past dates are
   reflected (e.g., if caretaker completed a task)
```

### Flow 8F: Read-Only Task Detail (Non-Today Views)

```
When viewing a past day, tapping a task card opens a READ-ONLY
bottom sheet (not the editable version from Flow 6A):

  ┌─────────────────────────────────────────────┐
  │              Task Details                    │
  │                                             │
  │ Time                                        │
  │ 7:00 AM                                    │
  │                                             │
  │ Activity Type                               │
  │ 🍽️ Meal                                     │
  │                                             │
  │ Notes                                       │
  │ 1/2 cup kibble — wait 30 min before play   │
  │                                             │
  │ Status                                      │
  │ ✅ Completed by Sarah at 7:05 AM           │
  │                                             │
  │                   [Close]                   │
  └─────────────────────────────────────────────┘

Differences from Edit Task bottom sheet:
- Title: "Task Details" (not "Edit Task")
- All fields are display-only (no pickers, no text input)
- Shows completion status with who completed and when
- Single "Close" button (no "Save Changes" or "Cancel")
- Potty details shown as text: "Poop 💩, Pee 💦" (not toggles)

For uncompleted past tasks:
- Status line shows: "⚪ Not completed"
- No user attribution

For tomorrow's view:
- Tapping task cards is DISABLED entirely (no bottom sheet opens)
- Tomorrow's tasks have no meaningful detail beyond what's
  visible on the card
```

### Flow 8G: Data Fetching for Non-Today Views

```
When the user selects a different day from the calendar, the app
fetches:

For past days:
1. Active routine items (from Supabase routines/routine_items)
   → Same base routine template as today
2. Activity logs for that date (from Supabase activity_logs)
   → Completion status, completed_by, completed_at
3. Custom tasks for that date (from Firebase tasks collection)
   → where('date', '==', selectedDateString)
4. Edited routine items for that date (from Firebase)
   → where('date', '==', selectedDateString)
5. Deleted routine items for that date (from Firebase)
   → where('date', '==', selectedDateString)

For tomorrow:
1. Active routine items only (from Supabase routines/routine_items)
   → No activity logs, custom tasks, edits, or deletions exist yet

Query changes required:
- All service functions (tasks.ts, activity-logs.ts,
  edited-routine-items.ts, deleted-routine-items.ts) must accept
  an optional date parameter instead of hardcoding today's date
- Default behavior (no date param) remains today for backwards
  compatibility
- Supabase activity_logs already indexed on (puppy_id, date) —
  no new indexes needed
- Firebase queries already filter by date string — no schema
  changes needed

Performance:
- Each date selection triggers a new set of queries
- Loading spinner shown briefly while fetching
  (on the task list area, not the whole screen)
- Data is NOT cached between date navigations in v1
  (each selection fetches fresh data)
- No real-time subscriptions for non-today views
  (static data, loaded once per selection)
- Calendar picker itself does not trigger any data fetches —
  only the final date selection does
```

### Flow 8H: State Management

```
New state in Dashboard component:

  selectedDate: Date
  - Defaults to new Date() (today)
  - Updated when user taps a date in the calendar picker
  - Reset to today via "Today" pill button or calendar "Today" button

  isCalendarOpen: boolean
  - Controls visibility of the calendar picker bottom sheet
  - Set to true when user taps the date header
  - Set to false when user selects a date, taps "Close",
    taps backdrop, or taps "Today" button in calendar

  isViewingToday: boolean (derived)
  - true when selectedDate matches today's date
  - Controls visibility of FAB, editability, real-time subs,
    and "Today" pill button

  calendarMinDate: Date (derived)
  - The puppy's creation date (earliest selectable date)
  - Derived from routines.generated_at or puppies.created_at
    (whichever is earlier)

  calendarMaxDate: Date (derived)
  - Tomorrow's date (today + 1 day)
  - The latest selectable date in the calendar

Conditional rendering based on isViewingToday:
  ┌───────────────────────┬──────────┬────────────┐
  │ UI Element            │  Today   │  Non-Today │
  ├───────────────────────┼──────────┼────────────┤
  │ FAB (+ button)        │ Visible  │ Hidden     │
  │ Swipe-to-delete       │ Enabled  │ Disabled   │
  │ Completion tap        │ Enabled  │ Disabled   │
  │ Task card tap → Edit  │ Yes      │ Read-only  │
  │ Progress stats card   │ Visible  │ Hidden     │
  │ Real-time subs        │ Active   │ Inactive   │
  │ Current time line     │ Visible  │ Hidden     │
  │ "Today" pill button   │ Hidden   │ Visible    │
  │ Date header chevron   │ Visible  │ Visible    │
  └───────────────────────┴──────────┴────────────┘
```

### Flow 8I: Permissions & Access Control

```
Who can use the calendar picker:
✓ Primary Owner — can browse all past days and tomorrow
✓ Caretaker — can browse all past days and tomorrow

Both roles see the same data for any given date. There is
no role-based restriction on which dates can be viewed.

Both roles are read-only on non-today views. Neither role
can modify past or future task data through the calendar
navigation.
```

### Flow 8J: Edge Cases

```
Edge case 1: Midnight rollover while viewing a past date
- User is viewing Feb 15 at 11:59 PM
- Clock rolls over to midnight (now Feb 20)
- User's "today" is now Feb 20
- The view they're looking at (Feb 15) stays on Feb 15
- "Today" pill button still works — tapping it goes to Feb 20
- If user opens the calendar, the "today" indicator (filled
  circle) now shows on Feb 20, and the max selectable date
  shifts to Feb 21

Edge case 2: First day of app usage
- User just completed onboarding today
- Opening the calendar shows only today and tomorrow as
  selectable dates (all prior dates are grayed out)
- Calendar min date = today (puppy creation date)
- Calendar max date = tomorrow

Edge case 3: Routine was regenerated
- If the owner regenerated the routine on Feb 15, past days
  before Feb 15 may show a different routine structure
- In v1, all past days show the CURRENT active routine as the
  base template (not the historical routine that was active
  on that specific date)
- This is an accepted trade-off for v1 simplicity
- Activity logs, custom tasks, edits, and deletions from those
  dates are still accurately shown

Edge case 4: Offline while selecting a date
- If the user is offline when selecting a date from the calendar,
  cached data may be stale or unavailable
- Show: "You're offline. Showing cached data for this date."
- If no cached data exists for the requested date:
  "Unable to load tasks for this date. Please check your connection."
- User can still return to today (today's data has offline
  persistence via Firebase/Supabase caching)

Edge case 5: Calendar across month boundaries
- If the puppy was created on Jan 28 and today is Feb 5, the
  calendar should allow navigating back to January to reach
  Jan 28-31
- Month navigation arrows (◀ ▶) at the top of the calendar
  handle this seamlessly

Edge case 6: Long-time user with many months of data
- A user who has been using the app for 6+ months can navigate
  back through multiple months using the month navigation arrows
- The calendar only allows navigation back to the month
  containing the puppy's creation date
- Performance: The calendar itself is lightweight (just renders
  a grid of dates). Data is only fetched when a date is selected,
  not when browsing months.

Edge case 7: Selecting today from the calendar
- If user opens the calendar and taps today's date (the filled
  circle), it behaves the same as the "Today" button — returns
  to the full live view with FAB, completions, and real-time
  subscriptions enabled.
```

### Flow 8K: Future Considerations (v2+)

```
Potential enhancements for future versions:
- Dot indicators on calendar dates: Show small dots under dates
  that have activity data (e.g., green dot = all tasks completed,
  orange dot = partial, red dot = mostly missed) to give users
  a quick visual summary without selecting each date
- Multi-day future view: Allow viewing 2-7 days ahead (extend
  calendarMaxDate beyond tomorrow)
- Carry-forward incomplete tasks: Option to move yesterday's
  missed tasks into today's list
- Historical routine accuracy: Store routine snapshots so past
  days reflect the routine that was actually active on that date
- Week view toggle: Add a "Week" toggle at the top of the
  calendar sheet to show a horizontal scrollable week strip
  as an alternative to the full month grid
- Swipe gesture navigation: Swipe left/right on the task list
  itself to navigate between days (as a quick-browse complement
  to the calendar picker for adjacent-day navigation)
```
