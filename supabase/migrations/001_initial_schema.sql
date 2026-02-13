-- PupPlan (Enzo) - Initial Database Migration
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. TABLES
-- ============================================

-- Profiles (extends Supabase auth.users with display info)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Puppies
CREATE TABLE puppies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  breed TEXT NOT NULL,
  age_months INT NOT NULL DEFAULT 0,
  age_weeks INT NOT NULL DEFAULT 0,
  weight_value DECIMAL,
  weight_unit TEXT DEFAULT 'lbs',
  living_situation TEXT NOT NULL,
  photo_url TEXT,
  questionnaire_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Puppy Memberships (links users to puppies with roles)
CREATE TABLE puppy_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  puppy_id UUID NOT NULL REFERENCES puppies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'caretaker')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'removed')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(puppy_id, user_id)
);

-- Routines
CREATE TABLE routines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  puppy_id UUID NOT NULL REFERENCES puppies(id) ON DELETE CASCADE,
  generated_at TIMESTAMPTZ DEFAULT now(),
  source TEXT DEFAULT 'ai_generated',
  is_active BOOLEAN DEFAULT true
);

-- Routine Items
CREATE TABLE routine_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_id UUID NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  scheduled_time TIME NOT NULL,
  duration_minutes INT,
  sort_order INT,
  is_enabled BOOLEAN DEFAULT true
);

-- Activity Logs
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_item_id UUID NOT NULL REFERENCES routine_items(id) ON DELETE CASCADE,
  puppy_id UUID NOT NULL REFERENCES puppies(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('completed', 'missed', 'skipped')),
  completed_by UUID REFERENCES auth.users(id),
  completed_at TIMESTAMPTZ,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(routine_item_id, date)
);

-- Invites
CREATE TABLE invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  puppy_id UUID NOT NULL REFERENCES puppies(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  invite_token TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  accepted_by UUID REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 2. INDEXES (query performance)
-- ============================================

CREATE INDEX idx_puppy_memberships_user ON puppy_memberships(user_id) WHERE status = 'active';
CREATE INDEX idx_puppy_memberships_puppy ON puppy_memberships(puppy_id) WHERE status = 'active';
CREATE INDEX idx_routines_puppy_active ON routines(puppy_id) WHERE is_active = true;
CREATE INDEX idx_routine_items_routine ON routine_items(routine_id);
CREATE INDEX idx_activity_logs_puppy_date ON activity_logs(puppy_id, date);
CREATE INDEX idx_activity_logs_routine_item ON activity_logs(routine_item_id, date);
CREATE INDEX idx_invites_token ON invites(invite_token) WHERE status = 'pending';
CREATE INDEX idx_invites_puppy ON invites(puppy_id);

-- ============================================
-- 3. AUTO-CREATE PROFILE ON SIGNUP (trigger)
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'avatar_url', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 4. ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE puppies ENABLE ROW LEVEL SECURITY;
ALTER TABLE puppy_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE routine_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;

-- ---- PROFILES ----

CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid());

-- ---- PUPPIES ----

-- Anyone with an active membership can read the puppy
CREATE POLICY "Members can read their puppies"
  ON puppies FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM puppy_memberships
      WHERE puppy_memberships.puppy_id = puppies.id
        AND puppy_memberships.user_id = auth.uid()
        AND puppy_memberships.status = 'active'
    )
  );

-- Only owners can insert puppies (they create the membership right after)
CREATE POLICY "Authenticated users can create puppies"
  ON puppies FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Only owners can update puppies
CREATE POLICY "Owners can update their puppies"
  ON puppies FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM puppy_memberships
      WHERE puppy_memberships.puppy_id = puppies.id
        AND puppy_memberships.user_id = auth.uid()
        AND puppy_memberships.role = 'owner'
        AND puppy_memberships.status = 'active'
    )
  );

-- Only owners can delete puppies
CREATE POLICY "Owners can delete their puppies"
  ON puppies FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM puppy_memberships
      WHERE puppy_memberships.puppy_id = puppies.id
        AND puppy_memberships.user_id = auth.uid()
        AND puppy_memberships.role = 'owner'
        AND puppy_memberships.status = 'active'
    )
  );

-- ---- PUPPY MEMBERSHIPS ----

CREATE POLICY "Users can read their own memberships"
  ON puppy_memberships FOR SELECT
  USING (user_id = auth.uid());

-- Owners can read all memberships for their puppies (to see caretakers)
CREATE POLICY "Owners can read all memberships for their puppies"
  ON puppy_memberships FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM puppy_memberships AS pm
      WHERE pm.puppy_id = puppy_memberships.puppy_id
        AND pm.user_id = auth.uid()
        AND pm.role = 'owner'
        AND pm.status = 'active'
    )
  );

CREATE POLICY "Authenticated users can create memberships"
  ON puppy_memberships FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Owners can update memberships (e.g., remove caretaker)
CREATE POLICY "Owners can update memberships for their puppies"
  ON puppy_memberships FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM puppy_memberships AS pm
      WHERE pm.puppy_id = puppy_memberships.puppy_id
        AND pm.user_id = auth.uid()
        AND pm.role = 'owner'
        AND pm.status = 'active'
    )
  );

