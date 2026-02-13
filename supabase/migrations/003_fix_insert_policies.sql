-- Fix: INSERT policies may be missing or broken after migration 002
-- This ensures all INSERT policies exist and work correctly.

-- Re-create INSERT policy for puppies (drop first to be safe)
DROP POLICY IF EXISTS "Authenticated users can create puppies" ON puppies;
CREATE POLICY "Authenticated users can create puppies"
  ON puppies FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Re-create INSERT policy for puppy_memberships
DROP POLICY IF EXISTS "Authenticated users can create memberships" ON puppy_memberships;
CREATE POLICY "Authenticated users can create memberships"
  ON puppy_memberships FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Verify: list all policies on puppies table (check output in Results tab)
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename IN ('puppies', 'puppy_memberships', 'routines', 'routine_items')
ORDER BY tablename, cmd;
