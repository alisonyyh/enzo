-- Fix: infinite recursion in puppy_memberships RLS policies
-- The "Owners can read all memberships" policy queries puppy_memberships
-- inside its own RLS check, causing infinite recursion.
--
-- Solution: Create a SECURITY DEFINER function that bypasses RLS to check
-- ownership, then use it in the policies.

-- 1. Create a helper function that checks if a user is an owner of a puppy
--    SECURITY DEFINER = runs with the privileges of the function creator (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_puppy_owner(p_puppy_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.puppy_memberships
    WHERE puppy_id = p_puppy_id
      AND user_id = p_user_id
      AND role = 'owner'
      AND status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 2. Create a helper to check if a user is a member of a puppy (any role)
CREATE OR REPLACE FUNCTION public.is_puppy_member(p_puppy_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.puppy_memberships
    WHERE puppy_id = p_puppy_id
      AND user_id = p_user_id
      AND status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 3. Drop the recursive policies on puppy_memberships
DROP POLICY IF EXISTS "Owners can read all memberships for their puppies" ON puppy_memberships;
DROP POLICY IF EXISTS "Owners can update memberships for their puppies" ON puppy_memberships;

-- 4. Recreate them using the helper function (no recursion)
CREATE POLICY "Owners can read all memberships for their puppies"
  ON puppy_memberships FOR SELECT
  USING (public.is_puppy_owner(puppy_id, auth.uid()));

CREATE POLICY "Owners can update memberships for their puppies"
  ON puppy_memberships FOR UPDATE
  USING (public.is_puppy_owner(puppy_id, auth.uid()));

-- 5. Also fix the puppies table policies that reference puppy_memberships
--    (these work but are better off using the helper for consistency)
DROP POLICY IF EXISTS "Members can read their puppies" ON puppies;
DROP POLICY IF EXISTS "Owners can update their puppies" ON puppies;
DROP POLICY IF EXISTS "Owners can delete their puppies" ON puppies;

CREATE POLICY "Members can read their puppies"
  ON puppies FOR SELECT
  USING (public.is_puppy_member(id, auth.uid()));

CREATE POLICY "Owners can update their puppies"
  ON puppies FOR UPDATE
  USING (public.is_puppy_owner(id, auth.uid()));

CREATE POLICY "Owners can delete their puppies"
  ON puppies FOR DELETE
  USING (public.is_puppy_owner(id, auth.uid()));

-- 6. Fix routines policies
DROP POLICY IF EXISTS "Members can read routines for their puppies" ON routines;
DROP POLICY IF EXISTS "Owners can create routines" ON routines;
DROP POLICY IF EXISTS "Owners can update routines" ON routines;

CREATE POLICY "Members can read routines for their puppies"
  ON routines FOR SELECT
  USING (public.is_puppy_member(puppy_id, auth.uid()));

CREATE POLICY "Owners can create routines"
  ON routines FOR INSERT
  WITH CHECK (public.is_puppy_owner(puppy_id, auth.uid()));

CREATE POLICY "Owners can update routines"
  ON routines FOR UPDATE
  USING (public.is_puppy_owner(puppy_id, auth.uid()));

-- 7. Fix routine_items policies (these join through routines → puppy_memberships)
DROP POLICY IF EXISTS "Members can read routine items" ON routine_items;
DROP POLICY IF EXISTS "Owners can create routine items" ON routine_items;
DROP POLICY IF EXISTS "Owners can update routine items" ON routine_items;

CREATE POLICY "Members can read routine items"
  ON routine_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM routines
      WHERE routines.id = routine_items.routine_id
        AND public.is_puppy_member(routines.puppy_id, auth.uid())
    )
  );

CREATE POLICY "Owners can create routine items"
  ON routine_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM routines
      WHERE routines.id = routine_items.routine_id
        AND public.is_puppy_owner(routines.puppy_id, auth.uid())
    )
  );

CREATE POLICY "Owners can update routine items"
  ON routine_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM routines
      WHERE routines.id = routine_items.routine_id
        AND public.is_puppy_owner(routines.puppy_id, auth.uid())
    )
  );

-- 8. Fix activity_logs policies
DROP POLICY IF EXISTS "Members can read activity logs" ON activity_logs;
DROP POLICY IF EXISTS "Members can create activity logs" ON activity_logs;

CREATE POLICY "Members can read activity logs"
  ON activity_logs FOR SELECT
  USING (public.is_puppy_member(puppy_id, auth.uid()));

CREATE POLICY "Members can create activity logs"
  ON activity_logs FOR INSERT
  WITH CHECK (public.is_puppy_member(puppy_id, auth.uid()));

-- 9. Fix invites policies
DROP POLICY IF EXISTS "Owners can read invites for their puppies" ON invites;
DROP POLICY IF EXISTS "Owners can create invites" ON invites;

CREATE POLICY "Owners can read invites for their puppies"
  ON invites FOR SELECT
  USING (public.is_puppy_owner(puppy_id, auth.uid()));

CREATE POLICY "Owners can create invites"
  ON invites FOR INSERT
  WITH CHECK (
    invited_by = auth.uid()
    AND public.is_puppy_owner(puppy_id, auth.uid())
  );
