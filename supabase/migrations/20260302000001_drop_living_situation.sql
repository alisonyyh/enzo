-- Migration: Drop living_situation column from puppies table
-- Reason: Living situation and work arrangement were removed from the
-- onboarding questionnaire (4-step → 3-step flow). The column is no
-- longer populated by the frontend or used by the AI routine generator.

ALTER TABLE puppies DROP COLUMN IF EXISTS living_situation;
