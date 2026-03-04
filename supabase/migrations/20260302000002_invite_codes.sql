-- Migration: Replace invites table with invite_codes table (D70)
-- The invite code system is simpler: no status, no expiry, no accepted_by.
-- Each household gets a persistent, unique code generated at puppy creation.

-- 1. Create invite_codes table
CREATE TABLE IF NOT EXISTS invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  puppy_id UUID NOT NULL REFERENCES puppies(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One invite code per puppy (enforced at DB level)
CREATE UNIQUE INDEX IF NOT EXISTS idx_invite_codes_puppy_id ON invite_codes(puppy_id);

-- Fast lookups by code (used by validate-invite-code Edge Function)
CREATE INDEX IF NOT EXISTS idx_invite_codes_code ON invite_codes(code);

COMMENT ON TABLE invite_codes IS 'Persistent, unique invite codes per household. Replaces the old invites table (D70).';
COMMENT ON COLUMN invite_codes.code IS 'Format: {WORD}-{ALPHANUMERIC}, e.g. BISCUIT-7X2K. Case-insensitive (stored uppercase). See D71.';

-- 2. RLS policies
ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;

-- Owners can read their own puppy's invite code (Settings > Caretakers)
CREATE POLICY "Owners can view invite codes for their puppies"
  ON invite_codes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM puppy_memberships
      WHERE puppy_id = invite_codes.puppy_id
        AND user_id = auth.uid()
        AND role = 'owner'
        AND status = 'active'
    )
  );

-- Owners can insert invite codes for their puppies (during onboarding)
CREATE POLICY "Owners can create invite codes for their puppies"
  ON invite_codes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM puppy_memberships
      WHERE puppy_id = invite_codes.puppy_id
        AND user_id = auth.uid()
        AND role = 'owner'
        AND status = 'active'
    )
  );

-- 3. Drop old invites table (no production data at 0→1 stage)
DROP TABLE IF EXISTS invites;
