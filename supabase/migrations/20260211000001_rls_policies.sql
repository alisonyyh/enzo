-- Enable Row Level Security on all tables
-- This is CRITICAL for production security

-- ============================================================================
-- PROFILES TABLE
-- ============================================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can view all profiles (needed for showing completer avatars)
CREATE POLICY "Users can view all profiles"
  ON profiles FOR SELECT
  USING (true);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Users can insert their own profile (auto-created on signup)
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ============================================================================
-- PUPPIES TABLE
-- ============================================================================
ALTER TABLE puppies ENABLE ROW LEVEL SECURITY;

-- Members can view puppies they have access to
CREATE POLICY "Members can view puppies they have access to"
  ON puppies FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM puppy_memberships
      WHERE puppy_id = puppies.id
        AND user_id = auth.uid()
        AND status = 'active'
    )
  );

-- Owners can update their puppies
CREATE POLICY "Owners can update their puppies"
  ON puppies FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM puppy_memberships
      WHERE puppy_id = puppies.id
        AND user_id = auth.uid()
        AND role = 'owner'
        AND status = 'active'
    )
  );

-- Authenticated users can insert puppies (they become the owner)
CREATE POLICY "Authenticated users can insert puppies"
  ON puppies FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================================
-- PUPPY_MEMBERSHIPS TABLE
-- ============================================================================
ALTER TABLE puppy_memberships ENABLE ROW LEVEL SECURITY;

-- Members can view memberships for their puppies
CREATE POLICY "Members can view memberships for their puppies"
  ON puppy_memberships FOR SELECT
  USING (
    puppy_id IN (
      SELECT puppy_id FROM puppy_memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Authenticated users can insert memberships (when creating a puppy)
CREATE POLICY "Authenticated users can insert memberships"
  ON puppy_memberships FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Owners can update memberships for their puppies
CREATE POLICY "Owners can update memberships"
  ON puppy_memberships FOR UPDATE
  USING (
    puppy_id IN (
      SELECT puppy_id FROM puppy_memberships
      WHERE user_id = auth.uid()
        AND role = 'owner'
        AND status = 'active'
    )
  );

-- ============================================================================
-- ROUTINES TABLE
-- ============================================================================
ALTER TABLE routines ENABLE ROW LEVEL SECURITY;

-- Members can view routines for their puppies
CREATE POLICY "Members can view routines for their puppies"
  ON routines FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM puppy_memberships
      WHERE puppy_id = routines.puppy_id
        AND user_id = auth.uid()
        AND status = 'active'
    )
  );

-- Authenticated users can insert routines (Edge Function context)
CREATE POLICY "Authenticated users can insert routines"
  ON routines FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Owners can update routines for their puppies
CREATE POLICY "Owners can update routines"
  ON routines FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM puppy_memberships
      WHERE puppy_id = routines.puppy_id
        AND user_id = auth.uid()
        AND role = 'owner'
        AND status = 'active'
    )
  );

-- ============================================================================
-- ROUTINE_ITEMS TABLE
-- ============================================================================
ALTER TABLE routine_items ENABLE ROW LEVEL SECURITY;

-- Members can view routine items for their puppies
CREATE POLICY "Members can view routine items for their puppies"
  ON routine_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM routines r
      JOIN puppy_memberships pm ON pm.puppy_id = r.puppy_id
      WHERE r.id = routine_items.routine_id
        AND pm.user_id = auth.uid()
        AND pm.status = 'active'
    )
  );

-- Authenticated users can insert routine items (Edge Function context)
CREATE POLICY "Authenticated users can insert routine items"
  ON routine_items FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Owners can update routine items for their puppies
CREATE POLICY "Owners can update routine items"
  ON routine_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM routines r
      JOIN puppy_memberships pm ON pm.puppy_id = r.puppy_id
      WHERE r.id = routine_items.routine_id
        AND pm.user_id = auth.uid()
        AND pm.role = 'owner'
        AND pm.status = 'active'
    )
  );

-- ============================================================================
-- ACTIVITY_LOGS TABLE
-- ============================================================================
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Members can view activity logs for their puppies
CREATE POLICY "Members can view activity logs for their puppies"
  ON activity_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM puppy_memberships
      WHERE puppy_id = activity_logs.puppy_id
        AND user_id = auth.uid()
        AND status = 'active'
    )
  );

-- Members can insert activity logs (when completing tasks)
CREATE POLICY "Members can insert activity logs"
  ON activity_logs FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM puppy_memberships
      WHERE puppy_id = activity_logs.puppy_id
        AND user_id = auth.uid()
        AND status = 'active'
    )
  );

-- Members can delete their own activity logs (undo completion)
CREATE POLICY "Members can delete their own activity logs"
  ON activity_logs FOR DELETE
  USING (
    completed_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM puppy_memberships
      WHERE puppy_id = activity_logs.puppy_id
        AND user_id = auth.uid()
        AND status = 'active'
    )
  );

-- ============================================================================
-- INVITES TABLE
-- ============================================================================
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;

-- Owners can view invites for their puppies
CREATE POLICY "Owners can view invites for their puppies"
  ON invites FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM puppy_memberships
      WHERE puppy_id = invites.puppy_id
        AND user_id = auth.uid()
        AND role = 'owner'
        AND status = 'active'
    )
  );

-- Anyone can view pending invites by token (for invite acceptance flow)
CREATE POLICY "Anyone can view pending invites by token"
  ON invites FOR SELECT
  USING (status = 'pending');

-- Owners can insert invites for their puppies
CREATE POLICY "Owners can insert invites"
  ON invites FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM puppy_memberships
      WHERE puppy_id = invites.puppy_id
        AND user_id = auth.uid()
        AND role = 'owner'
        AND status = 'active'
    )
  );

-- Owners can update invites for their puppies
CREATE POLICY "Owners can update invites"
  ON invites FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM puppy_memberships
      WHERE puppy_id = invites.puppy_id
        AND user_id = auth.uid()
        AND role = 'owner'
        AND status = 'active'
    )
  );

-- Authenticated users can update invites when accepting
CREATE POLICY "Authenticated users can accept invites"
  ON invites FOR UPDATE
  USING (auth.uid() IS NOT NULL AND status = 'pending');
