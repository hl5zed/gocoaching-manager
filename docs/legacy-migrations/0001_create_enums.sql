-- =============================================================================
-- Migration: 0001_create_enums.sql
-- Project:   GOThriveCoaching
-- Purpose:   Declare every application-level PostgreSQL enum type (27 total).
--
-- Rules:
--   - All enums are created in the public schema.
--   - No tables, indexes, or functions are created here.
--   - Later migrations reference these types by name in column definitions.
--   - Adding a new value to an existing enum requires a separate migration
--     using:  ALTER TYPE <enum_name> ADD VALUE '<new_value>';
--   - Renaming or removing enum values requires a full column rewrite and
--     must be treated as a breaking change.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. USER / PROFILE STATUS
--    Used by: profiles.status
--    Correction applied: profile_status_enum added as a first-class named type
--    (not an inline check constraint) so it is reusable and auditable.
-- -----------------------------------------------------------------------------
CREATE TYPE profile_status_enum AS ENUM (
  'active',
  'inactive',
  'suspended',
  'archived',
  'anonymized'
);


-- -----------------------------------------------------------------------------
-- 2. SYSTEM ROLES
--    Used by: user_roles.role, profiles.primary_role, invitations.invited_role
--    These are platform-permission roles, distinct from Growth Level roles.
-- -----------------------------------------------------------------------------
CREATE TYPE system_role_enum AS ENUM (
  'super_admin',
  'country_admin',
  'organization_admin',
  'church_admin',
  'group_leader',
  'coach_maker',
  'coach',
  'coachee'
);


-- -----------------------------------------------------------------------------
-- 3. SCOPE TYPES
--    Used by: user_roles.scope_type, stats_snapshots.scope_type,
--             app_settings.scope_type, invitations.scope_type
--    Defines the level of the hierarchy a role or setting applies to.
-- -----------------------------------------------------------------------------
CREATE TYPE scope_type_enum AS ENUM (
  'global',
  'country',
  'region',
  'organization',
  'church',
  'group',
  'cohort',
  'coach'
);


-- -----------------------------------------------------------------------------
-- 4. USER ROLE STATUS
--    Used by: user_roles.status
--    Separate from profile_status_enum — a role can be revoked without
--    deactivating the entire profile.
-- -----------------------------------------------------------------------------
CREATE TYPE user_role_status_enum AS ENUM (
  'active',
  'inactive',
  'revoked'
);


-- -----------------------------------------------------------------------------
-- 5. ORGANIZATION TYPE
--    Used by: organizations.organization_type
-- -----------------------------------------------------------------------------
CREATE TYPE organization_type_enum AS ENUM (
  'denomination',
  'mission_body',
  'church_network',
  'local_ministry',
  'nonprofit',
  'other'
);


-- -----------------------------------------------------------------------------
-- 6. GROUP TYPE
--    Used by: groups.group_type
-- -----------------------------------------------------------------------------
CREATE TYPE group_type_enum AS ENUM (
  'ministry_team',
  'small_group',
  'cohort_group',
  'training_group',
  'regional_group',
  'other'
);


-- -----------------------------------------------------------------------------
-- 7. GOAL STATUS
--    Used by: goals.status
-- -----------------------------------------------------------------------------
CREATE TYPE goal_status_enum AS ENUM (
  'active',
  'paused',
  'completed',
  'archived'
);


-- -----------------------------------------------------------------------------
-- 8. GOAL TARGET PERIOD
--    Used by: goals.target_period
--    Describes the window over which the goal target applies.
-- -----------------------------------------------------------------------------
CREATE TYPE goal_target_period_enum AS ENUM (
  'weekly',
  'monthly',
  'quarterly',
  'yearly'
);


-- -----------------------------------------------------------------------------
-- 9. GOAL FREQUENCY
--    Used by: goals.frequency
--    How often the user is expected to log progress against this goal.
-- -----------------------------------------------------------------------------
CREATE TYPE goal_frequency_enum AS ENUM (
  'daily',
  'weekly',
  'monthly'
);


