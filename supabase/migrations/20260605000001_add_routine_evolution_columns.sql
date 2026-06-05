-- Add routine evolution columns (valid_until, regeneration_status, generation_context)
-- These support weekly routine regeneration (F14)
-- Using IF NOT EXISTS in case columns were added manually via SQL editor

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'routines' AND column_name = 'valid_until'
  ) THEN
    ALTER TABLE routines ADD COLUMN valid_until TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'routines' AND column_name = 'regeneration_status'
  ) THEN
    ALTER TABLE routines ADD COLUMN regeneration_status TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'routines' AND column_name = 'generation_context'
  ) THEN
    ALTER TABLE routines ADD COLUMN generation_context JSONB;
  END IF;
END
$$;

-- Backfill: set valid_until for existing active routines that don't have it
UPDATE routines
SET valid_until = generated_at + INTERVAL '7 days'
WHERE valid_until IS NULL AND is_active = true;
