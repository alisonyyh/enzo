-- DEFINITIVE RLS FIX
-- The issue: INSERT policies with "TO authenticated" don't work because
-- Supabase client connects as the "anon" role (using anon key).
-- The JWT token provides auth.uid() but the ROLE is still "anon".
-- So we need policies that apply to the default roles and use auth.uid()
-- to check authentication.

-- ============================================
-- Drop ALL existing policies (clean slate)
-- ============================================

DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT policyname, tablename
        FROM pg_policies
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
    END LOOP;
END
$$;

-- ============================================
-- Ensure helper functions exist
-- ============================================

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

CREATE OR REPLACE FUNCTION public.is_puppy_member(p_puppy_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.puppy_memberships
    WHERE puppy_id = p_puppy_id
      AND user_id = p_user_id
      AND status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================
-- Ensure RLS is enabled
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE puppies ENABLE ROW LEVEL SECURITY;
ALTER TABLE puppy_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE routine_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PROFILES
-- ============================================

CREATE POLICY "profiles_select" ON profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "profiles_update" ON profiles FOR UPDATE
  USING (id = auth.uid());

-- ============================================
-- PUPPIES - use auth.uid() IS NOT NULL (works with anon role + JWT)
-- ============================================

CREATE POLICY "puppies_insert" ON puppies FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "puppies_select" ON puppies FOR SELECT
  USING (public.is_puppy_member(id, auth.uid()));

CREATE POLICY "puppies_update" ON puppies FOR UPDATE
  USING (public.is_puppy_owner(id, auth.uid()));

CREATE POLICY "puppies_delete" ON puppies FOR DELETE
  USING (public.is_puppy_owner(id, auth.uid()));

-- ============================================
-- PUPPY MEMBERSHIPS
-- ============================================

CREATE POLICY "memberships_insert" ON puppy_memberships FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "memberships_select_own" ON puppy_memberships FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "memberships_select_owner" ON puppy_memberships FOR SELECT
  USING (public.is_puppy_owner(puppy_id, auth.uid()));

CREATE POLICY "memberships_update" ON puppy_memberships FOR UPDATE
  USING (public.is_puppy_owner(puppy_id, auth.uid()));

-- ============================================
-- ROUTINES
-- ============================================

CREATE POLICY "routines_select" ON routines FOR SELECT
  USING (public.is_puppy_member(puppy_id, auth.uid()));

CREATE POLICY "routines_insert" ON routines FOR INSERT
  WITH CHECK (public.is_puppy_owner(puppy_id, auth.uid()));

CREATE POLICY "routines_update" ON routines FOR UPDATE
  USING (public.is_puppy_owner(puppy_id, auth.uid()));

-- ============================================
-- ROUTINE ITEMS
-- ============================================

CREATE POLICY "routine_items_select" ON routine_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM routines
      WHERE routines.id = routine_items.routine_id
        AND public.is_puppy_member(routines.puppy_id, auth.uid())
    )
  );

CREATE POLICY "routine_items_insert" ON routine_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM routines
      WHERE routines.id = routine_items.routine_id
        AND public.is_puppy_owner(routines.puppy_id, auth.uid())
    )
  );

CREATE POLICY "routine_items_update" ON routine_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM routines
      WHERE routines.id = routine_items.routine_id
        AND public.is_puppy_owner(routines.puppy_id, auth.uid())
    )
  );

-- ============================================
-- ACTIVITY LOGS
-- ============================================

CREATE POLICY "activity_logs_select" ON activity_logs FOR SELECT
  USING (public.is_puppy_member(puppy_id, auth.uid()));

CREATE POLICY "activity_logs_insert" ON activity_logs FOR INSERT
  WITH CHECK (public.is_puppy_member(puppy_id, auth.uid()));

CREATE POLICY "activity_logs_update" ON activity_logs FOR UPDATE
  USING (completed_by = auth.uid());

-- ============================================
-- INVITES
-- ============================================

CREATE POLICY "invites_select" ON invites FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "invites_insert" ON invites FOR INSERT
  WITH CHECK (
    invited_by = auth.uid()
    AND public.is_puppy_owner(puppy_id, auth.uid())
  );

CREATE POLICY "invites_update" ON invites FOR UPDATE
  USING (invited_by = auth.uid() OR auth.uid() IS NOT NULL);

-- ============================================
-- VERIFY: Show all policies
-- ============================================

SELECT tablename, policyname, cmd, roles, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd, policyname;
