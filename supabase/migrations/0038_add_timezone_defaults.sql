-- Add organization-level timezone defaults and seed the global system default timezone.
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS default_timezone text NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'organizations_default_timezone_length_chk'
  ) THEN
    ALTER TABLE public.organizations
      ADD CONSTRAINT organizations_default_timezone_length_chk
      CHECK (
        default_timezone IS NULL
        OR char_length(default_timezone) BETWEEN 3 AND 80
      );
  END IF;
END
$$;

INSERT INTO public.system_settings (
  scope_type,
  scope_id,
  key,
  value,
  value_type,
  description
)
VALUES (
  'global',
  null,
  'default_timezone',
  '{"timezone":"Asia/Bangkok"}'::jsonb,
  'timezone',
  'Global default timezone used when profile and organization timezone are not set.'
)
ON CONFLICT ON CONSTRAINT system_settings_scope_key_unique DO NOTHING;
