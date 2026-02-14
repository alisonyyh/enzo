-- Fix: Allow user deletion by adding CASCADE to foreign keys
-- This allows deleting users from Supabase Dashboard without errors

-- ============================================
-- OPTION 1: Fix Foreign Key Constraints (Permanent)
-- ============================================

-- Drop and recreate activity_logs.completed_by foreign key with CASCADE
ALTER TABLE activity_logs
  DROP CONSTRAINT IF EXISTS activity_logs_completed_by_fkey;

ALTER TABLE activity_logs
  ADD CONSTRAINT activity_logs_completed_by_fkey
  FOREIGN KEY (completed_by)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- Drop and recreate invites.invited_by foreign key with CASCADE
ALTER TABLE invites
  DROP CONSTRAINT IF EXISTS invites_invited_by_fkey;

ALTER TABLE invites
  ADD CONSTRAINT invites_invited_by_fkey
  FOREIGN KEY (invited_by)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- Drop and recreate invites.accepted_by foreign key with CASCADE
ALTER TABLE invites
  DROP CONSTRAINT IF EXISTS invites_accepted_by_fkey;

ALTER TABLE invites
  ADD CONSTRAINT invites_accepted_by_fkey
  FOREIGN KEY (accepted_by)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- ============================================
-- VERIFICATION
-- ============================================

-- Run this to verify CASCADE is set:
-- SELECT
--   tc.table_name,
--   kcu.column_name,
--   tc.constraint_name,
--   rc.delete_rule
-- FROM information_schema.table_constraints AS tc
-- JOIN information_schema.key_column_usage AS kcu
--   ON tc.constraint_name = kcu.constraint_name
-- JOIN information_schema.referential_constraints AS rc
--   ON tc.constraint_name = rc.constraint_name
-- WHERE tc.constraint_type = 'FOREIGN KEY'
--   AND kcu.table_schema = 'public'
--   AND kcu.column_name IN ('completed_by', 'invited_by', 'accepted_by')
-- ORDER BY tc.table_name;

-- ============================================
-- OPTION 2: Manual Cleanup (For immediate use)
-- ============================================

-- If you need to delete a specific user RIGHT NOW before applying the fix above,
-- uncomment and run these lines (replace 'USER_ID_HERE' with actual UUID):

-- DELETE FROM activity_logs WHERE completed_by = 'USER_ID_HERE';
-- DELETE FROM invites WHERE invited_by = 'USER_ID_HERE' OR accepted_by = 'USER_ID_HERE';
-- DELETE FROM auth.users WHERE id = 'USER_ID_HERE';
