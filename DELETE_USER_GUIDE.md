# How to Delete a User in Supabase

## Problem
"Failed to delete selected users: Database error deleting user"

This happens because some tables (`activity_logs`, `invites`) reference the user but don't have CASCADE delete enabled.

---

## Quick Fix (Recommended)

Run this SQL in **Supabase Dashboard → SQL Editor** to fix the foreign keys permanently:

```sql
-- Fix activity_logs.completed_by
ALTER TABLE activity_logs
  DROP CONSTRAINT IF EXISTS activity_logs_completed_by_fkey;

ALTER TABLE activity_logs
  ADD CONSTRAINT activity_logs_completed_by_fkey
  FOREIGN KEY (completed_by)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- Fix invites.invited_by
ALTER TABLE invites
  DROP CONSTRAINT IF EXISTS invites_invited_by_fkey;

ALTER TABLE invites
  ADD CONSTRAINT invites_invited_by_fkey
  FOREIGN KEY (invited_by)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- Fix invites.accepted_by
ALTER TABLE invites
  DROP CONSTRAINT IF EXISTS invites_accepted_by_fkey;

ALTER TABLE invites
  ADD CONSTRAINT invites_accepted_by_fkey
  FOREIGN KEY (accepted_by)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;
```

After running this, you can delete users normally from the Supabase Dashboard.

---

## Manual Cleanup (Alternative)

If you need to delete a user RIGHT NOW without fixing the foreign keys:

### Step 1: Get the User ID

1. Go to **Supabase Dashboard → Authentication → Users**
2. Click on the user you want to delete
3. Copy their **User ID** (UUID format like `a1b2c3d4-...`)

### Step 2: Run Cleanup SQL

In **SQL Editor**, run this (replace `YOUR_USER_ID` with the actual UUID):

```sql
-- Replace YOUR_USER_ID with the actual user UUID
DO $$
DECLARE
  user_uuid UUID := 'YOUR_USER_ID';
BEGIN
  -- Delete activity logs
  DELETE FROM activity_logs WHERE completed_by = user_uuid;

  -- Delete invites
  DELETE FROM invites WHERE invited_by = user_uuid OR accepted_by = user_uuid;

  -- Now delete the user (CASCADE will handle the rest)
  DELETE FROM auth.users WHERE id = user_uuid;

  RAISE NOTICE 'User % deleted successfully', user_uuid;
END $$;
```

---

## What Gets Deleted Automatically (CASCADE is already set)

When you delete a user, these records are **automatically deleted**:
- ✅ `profiles` (user's profile)
- ✅ `puppy_memberships` (user's puppy access)
- ✅ `puppies` (if they own puppies, puppies are deleted)
  - ✅ `routines` (all routines for deleted puppies)
  - ✅ `routine_items` (all routine items)
  - ✅ `activity_logs` (all activity logs for deleted puppies)
  - ✅ `invites` (all invites for deleted puppies)

**Important:** Deleting a user who owns puppies will **delete all their puppies and all associated data**. This is a destructive operation!

---

## Testing Workflow

For development/testing, here's a safe workflow:

### Reset Test User

```sql
-- 1. Find your test user ID
SELECT id, email FROM auth.users WHERE email = 'your-test-email@example.com';

-- 2. Delete activity logs
DELETE FROM activity_logs WHERE completed_by = 'USER_ID_HERE';

-- 3. Delete invites
DELETE FROM invites WHERE invited_by = 'USER_ID_HERE' OR accepted_by = 'USER_ID_HERE';

-- 4. Delete the user (CASCADE handles puppies, memberships, etc.)
DELETE FROM auth.users WHERE id = 'USER_ID_HERE';
```

### Create Fresh Test User

1. Sign out of the app
2. Sign in with Google (creates new user automatically)
3. Complete onboarding to create a new puppy

---

## Verification

After applying the fix, verify CASCADE is enabled:

```sql
SELECT
  tc.table_name,
  kcu.column_name,
  tc.constraint_name,
  rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.referential_constraints AS rc
  ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND kcu.table_schema = 'public'
  AND kcu.column_name IN ('completed_by', 'invited_by', 'accepted_by')
ORDER BY tc.table_name;
```

**Expected output:**
| table_name | column_name | constraint_name | delete_rule |
|------------|-------------|-----------------|-------------|
| activity_logs | completed_by | activity_logs_completed_by_fkey | CASCADE |
| invites | invited_by | invites_invited_by_fkey | CASCADE |
| invites | accepted_by | invites_accepted_by_fkey | CASCADE |

All should show `CASCADE` in the `delete_rule` column.

---

## Why This Happens

The initial schema (001_initial_schema.sql) had:

```sql
-- Missing ON DELETE CASCADE
completed_by UUID REFERENCES auth.users(id),  -- ❌ Should be CASCADE
invited_by UUID NOT NULL REFERENCES auth.users(id),  -- ❌ Should be CASCADE
accepted_by UUID REFERENCES auth.users(id)  -- ❌ Should be CASCADE
```

PostgreSQL defaults to `ON DELETE NO ACTION` when CASCADE is not specified, which prevents deletion when child records exist.

The fix adds `ON DELETE CASCADE` to these foreign keys, so deleting a user automatically removes their related records.

---

## Files Created

- `supabase/migrations/006_fix_user_deletion.sql` - Migration to fix foreign keys
- `DELETE_USER_GUIDE.md` - This guide (for reference)

---

## Next Steps

1. **Apply the fix** - Run the SQL migration in Supabase Dashboard
2. **Test deletion** - Try deleting a user from Authentication → Users
3. **For production** - Consider soft delete instead (mark users as deleted rather than actually deleting)
