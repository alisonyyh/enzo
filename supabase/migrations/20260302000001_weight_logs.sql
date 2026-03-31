-- ============================================================================
-- WEIGHT TRACKING: weight_logs table, RLS policies, indexes, and sync trigger
-- Feature: F12 / Flow 8 (decisions-log.md D58-D67)
-- Backend Plan: Section 21 of backend-development-plan.md
-- ============================================================================

-- ============================================================================
-- TABLE: weight_logs
-- ============================================================================
-- Stores historical weight entries for a puppy.
-- Each entry records its own unit independently (D63).
-- The is_onboarding flag identifies the auto-migrated baseline entry (D62).

CREATE TABLE weight_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  puppy_id UUID NOT NULL REFERENCES puppies(id) ON DELETE CASCADE,
  weight_value DECIMAL NOT NULL,
  weight_unit TEXT NOT NULL DEFAULT 'lbs',
  logged_at DATE NOT NULL DEFAULT CURRENT_DATE,
  logged_by UUID REFERENCES auth.users(id),
  note TEXT,
  is_onboarding BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- CHECK constraints for data integrity (defense in depth beyond client-side validation)
ALTER TABLE weight_logs
  ADD CONSTRAINT weight_logs_weight_positive CHECK (weight_value > 0),
  ADD CONSTRAINT weight_logs_weight_max CHECK (weight_value <= 300),
  ADD CONSTRAINT weight_logs_unit_valid CHECK (weight_unit IN ('lbs', 'kg')),
  ADD CONSTRAINT weight_logs_note_length CHECK (note IS NULL OR char_length(note) <= 200);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Primary query pattern: fetch all logs for a puppy, newest first
-- Used by getWeightLogs() in weight-logs.ts
CREATE INDEX idx_weight_logs_puppy_date
  ON weight_logs(puppy_id, logged_at DESC, created_at DESC);

-- Speed up onboarding check: ensureOnboardingWeight() queries by puppy_id + is_onboarding
CREATE INDEX idx_weight_logs_onboarding
  ON weight_logs(puppy_id)
  WHERE is_onboarding = true;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
-- Both owner and caretaker have equal CRUD access (D58).
-- DELETE policy includes is_onboarding = false guard (D65) — triple-guarded:
--   1. Client: LogWeightSheet hides Delete button for is_onboarding entries
--   2. Service: deleteWeightLog() adds .eq('is_onboarding', false)
--   3. Database: RLS DELETE policy (below)

ALTER TABLE weight_logs ENABLE ROW LEVEL SECURITY;

-- SELECT: Both owner and caretaker can view weight logs
CREATE POLICY "Members can view weight logs for their puppies"
  ON weight_logs FOR SELECT
  USING (
    puppy_id IN (
      SELECT puppy_id FROM puppy_memberships
      WHERE user_id = auth.uid()
        AND status = 'active'
    )
  );

-- INSERT: Both owner and caretaker can add weight logs
CREATE POLICY "Members can insert weight logs for their puppies"
  ON weight_logs FOR INSERT
  WITH CHECK (
    puppy_id IN (
      SELECT puppy_id FROM puppy_memberships
      WHERE user_id = auth.uid()
        AND status = 'active'
    )
  );

-- UPDATE: Both owner and caretaker can edit weight logs
CREATE POLICY "Members can update weight logs for their puppies"
  ON weight_logs FOR UPDATE
  USING (
    puppy_id IN (
      SELECT puppy_id FROM puppy_memberships
      WHERE user_id = auth.uid()
        AND status = 'active'
    )
  );

-- DELETE: Both owner and caretaker can delete weight logs
-- EXCEPT onboarding entries (is_onboarding = false guard per D65)
CREATE POLICY "Members can delete weight logs for their puppies"
  ON weight_logs FOR DELETE
  USING (
    is_onboarding = false
    AND puppy_id IN (
      SELECT puppy_id FROM puppy_memberships
      WHERE user_id = auth.uid()
        AND status = 'active'
    )
  );

-- ============================================================================
-- TRIGGER: Sync most recent weight to puppies table
-- ============================================================================
-- When a weight_log is inserted, updated, or deleted, update
-- puppies.weight_value and puppies.weight_unit to reflect the
-- most recent entry (by logged_at DESC, created_at DESC).
--
-- This ensures the puppy profile always shows current weight
-- even if the client didn't update it (crash, network error, etc.)
--
-- Uses SECURITY DEFINER so the trigger can UPDATE the puppies table
-- even though the RLS policy on puppies restricts writes to owners only.
-- (Caretakers can log weight but shouldn't need UPDATE permission on puppies.)

CREATE OR REPLACE FUNCTION update_current_weight()
RETURNS TRIGGER AS $$
DECLARE
  target_puppy_id UUID;
  latest_weight DECIMAL;
  latest_unit TEXT;
BEGIN
  -- Determine which puppy to update
  target_puppy_id := COALESCE(NEW.puppy_id, OLD.puppy_id);

  -- Find the most recent weight entry
  SELECT weight_value, weight_unit
  INTO latest_weight, latest_unit
  FROM weight_logs
  WHERE puppy_id = target_puppy_id
  ORDER BY logged_at DESC, created_at DESC
  LIMIT 1;

  -- Update the puppies table
  -- If all weight logs were deleted, latest_weight will be NULL.
  -- In that case, keep existing values (should not happen in practice
  -- because onboarding entries can't be deleted via RLS).
  IF latest_weight IS NOT NULL THEN
    UPDATE puppies
    SET weight_value = latest_weight,
        weight_unit = latest_unit
    WHERE id = target_puppy_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER weight_log_sync
  AFTER INSERT OR UPDATE OR DELETE ON weight_logs
  FOR EACH ROW EXECUTE FUNCTION update_current_weight();

-- ============================================================================
-- TRIGGER: Auto-update updated_at on row modifications
-- ============================================================================

CREATE OR REPLACE FUNCTION update_weight_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER weight_logs_updated_at
  BEFORE UPDATE ON weight_logs
  FOR EACH ROW EXECUTE FUNCTION update_weight_logs_updated_at();
