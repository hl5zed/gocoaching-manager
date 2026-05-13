-- Add optional ministry position text field for member profile metadata.
-- Existing country/organization/church/generation/role columns are reused.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ministry_position text;
