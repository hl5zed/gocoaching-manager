# GOThriveCoaching – Global Coaching Operations Platform

[한국어 설명]

이 플랫폼은 단순한 목표관리 앱이 아닙니다. :contentReference[oaicite:0]{index=0}  

전세계 선교사, 목회자, 코치, 피코치, 그룹 리더, 관리자가 함께 사용하는  
**“52주 성장 추적 기반 코칭 운영 플랫폼”**입니다.

핵심 구조:

Mission → Vision → Core Values → Goals → Weekly Execution → Reflection → Coaching → Multiplication

---

==================================================

1. PRODUCT CONCEPT

==================================================

GOThriveCoaching is a global coaching platform that tracks 52 weeks of growth and enables:

- individual growth tracking
- coach–coachee relationships
- multi-generation coaching structure
- group and organization analytics
- disciple multiplication

---

==================================================
2. KEY BUSINESS REQUIREMENTS
==================================================

A. INDIVIDUAL COACHING

- mission / vision / core values
- annual goals (4 categories)
- execution strategy

B. WEEKLY TRACKING

- 52 weeks input
- achievement rate calculation
- reflection (memo, blocker, adjustment)
- coaching request

C. COACHING FLOW
입력 → 성찰 → 질문 → 피드백 → 행동 변화

D. GROUP MONITORING

- 월별 성취 테이블 (1~12월)
- 누적 성취
- 평균 성취
- 전체 성취 (UP TO CURRENT)

E. ORGANIZATION ANALYTICS

- 역할별 / 세대별 / 그룹별 분석

F. GLOBAL COACHING STRUCTURE

This platform must support a global coaching hierarchy.

Hierarchy:

Global
→ Country
→ Region
→ Organization / Denomination / Mission Body
→ Church / Local Group / Ministry Team
→ Cohort / Generation
→ Coach Maker
→ Coach
→ Coachee
→ Weekly Growth Logs

Purpose:

- Manage coaching across multiple countries
- Track coaching by organization, church, group, and generation
- Visualize how one coach raises another coach
- Show disciple multiplication across generations
- Help leaders identify active, weak, and growing coaching networks

---

# ==================================================
2.5 GROWTH LEVEL SYSTEM (CRITICAL)

This platform must include a Growth Level System.

Level Structure:

- Level 1: Self Leadership (자기관리)
- Level 2: Coached (코칭 참여)
- Level 3: Coach (코치)
- Level 4: Coach Maker (코치 양성)

Purpose:

- 개인 성장 → 리더 성장 → 코치 양성
- 제자 재생산 구조 시스템화

Promotion Logic:

Level 1 → Level 2:

- 4주 이상 입력
- 평균 성취율 50%
- 자동 승급

Level 2 → Level 3:

- 12주 입력
- 평균 65%
- 피드백 4회
- 관리자 승인

Level 3 → Level 4:

- 24주 입력
- 평균 70%
- 피코치 2명 이상
- 피드백 제공 8회
- 관리자 승인

UI Requirements:

- 사용자 프로필에 Level 표시
- 다음 단계 진행률 표시
- 코치 화면에 승급 후보 표시
- 관리자 승인 큐
- 레벨 분포 분석

IMPORTANT:
This is NOT gamification.
This is a disciple multiplication system.

# ==================================================
2.6 COACHING GENERATION SYSTEM

This platform must track coaching generations.

Generation Concept:

- Generation 0: Founder / Initial Leader
- Generation 1: First-level coaches trained by the founder
- Generation 2: Coaches trained by Generation 1
- Generation 3: Coaches trained by Generation 2
- Generation 4+: Ongoing multiplication

Example:

Founder
→ Gen 1 Coach
→ Gen 2 Coach
→ Gen 3 Coach
→ Coachees and future coaches

Purpose:

- Show coaching multiplication visually
- Track who raised whom
- Identify strong multiplication lines
- Identify coaching lines that need support
- Help leaders see spiritual reproduction, not only attendance or achievement

Required Features:

- Coaching tree view
- Generation number for each user
- Coach lineage tracking
- Multiplication rate calculation
- Generation-based analytics

Important:

This is not a ranking system.
This is a disciple multiplication tracking system.

---

==================================================
3. USER ROLES
==================================================

System Roles:

- super_admin
- country_admin
- organization_admin
- church_admin
- group_leader
- coach_maker
- coach
- coachee

Growth Level Roles:

Level 1: Self Leader / 자기관리자
Level 2: Coached Person / 코칭 참여자
Level 3: Coach / 코치
Level 4: Coach Maker / 코치 양성자

Important Distinction:

System Role = what the user can manage in the platform.
Growth Level = where the user is in the coaching growth journey.

Example:

A user can be:

- church_admin as a system role
- Level 2 as a growth level

Another user can be:

- coach as a system role
- Level 3 as a growth level

---

==================================================
4. TECHNOLOGY STACK
==================================================

- Next.js (App Router)
- TypeScript
- Tailwind
- shadcn/ui
- Supabase
- TanStack Table
- Recharts
- PWA support
- Service Worker
- IndexedDB for offline draft storage

---

==================================================
5. DATABASE SCHEMA - REVISED
==================================================

IMPORTANT:
Because this project uses Supabase, do not create a custom users table that conflicts with auth.users.

Use:

- auth.users
  Purpose: authentication and login

- public.profiles
  Purpose: application user profile, role, organization, coaching identity

Core Tables:

Global Structure Tables:

- countries
- regions
- organizations
- churches
- groups
- cohorts

Global Structure Fields:

countries Fields:

- id
- name
- code
- default_language
- default_timezone
- is_active
- created_at
- updated_at
- deleted_at

regions Fields:

- id
- country_id
- name
- code
- default_language
- default_timezone
- is_active
- created_at
- updated_at
- deleted_at

organizations Fields:

- id
- country_id
- region_id
- name
- organization_type
- default_language
- default_timezone
- is_active
- created_at
- updated_at
- deleted_at

churches Fields:

- id
- organization_id
- country_id
- region_id
- name
- default_language
- default_timezone
- is_active
- created_at
- updated_at
- deleted_at

groups Fields:

- id
- church_id
- organization_id
- name
- group_type
- default_language
- default_timezone
- is_active
- created_at
- updated_at
- deleted_at

cohorts Fields:

- id
- group_id
- church_id
- organization_id
- name
- cohort_year
- cohort_label
- default_language
- default_timezone
- is_active
- created_at
- updated_at
- deleted_at

Global Structure Rules:

1. Each global structure table may have default_language and default_timezone.
2. If a lower-level structure does not define default_language, inherit from the parent structure.
3. If a lower-level structure does not define default_timezone, inherit from the parent structure.
4. Recommended fallback order:

user preferred language
→ cohort default language
→ group default language
→ church default language
→ organization default language
→ country default language
→ English
→ Korean

5. Recommended timezone fallback order:

user timezone
→ cohort default timezone
→ group default timezone
→ church default timezone
→ organization default timezone
→ country default timezone
→ UTC

6. All timestamps should be stored in UTC.
7. UI should display dates and times based on the user's timezone.
8. Weekly calculations should use the user's timezone by default.
9. Organization dashboards may use the organization's default_timezone.

User and Coaching Tables:

- profiles
- coaching_profiles
- coaching_relationships
- invitations
- coaching_generations
- user_roles
- user_status_logs


Role Design Rule:

A user can have multiple system roles.

Examples:
- A church_admin can also be a coach.
- A coach_maker can also manage a cohort.
- A country_admin can also serve as a coach.

Therefore, use user_roles table for flexible role assignment.

profiles.primary_role may be used only for default dashboard routing.

Goal and Tracking Tables:

- goal_categories
- goal_units
- goals
- goal_templates
- goal_template_items
- goal_category_question_sets
- coaching_questions
- weekly_logs
- weekly_log_items
- weekly_reflection_answers
- monthly_summaries
- stats_snapshots
- coach_feedback

Level System Tables:

- growth_levels
- level_requirements
- level_progress_reviews
- level_promotion_requests

Notification and System Tables:

- notifications
- audit_logs
- app_settings
- translated_contents
- sync_events
- care_prompts

Language and Localization Tables:

- supported_languages
- language_translations
- user_language_preferences

supported_languages Fields:

- id
- code
- name
- native_name
- is_default
- is_active
- sort_order
- created_at
- updated_at

Examples:

- ko / Korean / 한국어
- en / English / English
- th / Thai / ไทย
- ja / Japanese / 日本語
- zh / Chinese / 中文
- es / Spanish / Español

language_translations Fields:

- id
- language_code
- translation_key
- translated_text
- namespace
- description
- created_at
- updated_at

Examples:

translation_key = dashboard.title
ko = 대시보드
en = Dashboard
th = แดชบอร์ด

translation_key = weekly_input.submit_button
ko = 이번 주 기록 저장
en = Save Weekly Log
th = บันทึกประจำสัปดาห์

user_language_preferences Fields:

- id
- user_id
- preferred_language
- fallback_language
- auto_translate_feedback
- created_at
- updated_at

Feedback Quality Tables:

- coach_feedback_quality_reviews

profiles Fields:

- id
- auth_user_id
- full_name
- display_name
- email
- phone
- country_id
- region_id
- organization_id
- church_id
- group_id
- cohort_id
- primary_role
- growth_level_id
- generation_number
- parent_coach_id
- growth_level_updated_at
- promoted_by
- status
- preferred_language
- timezone
- created_at
- updated_at
- anonymized_at
- anonymized_by
- erasure_requested_at
- deleted_at

Database Rule:

profiles.id is the stable application profile id.

profiles.auth_user_id may reference auth.users.id.

Recommended relationship:

profiles.auth_user_id → auth.users.id

Important:
auth_user_id must be nullable.

Reason:
When a user requests account deletion or anonymization, the system may disconnect the profile from auth.users while preserving non-identifiable coaching history, 52-week statistics, and coaching generation lineage.

Do not use auth.users.id directly as the permanent lineage identity.

Use profiles.id as the stable internal identity for:

- weekly_logs.user_id
- goals.user_id
- coaching_relationships.coach_id
- coaching_relationships.coachee_id
- coaching_generations.user_id
- coaching_generations.coach_id
- coaching_generations.parent_id
- coaching_generations.root_leader_id
- coach_feedback.coach_id
- coach_feedback.coachee_id
- user_roles.user_id

Account Deletion / Auth Disconnect Flow:

Purpose:
Allow users to delete their login account while preserving anonymized coaching history, 52-week statistics, and lineage analytics.

Rules:

1. When a user requests account deletion, do not delete the profiles record.

2. First anonymize personally identifiable information:
   - full_name
   - display_name
   - email
   - phone
   - personal notes
   - private reflections when required

3. Set profile fields:
   - profiles.auth_user_id = null
   - profiles.status = anonymized
   - profiles.anonymized_at = current timestamp
   - profiles.deleted_at = current timestamp if the profile should be hidden from normal views

4. Then delete or disable the related auth.users account.

5. Keep profiles.id as the internal reference for:
   - weekly statistics
   - coaching relationship history
   - coaching generation lineage
   - feedback history after anonymization
   - organization-level aggregated analytics