-- -----------------------------------------------------------------------------
-- 10. WEEKLY LOG STATUS
--     Used by: weekly_logs.status
--     Derived from the spec's weekly input workflow:
--       draft  → user has started but not submitted
--       submitted → user has submitted for the week
--       archived → soft-hidden from normal views
-- -----------------------------------------------------------------------------
CREATE TYPE weekly_log_status_enum AS ENUM (
  'draft',
  'submitted',
  'archived'
);


-- -----------------------------------------------------------------------------
-- 11. COACHING RELATIONSHIP STATUS
--     Used by: coaching_relationships.status
-- -----------------------------------------------------------------------------
CREATE TYPE coaching_relationship_status_enum AS ENUM (
  'active',
  'paused',
  'ended',
  'archived'
);


-- -----------------------------------------------------------------------------
-- 12. RELATIONSHIP TYPE
--     Used by: coaching_relationships.relationship_type
-- -----------------------------------------------------------------------------
CREATE TYPE relationship_type_enum AS ENUM (
  'individual_coaching',
  'group_coaching',
  'leadership_coaching',
  'pastoral_coaching',
  'missionary_coaching'
);


-- -----------------------------------------------------------------------------
-- 13. COACH FEEDBACK STATUS
--     Used by: coach_feedback.status
-- -----------------------------------------------------------------------------
CREATE TYPE coach_feedback_status_enum AS ENUM (
  'draft',
  'sent',
  'read',
  'responded',
  'archived'
);


-- -----------------------------------------------------------------------------
-- 14. PROMOTION REQUEST STATUS
--     Used by: level_promotion_requests.status
-- -----------------------------------------------------------------------------
CREATE TYPE promotion_request_status_enum AS ENUM (
  'pending',
  'approved',
  'rejected',
  'cancelled'
);


-- -----------------------------------------------------------------------------
-- 15. INVITATION STATUS
--     Used by: invitations.status
-- -----------------------------------------------------------------------------
CREATE TYPE invitation_status_enum AS ENUM (
  'pending',
  'accepted',
  'expired',
  'revoked'
);


-- -----------------------------------------------------------------------------
-- 16. NOTIFICATION TYPE
--     Used by: notifications.type
-- -----------------------------------------------------------------------------
CREATE TYPE notification_type_enum AS ENUM (
  'weekly_log_reminder',
  'feedback_received',
  'promotion_candidate',
  'promotion_approved',
  'promotion_rejected',
  'risk_attention',
  'care_prompt_created',
  'coach_assignment',
  'system_notice'
);


-- -----------------------------------------------------------------------------
-- 17. CARE PROMPT STATUS
--     Used by: care_prompts.status
-- -----------------------------------------------------------------------------
CREATE TYPE care_prompt_status_enum AS ENUM (
  'pending',
  'acknowledged',
  'followed_up',
  'resolved',
  'dismissed'
);


-- -----------------------------------------------------------------------------
-- 18. SYNC STATUS
--     Used by: sync_events.sync_status
--     Tracks the lifecycle of an offline-to-online sync attempt.
-- -----------------------------------------------------------------------------
CREATE TYPE sync_status_enum AS ENUM (
  'local_saved',
  'waiting_to_sync',
  'syncing',
  'synced',
  'sync_failed',
  'conflict_detected',
  'resolved'
);


-- -----------------------------------------------------------------------------
-- 19. SYNC CONFLICT RESOLUTION ACTION
--     Used by: sync_events.resolution_action
-- -----------------------------------------------------------------------------
CREATE TYPE sync_resolution_action_enum AS ENUM (
  'kept_local',
  'used_server',
  'manually_merged',
  'dismissed'
);


-- -----------------------------------------------------------------------------
-- 20. PERIOD TYPE
--     Used by: stats_snapshots.period_type, monthly_summaries (implicit)
-- -----------------------------------------------------------------------------
CREATE TYPE period_type_enum AS ENUM (
  'weekly',
  'monthly',
  'quarterly',
  'yearly'
);


-- -----------------------------------------------------------------------------
-- 21. TRANSLATION REVIEW STATUS
--     Used by: translated_contents.review_status
--     Tracks whether an AI-generated translation has been human-reviewed.
-- -----------------------------------------------------------------------------
CREATE TYPE translation_review_status_enum AS ENUM (
  'ai_generated',
  'user_reviewed',
  'edited',
  'approved'
);


