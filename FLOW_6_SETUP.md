# Flow 6: Task Management - Setup Guide

This guide walks you through setting up the real-time task management feature (Flow 6) which allows puppy owners and caretakers to edit, delete, and add tasks when puppies deviate from their planned routine.

## Overview

Flow 6 uses a **hybrid backend architecture**:
- **Firebase Firestore**: Real-time task sync with offline persistence
- **Supabase**: User authentication and puppy access control

## Prerequisites

You'll need:
1. Node.js installed (to run npm commands)
2. A Firebase project
3. A Supabase project (already configured)
4. Firebase CLI installed globally

## Step 1: Install Dependencies

```bash
cd /Users/alyeo/Documents/puppy_daycare
npm install
```

This installs:
- `firebase` - Firebase SDK for Firestore
- `react-swipeable` - Swipe gesture library
- `date-fns` - Date formatting utility

## Step 2: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click "Add project"
3. Project name: `pupplan-prod`
4. Disable Google Analytics (keep it simple for 0→1)
5. Click "Create project"

## Step 3: Enable Firestore

1. In Firebase Console, go to **Build → Firestore Database**
2. Click "Create database"
3. Choose **Production mode** (we'll deploy custom rules)
4. Select a location (choose closest to your users)
5. Click "Enable"

## Step 4: Get Firebase Config

1. In Firebase Console, go to **Project Settings** (gear icon)
2. Scroll to "Your apps" section
3. Click the **Web** icon (`</>`)
4. Register app name: `PupPlan`
5. Copy the `firebaseConfig` object
6. Create `.env` file in project root:

```bash
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
```

## Step 5: Deploy Firestore Security Rules

```bash
# Install Firebase CLI globally (if not already installed)
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firestore in project
cd /Users/alyeo/Documents/puppy_daycare
firebase init firestore

# When prompted:
# - Select existing project: pupplan-prod
# - Firestore rules file: firebase/firestore.rules
# - Firestore indexes file: firebase/firestore.indexes.json

# Deploy rules
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

## Step 6: Set Up Firebase Admin SDK for Supabase Edge Function

1. In Firebase Console, go to **Project Settings → Service Accounts**
2. Click "Generate new private key"
3. Download the JSON file (keep it secure!)
4. Copy the entire JSON content
5. Set it as a Supabase secret:

```bash
# Install Supabase CLI (if not already installed)
brew install supabase/tap/supabase

# Login to Supabase
supabase login

# Link to your Supabase project
supabase link --project-ref your-project-ref

# Set Firebase service account as secret (paste the entire JSON as a string)
supabase secrets set FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}'
```

## Step 7: Deploy Supabase Edge Function

```bash
# Deploy the get-firebase-token Edge Function
supabase functions deploy get-firebase-token

# The function will be available at:
# https://your-project-ref.supabase.co/functions/v1/get-firebase-token
```

## Step 8: Create Supabase Database Table (if not exists)

If you don't already have a `puppy_memberships` table, create it:

```sql
-- Run this in Supabase SQL Editor
CREATE TABLE IF NOT EXISTS puppy_memberships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  puppy_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'caretaker')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX idx_puppy_memberships_user_id ON puppy_memberships(user_id);
CREATE INDEX idx_puppy_memberships_puppy_id ON puppy_memberships(puppy_id);
```

## Step 9: Test the Setup

1. Start the dev server:

```bash
npm run dev
```

2. Navigate to the TaskManagementDashboard component (you'll need to integrate it into your routing)

3. Test the features:
   - ✅ Click "+" button to add a new task
   - ✅ Tap a task to expand and edit time/activity type
   - ✅ Swipe left to reveal delete button
   - ✅ Go offline (DevTools → Network → Offline) and verify yellow banner appears
   - ✅ Edit a task while offline, then go back online to see sync

## Step 10: Integration into Existing App

To integrate Flow 6 into your existing Dashboard, you have two options:

### Option A: Replace Existing Dashboard (Recommended for testing)

In `src/app/App.tsx`, import and use TaskManagementDashboard:

```tsx
import { TaskManagementDashboard } from './components/TaskManagementDashboard';