6. An anonymized profile must not be able to log in again unless a super_admin explicitly restores or reconnects the profile.

7. Every account deletion or auth disconnect action must create an audit log.

Required Audit Actions:

- auth_user_disconnected
- profile_anonymized
- account_deletion_requested
- account_deletion_completed

Important:
Never use auth.users.id as the permanent identity for coaching lineage.
Use profiles.id as the stable internal identity.

invitations Fields:

- id
- email
- invited_role
- scope_type
- scope_id
- invited_by
- token
- expires_at
- accepted_at
- status
- created_at
- updated_at
- deleted_at

Invitation Rules:

1. Admins can invite users only within their allowed scope.
2. Invitation token must expire.
3. A user can accept invitation only once.
4. Accepted invitation should create or connect a profile.
5. Invitation acceptance should create user_roles record.
6. All invitation actions should create audit logs.

user_roles Fields:

- id
- user_id
- role
- scope_type
- scope_id
- assigned_by
- assigned_at
- status
- created_at
- updated_at
- deleted_at

Role Scope Examples:

- role = country_admin, scope_type = country, scope_id = country_id
- role = organization_admin, scope_type = organization, scope_id = organization_id
- role = church_admin, scope_type = church, scope_id = church_id
- role = group_leader, scope_type = group, scope_id = group_id
- role = coach, scope_type = relationship, scope_id = coaching_relationship_id

user_status_logs Fields:

- id
- user_id
- previous_status
- new_status
- reason
- changed_by
- changed_at
- created_at

User Status Log Rules:

1. Every important profile status change should create a user_status_logs record.
2. user_status_logs should not be soft-deleted.
3. Status history should remain available for audit and pastoral care context.
4. Examples:
   - active → inactive
   - active → suspended
   - inactive → active

coaching_profiles Fields:

- id
- user_id
- mission
- vision
- core_values
- annual_focus
- personal_notes
- coach_visible_notes
- created_at
- updated_at
- deleted_at

goals Fields:

- id
- user_id
- category_id
- unit_id
- title
- description
- target_value
- target_period
- frequency
- weight
- start_date
- end_date
- status
- is_active
- sort_order
- created_at
- updated_at
- deleted_at

goal_targets Fields:

- id
- goal_id
- target_value
- effective_from
- effective_to
- changed_by
- change_reason
- created_at
- updated_at
- deleted_at

Goal Target History Rules:

1. goal_targets stores historical target value changes.
2. Each target value should have an effective date range.
3. Weekly input should use the target value active during the selected week.
4. If goal_targets is not implemented in MVP, weekly_log_items.target_value_at_time must still preserve the target snapshot.

Goal Target Change Rules:

Purpose:
Allow users to adjust current and future goals without corrupting past achievement statistics.

Rules:

1. goals.target_value represents the current target value.
2. Changing goals.target_value affects only new weekly_log_items created after the change.
3. Existing weekly_log_items must keep their original target_value_at_time.
4. Past achievement_rate values must not be recalculated simply because goals.target_value changed.
5. If historical recalculation is needed, it must be an explicit admin action and must create an audit log.
6. The UI should show a notice when changing target_value:

"Changing this goal target will affect future weekly records only. Past records will keep the target value used at that time."

7. goal_targets may be used for advanced target history tracking.
   However, weekly_log_items.target_value_at_time remains the source of truth for historical achievement calculation.

goal_categories Fields:

- id
- code
- name_ko
- name_en
- name_th
- description
- sort_order
- is_active
- created_at
- updated_at
- deleted_at

goal_templates Fields:

- id
- template_type
- name
- description
- language_code
- organization_id
- is_global
- is_active
- created_at
- updated_at
- deleted_at

goal_template_items Fields:

- id
- template_id
- category_id
- unit_id
- title
- description
- default_target_value
- default_frequency
- default_weight
- sort_order
- is_active
- created_at
- updated_at
- deleted_at

goal_units Fields:

- id
- code
- name_ko
- name_en
- name_th
- created_at
- updated_at
- deleted_at

goal_category_question_sets Fields:

- id
- goal_category_id
- name
- description
- language_code
- is_default
- is_active
- created_at
- updated_at
- deleted_at

coaching_questions Fields:

- id
- question_set_id
- goal_category_id
- question_type
- question_text
- question_intent
- display_order
- is_ai_assist_enabled
- is_required
- is_active
- created_at
- updated_at
- deleted_at

Dynamic Questioning Rules:

Purpose:
Provide different reflection and coaching questions depending on the user's goal category.

Examples:

- Spiritual goals should use questions about prayer, Scripture, obedience, grace, calling, and spiritual formation.
- Health goals should use questions about rhythm, rest, exercise, energy, and sustainability.
- Ministry goals should use questions about people, relationships, fruitfulness, obstacles, and next steps.
- Learning goals should use questions about progress, consistency, understanding, and practice.

Rules:

1. Each goal_category may have one or more question sets.
2. Each question set may contain multiple coaching questions.
3. Questions should be selected based on goal_category_id.
4. The system should show category-specific reflection questions during weekly input.
5. Coaches may also see suggested category-specific coaching questions.
6. AI may suggest additional questions, but default question sets should work without AI.
7. Questions must be warm, reflective, and non-shaming.
8. Questions should support multilingual display through language_code or translation keys.
9. Admins may create or edit question sets for organizations or ministry contexts.
10. User answers remain part of weekly reflection data and must follow privacy rules.

Question Types:

- weekly_reflection
- coach_feedback_prompt
- blocker_discovery
- care_prompt
- next_step_planning
- encouragement_prompt
- ai_suggested

Question Intent Examples:

- reflection
- encouragement
- diagnosis
- action_step
- spiritual_discernment
- sustainability
- relationship_care

weekly_logs Fields:

- id
- user_id
- year
- week_number
- week_start_date
- week_end_date
- reflection_private
- reflection_coach_visible
- blocker
- adjustment_plan
- coaching_request
- submitted_at
- status
- created_at
- version
- updated_at
- deleted_at

Version Rule:

- version default value should be 1.
- version must increment by 1 on every successful update.
- version must not be manually edited by normal users.

Weekly Log Rules:

1. One user can have only one weekly_log per year and week_number.
2. If the user edits weekly input, update the existing weekly_log instead of creating a new one.
3. Use unique constraint:

unique(user_id, year, week_number)

Optimistic Concurrency Control Rules:

Purpose:
Prevent accidental overwrites when the same weekly log is edited from multiple devices or repeated network requests.

Rules:

1. weekly_logs must include a version field.
2. weekly_log_items should also include a version field.
3. When a weekly_log is created, version should start at 1.
4. When a weekly_log is updated, the system must check the current version.
5. Update should succeed only if the submitted version matches the current database version.
6. On successful update, increment version by 1.
7. If the version does not match, reject the update and return a conflict response.

Conflict Resolution Screen Rule:

When a version conflict occurs, the system must show a Conflict Resolution Screen instead of simply failing the save.

Purpose:
Help users safely resolve differences between local offline data and newer server data.

Display:

- local draft version
- server saved version
- last local updated time
- last server updated time
- highlighted differences
- simple explanation of why the conflict happened

Side-by-side Layout:

Left side:
My Local Draft

Right side:
Server Version

User Choices:

1. Keep server version
   - discard local draft
   - keep the latest server data

2. Overwrite with my local draft
   - replace server data with local data
   - require confirmation

3. Manually merge
   - allow user to combine fields from both versions
   - save the merged version as the new record

Fields to Compare:

- actual_value
- target_value_at_time
- memo
- reflection_private
- reflection_coach_visible
- blocker
- adjustment_plan
- coaching_request
- weekly_reflection_answers

Important:
Do not show technical language such as "version mismatch" to normal users.
Use simple language such as:
"This weekly record was updated on another device. Please review both versions before saving."

Conflict Logging Rule:

Every sync conflict should create or update a sync_events record with:

- conflict_type
- local_version
- server_version
- resolution_action
- resolved_at

Purpose:
Keep a lightweight record of sync conflicts for support, debugging, and reliability monitoring.

Rules:

1. When a version conflict is detected, create or update a sync_events record.
2. Do not store full private reflection text in sync_events.
3. Store only metadata needed to understand the conflict.
4. When the user chooses a resolution, update resolution_action.
5. When the conflict is resolved, set resolved_at.
6. sync_events must not become the source of truth.
7. weekly_logs and weekly_log_items remain the source of truth.

8. The UI should show a clear message such as:
   "This weekly log was updated on another device. Please review both versions before saving."

9. The system must not silently overwrite newer data.

10. Repeated network requests should be handled safely through unique constraints and idempotent update logic.

Alternative:
If version is not used, updated_at may be used for conditional updates.
However, version-based optimistic locking is recommended for clarity.

Example:

Current database version = 3
User submitted version = 3
→ update succeeds
→ version becomes 4

Current database version = 4
User submitted version = 3
→ update is rejected
→ user must reload latest data

weekly_log_items Fields:

- id
- weekly_log_id
- goal_id
- target_value
- target_value_at_time
- actual_value
- achievement_rate
- weighted_score
- memo
- created_at
- version
- updated_at
- deleted_at

Target Value Snapshot Rules:

Purpose:
Preserve historical accuracy when a goal target changes over time.

Problem:
If goals.target_value changes in week 20, the system must not recalculate weeks 1-19 using the new target value.

Core Rule:
weekly_log_items must store the target value that was active at the time of weekly input.

Rules:

1. goals.target_value stores the current target setting.
2. weekly_log_items.target_value_at_time stores the target value used for that specific weekly record.
3. When a weekly_log_item is created, copy the current goals.target_value into target_value_at_time.
4. Achievement calculation must use target_value_at_time, not the current goals.target_value.
5. Past weekly_log_items must not be recalculated automatically when goals.target_value changes.
6. If a user intentionally edits an old weekly record, the UI must show which target value is being used.
7. Admin recalculation should preserve the original target_value_at_time unless explicitly requested.
8. The system may keep weekly_log_items.target_value for backward compatibility, but target_value_at_time is the source of truth for calculations.
9. If both target_value and target_value_at_time exist in weekly_log_items, target_value_at_time must always be used for calculation.
10. In MVP, developers may choose to remove weekly_log_items.target_value and keep only target_value_at_time to avoid confusion.

Example:

Week 1-19:
goals.target_value = 10
weekly_log_items.target_value_at_time = 10

Week 20:
User changes goals.target_value to 15
New weekly_log_items.target_value_at_time = 15

Result:
Weeks 1-19 remain calculated with 10.
Week 20 and later are calculated with 15.

weekly_reflection_answers Fields:

- id
- weekly_log_id
- goal_id
- goal_category_id
- question_id
- answer_text
- visibility
- created_at
- updated_at
- deleted_at

Reflection Answer Rules:

1. weekly_reflection_answers stores answers to category-specific reflection questions.
2. Answers may be private or coach-visible depending on visibility.
3. Private answers must not be shown in group dashboards or admin summary views.
4. Coach-visible answers may be shown only to assigned coaches.
5. Reflection answers should follow the same privacy rules as reflection_private and reflection_coach_visible.
6. The system should allow short answers to keep weekly input under 3 minutes.

monthly_summaries Fields:

