// =============================================================================
// src/types/database.ts
// Updated: 2026-05-07
// Migration baseline: root SQL 0001-0012 + supabase/migrations 0013-0019
// Source: PROJECT_spec.md + current migrations in this repository
//
// SCHEMA_MISMATCH:
// - The current codebase uses audit actions `invitation_created` and
//   `invitation_revoked`, but those values are not listed in the canonical
//   PROJECT_spec.md audit action enum list provided for this task.
// - To keep type safety aligned with existing DB/code assumptions, both values
//   are included below in addition to the canonical spec values.
// - Tables such as goals, weekly_log_items, notifications, sync_events, and
//   level_promotion_requests are modeled from PROJECT_spec.md because their
//   defining SQL migrations are not present in the inspected baseline of this
//   repository yet.
// =============================================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export const PROFILE_STATUSES = [
  "active",
  "inactive",
  "suspended",
  "archived",
  "anonymized",
] as const;
export type ProfileStatus = (typeof PROFILE_STATUSES)[number];

export const GO_STATUSES = ["active", "paused", "completed", "archived"] as const;
export type GoalStatus = (typeof GO_STATUSES)[number];

export const GOAL_PRIORITIES = ["low", "normal", "high"] as const;
export type GoalPriority = (typeof GOAL_PRIORITIES)[number];

export const MOKSILGI_STATUSES = ["draft", "active", "archived"] as const;
export type MoksilgiStatus = (typeof MOKSILGI_STATUSES)[number];

export const MOKSILGI_AREA_KEYS = [
  "spiritual",
  "intellectual",
  "physical",
  "social",
  "other",
] as const;
export type MoksilgiAreaKey = (typeof MOKSILGI_AREA_KEYS)[number];

export const MOKSILGI_MEASUREMENT_TYPES = [
  "daily_check",
  "weekly_count",
  "monthly_number",
  "monthly_comment",
] as const;
export type MoksilgiMeasurementType =
  (typeof MOKSILGI_MEASUREMENT_TYPES)[number];

export const COACHING_RELATIONSHIP_STATUSES = [
  "active",
  "paused",
  "ended",
  "archived",
] as const;
export type CoachingRelationshipStatus =
  (typeof COACHING_RELATIONSHIP_STATUSES)[number];

export const RELATIONSHIP_TYPES = [
  "individual_coaching",
  "group_coaching",
  "leadership_coaching",
  "pastoral_coaching",
  "missionary_coaching",
] as const;
export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];

export const USER_ROLES = [
  "super_admin",
  "country_admin",
  "organization_admin",
  "church_admin",
  "group_leader",
  "coach_maker",
  "coach",
  "coachee",
] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const SCOPE_TYPES = [
  "global",
  "country",
  "region",
  "organization",
  "church",
  "group",
  "cohort",
  "coach",
] as const;
export type ScopeType = (typeof SCOPE_TYPES)[number];

export const INVITATION_STATUSES = [
  "pending",
  "accepted",
  "expired",
  "revoked",
] as const;
export type InvitationStatus = (typeof INVITATION_STATUSES)[number];

export const WEEKLY_LOG_STATUSES = ["draft", "submitted", "archived"] as const;
export type WeeklyLogStatus = (typeof WEEKLY_LOG_STATUSES)[number];

export const PERSONAL_RECORD_VISIBILITIES = ["private", "coach"] as const;
export type PersonalRecordVisibility =
  (typeof PERSONAL_RECORD_VISIBILITIES)[number];

export const PERSONAL_RECORD_STATUSES = [
  "draft",
  "submitted",
  "reviewed",
] as const;
export type PersonalRecordStatus = (typeof PERSONAL_RECORD_STATUSES)[number];

export const NOTIFICATION_TYPES = [
  "weekly_log_reminder",
  "feedback_received",
  "promotion_candidate",
  "promotion_approved",
  "promotion_rejected",
  "risk_attention",
  "care_prompt_created",
  "coach_assignment",
  "system_notice",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const CARE_PROMPT_STATUSES = [
  "pending",
  "acknowledged",
  "followed_up",
  "resolved",
  "dismissed",
] as const;
export type CarePromptStatus = (typeof CARE_PROMPT_STATUSES)[number];

export const SYNC_STATUSES = [
  "local_saved",
  "waiting_to_sync",
  "syncing",
  "synced",
  "sync_failed",
  "conflict_detected",
  "resolved",
] as const;
export type SyncStatus = (typeof SYNC_STATUSES)[number];

export const COACH_FEEDBACK_STATUSES = [
  "draft",
  "published",
  "archived",
] as const;
export type CoachFeedbackStatus = (typeof COACH_FEEDBACK_STATUSES)[number];

export const PROMOTION_REQUEST_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "cancelled",
] as const;
export type PromotionRequestStatus =
  (typeof PROMOTION_REQUEST_STATUSES)[number];