// Replace Dashboard with TaskManagementDashboard
<TaskManagementDashboard
  puppyId={currentPuppy.id}
  puppyName={currentPuppy.name}
/>
```

### Option B: Add as Tab in Existing Dashboard

Add a new tab to switch between "Today's Progress" (existing) and "Edit Routine" (Flow 6):

```tsx
// In Dashboard.tsx
import { TaskManagementDashboard } from './TaskManagementDashboard';

const [activeTab, setActiveTab] = useState<'progress' | 'edit'>('progress');

// Add tab switcher UI
{activeTab === 'progress' ? (
  // Existing Dashboard UI
) : (
  <TaskManagementDashboard puppyId={puppyId} puppyName={puppyName} />
)}
```

## Troubleshooting

### Error: "Not authenticated"
- Check that Firebase config is correct in `.env`
- Verify Supabase Edge Function is deployed and returning Custom Token
- Check browser console for Firebase auth errors

### Error: "Permission denied"
- Verify Firestore security rules are deployed
- Check that `puppy_memberships` table has correct data
- Verify Custom Claims include `puppyIds` array (check Firebase Auth console)

### Tasks not syncing in real-time
- Check network connection
- Verify Firestore composite index is created (Firebase Console → Firestore → Indexes)
- Check browser console for Firestore errors

### Offline mode not working
- Offline persistence only works in one browser tab at a time
- Check that IndexedDB is enabled in browser
- Try closing all tabs except one

## Cost Estimate

**Firebase Firestore (Free Spark Tier):**
- 50K reads/day, 20K writes/day, 1GB storage
- Estimated usage (50 users): 1,500 reads/day, 250 writes/day
- **Cost: $0/month** (well under free tier limits)

**Scaling to 1000 users:**
- 30K reads/day, 5K writes/day
- Still under free tier
- Upgrade to Blaze (pay-as-you-go) at 10K+ users: ~$15/month

## Next Steps

After Flow 6 is working:

1. **Add conflict resolution UI** - Show toast when another user edits same task
2. **Add undo functionality** - 24-hour window to revert edits
3. **Add task edit history** - Audit log of who changed what
4. **Multi-day editing** - Edit tasks from past 7 days
5. **Custom activity types** - Let users define their own categories

## Architecture Diagram

```
Frontend (React)
    ├── Supabase Auth (Google OAuth)
    │   └── Edge Function: get-firebase-token
    │       └── Returns: Firebase Custom Token with puppyIds claim
    │
    ├── Firebase Auth (Custom Token)
    │   └── Authenticates user for Firestore access
    │
    ├── Firestore (tasks collection)
    │   ├── Real-time listeners (< 3s sync)
    │   ├── Offline persistence (IndexedDB)
    │   └── Security rules (puppyIds claim validation)
    │
    └── Supabase (users, puppies, routines)
        └── PostgreSQL (structured relational data)
```

## Files Created

- `src/lib/firebase.ts` - Firebase initialization & auth
- `src/lib/services/tasks.ts` - Task CRUD operations
- `src/app/components/TaskCard.tsx` - Expandable task card
- `src/app/components/SwipeableTaskCard.tsx` - Swipe gesture wrapper
- `src/app/components/AddTaskFAB.tsx` - Floating action button
- `src/app/components/NetworkStatusBanner.tsx` - Offline/sync indicator
- `src/app/components/TaskManagementDashboard.tsx` - Main dashboard
- `firebase/firestore.rules` - Firestore security rules
- `firebase/firestore.indexes.json` - Firestore indexes
- `supabase/functions/get-firebase-token/index.ts` - Custom Token generator

---

**Need help?** Check the [backend-development-plan.md](docs/backend-development-plan.md) Section 17 for detailed implementation steps.