- id
- user_id
- year
- month
- total_goals
- completed_goals
- average_achievement_rate
- average_risk_score
- submitted_weeks_count
- missed_weeks_count
- coach_feedback_count
- reflection_count
- calculated_at
- created_at
- updated_at
- deleted_at

Monthly Summary Rules:

1. monthly_summaries stores user-level monthly summary data.
2. Raw weekly_logs and weekly_log_items remain the source of truth.
3. monthly_summaries should be recalculated when weekly data changes.
4. Dashboards may read monthly_summaries for faster user-level monthly reports.
5. Use unique constraint:

unique(user_id, year, month)

stats_snapshots Fields:

- id
- scope_type
- scope_id
- period_type
- year
- month
- week_number
- total_users
- active_users
- inactive_users
- total_coaches
- total_coachees
- active_coaching_relationships
- average_achievement_rate
- average_risk_score
- high_risk_user_count
- total_feedback_count
- reviewed_feedback_count
- average_feedback_quality_score
- feedback_with_question_rate
- feedback_with_action_step_rate
- feedback_with_specific_observation_rate
- coaches_needing_feedback_training_count
- growth_level_1_count
- growth_level_2_count
- growth_level_3_count
- growth_level_4_count
- generation_0_count
- generation_1_count
- generation_2_count
- generation_3_count
- generation_4_plus_count
- multiplication_rate
- active_coaching_rate
- generation_depth
- calculated_at
- created_at
- updated_at
- deleted_at

Generation Snapshot Rule:

generation_depth in stats_snapshots should be calculated from maximum lineage_depth within the selected scope.

Examples:

- global generation_depth = max lineage_depth across all active lineages
- organization generation_depth = max lineage_depth within that organization
- church generation_depth = max lineage_depth within that church
- group generation_depth = max lineage_depth within that group
- coach generation_depth = max lineage_depth under that coach's coaching tree

Snapshot Scope Types:

- global
- country
- region
- organization
- church
- group
- cohort
- coach

Snapshot Scope ID Rule:

1. If scope_type = global, scope_id may be null.
2. If scope_type is not global, scope_id must reference the corresponding table id.
3. Examples:

- scope_type = global, scope_id = null
- scope_type = country, scope_id = country_id
- scope_type = organization, scope_id = organization_id
- scope_type = church, scope_id = church_id
- scope_type = group, scope_id = group_id
- scope_type = cohort, scope_id = cohort_id
- scope_type = coach, scope_id = coach_user_id

Snapshot Period Types:

- weekly
- monthly
- quarterly
- yearly

Snapshot Rules:

1. Raw data remains the source of truth.
2. stats_snapshots stores pre-calculated dashboard statistics.
3. Dashboards should read from stats_snapshots whenever possible.
4. Heavy aggregation should not run on every dashboard page load.
5. Snapshot records should be recalculated by scheduled batch jobs.
6. If snapshot data is missing, the system may calculate live data as fallback.
7. Live fallback calculation should be limited to small scopes only.
8. Global, country, and organization dashboards should prefer snapshot data.

Recommended Snapshot Design:

Use one flexible stats_snapshots table with scope_type and scope_id.

Do not create separate snapshot tables for each scope during MVP.

Important:
Snapshot records store calculated summary data.
They should not replace raw data such as weekly_logs, coaching_relationships, coaching_generations, or coach_feedback.
Raw data remains the source of truth.
Snapshots are used only for fast dashboards, analytics, and reports.

coach_feedback Fields:

- id
- weekly_log_id
- coach_id
- coachee_id
- feedback_text
- encouragement
- question
- action_step
- visibility
- status
- read_at
- response_text
- responded_at
- created_at
- updated_at
- deleted_at

coach_feedback_quality_reviews Fields:

- id
- feedback_id
- coach_id
- reviewer_id
- reviewer_role
- rating
- encouragement_score
- question_quality_score
- actionability_score
- specificity_score
- care_language_score
- theological_sensitivity_score
- follow_up_score
- has_encouragement
- has_question
- has_action_step
- has_specific_observation
- review_comment
- training_recommendation
- reviewed_at
- created_at
- updated_at
- deleted_at

Feedback Quality Review Rules:

Purpose:
Help Coach Makers supervise and develop coaches by reviewing the quality of coaching feedback.

Core Principle:
Feedback quality review is not for ranking or shaming coaches.
It exists to help coaches grow in encouragement, question asking, care language, and action-oriented coaching.

Review Criteria:

1. Encouragement Quality
   - Does the feedback include sincere encouragement?
   - Is the encouragement specific rather than generic?

2. Question Quality
   - Does the feedback include a meaningful coaching question?
   - Does the question help the coachee reflect more deeply?

3. Action Step Quality
   - Does the feedback suggest a clear and realistic next step?
   - Is the action step small enough to practice within the next week?

4. Specificity
   - Does the coach refer to the actual weekly log or reflection?
   - Or is the feedback too generic, such as "Good job" only?

5. Care Language
   - Is the tone warm, respectful, and non-shaming?
   - Does the feedback protect dignity?

6. Theological Sensitivity
   - For pastoral or spiritual coaching, does the feedback reflect biblical care, grace, and wisdom?
   - Does it avoid legalistic or guilt-based language?

7. Follow-up Quality
   - Does the feedback help continue the coaching conversation?
   - Does it invite further reflection or response?

Score Guide:

- 1 = needs training
- 2 = basic
- 3 = good
- 4 = strong
- 5 = excellent

Required Quality Signals:

- has_encouragement
- has_question
- has_action_step
- has_specific_observation

Coach Maker Supervision Rules:

1. Coach Makers can review feedback from coaches assigned to them.
2. Organization admins may view aggregated feedback quality summaries.
3. Individual feedback review details should be visible only to authorized supervisors.
4. Feedback quality reviews should be used for coach training, not public ranking.
5. Repeated low quality feedback should trigger training recommendation, not punishment.
6. High quality feedback examples may be used as training samples after removing sensitive personal content.
7. Feedback quality trends may be included in Coach Maker dashboards.

coaching_relationships Fields:

- id
- coach_id
- coachee_id
- organization_id
- church_id
- group_id
- cohort_id
- start_date
- end_date
- status
- relationship_type
- is_primary
- created_at
- updated_at
- deleted_at

Relationship Rules:

1. A coachee can have only one primary active coach at a time.
2. A coachee may have additional support coaches if relationship_type allows it.
3. Only one active relationship is allowed for the same coach_id, coachee_id, and relationship_type.
4. When changing coach, the previous relationship must be ended with end_date and status = ended.
5. Coaching history must not be deleted.

Relationship vs Generation Rule:

1. coaching_relationships tracks active and historical coaching assignments.
2. coaching_generations tracks multiplication lineage and generation depth.
3. A coaching relationship can change over time.
4. A generation lineage should be preserved for historical multiplication analytics.
5. Changing a coach does not automatically erase the original generation lineage.
6. When a new coach relationship is created, the system should decide whether it also creates or updates a coaching_generations record.
7. This decision should be explicit in the UI or admin workflow.

coaching_generations Fields:

- id
- user_id
- coach_id
- parent_id
- generation_number
- lineage_path
- root_leader_id
- lineage_depth
- created_at
- updated_at
- deleted_at

Generation Lineage Rules:

1. root_leader_id identifies the first leader or founder of the coaching lineage.

2. lineage_path stores the full coaching path from root leader to current user.

Example:
root_leader_id → gen1_coach_id → gen2_coach_id → current_user_id

3. parent_id identifies the direct parent node in the coaching generation tree.

Purpose:
parent_id allows fast lookup for direct parent and direct children.

Examples:

- Find my direct coach in the generation tree
- Find my direct coachees
- Find all immediate next-generation coaches under one coach

4. lineage_depth stores how far the current user is from the root leader.

Examples:

- Founder / Root Leader: lineage_depth = 0
- Generation 1 Coach: lineage_depth = 1
- Generation 2 Coach: lineage_depth = 2
- Generation 3 Coach: lineage_depth = 3
- Generation 4+ Coach: lineage_depth >= 4

5. lineage_depth should be calculated and saved when a coaching generation record is created or updated.

6. lineage_depth allows the system to quickly answer questions such as:
   - Which coaching lines reached Generation 4 or higher?
   - Which root leaders produced multi-generation coaches?
   - Which organizations have the deepest coaching reproduction?
   - Which coaching lines need support before reaching the next generation?

7. generation_number and lineage_depth may be the same in simple cases.
   However, lineage_depth is kept as a dedicated field for faster filtering, analytics, and dashboard performance.

8. Do not delete lineage records when a user becomes inactive.
   Preserve lineage_depth for historical multiplication analytics.

growth_levels Fields:

- id
- level_number
- code
- name_ko
- name_en
- name_th
- description
- is_active
- sort_order
- created_at
- updated_at
- deleted_at

level_requirements Fields:

- id
- from_level_id
- to_level_id
- required_weeks
- required_average_achievement_rate
- required_feedback_count
- required_coachee_count
- required_feedback_given_count
- requires_admin_approval
- created_at
- updated_at
- deleted_at

level_progress_reviews Fields:

- id
- user_id
- current_level_id
- target_level_id
- submitted_weeks_count
- average_achievement_rate
- feedback_received_count
- coachee_count
- feedback_given_count
- is_eligible
- reviewed_at
- reviewed_by
- created_at
- updated_at
- deleted_at

Tree Query Optimization Rules:

Purpose:
Support both full lineage queries and fast direct relationship queries.

Rules:

1. lineage_path is used for materialized path style queries.
   It is useful for retrieving the full coaching lineage or the entire subtree.

2. parent_id is used for direct parent-child queries.
   It is useful for finding:
   - direct parent coach
   - direct coachees
   - immediate next-generation coaches

3. root_leader_id is used for filtering all users under the same root leader.

4. lineage_depth is used for filtering and analytics by generation depth.

5. The system should not parse lineage_path for every direct parent-child lookup.
   Use parent_id for direct lookups.

6. Recommended indexes:

- coaching_generations(parent_id)
- coaching_generations(root_leader_id)
- coaching_generations(user_id)
- coaching_generations(coach_id)
- coaching_generations(lineage_depth)

7. Example direct child query:

Find all direct children of a coach:
parent_id = coach_user_id

8. Example full subtree query:

Find all descendants under a root leader:
root_leader_id = selected_root_leader_id
and lineage_path starts with selected lineage path

9. Example deep multiplication query:

Find all users in generation depth 4 or higher:
lineage_depth >= 4

Important:
Use lineage_path for full tree traversal.
Use parent_id for immediate parent-child lookup.
Use root_leader_id and lineage_depth for fast analytics.

Lineage Path Rebuild / Subtree Update Rules:

Purpose:
Maintain accurate coaching generation paths when a coach, parent node, or lineage structure changes.

Problem:
When a middle-level coach changes parent_id, all descendants under that coach may need updated lineage_path, root_leader_id, and lineage_depth.

Core Rule:
The system must not update only the changed node.
It must also update the full descendant subtree when lineage changes.

Required Mechanism:

Use a PostgreSQL RPC function or controlled server-side function to rebuild lineage paths.

Recommended function name:

- rebuild_coaching_lineage_subtree(changed_user_id, actor_id)

Function Responsibilities:

1. Find the changed coaching_generations record.
2. Find the new parent record using parent_id.
3. Recalculate the changed user's:
   - lineage_path
   - root_leader_id
   - lineage_depth
4. Find all descendants under the changed user's old lineage_path.
5. Replace the old path prefix with the new path prefix for every descendant.
6. Recalculate lineage_depth for every descendant.
7. Preserve historical records unless an admin explicitly changes lineage.
8. Create an audit log for the lineage rebuild.

Example:

Before coach change:

Founder
→ Coach A
→ Coach B
→ Coach C

lineage_path:
Founder.CoachA.CoachB.CoachC

After Coach B moves under Coach X:

Founder
→ Coach X
→ Coach B
→ Coach C

Updated lineage_path:
Founder.CoachX.CoachB.CoachC

Recommended RPC Concept:

function rebuild_coaching_lineage_subtree(changed_user_id uuid, actor_id uuid)

Pseudo Logic:

1. Check permission:
   can_rebuild_lineage_tree(actor_id, changed_user_id)

2. Load changed node:
   select * from coaching_generations where user_id = changed_user_id

3. Load parent node:
   select * from coaching_generations where user_id = changed_node.parent_id

4. Calculate new values:
   new_root_leader_id = parent.root_leader_id
   new_lineage_path = parent.lineage_path + changed_user_id
   new_lineage_depth = parent.lineage_depth + 1

5. Store old_lineage_path before update.

6. Update changed node.

7. Update all descendants:
   replace old_lineage_path prefix with new_lineage_path prefix

Path Replacement Rule:

For every descendant whose lineage_path starts with old_lineage_path,
replace the old prefix with new_lineage_path.

Concept:

descendant.lineage_path =
replace_prefix(descendant.lineage_path, old_lineage_path, new_lineage_path)

This ensures that all descendants remain connected to the correct coaching lineage after a parent coach changes.

8. Recalculate lineage_depth for descendants.

9. Insert audit log.

10. Commit transaction.

Subtree Update Rule:

If Coach B changes parent_id, then Coach B and all descendants of Coach B must have updated lineage_path, root_leader_id, and lineage_depth.

Trigger / RPC Rule:

1. Do not allow normal client-side updates to lineage_path directly.
2. parent_id changes must be handled through a secure PostgreSQL RPC function.
3. Edge Functions may call the RPC function, but should not directly rebuild lineage in application code.
4. The RPC function should run inside a database transaction.
5. If any descendant update fails, the entire lineage update should rollback.
6. Only authorized roles may trigger lineage rebuild:
   - super_admin
   - organization_admin within scope
   - coach_maker within assigned scope if allowed
7. Every lineage rebuild must create an audit log.
8. Database triggers may be used only as a safety guard, not as the main business workflow.

Recommended Audit Actions:

- lineage_parent_changed
- lineage_subtree_rebuilt
- lineage_rebuild_failed

Important:
lineage_path is powerful for reads but expensive to update.
Therefore, lineage changes should be rare, intentional, authorized, and audited.



level_promotion_requests Fields:

- id
- user_id
- current_level_id
- requested_level_id
- requested_by
- approved_by
- status
- reason
- review_comment
- requested_at
- approved_at
- created_at
- updated_at
- deleted_at

translated_contents Fields:

- id
- source_table
- source_id
- source_language
- target_language
- original_text
- translated_text
- translation_provider
- reviewed_by_user
- created_at
- updated_at
- deleted_at

Translation Storage Rules:

1. AI translation must never overwrite the original message.
2. Original text and translated text must both be stored when needed.
3. translated_contents can be connected to coach_feedback, weekly_logs, notifications, or encouragement messages.
4. source_table identifies where the original content came from.
5. source_id identifies the specific record in that table.
6. reviewed_by_user shows whether a human reviewed or edited the AI translation.

Examples:

source_table = coach_feedback
source_id = feedback_id
source_language = ko
target_language = th
original_text = Korean coaching feedback
translated_text = Thai translated feedback

source_table = weekly_logs
source_id = weekly_log_id
source_language = th
target_language = ko
original_text = Thai weekly reflection
translated_text = Korean translated reflection

care_prompts Fields:

- id
- coachee_id
- coach_id
- weekly_log_id
- risk_score
- risk_level
- trigger_reason
- recommended_question_id
- prompt_message
- popup_shown_at
- coach_response_action
- status
- created_at
- acknowledged_at
- resolved_at
- updated_at
- deleted_at

Care Prompt Rules:

Purpose:
Help coaches respond with care when a coachee shows signs of risk or discouragement.

Core Principle:
Care Prompt is not a warning, punishment, or failure label.
It is a pastoral coaching support signal.

Trigger Rules:

1. If risk_score >= 60, create a Care Prompt for the assigned coach.
2. If risk_score >= 70, show a Care Question popup on the coach dashboard.
3. If risk_score >= 80, mark the prompt as high priority and suggest personal follow-up.
4. If a coachee misses weekly logs for 3 or more consecutive weeks, create a Care Prompt.
5. If repeated blocker keywords appear for 3 weeks, create a Care Prompt.
6. If no coach feedback has been given for 4 weeks, notify the coach.

Care Question Popup Rules:

Purpose:
Guide the coach to approach the coachee with warmth, care, and thoughtful questions.

Rules:

1. When risk_score >= 70, the coach dashboard should show a Care Question popup.
2. The popup should not say "danger" or "failure".
3. The popup should use care-centered language.
4. The system should recommend one or more questions from coaching_questions.
5. Prefer questions where:
   - question_intent = diagnosis
   - question_intent = encouragement
   - question_intent = relationship_care
   - question_type = care_prompt
   - question_type = blocker_discovery
6. The coach may choose one suggested question, edit it, or write a personal message.
7. The popup should be dismissible, but dismissing should require a simple reason if risk_score >= 80.
8. The system should record whether the coach acknowledged or followed up on the prompt.

Example Popup Message:

"This coachee may need encouragement. Consider reaching out with a warm question."

Suggested Care Questions:

- What has felt heavy or difficult for you this week?
- Where do you feel you need encouragement or support?
- What is one small step that would feel possible this week?
- How can I pray for you or support you this week?

Important:
Care Question popups must guide the coach toward gentle conversation, not correction, pressure, or judgment.

Recommended Question Logic:

1. The system should recommend diagnosis or care-related coaching questions.
2. Recommended questions should come from coaching_questions.
3. Prefer questions where:
   - question_type = blocker_discovery
   - question_intent = diagnosis
   - question_intent = relationship_care
   - question_intent = encouragement

Care Prompt Status:

- pending
- acknowledged
- followed_up
- resolved
- dismissed

Care Prompt UX:

1. The coach should see a warm message such as:
   "This coachee may need encouragement. Consider reaching out with care."

2. The system may suggest a question such as:
   "What has felt heavy or difficult for you this week?"

3. The coach should be able to:
   - acknowledge the prompt
   - send encouragement
   - write feedback
   - mark as followed up
   - dismiss with reason

Important:
Risk Score should lead to care, not control.
Care Prompts must never shame the coachee.

notifications Fields:

- id
- user_id
- type
- title
- message
- related_entity_type
- related_entity_id
- is_read
- read_at
- created_at
- updated_at
- deleted_at

app_settings Fields:

- id
- key
- value
- value_type
- scope_type
- scope_id
- description
- created_at
- updated_at
- deleted_at

App Settings Rules:

1. app_settings stores configurable system settings.
2. Settings can be global or scoped to country, organization, church, group, or cohort.
3. Sensitive secrets should not be stored in app_settings.
4. Public app configuration may be stored here.
5. Examples:
   - default_language
   - default_timezone
   - weekly_log_deadline_day
   - weekly_log_reminder_enabled
   - ai_translation_enabled

sync_events Fields:

- id
- user_id
- device_id
- entity_type
- entity_id
- action
- sync_status
- conflict_type
- local_version
- server_version
- resolution_action
- resolved_at
- error_message
- client_updated_at
- server_updated_at
- created_at

Sync Event Rules:

1. sync_events tracks offline-to-online synchronization attempts.
2. It is used for debugging and reliability monitoring.
3. sync_events should not store full private reflection content.
4. Store metadata only unless necessary.
5. Failed sync attempts may be visible to support admins.
6. Conflict events should record conflict_type, local_version, server_version, and resolution_action.
7. resolution_action examples:
   - kept_local
   - used_server
   - manually_merged
   - dismissed
8. Do not store full private reflection text in sync_events.
9. Store only metadata needed for support and debugging.
10. Do not rely on sync_events as the source of truth.

audit_logs Fields:

- id
- actor_id
- action
- entity_type
- entity_id
- old_value
- new_value
- reason
- ip_address
- user_agent
- request_id
- created_at

Audit Log Retention Rules:

1. audit_logs must not use soft delete.
2. audit_logs should not have deleted_at.
3. audit_logs should not be editable by normal users.
4. audit_logs should be append-only.
5. Only super_admin can view full audit logs.
6. Sensitive data should be masked before being stored in audit logs.

Required Audit Actions:

- role_changed
- profile_updated_by_admin
- soft_delete_profile
- restore_profile
- hard_delete_record
- coach_assigned
- coach_changed
- coaching_relationship_ended
- growth_level_promoted
- promotion_approved
- promotion_rejected
- weekly_log_soft_deleted
- snapshot_recalculated
- rls_policy_sensitive_action
- user_requested_erasure
- profile_anonymized
- private_reflections_deleted
- feedback_anonymized
- lineage_preserved_anonymized
- permanent_delete_completed

Enum / Fixed Value Rules:

Use fixed enum-like values for important status fields.

profile status:

- active
- inactive
- suspended
- archived
- anonymized

goal status:

- active
- paused
- completed
- archived

coaching relationship status:

- active
- paused
- ended
- archived

relationship_type:

- individual_coaching
- group_coaching
- leadership_coaching
- pastoral_coaching
- missionary_coaching

role:

- super_admin
- country_admin
- organization_admin
- church_admin
- group_leader
- coach_maker
- coach
- coachee

scope_type:

- global
- country
- region
- organization
- church
- group
- cohort
- coach

period_type:

- weekly
- monthly
- quarterly
- yearly

notification type:

- weekly_log_reminder
- feedback_received
- promotion_candidate
- promotion_approved
- promotion_rejected
- risk_attention
- care_prompt_created
- coach_assignment
- system_notice

care prompt status:

- pending
- acknowledged
- followed_up
- resolved
- dismissed

sync_status:

- local_saved
- waiting_to_sync
- syncing
- synced
- sync_failed
- conflict_detected
- resolved

sync conflict resolution_action:

- kept_local
- used_server
- manually_merged
- dismissed

coach feedback status:

- draft
- sent
- read
- responded
- archived

promotion request status:

- pending
- approved
- rejected
- cancelled

invitation status:

- pending
- accepted
- expired
- revoked

translation review status:

- ai_generated
- user_reviewed
- edited
- approved

organization_type:

- denomination
- mission_body
- church_network
- local_ministry
- nonprofit
- other

group_type:

- ministry_team
- small_group
- cohort_group
- training_group
- regional_group
- other

