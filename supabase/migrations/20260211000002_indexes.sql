-- Performance indexes for PupPlan
-- These speed up common queries, especially RLS policy checks

-- ============================================================================
-- PUPPY_MEMBERSHIPS INDEXES
-- ============================================================================

-- Critical for RLS: speeds up membership lookups by user
-- Used in nearly every RLS policy
CREATE INDEX idx_puppy_memberships_user_puppy
  ON puppy_memberships(user_id, puppy_id)
  WHERE status = 'active';

-- Speed up reverse lookups (find all users for a puppy)
CREATE INDEX idx_puppy_memberships_puppy_user
  ON puppy_memberships(puppy_id, user_id)
  WHERE status = 'active';

-- Speed up role-based queries (find owners)
CREATE INDEX idx_puppy_memberships_role
  ON puppy_memberships(puppy_id, role)
  WHERE status = 'active';

-- ============================================================================
-- ROUTINES INDEXES
-- ============================================================================

-- Speed up fetching active routine for a puppy
-- Critical for dashboard load performance
CREATE INDEX idx_routines_puppy_active
  ON routines(puppy_id, is_active)
  WHERE is_active = true;

-- Speed up routine history queries (if needed later)
CREATE INDEX idx_routines_puppy_generated
  ON routines(puppy_id, generated_at DESC);

-- ============================================================================
-- ROUTINE_ITEMS INDEXES
-- ============================================================================

-- Speed up fetching items for a routine
-- Used every time dashboard loads
CREATE INDEX idx_routine_items_routine
  ON routine_items(routine_id, scheduled_time);

-- Speed up sorting by time
CREATE INDEX idx_routine_items_time
  ON routine_items(scheduled_time)
  WHERE is_enabled = true;

-- ============================================================================
-- ACTIVITY_LOGS INDEXES
-- ============================================================================

-- Critical: speed up today's logs query (dashboard load)
-- Most common query in the app
CREATE INDEX idx_activity_logs_puppy_date
  ON activity_logs(puppy_id, date DESC);

-- Speed up finding logs for a specific routine item
CREATE INDEX idx_activity_logs_routine_item_date
  ON activity_logs(routine_item_id, date);

-- Speed up user completion history (for progress tracking)
CREATE INDEX idx_activity_logs_completed_by
  ON activity_logs(completed_by, puppy_id, date)
  WHERE completed_by IS NOT NULL;

-- Speed up date range queries (weekly/monthly stats)
CREATE INDEX idx_activity_logs_date_range
  ON activity_logs(puppy_id, date, status);

-- ============================================================================
-- INVITES INDEXES
-- ============================================================================

-- Critical: speed up invite token lookups (invite acceptance)
-- Must be very fast for good UX
CREATE INDEX idx_invites_token
  ON invites(invite_token)
  WHERE status = 'pending';

-- Speed up finding invites by puppy (owner's invite management)
CREATE INDEX idx_invites_puppy_status
  ON invites(puppy_id, status, created_at DESC);

-- Speed up cleanup queries (find expired invites)
CREATE INDEX idx_invites_expires
  ON invites(expires_at)
  WHERE status = 'pending';

-- ============================================================================
-- PROFILES INDEXES
-- ============================================================================

-- Speed up profile lookups by ID (for avatar fetching)
-- Used when displaying completer profile pictures
CREATE INDEX idx_profiles_id
  ON profiles(id);

-- ============================================================================
-- COMPOSITE INDEXES FOR COMPLEX QUERIES
-- ============================================================================

-- Speed up dashboard query: get today's logs with completer info
-- Optimizes the JOIN between activity_logs and profiles
CREATE INDEX idx_activity_logs_dashboard
  ON activity_logs(puppy_id, date, completed_by)
  WHERE completed_by IS NOT NULL;