export const AUDIT_ACTIONS = [
  "role_changed",
  "profile_updated_by_admin",
  "profile_self_updated",
  "soft_delete_profile",
  "restore_profile",
  "hard_delete_record",
  "coach_assigned",
  "coach_changed",
  "coaching_relationship_ended",
  "growth_level_promoted",
  "promotion_approved",
  "promotion_rejected",
  "weekly_log_soft_deleted",
  "snapshot_recalculated",
  "rls_policy_sensitive_action",
  "user_requested_erasure",
  "profile_anonymized",
  "private_reflections_deleted",
  "feedback_anonymized",
  "lineage_preserved_anonymized",
  "permanent_delete_completed",
  "auth_user_disconnected",
  "account_deletion_requested",
  "account_deletion_completed",
  "invitation_accepted",
  "lineage_parent_changed",
  "lineage_subtree_rebuilt",
  "lineage_rebuild_failed",
  "invitation_created",
  "invitation_revoked",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const USER_ROLE_STATUSES = ["active", "inactive", "revoked"] as const;
export type UserRoleStatus = (typeof USER_ROLE_STATUSES)[number];

export const ORGANIZATION_TYPES = [
  "denomination",
  "mission_body",
  "church_network",
  "local_ministry",
  "nonprofit",
  "other",
] as const;
export type OrganizationType = (typeof ORGANIZATION_TYPES)[number];

export const TRANSLATION_REVIEW_STATUSES = [
  "draft",
  "approved",
  "rejected",
] as const;
export type TranslationReviewStatus =
  (typeof TRANSLATION_REVIEW_STATUSES)[number];

export const RISK_LEVELS = ["low", "medium", "high", "critical"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

type TableDefinition<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
};

type TablesMap = {
  profiles: TableDefinition<
    {
      id: string;
      auth_user_id: string | null;
      full_name: string | null;
      display_name: string | null;
      email: string | null;
      phone: string | null;
      country_id: string | null;
      region_id: string | null;
      organization_id: string | null;
      church_id: string | null;
      ministry_position: string | null;
      group_id: string | null;
      cohort_id: string | null;
      primary_role: UserRole | null;
      growth_level_id: string | null;
      generation_number: number | null;
      parent_coach_id: string | null;
      growth_level_updated_at: string | null;
      promoted_by: string | null;
      status: ProfileStatus;
      preferred_language: string | null;
      timezone: string | null;
      anonymized_at: string | null;
      anonymized_by: string | null;
      erasure_requested_at: string | null;
      created_at: string;
      updated_at: string;
      deleted_at: string | null;
    },
    {
      id?: string;
      auth_user_id?: string | null;
      full_name?: string | null;
      display_name?: string | null;
      email?: string | null;
      phone?: string | null;
      country_id?: string | null;
      region_id?: string | null;
      organization_id?: string | null;
      church_id?: string | null;
      ministry_position?: string | null;
      group_id?: string | null;
      cohort_id?: string | null;
      primary_role?: UserRole | null;
      growth_level_id?: string | null;
      generation_number?: number | null;
      parent_coach_id?: string | null;
      growth_level_updated_at?: string | null;
      promoted_by?: string | null;
      status?: ProfileStatus;
      preferred_language?: string | null;
      timezone?: string | null;
      anonymized_at?: string | null;
      anonymized_by?: string | null;
      erasure_requested_at?: string | null;
      created_at?: string;
      updated_at?: string;
      deleted_at?: string | null;
    },
    {
      id?: string;
      auth_user_id?: string | null;
      full_name?: string | null;
      display_name?: string | null;
      email?: string | null;
      phone?: string | null;
      country_id?: string | null;
      region_id?: string | null;
      organization_id?: string | null;
      church_id?: string | null;
      ministry_position?: string | null;
      group_id?: string | null;
      cohort_id?: string | null;
      primary_role?: UserRole | null;
      growth_level_id?: string | null;
      generation_number?: number | null;
      parent_coach_id?: string | null;
      growth_level_updated_at?: string | null;
      promoted_by?: string | null;
      status?: ProfileStatus;
      preferred_language?: string | null;
      timezone?: string | null;
      anonymized_at?: string | null;
      anonymized_by?: string | null;
      erasure_requested_at?: string | null;
      created_at?: string;
      updated_at?: string;
      deleted_at?: string | null;
    }
  >;
  profile_generation_history: TableDefinition<
    {
      id: string;
      profile_id: string;
      old_generation_number: number | null;
      new_generation_number: number | null;
      changed_by_auth_user_id: string | null;
      changed_by_profile_id: string | null;
      change_source: string;
      reason: string | null;
      created_at: string;
    },
    {
      id?: string;
      profile_id: string;
      old_generation_number?: number | null;
      new_generation_number?: number | null;
      changed_by_auth_user_id?: string | null;
      changed_by_profile_id?: string | null;
      change_source?: string;
      reason?: string | null;
      created_at?: string;
    },
    {
      id?: string;
      profile_id?: string;
      old_generation_number?: number | null;
      new_generation_number?: number | null;
      changed_by_auth_user_id?: string | null;
      changed_by_profile_id?: string | null;
      change_source?: string;
      reason?: string | null;
      created_at?: string;
    }
  >;
  goals: TableDefinition<
    {
      id: string;
      profile_id: string;
      relationship_id: string | null;
      title: string;
      description: string | null;
      category: string | null;
      target_value: number | null;
      current_value: number | null;
      unit: string | null;
      status: GoalStatus;
      priority: GoalPriority;
      start_date: string | null;
      due_date: string | null;
      completed_at: string | null;
      created_at: string;
      updated_at: string;
      deleted_at: string | null;
    },
    {
      id?: string;
      profile_id: string;
      relationship_id?: string | null;
      title: string;
      description?: string | null;
      category?: string | null;
      target_value?: number | null;
      current_value?: number | null;
      unit?: string | null;
      status?: GoalStatus;
      priority?: GoalPriority;
      start_date?: string | null;
      due_date?: string | null;
      completed_at?: string | null;
      created_at?: string;
      updated_at?: string;
      deleted_at?: string | null;
    },
    {
      id?: string;
      profile_id?: string;
      relationship_id?: string | null;
      title?: string;
      description?: string | null;
      category?: string | null;
      target_value?: number | null;
      current_value?: number | null;
      unit?: string | null;
      status?: GoalStatus;
      priority?: GoalPriority;
      start_date?: string | null;
      due_date?: string | null;
      completed_at?: string | null;
      created_at?: string;
      updated_at?: string;
      deleted_at?: string | null;
    }
  >;
  moksilgi_plans: TableDefinition<
    {
      id: string;
      profile_id: string;
      title: string;
      subtitle: string;
      period_start: string | null;
      period_end: string | null;
      written_at: string | null;
      author_name: string | null;
      region_name: string | null;
      team_name: string | null;
      regional_leader_name: string | null;
      coach_name: string | null;
      role_label: string | null;
      generation_label: string | null;
      mission_statement: string | null;
      mission_bible_verse: string | null;
      mission_description: string | null;
      vision_year: number | null;
      vision_statement: string | null;
      vision_metrics: string | null;
      vision_target: string | null;
      vision_description: string | null;
      core_values_json: Json;
      main_goal: string | null;
      main_goal_description: string | null;
      status: MoksilgiStatus;
      created_at: string;
      updated_at: string;
      deleted_at: string | null;
    },
    {
      id?: string;
      profile_id: string;
      title?: string;
      subtitle?: string;
      period_start?: string | null;
      period_end?: string | null;
      written_at?: string | null;
      author_name?: string | null;
      region_name?: string | null;
      team_name?: string | null;
      regional_leader_name?: string | null;
      coach_name?: string | null;
      role_label?: string | null;
      generation_label?: string | null;
      mission_statement?: string | null;
      mission_bible_verse?: string | null;
      mission_description?: string | null;
      vision_year?: number | null;
      vision_statement?: string | null;
      vision_metrics?: string | null;
      vision_target?: string | null;
      vision_description?: string | null;
      core_values_json?: Json;
      main_goal?: string | null;
      main_goal_description?: string | null;
      status?: MoksilgiStatus;
      created_at?: string;
      updated_at?: string;
      deleted_at?: string | null;
    },
    {
      id?: string;
      profile_id?: string;
      title?: string;
      subtitle?: string;
      period_start?: string | null;
      period_end?: string | null;
      written_at?: string | null;
      author_name?: string | null;
      region_name?: string | null;
      team_name?: string | null;
      regional_leader_name?: string | null;
      coach_name?: string | null;
      role_label?: string | null;
      generation_label?: string | null;
      mission_statement?: string | null;
      mission_bible_verse?: string | null;
      mission_description?: string | null;
      vision_year?: number | null;
      vision_statement?: string | null;
      vision_metrics?: string | null;
      vision_target?: string | null;
      vision_description?: string | null;
      core_values_json?: Json;
      main_goal?: string | null;
      main_goal_description?: string | null;
      status?: MoksilgiStatus;
      created_at?: string;
      updated_at?: string;
      deleted_at?: string | null;
    }
  >;
  moksilgi_goal_areas: TableDefinition<
    {
      id: string;
      plan_id: string;
      area_key: MoksilgiAreaKey;
      area_title: string;
      area_subtitle: string | null;
      sort_order: number;
      created_at: string;
      updated_at: string;
      deleted_at: string | null;
    },
    {
      id?: string;
      plan_id: string;
      area_key: MoksilgiAreaKey;
      area_title: string;
      area_subtitle?: string | null;
      sort_order?: number;
      created_at?: string;
      updated_at?: string;
      deleted_at?: string | null;
    },
    {
      id?: string;
      plan_id?: string;
      area_key?: MoksilgiAreaKey;
      area_title?: string;
      area_subtitle?: string | null;
      sort_order?: number;
      created_at?: string;
      updated_at?: string;
      deleted_at?: string | null;
    }
  >;
  moksilgi_detail_goals: TableDefinition<
    {
      id: string;
      plan_id: string;
      area_id: string;
      title: string;
      description: string | null;
      annual_target: number | null;
      monthly_target: number | null;
      unit: string | null;
      measurement_type: MoksilgiMeasurementType;
      strategies_json: Json;
      sort_order: number;
      created_at: string;
      updated_at: string;
      deleted_at: string | null;
    },
    {
      id?: string;
      plan_id: string;
      area_id: string;
      title: string;
      description?: string | null;
      annual_target?: number | null;
      monthly_target?: number | null;
      unit?: string | null;
      measurement_type?: MoksilgiMeasurementType;
      strategies_json?: Json;
      sort_order?: number;
      created_at?: string;
      updated_at?: string;
      deleted_at?: string | null;
    },
    {
      id?: string;
      plan_id?: string;
      area_id?: string;
      title?: string;
      description?: string | null;
      annual_target?: number | null;
      monthly_target?: number | null;
      unit?: string | null;
      measurement_type?: MoksilgiMeasurementType;
      strategies_json?: Json;
      sort_order?: number;
      created_at?: string;
      updated_at?: string;
      deleted_at?: string | null;
    }
  >;
  moksilgi_monthly_records: TableDefinition<
    {
      id: string;
      plan_id: string;
      area_id: string;
      detail_goal_id: string;
      profile_id: string;
      year: number;
      month: number;
      target_value: number | null;
      actual_value: number | null;
      achievement_rate: number;
      daily_checks_json: Json;
      weekly_counts_json: Json;
      comment: string | null;
      created_at: string;
      updated_at: string;
      deleted_at: string | null;
    },
    {
      id?: string;
      plan_id: string;
      area_id: string;
      detail_goal_id: string;
      profile_id: string;
      year: number;
      month: number;
      target_value?: number | null;
      actual_value?: number | null;
      achievement_rate?: number;
      daily_checks_json?: Json;
      weekly_counts_json?: Json;
      comment?: string | null;
      created_at?: string;
      updated_at?: string;
      deleted_at?: string | null;
    },
    {
      id?: string;
      plan_id?: string;
      area_id?: string;
      detail_goal_id?: string;
      profile_id?: string;
      year?: number;
      month?: number;
      target_value?: number | null;
      actual_value?: number | null;
      achievement_rate?: number;
      daily_checks_json?: Json;
      weekly_counts_json?: Json;
      comment?: string | null;
      created_at?: string;
      updated_at?: string;
      deleted_at?: string | null;
    }
  >;
  moksilgi_monthly_summaries: TableDefinition<
    {
      id: string;
      plan_id: string;
      profile_id: string;
      year: number;
      month: number;
      spiritual_rate: number;
      intellectual_rate: number;
      physical_rate: number;
      social_rate: number;
      other_rate: number;
      total_rate: number;
      average_rate: number;
      created_at: string;
      updated_at: string;
      deleted_at: string | null;
    },
    {
      id?: string;
      plan_id: string;
      profile_id: string;
      year: number;
      month: number;
      spiritual_rate?: number;
      intellectual_rate?: number;
      physical_rate?: number;
      social_rate?: number;
      other_rate?: number;
      total_rate?: number;
      average_rate?: number;
      created_at?: string;
      updated_at?: string;
      deleted_at?: string | null;
    },
    {
      id?: string;
      plan_id?: string;
      profile_id?: string;
      year?: number;
      month?: number;
      spiritual_rate?: number;
      intellectual_rate?: number;
      physical_rate?: number;
      social_rate?: number;
      other_rate?: number;
      total_rate?: number;
      average_rate?: number;
      created_at?: string;
      updated_at?: string;
      deleted_at?: string | null;
    }
  >;
  daily_records: TableDefinition<
    {
      id: string;
      profile_id: string;
      relationship_id: string | null;
      record_date: string;
      title: string | null;
      reflection: string | null;
      practice: string | null;
      prayer_request: string | null;
      visibility: PersonalRecordVisibility;
      shared_with_coach: boolean;
      status: PersonalRecordStatus;
      submitted_at: string | null;
      created_at: string;
      updated_at: string;
      deleted_at: string | null;
    },
    {
      id?: string;
      profile_id: string;
      relationship_id?: string | null;
      record_date: string;
      title?: string | null;
      reflection?: string | null;
      practice?: string | null;
      prayer_request?: string | null;
      visibility?: PersonalRecordVisibility;
      shared_with_coach?: boolean;
      status?: PersonalRecordStatus;
      submitted_at?: string | null;
      created_at?: string;
      updated_at?: string;
      deleted_at?: string | null;
    },
    {
      id?: string;
      profile_id?: string;
      relationship_id?: string | null;
      record_date?: string;
      title?: string | null;
      reflection?: string | null;
      practice?: string | null;
      prayer_request?: string | null;
      visibility?: PersonalRecordVisibility;
      shared_with_coach?: boolean;
      status?: PersonalRecordStatus;
      submitted_at?: string | null;
      created_at?: string;
      updated_at?: string;
      deleted_at?: string | null;
    }
  >;
  monthly_reflections: TableDefinition<
    {
      id: string;
      profile_id: string;
      relationship_id: string | null;
      year: number;
      month: number;
      summary: string | null;
      growth_points: string | null;
      difficulty: string | null;
      next_month_plan: string | null;
      visibility: PersonalRecordVisibility;
      shared_with_coach: boolean;
      status: PersonalRecordStatus;
      submitted_at: string | null;
      reviewed_at: string | null;
      created_at: string;
      updated_at: string;
      deleted_at: string | null;
    },
    {
      id?: string;
      profile_id: string;
      relationship_id?: string | null;
      year: number;
      month: number;
      summary?: string | null;
      growth_points?: string | null;
      difficulty?: string | null;
      next_month_plan?: string | null;
      visibility?: PersonalRecordVisibility;
      shared_with_coach?: boolean;
      status?: PersonalRecordStatus;
      submitted_at?: string | null;
      reviewed_at?: string | null;
      created_at?: string;
      updated_at?: string;
      deleted_at?: string | null;
    },
    {
      id?: string;
      profile_id?: string;
      relationship_id?: string | null;
      year?: number;
      month?: number;
      summary?: string | null;
      growth_points?: string | null;
      difficulty?: string | null;
      next_month_plan?: string | null;
      visibility?: PersonalRecordVisibility;
      shared_with_coach?: boolean;
      status?: PersonalRecordStatus;
      submitted_at?: string | null;
      reviewed_at?: string | null;
      created_at?: string;
      updated_at?: string;
      deleted_at?: string | null;
    }
  >;
  weekly_logs: TableDefinition<
    {
      id: string;
      relationship_id: string;
      coachee_profile_id: string;
      week_start: string;
      week_end: string;
      gratitude: string | null;
      prayer_request: string | null;
      progress_summary: string | null;
      difficulty: string | null;
      message_to_coach: string | null;
      status: WeeklyLogStatus;
      version: number;
      submitted_at: string | null;
      created_at: string;
      updated_at: string;
      deleted_at: string | null;
    },
    {
      id?: string;
      relationship_id: string;
      coachee_profile_id: string;
      week_start: string;
      week_end: string;
      gratitude?: string | null;
      prayer_request?: string | null;
      progress_summary?: string | null;
      difficulty?: string | null;
      message_to_coach?: string | null;
      status?: WeeklyLogStatus;
      version?: number;
      submitted_at?: string | null;
      created_at?: string;
      updated_at?: string;
      deleted_at?: string | null;
    },
    {
      id?: string;
      relationship_id?: string;
      coachee_profile_id?: string;
      week_start?: string;
      week_end?: string;
      gratitude?: string | null;
      prayer_request?: string | null;
      progress_summary?: string | null;
      difficulty?: string | null;
      message_to_coach?: string | null;
      status?: WeeklyLogStatus;
      version?: number;
      submitted_at?: string | null;
      created_at?: string;
      updated_at?: string;
      deleted_at?: string | null;
    }
  >;
  weekly_log_items: TableDefinition<
    {
      id: string;
      weekly_log_id: string;
      goal_id: string | null;
      title: string | null;
      note: string | null;
      target_value_at_time: number;
      actual_value: number | null;
      version: number;
      created_at: string;
      updated_at: string;
      deleted_at: string | null;
    },
    {
      id?: string;
      weekly_log_id: string;
      goal_id?: string | null;
      title?: string | null;
      note?: string | null;
      target_value_at_time: number;
      actual_value?: number | null;
      version?: number;
      created_at?: string;
      updated_at?: string;
      deleted_at?: string | null;
    },
    {
      id?: string;
      weekly_log_id?: string;
      goal_id?: string | null;
      title?: string | null;
      note?: string | null;
      target_value_at_time?: number;
      actual_value?: number | null;
      version?: number;
      created_at?: string;
      updated_at?: string;
      deleted_at?: string | null;
    }
  >;
  coaching_relationships: TableDefinition<
    {
      id: string;
      coach_profile_id: string;
      coachee_profile_id: string;
      relationship_type: RelationshipType;
      status: CoachingRelationshipStatus;
      scope_type: ScopeType;
      scope_id: string | null;
      started_at: string;
      ended_at: string | null;
      created_at: string;
      updated_at: string;
      deleted_at: string | null;
    },
    {
      id?: string;
      coach_profile_id: string;
      coachee_profile_id: string;
      relationship_type: RelationshipType;
      status?: CoachingRelationshipStatus;
      scope_type?: ScopeType;
      scope_id?: string | null;
      started_at?: string;
      ended_at?: string | null;
      created_at?: string;
      updated_at?: string;
      deleted_at?: string | null;
    },
    {
      id?: string;
      coach_profile_id?: string;
      coachee_profile_id?: string;
      relationship_type?: RelationshipType;
      status?: CoachingRelationshipStatus;
      scope_type?: ScopeType;
      scope_id?: string | null;
      started_at?: string;
      ended_at?: string | null;
      created_at?: string;
      updated_at?: string;
      deleted_at?: string | null;
    }
  >;
  coaching_generations: TableDefinition<
    {
      id: string;
      profile_id: string;
      parent_profile_id: string | null;
      root_profile_id: string | null;
      generation_number: number;
      created_at: string;
      updated_at: string;
      deleted_at: string | null;
    },
    {
      id?: string;
      profile_id: string;
      parent_profile_id?: string | null;
      root_profile_id?: string | null;
      generation_number: number;
      created_at?: string;
      updated_at?: string;
      deleted_at?: string | null;
    },
    {
      id?: string;
      profile_id?: string;
      parent_profile_id?: string | null;
      root_profile_id?: string | null;
      generation_number?: number;
      created_at?: string;
      updated_at?: string;
      deleted_at?: string | null;
    }
  >;
  coach_feedback: TableDefinition<
    {
      id: string;
      weekly_log_id: string;
      relationship_id: string;
      coach_profile_id: string;
      coachee_profile_id: string;
      feedback_text: string;
      encouragement: string | null;
      next_step: string | null;
      status: CoachFeedbackStatus;
      version: number;
      created_at: string;
      updated_at: string;
      deleted_at: string | null;
    },
    {
      id?: string;
      weekly_log_id: string;
      relationship_id: string;
      coach_profile_id: string;
      coachee_profile_id: string;
      feedback_text: string;
      encouragement?: string | null;
      next_step?: string | null;
      status?: CoachFeedbackStatus;
      version?: number;
      created_at?: string;
      updated_at?: string;
      deleted_at?: string | null;
    },
    {
      id?: string;
      weekly_log_id?: string;
      relationship_id?: string;
      coach_profile_id?: string;
      coachee_profile_id?: string;
      feedback_text?: string;
      encouragement?: string | null;
      next_step?: string | null;
      status?: CoachFeedbackStatus;
      version?: number;
      created_at?: string;
      updated_at?: string;
      deleted_at?: string | null;
    }
  >;
  invitations: TableDefinition<
    {
      id: string;
      invited_email: string;
      invited_role: UserRole;
      scope_type: ScopeType;
      scope_id: string | null;
      invited_by: string | null;
      token_hash: string;
      status: InvitationStatus;
      expires_at: string;
      accepted_at: string | null;
      accepted_by: string | null;
      created_at: string;
      updated_at: string;
      deleted_at: string | null;
    },
    {
      id?: string;
      invited_email: string;
      invited_role: UserRole;
      scope_type: ScopeType;
      scope_id?: string | null;
      invited_by?: string | null;
      token_hash: string;
      status?: InvitationStatus;
      expires_at: string;
      accepted_at?: string | null;
      accepted_by?: string | null;
      created_at?: string;
      updated_at?: string;
      deleted_at?: string | null;
    },
    {
      id?: string;
      invited_email?: string;
      invited_role?: UserRole;
      scope_type?: ScopeType;
      scope_id?: string | null;
      invited_by?: string | null;
      token_hash?: string;
      status?: InvitationStatus;
      expires_at?: string;
      accepted_at?: string | null;
      accepted_by?: string | null;
      created_at?: string;
      updated_at?: string;
      deleted_at?: string | null;
    }
  >;
  user_roles: TableDefinition<
    {
      id: string;
      profile_id: string;
      role: UserRole;
      scope_type: ScopeType;
      scope_id: string | null;
      granted_by: string | null;
      granted_at: string;
      expires_at: string | null;
      status: UserRoleStatus;
      is_active: boolean;
      created_at: string;
      updated_at: string;
      deleted_at: string | null;
    },
    {
      id?: string;
      profile_id: string;
      role: UserRole;
      scope_type: ScopeType;
      scope_id?: string | null;
      granted_by?: string | null;
      granted_at?: string;
      expires_at?: string | null;
      status?: UserRoleStatus;
      is_active?: boolean;
      created_at?: string;
      updated_at?: string;
      deleted_at?: string | null;
    },
    {
      id?: string;
      profile_id?: string;
      role?: UserRole;
      scope_type?: ScopeType;
      scope_id?: string | null;
      granted_by?: string | null;
      granted_at?: string;
      expires_at?: string | null;
      status?: UserRoleStatus;
      is_active?: boolean;
      created_at?: string;
      updated_at?: string;
      deleted_at?: string | null;
    }
  >;
  audit_logs: TableDefinition<
    {
      id: string;
      actor_id: string | null;
      action: AuditAction;
      table_name: string;
      record_id: string | null;
      old_values: Json | null;
      new_values: Json | null;
      reason: string | null;
      request_id: string | null;
      ip_address: string | null;
      user_agent: string | null;
      created_at: string;
    },
    {
      id?: string;
      actor_id?: string | null;
      action: AuditAction;
      table_name: string;
      record_id?: string | null;
      old_values?: Json | null;
      new_values?: Json | null;
      reason?: string | null;
      request_id?: string | null;
      ip_address?: string | null;
      user_agent?: string | null;
      created_at?: string;
    },
    {
      id?: string;
      actor_id?: string | null;
      action?: AuditAction;
      table_name?: string;
      record_id?: string | null;
      old_values?: Json | null;
      new_values?: Json | null;
      reason?: string | null;
      request_id?: string | null;
      ip_address?: string | null;
      user_agent?: string | null;
      created_at?: string;
    }
  >;
  care_prompts: TableDefinition<
    {
      id: string;
      profile_id: string;
      status: CarePromptStatus;
      prompt_text: string | null;
      created_at: string;
      updated_at: string;
      deleted_at: string | null;
    },
    {
      id?: string;
      profile_id: string;
      status?: CarePromptStatus;
      prompt_text?: string | null;
      created_at?: string;
      updated_at?: string;
      deleted_at?: string | null;
    },
    {
      id?: string;
      profile_id?: string;
      status?: CarePromptStatus;
      prompt_text?: string | null;
      created_at?: string;
      updated_at?: string;
      deleted_at?: string | null;
    }
  >;
  notifications: TableDefinition<
    {
      id: string;
      profile_id: string;
      type: NotificationType;
      title: string | null;
      body: string | null;
      read_at: string | null;
      created_at: string;
      updated_at: string;
      deleted_at: string | null;
    },
    {
      id?: string;
      profile_id: string;
      type: NotificationType;
      title?: string | null;
      body?: string | null;
      read_at?: string | null;
      created_at?: string;
      updated_at?: string;
      deleted_at?: string | null;
    },
    {
      id?: string;
      profile_id?: string;
      type?: NotificationType;
      title?: string | null;
      body?: string | null;
      read_at?: string | null;
      created_at?: string;
      updated_at?: string;
      deleted_at?: string | null;
    }
  >;
  sync_events: TableDefinition<
    {
      id: string;
      profile_id: string | null;
      entity_type: string;
      entity_id: string;
      sync_status: SyncStatus;
      payload: Json | null;
      last_error: string | null;
      created_at: string;
      updated_at: string;
    },
    {
      id?: string;
      profile_id?: string | null;
      entity_type: string;
      entity_id: string;
      sync_status: SyncStatus;
      payload?: Json | null;
      last_error?: string | null;
      created_at?: string;
      updated_at?: string;
    },
    {
      id?: string;
      profile_id?: string | null;
      entity_type?: string;
      entity_id?: string;
      sync_status?: SyncStatus;
      payload?: Json | null;
      last_error?: string | null;
      created_at?: string;
      updated_at?: string;
    }
  >;
  level_promotion_requests: TableDefinition<
    {
      id: string;
      profile_id: string;
      requested_by: string | null;
      approved_by: string | null;
      growth_level_id: string | null;
      status: PromotionRequestStatus;
      reason: string | null;
      reviewed_at: string | null;
      created_at: string;
      updated_at: string;
      deleted_at: string | null;
    },
    {
      id?: string;
      profile_id: string;
      requested_by?: string | null;
      approved_by?: string | null;
      growth_level_id?: string | null;
      status?: PromotionRequestStatus;
      reason?: string | null;
      reviewed_at?: string | null;
      created_at?: string;
      updated_at?: string;
      deleted_at?: string | null;
    },
    {
      id?: string;
      profile_id?: string;
      requested_by?: string | null;
      approved_by?: string | null;
      growth_level_id?: string | null;
      status?: PromotionRequestStatus;
      reason?: string | null;
      reviewed_at?: string | null;
      created_at?: string;
      updated_at?: string;
      deleted_at?: string | null;
    }
  >;
  supported_languages: TableDefinition<
    {
      code: string;
      english_name: string;
      native_name: string | null;
      is_active: boolean;
      created_at: string;
      updated_at: string;
    },
    {
      code: string;
      english_name: string;
      native_name?: string | null;
      is_active?: boolean;
      created_at?: string;
      updated_at?: string;
    },
    {
      code?: string;
      english_name?: string;
      native_name?: string | null;
      is_active?: boolean;
      created_at?: string;
      updated_at?: string;
    }
  >;
  translation_namespaces: TableDefinition<
    {
      id: string;
      name: string;
      description: string | null;
      is_active: boolean;
      created_at: string;
      updated_at: string;
    },
    {
      id?: string;
      name: string;
      description?: string | null;
      is_active?: boolean;
      created_at?: string;
      updated_at?: string;
    },
    {
      id?: string;
      name?: string;
      description?: string | null;
      is_active?: boolean;
      created_at?: string;
      updated_at?: string;
    }
  >;
  translation_keys: TableDefinition<
    {
      id: string;
      namespace_id: string;
      key: string;
      description: string | null;
      is_active: boolean;
      created_at: string;
      updated_at: string;
    },
    {
      id?: string;
      namespace_id: string;
      key: string;
      description?: string | null;
      is_active?: boolean;
      created_at?: string;
      updated_at?: string;
    },
    {
      id?: string;
      namespace_id?: string;
      key?: string;
      description?: string | null;
      is_active?: boolean;
      created_at?: string;
      updated_at?: string;
    }
  >;
  translation_values: TableDefinition<
    {
      id: string;
      translation_key_id: string;
      language_code: string;
      value: string;
      review_status: TranslationReviewStatus;
      is_machine_translated: boolean;
      created_at: string;
      updated_at: string;
    },
    {
      id?: string;
      translation_key_id: string;
      language_code: string;
      value: string;
      review_status?: TranslationReviewStatus;
      is_machine_translated?: boolean;
      created_at?: string;
      updated_at?: string;
    },
    {
      id?: string;
      translation_key_id?: string;
      language_code?: string;
      value?: string;
      review_status?: TranslationReviewStatus;
      is_machine_translated?: boolean;
      created_at?: string;
      updated_at?: string;
    }
  >;
  growth_levels: TableDefinition<
    {
      id: string;
      code: string;
      name: string;
      description: string | null;
      created_at: string;
      updated_at: string;
    },
    {
      id?: string;
      code: string;
      name: string;
      description?: string | null;
      created_at?: string;
      updated_at?: string;
    },
    {
      id?: string;
      code?: string;
      name?: string;
      description?: string | null;
      created_at?: string;
      updated_at?: string;
    }
  >;
  countries: TableDefinition<
    {
      id: string;
      name: string;
      code: string;
      is_active: boolean;
      created_at: string;
      updated_at: string;
    },
    {
      id?: string;
      name: string;
      code: string;
      is_active?: boolean;
      created_at?: string;
      updated_at?: string;
    },
    {
      id?: string;
      name?: string;
      code?: string;
      is_active?: boolean;
      created_at?: string;
      updated_at?: string;
    }
  >;
  regions: TableDefinition<
    {
      id: string;
      country_id: string | null;
      name: string;
      created_at: string;
      updated_at: string;
    },
    {
      id?: string;
      country_id?: string | null;
      name: string;
      created_at?: string;
      updated_at?: string;
    },
    {
      id?: string;
      country_id?: string | null;
      name?: string;
      created_at?: string;
      updated_at?: string;
    }
  >;
  generation_options: TableDefinition<
    {
      id: string;
      generation_number: number;
      label: string;
      scope_type: string;
      scope_id: string | null;
      is_active: boolean;
      sort_order: number;
      created_at: string;
      updated_at: string;
      deleted_at: string | null;
    },
    {
      id?: string;
      generation_number: number;
      label: string;
      scope_type?: string;
      scope_id?: string | null;
      is_active?: boolean;
      sort_order?: number;
      created_at?: string;
      updated_at?: string;
      deleted_at?: string | null;
    },
    {
      id?: string;
      generation_number?: number;
      label?: string;
      scope_type?: string;
      scope_id?: string | null;
      is_active?: boolean;
      sort_order?: number;
      created_at?: string;
      updated_at?: string;
      deleted_at?: string | null;
    }
  >;
  organizations: TableDefinition<
    {
      id: string;
      country_id: string;
      organization_type: OrganizationType;
      name: string;
      default_timezone: string | null;
      is_active: boolean;
      created_at: string;
      updated_at: string;
      deleted_at: string | null;
    },
    {
      id?: string;
      country_id: string;
      organization_type: OrganizationType;
      name: string;
      default_timezone?: string | null;
      is_active?: boolean;
      created_at?: string;
      updated_at?: string;
      deleted_at?: string | null;
    },
    {
      id?: string;
      country_id?: string;
      organization_type?: OrganizationType;
      name?: string;
      default_timezone?: string | null;
      is_active?: boolean;
      created_at?: string;
      updated_at?: string;
      deleted_at?: string | null;
    }
  >;
  churches: TableDefinition<
    {
      id: string;
      organization_id: string | null;
      name: string;
      created_at: string;
      updated_at: string;
    },
    {
      id?: string;
      organization_id?: string | null;
      name: string;
      created_at?: string;
      updated_at?: string;
    },
    {
      id?: string;
      organization_id?: string | null;
      name?: string;
      created_at?: string;
      updated_at?: string;
    }
  >;
  groups: TableDefinition<
    {
      id: string;
      church_id: string | null;
      name: string;
      created_at: string;
      updated_at: string;
    },
    {
      id?: string;
      church_id?: string | null;
      name: string;
      created_at?: string;
      updated_at?: string;
    },
    {
      id?: string;
      church_id?: string | null;
      name?: string;
      created_at?: string;
      updated_at?: string;
    }
  >;
  cohorts: TableDefinition<
    {
      id: string;
      group_id: string | null;
      name: string;
      created_at: string;
      updated_at: string;
    },
    {
      id?: string;
      group_id?: string | null;
      name: string;
      created_at?: string;
      updated_at?: string;
    },
    {
      id?: string;
      group_id?: string | null;
      name?: string;
      created_at?: string;
      updated_at?: string;
    }
  >;
};

type PublicEnums = {
  profile_status_enum: ProfileStatus;
  goal_status_enum: GoalStatus;
  coaching_relationship_status_enum: CoachingRelationshipStatus;
  relationship_type_enum: RelationshipType;
  system_role_enum: UserRole;
  scope_type_enum: ScopeType;
  invitation_status_enum: InvitationStatus;
  weekly_log_status_enum: WeeklyLogStatus;
  notification_type_enum: NotificationType;
  care_prompt_status_enum: CarePromptStatus;
  sync_status_enum: SyncStatus;
  coach_feedback_status_enum: CoachFeedbackStatus;
  promotion_request_status_enum: PromotionRequestStatus;
  audit_action_enum: AuditAction;
  user_role_status_enum: UserRoleStatus;
  organization_type_enum: OrganizationType;
  translation_review_status_enum: TranslationReviewStatus;
  risk_level_enum: RiskLevel;
};

export type Database = {
  public: {
    Tables: TablesMap;
    Views: Record<string, never>;
    Functions: {
      accept_invitation: {
        Args: {
          p_token: string;
          p_auth_user_id: string;
          p_email: string;
          p_full_name?: string | null;
          p_display_name?: string | null;
        };
        Returns: Json;
      };
    };
    Enums: PublicEnums;
  };
};

type PublicTables = Database["public"]["Tables"];
type PublicEnumsMap = Database["public"]["Enums"];

export type Tables<T extends keyof PublicTables> = PublicTables[T]["Row"];
export type InsertDto<T extends keyof PublicTables> = PublicTables[T]["Insert"];
export type UpdateDto<T extends keyof PublicTables> = PublicTables[T]["Update"];
export type Enums<T extends keyof PublicEnumsMap> = PublicEnumsMap[T];

export type ProfileRow = Tables<"profiles">;
export type ProfileGenerationHistoryRow =
  Tables<"profile_generation_history">;
export type UserRoleRow = Tables<"user_roles">;
export type InvitationRow = Tables<"invitations">;
export type WeeklyLogRow = Tables<"weekly_logs">;
export type DailyRecordRow = Tables<"daily_records">;
export type MonthlyReflectionRow = Tables<"monthly_reflections">;
export type AuditLogRow = Tables<"audit_logs">;
export type SupportedLanguageRow = Tables<"supported_languages">;
export type TranslationNamespaceRow = Tables<"translation_namespaces">;
export type TranslationKeyRow = Tables<"translation_keys">;
export type TranslationValueRow = Tables<"translation_values">;
export type GrowthLevelRow = Tables<"growth_levels">;
export type CountryRow = Tables<"countries">;
export type RegionRow = Tables<"regions">;
export type OrganizationRow = Tables<"organizations">;
export type ChurchRow = Tables<"churches">;
export type GroupRow = Tables<"groups">;
export type CohortRow = Tables<"cohorts">;

export type ProfileInsert = InsertDto<"profiles">;
export type ProfileUpdate = UpdateDto<"profiles">;
export type UserRoleInsert = InsertDto<"user_roles">;
export type AuditLogInsert = InsertDto<"audit_logs">;
export type InvitationInsert = InsertDto<"invitations">;
export type WeeklyLogInsert = InsertDto<"weekly_logs">;
export type WeeklyLogUpdate = UpdateDto<"weekly_logs">;
export type DailyRecordInsert = InsertDto<"daily_records">;
export type DailyRecordUpdate = UpdateDto<"daily_records">;
export type MonthlyReflectionInsert = InsertDto<"monthly_reflections">;
export type MonthlyReflectionUpdate = UpdateDto<"monthly_reflections">;
export type TranslationValueInsert = InsertDto<"translation_values">;
export type TranslationValueUpdate = UpdateDto<"translation_values">;