Important:
Do not allow free-text status values in production.

Soft Delete Field Rule:

Important historical tables must include deleted_at.

Use this field to hide or deactivate records without permanently deleting them.

Core rule:

- deleted_at = null means the record is active.
- deleted_at has a timestamp means the record is soft-deleted.
- normal dashboards should only show records where deleted_at is null.
- historical analytics may include inactive or ended records when needed.
- permanent deletion should be allowed only for super_admin.
- every soft delete and restore action must create an audit log.

Database Constraints and Indexes:

Purpose:
Protect data integrity and improve query performance.

Required Unique Constraints:

1. profiles:
   unique(auth_user_id) where auth_user_id is not null
   profiles.auth_user_id should use ON DELETE SET NULL if connected by foreign key to auth.users.

2. weekly_logs:
   unique(user_id, year, week_number)

3. monthly_summaries:
   unique(user_id, year, month)

4. coaching_relationships:

Only one active primary coach per coachee.

Recommended partial unique rule:

unique(coachee_id)
where status = 'active'
and is_primary = true
and deleted_at is null

Also prevent duplicate active relationship:

unique(coach_id, coachee_id, relationship_type)
where status = 'active'
and deleted_at is null

5. user_roles:
   unique(user_id, role, scope_type, scope_id) for active roles

6. invitations:
   unique(token)
   recommended partial uniqueness for pending invitation by email, invited_role, scope_type, scope_id

7. language_translations:
   unique(language_code, translation_key, namespace)

8. supported_languages:
   unique(code)

9. stats_snapshots:

For non-global scopes:
unique(scope_type, scope_id, period_type, year, month, week_number)

For global scope:
use a partial unique constraint where scope_type = 'global'

Important:
Because scope_id may be null for global snapshots, database implementation must prevent duplicate global snapshot records.

Recommended implementation options:

- use partial unique indexes
- or use a fixed global scope_id value such as 'global'
- or use a generated normalized_scope_id for uniqueness

10. goal_units:
   unique(code)

11. goal_categories:
   unique(code)

12. growth_levels:
   unique(level_number)
   unique(code)

13. goal_targets:
   prevent overlapping effective date ranges for the same goal_id when possible

Required Indexes:

- profiles(country_id)
- profiles(organization_id)
- profiles(church_id)
- profiles(group_id)
- profiles(growth_level_id)
- profiles(deleted_at)

- goals(user_id)
- goals(status)
- goals(deleted_at)

- weekly_logs(user_id, year, week_number)
- weekly_logs(deleted_at)

- weekly_log_items(weekly_log_id)
- weekly_log_items(goal_id)
- weekly_log_items(goal_id, created_at)

- coaching_relationships(coach_id)
- coaching_relationships(coachee_id)
- coaching_relationships(status)
- coaching_relationships(is_primary)
- coaching_relationships(deleted_at)

- coaching_generations(root_leader_id)
- coaching_generations(user_id)
- coaching_generations(coach_id)
- coaching_generations(parent_id)
- coaching_generations(lineage_depth)
- coaching_generations(lineage_path) using GIST or GIN if ltree is used
- coaching_generations(deleted_at)

Lineage Path Index Rule:

If PostgreSQL ltree is used for lineage_path, create an appropriate GIST or GIN index for subtree queries.

Purpose:

- fast descendant lookup
- fast subtree filtering
- fast lineage analytics
- efficient lineage_path prefix matching

End of Lineage Path Index Rule.

- stats_snapshots(scope_type, scope_id, period_type, year, month, week_number)
- stats_snapshots(calculated_at)

- translated_contents(source_table, source_id)
- monthly_summaries(user_id, year, month)
- monthly_summaries(deleted_at)

- user_roles(user_id)
- user_roles(role, scope_type, scope_id)
- user_roles(status)

- invitations(email)
- invitations(token)
- invitations(status)
- invitations(expires_at)

- goal_categories(code)
- goal_categories(is_active)

- goal_templates(template_type)
- goal_templates(organization_id)
- goal_templates(is_global)
- goal_templates(is_active)

- goal_targets(goal_id)
- goal_targets(effective_from)
- goal_targets(effective_to)

- goal_template_items(template_id)
- goal_template_items(category_id)

- coaching_questions(question_set_id)
- coaching_questions(goal_category_id)
- coaching_questions(is_active)

- weekly_reflection_answers(weekly_log_id)
- weekly_reflection_answers(goal_id)
- weekly_reflection_answers(question_id)
- weekly_reflection_answers(visibility)

- coach_feedback_quality_reviews(feedback_id)
- coach_feedback_quality_reviews(coach_id)
- coach_feedback_quality_reviews(reviewer_id)
- coach_feedback_quality_reviews(reviewed_at)

- sync_events(user_id)
- sync_events(device_id)
- sync_events(sync_status)
- sync_events(created_at)

- care_prompts(coach_id)
- care_prompts(coachee_id)
- care_prompts(weekly_log_id)
- care_prompts(status)
- care_prompts(risk_score)
- care_prompts(created_at)

- notifications(user_id, is_read)
- audit_logs(actor_id, entity_type, entity_id)

Important:
All dashboard and analytics queries should use indexed fields.

---

==================================================
6. CALCULATION ENGINE
==================================================

Timezone and Week Calculation Rules:

Purpose:
Prevent confusion in weekly tracking across countries and time zones.

Rules:

1. Each user must have a timezone in profiles.timezone.
2. Each organization may have a default timezone.
3. Weekly logs should be calculated based on the user's timezone by default.
4. Organization dashboards may use the organization's default timezone.
5. week_start_date and week_end_date must be stored explicitly.
6. Do not rely only on week_number for date calculations.
7. The system should use ISO week standard unless an organization defines a custom week rule.
8. Default week starts on Monday.
9. Weekly snapshot batch jobs should run according to the organization's timezone when possible.
10. All timestamps should be stored in UTC.
11. UI should display dates in the user's local timezone.

Important:
Store UTC in the database.
Display local time in the UI.

Basic formula:

Achievement Calculation Overview:

The system calculates raw achievement, caps recorded achievement at 200%, and uses the result for weekly, monthly, cumulative, category, and group-level summaries.

Supported calculation scopes:

- weekly
- monthly
- cumulative
- category
- group average
- up_to_current

Calculation Rules:

1. If target_value_at_time is 0 or null, achievement_rate must be 0.

Reason:
The system must prevent division by zero errors and preserve historical accuracy.

2. Raw achievement rate:

raw_achievement_rate = (actual_value / target_value_at_time) * 100

3. Recorded achievement rate must be capped at 200%.

achievement_rate = min(raw_achievement_rate, 200)

Examples:

- target_value_at_time = 10, actual_value = 5
  achievement_rate = 50%

- target_value_at_time = 10, actual_value = 10
  achievement_rate = 100%

- target_value_at_time = 10, actual_value = 15
  achievement_rate = 150%

- target_value_at_time = 10, actual_value = 20
  achievement_rate = 200%

- target_value_at_time = 10, actual_value = 30
  raw_achievement_rate = 300%
  achievement_rate = 200%

4. Display achievement rate:

display_achievement_rate = achievement_rate

Important:
The system records achievement rate up to 200%.
However, in visual progress bars, the bar should be visually full at 100%, and values over 100% should be shown as extra achievement.

Example:
- 100% = goal achieved
- 150% = exceeded goal
- 200% = maximum recognized achievement

5. Weighted score:

weighted_score = achievement_rate * goal_weight

6. Category achievement:

category_achievement = sum(weighted_score) / sum(goal_weight)

7. Overall weekly achievement:

weekly_achievement = sum(all weighted_score) / sum(all goal_weight)

8. Monthly achievement:

monthly_achievement = average(weekly_achievement within the month)

9. Cumulative achievement:

cumulative_achievement = average(weekly_achievement from week 1 to current week)

10. Group average achievement:

group_average_achievement = average(weekly_achievement of all active group members)

Important:
Achievement rate is allowed up to 200% in order to recognize extra effort.
But the system must not encourage unhealthy overwork.
Values above 100% should be displayed as "Exceeded Goal" rather than "Better Person" or "Higher Rank".

[한국어 설명]

성취율 계산은 다음 원칙을 따른다.

1. 목표값이 0이거나 비어 있으면 성취율은 0%로 처리한다.
2. 기본 성취율은 실제값 ÷ 목표값 × 100으로 계산한다.
3. 성취율은 최대 200%까지만 기록한다.
4. 100%는 목표 달성을 의미한다.
5. 100% 초과는 목표 초과 달성을 의미한다.
6. 200%를 넘는 경우에도 시스템에는 200%로 저장한다.
7. 이 기능은 과도한 경쟁을 위한 것이 아니라, 목표 이상으로 충실히 실행한 경우를 인정하기 위한 것이다.
8. 화면에서는 100% 이상을 “초과 달성”으로 표시하고, 사람을 비교하거나 평가하는 방식으로 사용하지 않는다.

Additional Calculations:

1. Multiplication Rate

multiplication_rate = number_of_new_coaches / number_of_existing_coaches

Purpose:
Measure how many coachees became coaches.

2. Active Coaching Rate

active_coaching_rate = active_coaching_relationships / total_coaching_relationships

Purpose:
Measure how many coaching relationships are currently active.

3. Generation Depth

generation_depth = maximum(lineage_depth) in a coaching lineage

Purpose:
Measure how far coaching multiplication has continued from the root leader.

Related Fields:

- root_leader_id
- lineage_path
- lineage_depth
- generation_number

Rules:

1. lineage_depth should be stored in coaching_generations.
2. generation_depth should be calculated from lineage_depth, not by repeatedly parsing lineage_path.
3. Dashboards should use lineage_depth for fast filtering and analytics.
4. A coaching line with lineage_depth >= 4 should be classified as a deep multiplication line.
5. Root leaders and organizations should be able to filter lines by lineage depth.

Example Queries:

- Find all coaching lines with lineage_depth >= 4
- Find root leaders with generation_depth >= 4
- Find organizations with the highest average lineage_depth
- Find coaching lines that stopped at lineage_depth 1 or 2

Feedback Quality Score Rules:

Purpose:
Measure the quality of coach feedback for coach development and supervision.

Basic Quality Signals:

- encouragement included
- coaching question included
- action step included
- specific observation included
- care language used
- non-shaming tone used

Recommended Calculation:

feedback_quality_score =
average(
  encouragement_score,
  question_quality_score,
  actionability_score,
  specificity_score,
  care_language_score,
  theological_sensitivity_score,
  follow_up_score
)

Required Minimum Quality:

A complete coaching feedback should normally include:

1. encouragement
2. one meaningful question
3. one realistic action step

Quality Level:

- 0-39: Needs Training
- 40-59: Basic
- 60-79: Good
- 80-89: Strong
- 90-100: Excellent

Important:
Feedback Quality Score must not be used as public ranking.
It should be used for Coach Maker supervision, coach training, and feedback improvement.

Risk Score Rules:

Base score: 0

Add risk points:

- missed weekly log for 1 week: +10
- missed weekly logs for 2 consecutive weeks: +25
- missed weekly logs for 3 or more consecutive weeks: +40
- weekly achievement below 50%: +15
- weekly achievement below 30%: +25
- no coach feedback for 2 weeks: +10
- no coach feedback for 4 weeks: +25
- repeated blocker keyword for 3 weeks: +20
- inactive login for 14 days: +20
- inactive login for 30 days: +40

Risk Level:

- 0-29: Stable
- 30-59: Needs Encouragement
- 60-79: Needs Coach Attention
- 80-100: Needs Personal Care

Final Risk Score Rule:

risk_score = min(total_risk_points, 100)

The maximum risk_score is 100.

Important:
Risk Score must never be shown as punishment, failure, or shame.
Use care-centered language.

Care Prompt Trigger Rules:

Purpose:
Connect Risk Score to practical coaching care.

Core Principle:
Risk detection should always lead to encouragement, attention, and care.

Trigger Logic:

1. If risk_score >= 60:
   - create care_prompts record
   - create notification for assigned coach
   - recommend one or more diagnosis/care questions from coaching_questions

2. If risk_score >= 70:
   - show Care Question popup on the coach dashboard
   - suggest warm diagnosis or encouragement questions
   - guide the coach to reach out with care-centered language

3. If risk_score >= 80:
   - mark care prompt as high priority
   - suggest personal follow-up, not only written feedback
   - encourage direct relational care when appropriate

Recommended Question Selection:

Use coaching_questions where:

- question_type = care_prompt
- question_type = blocker_discovery
- question_intent = diagnosis
- question_intent = encouragement
- question_intent = relationship_care

Example Care Prompt:

Risk signal:
risk_score = 65

System message to coach:
"This coachee may need encouragement. Consider reaching out with care."

Suggested question:
"What felt most difficult or heavy for you this week?"

Important:
The system should guide the coach toward gentle conversation, not correction or pressure.

Snapshot Job Reliability Rules:

1. Snapshot jobs must be idempotent.
   Running the same job twice should not create duplicate results.

2. Use upsert logic for stats_snapshots.

3. Each snapshot record should have calculated_at.

4. If a snapshot job fails:
   - log the error
   - notify super_admin
   - keep the previous valid snapshot available
   - allow manual recalculation

5. Admin dashboards should show the snapshot calculated_at time.

6. If snapshot data is older than the allowed threshold, show a warning to admins.

7. Snapshot freshness rules:

- weekly snapshot should be considered fresh for 7 days
- monthly snapshot should be considered fresh for 31 days
- yearly snapshot should be considered fresh for 366 days

8. Do not block dashboard loading if snapshot recalculation fails.

Purpose:
Pre-calculate high-level statistics for fast dashboard loading.

Reason:
Global, country, organization, church, group, cohort, and coach dashboards may become slow if all statistics are calculated in real time.

Batch Schedule:

- weekly snapshot: every Monday early morning
- monthly snapshot: first day of each month
- yearly snapshot: first day of each year
- manual recalculation: available to super_admin

Recommended Schedule:

- Monday 02:00 local server time for weekly snapshots
- 1st day of month 02:30 local server time for monthly snapshots
- January 1st 03:00 local server time for yearly snapshots

Snapshot Calculation Targets:

- global
- country
- region
- organization
- church
- group
- cohort
- coach

Snapshot Metrics:

- total users
- active users
- inactive users
- total coaches
- total coachees
- active coaching relationships
- average achievement rate
- average risk score
- high risk user count
- growth level distribution
- generation distribution
- multiplication rate
- active coaching rate
- generation depth

Performance Rule:

1. Raw data remains the source of truth.
2. Snapshot data is used for fast dashboard loading.
3. Admin dashboards should load snapshot data first.
4. Live calculation should be used only when snapshot data is missing or when viewing a small group.
5. Global and organization dashboards must not run heavy real-time aggregation on every page load.
6. Snapshot calculation should be handled by scheduled jobs or server-side batch functions.
7. The goal is to keep dashboard loading fast even with many users.

Important:
Snapshots are for performance and reporting.
They must not replace weekly_logs, coaching_relationships, or coaching_generations.

---

==================================================
7. REQUIRED SCREENS
==================================================

Coachee:

- dashboard
- weekly input
- statistics
- personal growth level progress
- coaching request form
- reflection history

Coach:

- coachee list
- feedback
- risk detection
- coaching request inbox
- promotion candidate list
- coachee progress comparison

Coach Maker:

- coach list
- coach training status
- next-generation coach candidates
- multiplication progress
- coach feedback quality review
- feedback quality supervision dashboard
- coach feedback improvement report
- feedback examples for training
- coach mentoring notes

Group Leader:

- achievement board
- group member progress
- group risk overview
- group generation map
- cohort progress summary

Church / Organization Admin:

- organization dashboard
- church/group/cohort management
- user management
- approval queue
- level distribution
- generation analytics
- coaching relationship management

Global Admin:

- country dashboard
- organization comparison
- global coaching map
- multiplication dashboard
- language and localization settings
- global user management

Common Screens:

- login
- signup
- onboarding
- profile setup
- language selection
- notification center
- account settings
- conflict resolution screen

Language Settings Screen:

Features:

- select preferred language
- show current language
- preview language change
- set fallback language
- enable or disable automatic translation for coaching feedback
- organization default language setting for admins

Admin Operation Screens:

- coach assignment
- promotion approval queue
- role management
- user invitation
- organization setup wizard
- question set management
- audit log viewer

Care and Coaching Screens:

- care dashboard
- care prompt inbox
- care question popup
- inactive user list
- encouragement message screen
- recommended care questions
- coach check-in history

---

==================================================
8. SCREEN DESIGN
==================================================

A. Dashboard

- mission
- weekly achievement
- 4 categories
- 52-week graph
- Level progress

B. Weekly Entry

- numeric input
- category-based reflection questions
- reflection
- coaching request
- AI-assisted question suggestions when enabled

C. Coach Dashboard

- 대상자 리스트
- 위험 감지
- 승급 후보

D. Group Board (핵심)

- 월별 성취 테이블
- 평균 / 누적 / 전체 성취

E. Admin

- 레벨 분포
- 승급 승인

F. Global Coaching Map

Purpose:
Show the full coaching structure from global level to individual level.

Display:

Global
→ Country
→ Region
→ Organization / Denomination / Mission Body
→ Church / Local Group / Ministry Team
→ Cohort / Generation
→ Coach Maker
→ Coach
→ Coachee

Features:

- expandable tree view
- filter by country
- filter by region
- filter by organization
- filter by church/group
- filter by cohort
- filter by generation
- active/inactive status
- number of coaches and coachees
- visual indicator for weak or inactive coaching lines

G. Coaching Tree View

Purpose:
Show disciple multiplication visually.

Display Example:

Founder
├── Gen 1 Coach A
│   ├── Gen 2 Coach A-1
│   └── Gen 2 Coach A-2
├── Gen 1 Coach B
│   └── Gen 2 Coach B-1
└── Gen 1 Coach C

Features:

- show coach-to-coachee relationship
- show generation number
- show growth level
- show recent activity
- show multiplication depth
- show active and inactive coaching relationships
- allow leaders to click a person and see weekly growth summary

H. Onboarding Flow

Purpose:
Help new users start without confusion.

Steps:

1. Select language
2. Confirm country / organization / church / group
3. Write mission and vision
4. Choose coaching template
5. Set weekly goals
6. Connect with coach or request coach
7. Start Week 1 input

Important:
The onboarding process must be simple enough for non-technical users.

I. Coach Maker Supervision Dashboard

Purpose:
Help Coach Makers review and improve the quality of coach feedback.

Display:

- assigned coaches
- number of feedback messages given
- percentage of feedback with encouragement
- percentage of feedback with coaching questions
- percentage of feedback with action steps
- average feedback quality score
- coaches needing training support
- strong feedback examples
- feedback quality trend over time

Actions:

- review feedback
- leave supervision comment
- recommend training
- mark as strong example
- schedule coach mentoring conversation

Important:
This dashboard must be used for coach development, not public comparison or ranking.

J. Conflict Resolution Screen

Purpose:
Help users safely resolve sync conflicts between local offline drafts and newer server data.

When to Show:

- offline draft sync fails because version does not match server version
- server data was updated on another device
- local IndexedDB draft and server record are different
- automatic merge is not safe

Display:

- conflict summary
- last synced time
- local draft updated time
- server data updated time
- side-by-side comparison
- highlighted differences
- clear explanation of why conflict happened

Side-by-side Layout:

Left side:
Local Draft

Right side:
Server Version

Fields to Compare:

- actual_value
- target_value_at_time
- memo
- reflection_private
- reflection_coach_visible
- blocker
- adjustment_plan
- coaching_request
- weekly_reflection_answers

Actions:

- keep local draft
- use server version
- merge manually
- save merged version
- cancel and review later

Important:
The screen must use calm and simple language.
Do not show technical error messages such as "version mismatch" to normal users.
Explain it as:
"This weekly record was updated on another device. Please review both versions before saving."

---

==================================================
9. UX PRINCIPLES
==================================================

- 3분 입력
- 지원 중심 언어
- 관계 중심 UI
- 모바일 최적화
- 오프라인 입력 지원

Additional UX Principles:

- do not shame users for low achievement
- encourage reflection before correction
- make coaching feedback warm, short, and actionable
- show progress visually, not only numerically
- use simple language for non-technical users
- support mobile-first input for busy pastors and missionaries
- make the weekly input process possible within 3 minutes
- separate private reflection from coach-visible reflection

Privacy UX:

- clearly separate private reflection and coach-visible reflection
- show a sharing label before saving
- allow users to preview what the coach can see
- never expose private reflection in group board or admin dashboard
- use privacy-friendly default settings

Multilingual UX:

- language selection must be easy to find
- users can change language anytime
- language names should be displayed in their native names
  Example: 한국어, English, ไทย
- avoid long and complex UI text
- use simple words for global users
- avoid culture-specific idioms in system messages
- keep coaching language warm, respectful, and simple
- preserve the original language of user reflections and coaching feedback
- show translated content as a helper, not as a replacement

Offline UX:

- users should be able to open the weekly input screen even with unstable internet
- users should be able to save weekly input as an offline draft
- the app should clearly show offline / syncing / synced status
- offline drafts should automatically sync when the connection returns
- users must be warned before closing the app if unsynced changes exist
- the app should never silently lose weekly input
- offline mode should prioritize weekly_logs, weekly_log_items, and reflection answers
- dashboards may show cached data when offline
- sensitive data stored offline must be minimized and protected

---

==================================================
10. SAMPLE TEMPLATE
==================================================

A. Pastoral Coaching Template

- Bible reading
- Prayer
- Sermon preparation
- Visitation
- Discipleship
- Reading
- Exercise
- Fellowship
- Ministry execution
- Rest

B. Missionary Coaching Template

- Spiritual life
- Local language learning
- Local relationship building
- Evangelism / ministry contact
- Family care
- Health
- Supporter communication
- Team collaboration
- Reading / study
- Rest

C. Church Leader Coaching Template

- Worship participation
- Bible reading
- Prayer
- Small group leadership
- Serving
- Relationship care
- Evangelism
- Personal growth
- Family life
- Weekly reflection

D. Youth / Next Generation Coaching Template

