-- Add optional free-text profile detail fields collected at self-signup time.
-- These are reference text only — no FK to organizations/churches, so no
-- directory data needs to be exposed to the public /signup page. The admin
-- reads this text at approval time and manually picks the matching
-- organization/church/group via the existing admin affiliation selects.

ALTER TABLE public.signup_requests
  ADD COLUMN IF NOT EXISTS affiliation_text text,
  ADD COLUMN IF NOT EXISTS region_text text,
  ADD COLUMN IF NOT EXISTS generation_text text,
  ADD COLUMN IF NOT EXISTS ministry_position text,
  ADD COLUMN IF NOT EXISTS self_introduction text;