-- -----------------------------------------------------------------------------
-- 22. COACHING QUESTION TYPE
--     Used by: coaching_questions.question_type
-- -----------------------------------------------------------------------------
CREATE TYPE question_type_enum AS ENUM (
  'weekly_reflection',
  'coach_feedback_prompt',
  'blocker_discovery',
  'care_prompt',
  'next_step_planning',
  'encouragement_prompt',
  'ai_suggested'
);


-- -----------------------------------------------------------------------------
-- 23. COACHING QUESTION INTENT
--     Used by: coaching_questions.question_intent
-- -----------------------------------------------------------------------------
CREATE TYPE question_intent_enum AS ENUM (
  'reflection',
  'encouragement',
  'diagnosis',
  'action_step',
  'spiritual_discernment',
  'sustainability',
  'relationship_care'
);


-- -----------------------------------------------------------------------------
-- 24. VISIBILITY
--     Used by: weekly_reflection_answers.visibility,
--              coach_feedback.visibility
--     Controls who can see a given piece of user-generated content.
-- -----------------------------------------------------------------------------
CREATE TYPE visibility_enum AS ENUM (
  'private',
  'coach_visible',
  'group_visible'
);


-- -----------------------------------------------------------------------------
-- 25. RISK LEVEL
--     Used by: care_prompts.risk_level, stats_snapshots (implicit)
--     Maps a computed risk_score integer range to a named care level.
--     Thresholds (from spec):
--       0-29   → stable
--       30-59  → needs_encouragement
--       60-79  → needs_coach_attention
--       80-100 → needs_personal_care
--     This enum is intentionally care-centered, never punitive.
-- -----------------------------------------------------------------------------
CREATE TYPE risk_level_enum AS ENUM (
  'stable',
  'needs_encouragement',
  'needs_coach_attention',
  'needs_personal_care'
);


-- -----------------------------------------------------------------------------
-- 26. COACH RESPONSE ACTION
--     Used by: care_prompts.coach_response_action
--     Records what action the coach took in response to a care prompt.
--     Values map to the actions available on the care prompt UX screen.
-- -----------------------------------------------------------------------------
CREATE TYPE coach_response_action_enum AS ENUM (
  'sent_encouragement',
  'wrote_feedback',
  'scheduled_check_in',
  'dismissed',
  'resolved'
);


-- -----------------------------------------------------------------------------
-- 27. AUDIT ACTION
--     Used by: audit_logs.action
--     Exhaustive set of all named audit events across the platform.
--     Sourced from four separate "Required Audit Actions" blocks in the spec
--     plus soft-delete and lineage rebuild sections — deduplicated here.
--
--     Groups:
--       A. Auth / account lifecycle
--       B. Profile and role management
--       C. Coaching relationship management
--       D. Growth level and promotion
--       E. Weekly log lifecycle
--       F. Lineage management
--       G. Erasure and anonymization
--       H. System and admin operations
-- -----------------------------------------------------------------------------
CREATE TYPE audit_action_enum AS ENUM (
  -- A. Auth / account lifecycle
  'auth_user_disconnected',
  'account_deletion_requested',
  'account_deletion_completed',

  -- B. Profile and role management
  'profile_updated_by_admin',
  'role_changed',
  'soft_delete_profile',
  'restore_profile',
  'hard_delete_record',

  -- C. Coaching relationship management
  'coach_assigned',
  'coach_changed',
  'coaching_relationship_ended',

  -- D. Growth level and promotion
  'growth_level_promoted',
  'promotion_approved',
  'promotion_rejected',

  -- E. Weekly log lifecycle
  'weekly_log_soft_deleted',
  'restore_weekly_log',

  -- F. Lineage management
  'lineage_parent_changed',
  'lineage_subtree_rebuilt',
  'lineage_rebuild_failed',

  -- G. Erasure and anonymization
  'user_requested_erasure',
  'profile_anonymized',
  'private_reflections_deleted',
  'feedback_anonymized',
  'lineage_preserved_anonymized',
  'permanent_delete_completed',

  -- H. System and admin operations
  'snapshot_recalculated',
  'rls_policy_sensitive_action'
);


-- =============================================================================
-- End of 0001_create_enums.sql
-- All 27 enum types are now available for use in subsequent migrations.
-- =============================================================================