- Bible reading
- Prayer
- Study habits
- Character growth
- Family relationship
- Church participation
- Friendship
- Service
- Media habits
- Weekly reflection

E. Coaching Question Template

Weekly Reflection Questions:

- What went well this week?
- What was difficult this week?
- What did you learn about yourself?
- Where did you experience God's help?
- What needs adjustment next week?
- What is one small step you will take next week?

Coach Feedback Questions:

- What encouraged you in this person's record?
- What question would help this person reflect more deeply?
- What small action step can you suggest?
- Is this person needing encouragement, clarity, or care?

[한국어 코칭 질문 예시]

- 이번 주에 잘된 것은 무엇입니까?
- 이번 주에 어려웠던 것은 무엇입니까?
- 자신에 대해 새롭게 알게 된 것은 무엇입니까?
- 하나님의 도우심을 경험한 부분은 무엇입니까?
- 다음 주에 조정해야 할 것은 무엇입니까?
- 다음 주에 실천할 작은 한 걸음은 무엇입니까?

F. Category-Based Coaching Question Sets

Purpose:
Provide different reflection questions depending on the goal category.

Spiritual Life Questions:

- How did you experience God's grace this week?
- What helped or hindered your prayer and Scripture rhythm?
- What is one small act of obedience for next week?

Health / Rest Questions:

- How was your physical energy this week?
- What rhythm helped your body recover?
- What is one realistic health step for next week?

Ministry / Service Questions:

- Who did you serve or encourage this week?
- What fruit or difficulty did you notice in ministry?
- What is one person or situation that needs prayerful attention?

Learning / Growth Questions:

- What did you learn or practice this week?
- Where did you get stuck?
- What small learning action will you repeat next week?

Relationship / Family Questions:

- Which relationship received care this week?
- Where did you need more patience, listening, or forgiveness?
- What is one small step of love for next week?

Important:
Questions should guide reflection, not create guilt or pressure.

---

==================================================
11. OUTPUT REQUIREMENTS
==================================================

1. Architecture
2. Folder structure
3. ERD
4. SQL
5. Views
6. Seed
7. Types
8. Utils
9. UI
10. Pages

MVP Delivery Order:

Phase 0: Foundation
- Supabase schema
- authentication
- RLS helper functions
- role and scope model
- database constraints and indexes
- enum / fixed value definitions
- i18n setup
- soft delete utilities
- audit log utilities
- seed data
- shared TypeScript types
- common layout
- common error handling
- loading / empty / error states
- timezone and week calculation rules

Phase 1: Core Coaching
- profile setup
- goals
- weekly logs
- weekly log items
- weekly reflection answers
- achievement calculation
- coach-coachee relationship
- coach feedback
- coachee dashboard
- coach dashboard

Phase 2: Organization and Growth Level
- countries
- regions
- organizations
- churches
- groups
- cohorts
- growth levels
- promotion requests
- approval queue
- group board
- notifications

Phase 3: Multiplication, Analytics, and Global Readiness
- coaching generations
- coaching tree view
- global coaching map
- risk score
- care dashboard
- feedback quality dashboard
- CSV export
- i18n
- audit logs
- anonymization workflow
- offline-first weekly input
- PWA install support
- Edge Functions for server-side workflows
- snapshot batch jobs

---

==================================================
12. CODING STANDARDS
==================================================

- production-ready
- typed
- reusable
- maintainable
- secure by default
- mobile-first
- accessible
- role-protected
- RLS-ready for Supabase
- edge-function ready
- CDN-cache aware
- read-replica aware
- offline-first ready
- PWA-ready
- IndexedDB-cache aware
- conflict-resolution-ready
- soft-delete aware
- anonymization-aware
- snapshot-aware dashboard design
- feedback-quality-aware
- dynamic-questioning-aware
- optimistic-concurrency-safe
- error-handled
- loading-state supported
- empty-state supported

---

==================================================
13. IMPORTANT DETAILS
==================================================

- RBAC
- group board 필수
- mobile 대응
- CSV export
- i18n 구조
- multi-country support
- multi-organization support
- church/group/cohort hierarchy
- coaching relationship tracking
- coaching generation tracking
- lineage depth tracking for fast generation analytics
- growth level approval workflow
- dynamic category-based coaching questions
- risk detection
- scheduled stats snapshots for fast dashboard loading
- audit log for important changes
- privacy control for reflection notes
- anonymization on delete for privacy compliance
- role-based dashboard access
- language support: Korean and English by default, expandable to Thai and other global languages

Multilingual / i18n Requirements:

This platform is designed for global use.

Default supported languages:

- Korean
- English

Additional supported languages should be extendable:

- Thai
- Japanese
- Chinese
- Spanish
- French
- Portuguese
- Indonesian
- Vietnamese
- Other languages as needed

Language Principle:

1. Korean and English must be supported from the beginning.
2. Thai should be prepared as an early expansion language.
3. The system must not hard-code UI text directly inside components.
4. All UI labels, menu names, buttons, messages, status labels, and error messages must use translation keys.
5. User-generated content should remain in the language entered by the user.
6. Coaching feedback may support translation, but the original text must always be preserved.
7. Each user can select a preferred language in their profile.
8. Admins may set a default language for each organization, church, group, or cohort.
9. The system must allow new languages to be added without changing the core database structure.

i18n Development Rules:

1. Do not hard-code visible UI text inside React components.

Bad example:
<button>Save</button>

Good example:
<button>{t("common.save")}</button>

2. Use translation keys for all visible text.

Examples:

- common.save
- common.cancel
- dashboard.title
- weekly_input.title
- weekly_input.submit
- coach.feedback_title
- risk.needs_encouragement
- level.level_1_name

3. Use default language fallback.

Fallback order:

user preferred language
→ organization default language
→ English
→ Korean

4. If translation is missing, show English as fallback.
5. Store system translation separately from user-generated content.

System translation:

- buttons
- menus
- labels
- status names
- error messages

User-generated content:

- reflections
- feedback
- mission
- vision
- personal notes

AI Translation Assistant:

Purpose:
Help coaches and coachees communicate across languages.

Use Cases:

- Korean coach gives feedback to Thai coachee
- English-speaking leader coaches Asian pastors or missionaries
- Thai coachee writes weekly reflection and Korean coach reads translated summary
- Global admin reviews multilingual coaching activity

Features:

- translate coaching feedback
- translate weekly reflection
- translate encouragement messages
- summarize reflection in coach's preferred language
- preserve original text
- show translated text separately
- allow user to edit AI-translated text before sending

Important:

1. AI translation must not replace human coaching.
2. AI translation must not overwrite the original message.
3. Original text must always be preserved.
4. Translated text must be clearly marked as translated content.
5. Users should be able to review and edit AI-translated text before sending.
6. AI translation should support Korean, English, and Thai first.
7. More languages can be added later through the same translation structure.
8. If AI translation uses an external provider, users and organizations should be informed.
9. Organizations should be able to disable AI translation.
10. Private reflections should not be sent to AI translation unless the user explicitly allows it.

Deletion Policy / Soft Delete Requirements:

This platform must use Soft Delete for important relational and historical data.

Purpose:

- preserve 52-week growth history
- protect coaching relationship history
- preserve coaching generation lineage
- prevent accidental loss of ministry and coaching records
- keep analytics stable even when users leave or relationships end

Core Rule:

Important records should not be physically deleted from the database.
Instead, mark them as deleted by setting deleted_at.

Recommended Soft Delete Fields:

- deleted_at

Recommended Soft Delete Tables:

- profiles
- coaching_relationships
- coaching_generations
- goals
- weekly_logs
- weekly_log_items
- coach_feedback
- level_promotion_requests

Deletion Behavior:

1. When a user leaves the platform:
   - do not delete the profile permanently
   - set profiles.status = inactive
   - set profiles.deleted_at = current timestamp if the account should be hidden
   - preserve generation and coaching history

2. When a coaching relationship ends:
   - do not delete the relationship
   - set status = ended
   - set end_date
   - deleted_at should be used only if the record was created by mistake

3. When a weekly log is removed:
   - do not permanently delete it by default
   - set deleted_at
   - exclude it from normal dashboards
   - keep it available for audit and recovery if needed

4. When displaying active data:
   - filter records where deleted_at is null

5. When calculating analytics:
   - default analytics should exclude deleted records
   - historical lineage analytics may include inactive users and ended relationships
   - permanently deleted records should never be required for generation tracking

6. Only super_admin may permanently delete records.
   Permanent deletion should be rare and must create an audit log.

Audit Requirement:

Every soft delete and restore action must create an audit log.

Examples:

- action = soft_delete_profile
- action = restore_profile
- action = soft_delete_weekly_log
- action = restore_weekly_log
- action = end_coaching_relationship

Important:

Soft Delete protects the integrity of coaching history.
This is essential because the platform tracks growth, relationship, and multiplication over time.

Data Erasure / Anonymization Policy:

Purpose:
Comply with privacy laws such as GDPR and other national data protection regulations while preserving non-identifiable ministry analytics and coaching lineage structure.

Core Principle:
When a user requests deletion of personal data, personally identifiable information must be removed or anonymized.
However, non-identifiable historical statistics and coaching lineage structure may be preserved for ministry analytics, unless local law requires full deletion.

Right to Erasure Rules:

1. Users may request deletion or anonymization of their personal data.

2. Personal identifiable information should be removed or anonymized, including:

- full_name
- display_name
- email
- phone
- personal notes
- private reflections
- profile photo if added later
- any free-text field that directly identifies the person

3. The system should preserve non-identifiable historical records when possible, including:

- anonymized weekly achievement statistics
- anonymized coaching relationship structure
- anonymized generation lineage
- aggregated organization statistics
- historical growth level distribution
- stats_snapshots

4. When anonymizing a profile:

- set auth_user_id = null
- set full_name = "Deleted User"
- set display_name = "Deleted User"
- remove email or replace with anonymized placeholder
- remove phone
- remove personal notes
- set status = anonymized
- set anonymized_at = current timestamp
- set deleted_at = current timestamp if the profile should be hidden from normal views
- keep profiles.id only as an internal non-public reference if legally allowed

5. Coaching lineage should be preserved without exposing personal identity.

Example:

Before anonymization:
Founder → Pastor Kim → Coach Lee → Coachee Park

After anonymization:
Founder → Deleted User → Coach Lee → Deleted User

6. Private reflections should be permanently removed or anonymized when the user requests deletion.

7. Coach-visible reflections and feedback should be reviewed according to privacy rules.
If they contain personal identifying content, they should be anonymized or removed.

8. Aggregated statistics may remain if they cannot reasonably identify the user.

9. The system must distinguish between:

- soft delete
- anonymization
- permanent deletion

10. Permanent deletion should be used only when required by law or approved by super_admin.

11. Every deletion, anonymization, or restoration action must create an audit log.

Required Audit Actions:

- user_requested_erasure
- profile_anonymized
- private_reflections_deleted
- feedback_anonymized
- lineage_preserved_anonymized
- permanent_delete_completed

Important:
Anonymization must protect the user's dignity and privacy while preserving non-identifiable coaching history and multiplication analytics.

Sensitive Text Handling Rules:

