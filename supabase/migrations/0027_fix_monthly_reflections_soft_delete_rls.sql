-- Migration: 0027_fix_monthly_reflections_soft_delete_rls.sql
-- Purpose:
--   Allow profile-owned monthly_reflections rows to be soft deleted by setting
--   deleted_at, while keeping profile.id based ownership and SELECT visibility
--   unchanged.
--
-- Notes:
--   - SELECT policy remains unchanged in 0026 and still filters deleted_at IS NULL.
--   - No DELETE policy is added; removal remains a soft delete via UPDATE.
--   - Ownership remains based on public.current_profile_id(), not auth.uid().

DROP POLICY IF EXISTS "monthly reflections update own" ON public.monthly_reflections;

CREATE POLICY "monthly reflections update own"
ON public.monthly_reflections
FOR UPDATE
TO authenticated
USING (
  public.monthly_reflections.deleted_at IS NULL
  AND public.monthly_reflections.profile_id = public.current_profile_id()
)
WITH CHECK (
  public.monthly_reflections.profile_id = public.current_profile_id()
  AND (
    public.monthly_reflections.deleted_at IS NOT NULL
    OR public.is_own_or_empty_relationship(
      public.monthly_reflections.relationship_id,
      public.monthly_reflections.profile_id
    )
  )
);