-- ---- ROUTINES ----

CREATE POLICY "Members can read routines for their puppies"
  ON routines FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM puppy_memberships
      WHERE puppy_memberships.puppy_id = routines.puppy_id
        AND puppy_memberships.user_id = auth.uid()
        AND puppy_memberships.status = 'active'
    )
  );

CREATE POLICY "Owners can create routines"
  ON routines FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM puppy_memberships
      WHERE puppy_memberships.puppy_id = routines.puppy_id
        AND puppy_memberships.user_id = auth.uid()
        AND puppy_memberships.role = 'owner'
        AND puppy_memberships.status = 'active'
    )
  );

CREATE POLICY "Owners can update routines"
  ON routines FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM puppy_memberships
      WHERE puppy_memberships.puppy_id = routines.puppy_id
        AND puppy_memberships.user_id = auth.uid()
        AND puppy_memberships.role = 'owner'
        AND puppy_memberships.status = 'active'
    )
  );

-- ---- ROUTINE ITEMS ----

CREATE POLICY "Members can read routine items"
  ON routine_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM routines
      JOIN puppy_memberships ON puppy_memberships.puppy_id = routines.puppy_id
      WHERE routines.id = routine_items.routine_id
        AND puppy_memberships.user_id = auth.uid()
        AND puppy_memberships.status = 'active'
    )
  );

CREATE POLICY "Owners can create routine items"
  ON routine_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM routines
      JOIN puppy_memberships ON puppy_memberships.puppy_id = routines.puppy_id
      WHERE routines.id = routine_items.routine_id
        AND puppy_memberships.user_id = auth.uid()
        AND puppy_memberships.role = 'owner'
        AND puppy_memberships.status = 'active'
    )
  );

CREATE POLICY "Owners can update routine items"
  ON routine_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM routines
      JOIN puppy_memberships ON puppy_memberships.puppy_id = routines.puppy_id
      WHERE routines.id = routine_items.routine_id
        AND puppy_memberships.user_id = auth.uid()
        AND puppy_memberships.role = 'owner'
        AND puppy_memberships.status = 'active'
    )
  );

-- ---- ACTIVITY LOGS ----

-- All members can read activity logs for their puppies
CREATE POLICY "Members can read activity logs"
  ON activity_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM puppy_memberships
      WHERE puppy_memberships.puppy_id = activity_logs.puppy_id
        AND puppy_memberships.user_id = auth.uid()
        AND puppy_memberships.status = 'active'
    )
  );

-- All members can insert activity logs (mark activities complete)
CREATE POLICY "Members can create activity logs"
  ON activity_logs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM puppy_memberships
      WHERE puppy_memberships.puppy_id = activity_logs.puppy_id
        AND puppy_memberships.user_id = auth.uid()
        AND puppy_memberships.status = 'active'
    )
  );

-- Users can update their own activity logs
CREATE POLICY "Users can update their own activity logs"
  ON activity_logs FOR UPDATE
  USING (completed_by = auth.uid());

-- ---- INVITES ----

-- Owners can read invites for their puppies
CREATE POLICY "Owners can read invites for their puppies"
  ON invites FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM puppy_memberships
      WHERE puppy_memberships.puppy_id = invites.puppy_id
        AND puppy_memberships.user_id = auth.uid()
        AND puppy_memberships.role = 'owner'
        AND puppy_memberships.status = 'active'
    )
  );

-- Anyone can read an invite by token (needed for accept flow)
CREATE POLICY "Anyone can read invite by token"
  ON invites FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Owners can create invites
CREATE POLICY "Owners can create invites"
  ON invites FOR INSERT
  WITH CHECK (
    invited_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM puppy_memberships
      WHERE puppy_memberships.puppy_id = invites.puppy_id
        AND puppy_memberships.user_id = auth.uid()
        AND puppy_memberships.role = 'owner'
        AND puppy_memberships.status = 'active'
    )
  );

-- Owners can update invites (revoke) and acceptors can update (accept)
CREATE POLICY "Invite participants can update invites"
  ON invites FOR UPDATE
  USING (
    invited_by = auth.uid()
    OR auth.uid() IS NOT NULL -- caretaker accepting
  );

-- ============================================
-- 5. REALTIME (enable for activity sync)
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE activity_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE invites;

-- ============================================
-- 6. STORAGE POLICIES (for puppy-photos bucket)
-- Run these AFTER creating the "puppy-photos" bucket
-- in the Supabase Storage dashboard
-- ============================================

-- Allow authenticated users to upload photos
CREATE POLICY "Authenticated users can upload puppy photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'puppy-photos'
    AND auth.uid() IS NOT NULL
  );

-- Allow public read access to puppy photos
CREATE POLICY "Public read access to puppy photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'puppy-photos');

-- Allow users to update their own uploads
CREATE POLICY "Users can update their own puppy photos"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'puppy-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow users to delete their own uploads
CREATE POLICY "Users can delete their own puppy photos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'puppy-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