Purpose:
Protect private reflections, coaching notes, feedback text, and other free-text fields that may contain sensitive personal or ministry information.

Sensitive text fields include:

- coaching_profiles.personal_notes
- coaching_profiles.coach_visible_notes
- weekly_logs.reflection_private
- weekly_logs.reflection_coach_visible
- weekly_reflection_answers.answer_text
- coach_feedback.feedback_text
- coach_feedback.response_text
- translated_contents.original_text
- translated_contents.translated_text

Rules:

1. Private text fields must never appear in group dashboards.
2. Admin dashboards should use counts and summaries, not raw private text.
3. AI translation or summarization must not process private text unless enabled by the organization and permitted by the user.
4. Data export should exclude private text by default.
5. Anonymization should remove or mask sensitive free-text fields.
6. Search indexing should not index private reflections unless explicitly permitted.
7. Offline storage should minimize sensitive text and clear it on logout.
8. Logs and audit_logs must not store full private text content.

Supabase RLS Requirements:

- users can read and update their own profiles through profiles.auth_user_id
- users can read and update their own goals through profiles.id
- users can read and update their own weekly logs through profiles.id
- anonymized profiles must not be accessible as personal accounts
- if profiles.auth_user_id is null, the profile must not be treated as an authenticated user-owned profile
- all user-owned data access must resolve auth.uid() to profiles.id through profiles.auth_user_id
- coaches can read assigned coachees' coach-visible logs only
- coaches can create feedback only for assigned coachees
- group leaders can view group-level summaries but not private reflections
- admins can manage users only within their assigned scope
- super_admin can manage all data
- private reflections must never be exposed through summary views

Tenant Scope / Data Access Rules:

1. All organization-level data must be scoped.
2. Users can access data only within their assigned scope.
3. Scope is defined by user_roles.scope_type and user_roles.scope_id.
4. RLS policies should use helper functions to check access.

Recommended RLS helper functions:

- is_super_admin(user_id)
- has_role(user_id, role)
- has_scope_access(user_id, scope_type, scope_id)
- is_assigned_coach(coach_id, coachee_id)
- can_view_weekly_log(viewer_id, weekly_log_id)
- can_manage_profile(manager_id, profile_id)
- can_rebuild_lineage_tree(actor_id, changed_user_id)

Lineage Permission Rules:

1. Normal users must not update lineage_path directly.
2. Normal users must not update root_leader_id directly.
3. parent_id changes must be allowed only through an authorized admin workflow.
4. lineage_path rebuild must be performed by secure RPC or Edge Function.
5. The RPC function must check whether the actor has permission to rebuild the selected lineage subtree.

Important:
Do not duplicate complex RLS logic in every policy.
Use helper functions to keep policies maintainable.

Offline-First / PWA Requirements:

Purpose:
Support missionaries, pastors, coaches, and coachees in areas with unstable internet connections.

Core Principle:
The weekly input experience must remain usable even when the network is unstable.

Offline-First Features:

- installable PWA experience
- offline access to weekly input screen
- IndexedDB-based local draft storage
- automatic sync when connection returns
- visible sync status
- conflict detection using version or updated_at
- safe retry for failed sync requests
- cached templates and language packs
- cached recent goals and weekly input structure

Offline Data Priority:

High priority offline support:

- weekly_logs draft
- weekly_log_items draft
- weekly_reflection_answers draft
- current goals
- goal categories
- coaching question sets
- language packs
- coaching templates

Low priority offline support:

- global dashboards
- organization analytics
- coaching tree view
- stats snapshots
- audit log viewer

Offline Sync Rules:

1. Users can create or edit weekly input while offline.
2. Offline changes must be saved locally in IndexedDB.
3. When internet connection returns, the app should sync pending changes automatically.
4. Sync must use optimistic concurrency control.
5. If server data changed while the user was offline, the app should show a conflict resolution screen.
6. Conflict resolution screen should show local draft and server version side by side.
7. Users should be able to choose:
   - keep local draft
   - use server version
   - merge manually
8. The system must not silently overwrite newer server data.
9. Each offline draft should have local_created_at, local_updated_at, and sync_status.
10. Failed sync attempts should be retried safely.
11. Users should be able to see whether a record is:
   - saved locally
   - waiting to sync
   - syncing
   - synced
   - sync failed
   - conflict detected

Offline Security Rules:

1. Do not store unnecessary sensitive data offline.
2. Private reflections stored offline should be minimized and protected.
3. Clear offline cache on logout.
4. Do not cache audit logs, invitation tokens, or role permission data.
5. If the device is shared, the user should be warned that offline drafts may remain on the device until logout or cache clear.

Important:
Offline mode is designed to protect the 3-minute input principle.
It must prevent data loss in mission fields and low-connectivity environments.

---

Global Infrastructure / Latency Requirements:

Purpose:
Support fast access for users in multiple regions such as Korea, Thailand, the United States, and other countries.

Infrastructure Principles:

1. Keep user-facing pages fast for global users.
2. Reduce database round trips for dashboard and read-heavy pages.
3. Cache static and semi-static data close to users.
4. Use server-side and edge-side processing for heavy or repeated operations.
5. Protect sensitive user data with Supabase RLS even when using edge functions.

Supabase Edge Functions Usage:

Use Supabase Edge Functions for:

- AI translation requests
- snapshot recalculation triggers
- invitation email sending
- notification dispatch
- secure server-side operations
- scheduled batch jobs
- integration with external APIs
- data export generation

Edge Function Rules:

1. Do not expose service role keys to the client.
2. Use Edge Functions for privileged server-side actions.
3. Validate user permissions inside the function.
4. Log sensitive actions to audit_logs.
5. Return only the minimum data required by the client.
6. Keep functions small and focused.

Read Replica / Read Scaling Strategy:

Purpose:
Improve read performance for global dashboards and large-scale analytics.

Rules:

1. Primary database remains the source of truth.
2. Read replicas may be used for read-heavy dashboards and reports.
3. Write operations must go to the primary database.
4. Admin dashboards should prefer stats_snapshots over live aggregation.
5. Read replicas should be considered when global read latency becomes noticeable.
6. Data that must be immediately consistent should read from the primary database.
7. Slightly delayed data is acceptable for historical analytics and summary dashboards.

CDN / Edge Caching Strategy:

Cache static or semi-static data through CDN or edge caching.

Recommended cache targets:

- language packs
- UI translation files
- coaching templates
- goal templates
- supported language list
- public configuration
- static assets
- non-sensitive help content

Do not cache sensitive private data publicly:

- private reflections
- coach-visible reflections
- weekly logs
- coach feedback
- user profiles
- role permissions
- invitation tokens
- audit logs

Cache Rules:

1. Static translation files may be cached aggressively.
2. Templates may be cached with revalidation.
3. User-specific data must not be publicly cached.
4. Cache keys should include language code when caching translations.
5. Admin dashboards should load stats_snapshots first and avoid heavy live queries.
6. Cache invalidation should be planned when templates or language packs are updated.

Performance Target:

- common pages should feel fast on mobile networks
- dashboard first meaningful data should load quickly
- global and organization dashboards should use precomputed snapshots
- static language and template data should be delivered from CDN or Edge whenever possible

---

==================================================
14. FINAL IDENTITY
==================================================

GOThriveCoaching is:

❌ 목표관리 앱  
❌ 습관 앱  
❌ 단순 출석 관리 앱  
❌ 단순 성과 평가 앱  

⭕ 코칭 운영 플랫폼  
⭕ 제자 재생산 시스템  
⭕ 코치 양성 플랫폼  
⭕ 글로벌 사역 성장 추적 플랫폼  
⭕ 교회와 선교단체를 위한 리더십 성장 플랫폼  

Core Identity:

This is not a system that simply measures people.
This is a system that helps people grow, receive coaching, become coaches, and raise new coaches.

[한국어 핵심 정리]

이 시스템의 본질은:

“사람을 평가하는 시스템이 아니라  
사람을 세우는 시스템이다.”

Level 시스템과 Generation 시스템을 통해

피코치 → 코치 → 코치 양성자 → 다음 세대 코치로 이어지는  
“영적 재생산 구조”를 구현한다.

==================================================
15. DEVELOPMENT GUARDRAILS
==================================================

Do not build this as:

- a competitive ranking app
- a shame-based performance tracker
- a simple habit tracker
- a social media app
- a public leaderboard system

The system must always protect:

- dignity
- privacy
- encouragement
- coaching relationship
- spiritual growth
- disciple multiplication

Development Priorities:

1. Care before evaluation
2. Reflection before correction
3. Relationship before analytics
4. Growth before performance
5. Multiplication before ranking

==================================================
16. ENGINEERING GUARDRAILS
==================================================

This project must be built with long-term maintainability, data integrity, and global scalability in mind.

Engineering Principles:

1. Database integrity before UI speed.
2. RLS security before feature expansion.
3. Raw data remains the source of truth.
4. Snapshots are for performance, not truth replacement.
5. Soft delete protects historical lineage.
6. Audit logs protect accountability.
7. Translation keys protect global scalability.
8. Helper functions should reduce duplicated security logic.
9. Every important workflow must have clear status values.
10. MVP must be small, but the foundation must be strong.

Critical Engineering Requirements:

- use enum-like fixed values for statuses and roles
- add database constraints and indexes
- use optimistic concurrency control for weekly log updates
- prevent silent overwrites from multiple devices
- optimize coaching tree queries with parent_id and lineage_path
- use parent_id for direct parent-child lookup
- use lineage_path for full lineage traversal
- rebuild descendant lineage_path through secure RPC when parent_id changes
- update lineage subtree inside a database transaction
- prevent direct client-side updates to lineage_path
- audit every lineage parent change and subtree rebuild
- support category-based dynamic coaching questions
- never use feedback quality scores for public ranking
- support offline-first weekly input with IndexedDB
- support PWA installation for mobile field use
- use optimistic concurrency control for offline sync
- provide conflict resolution UI for version mismatch
- show local draft and server version side by side
- allow user to keep local, use server, or manually merge
- prevent silent overwrite during sync conflicts
- use Supabase Edge Functions for privileged server-side operations
- cache static language packs and templates through CDN or Edge
- consider read replicas for read-heavy global dashboards
- avoid heavy live aggregation on global dashboard page load
- use UTC for stored timestamps
- display dates in user timezone
- use idempotent batch jobs
- use upsert for snapshot recalculation
- create audit logs for sensitive actions
- use RLS helper functions
- support invitation-based onboarding
- support anonymization on delete for privacy compliance
- preserve non-identifiable lineage analytics when legally allowed
- remove or anonymize personally identifiable information upon erasure request
- never hard-delete historical coaching lineage by default
- preserve original user-generated content
- keep AI translation separate from original content

Recommended Phase 0:

- Supabase schema
- authentication
- profiles/auth_user_id identity model
- RLS helper functions
- role and scope model
- database constraints and indexes
- enum / fixed value definitions
- i18n setup
- soft delete utilities
- anonymization utilities
- audit log utilities
- optimistic concurrency utilities
- target_value_at_time calculation utility
- lineage rebuild RPC design
- seed data
- shared TypeScript types
- common layout
- error/loading/empty states