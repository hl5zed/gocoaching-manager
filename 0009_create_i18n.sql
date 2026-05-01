-- =============================================================================
-- Migration: 0009_create_i18n.sql
-- Project:   GOThriveCoaching
-- Purpose:   Create the three-table normalised i18n structure for all
--            system UI translations (buttons, menus, labels, status names,
--            error messages). User-generated content (reflections, feedback,
--            mission/vision text) is NOT stored here — see translated_contents
--            (future migration) for AI-assisted translation of user content.
--
-- Three-table structure:
--
--   translation_namespaces   Controlled vocabulary of namespace names.
--         ↓ id
--   translation_keys         Key strings scoped to a namespace.
--         ↓ id
--   translation_values       Translated text per (key, language).
--
-- How this maps to application usage:
--   t('common.save')   → namespace 'common', key 'save'
--   t('dashboard.title') → namespace 'dashboard', key 'title'
--
-- Fallback order (application layer, not enforced here):
--   user preferred language
--   → organisation default language
--   → English
--   → Korean
--
-- Why three tables instead of one flat table:
--   - translation_namespaces enforces namespace spelling via FK — no silent
--     typo namespaces (e.g. 'dasboard' vs 'dashboard').
--   - translation_keys scopes keys within namespaces, allowing 'save' to
--     mean different things in 'common' vs 'goals' independently.
--   - translation_values links keys to languages with review metadata.
--   - Namespace-level attributes (description, is_active) stay clean.
--
-- No deleted_at on these tables:
--   Translation tables are configuration/reference data. If a key or namespace
--   becomes obsolete, is_active = false is sufficient. Soft delete adds
--   complexity without benefit here. The spec does not list deleted_at on
--   language_translations.
--
-- Dependencies:
--   0000_create_extensions.sql    → gen_random_uuid()
--   0001_create_enums.sql         → translation_review_status_enum
--   0002_create_languages.sql     → supported_languages(code), set_updated_at()
-- =============================================================================


-- =============================================================================
-- TABLE: translation_namespaces
-- Controlled vocabulary of namespace identifiers.
-- Seeded with the seven required namespaces at the end of this file.
-- =============================================================================
CREATE TABLE translation_namespaces (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL
                CHECK (
                  length(trim(name)) > 0
                  AND name = lower(name)
                ),
  description text,
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE translation_namespaces IS
  'Controlled vocabulary of i18n namespace identifiers. '
  'Each namespace groups related translation keys (e.g. common, dashboard, goals). '
  'Namespace names must be lowercase. Enforcing them here prevents typo namespaces '
  'from silently accumulating in translation_keys.';

COMMENT ON COLUMN translation_namespaces.name IS
  'Lowercase machine-readable namespace identifier. '
  'Examples: common, auth, dashboard, goals, weekly_logs, coaching, admin. '
  'Must be lowercase — enforced by CHECK constraint. '
  'Unique across the table.';

COMMENT ON COLUMN translation_namespaces.description IS
  'Human-readable description of what UI elements this namespace covers. '
  'Helps translators understand context and scope.';

COMMENT ON COLUMN translation_namespaces.is_active IS
  'False hides this namespace and all its keys from the translation admin UI. '
  'Does not delete keys or values — use for obsolete or draft namespaces.';

ALTER TABLE translation_namespaces
  ADD CONSTRAINT uq_translation_namespaces_name UNIQUE (name);

CREATE INDEX idx_translation_namespaces_is_active
  ON translation_namespaces (is_active);

CREATE TRIGGER trg_translation_namespaces_set_updated_at
  BEFORE UPDATE ON translation_namespaces
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =============================================================================
-- TABLE: translation_keys
-- Key strings scoped to a namespace.
-- The combination (namespace_id, key) is globally unique.
-- =============================================================================
CREATE TABLE translation_keys (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  namespace_id uuid        NOT NULL
                 REFERENCES translation_namespaces(id) ON DELETE RESTRICT,
  key          text        NOT NULL
                 CHECK (length(trim(key)) > 0),
  description  text,
  is_active    boolean     NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE translation_keys IS
  'Translation key strings, each scoped to a namespace. '
  'The pair (namespace_id, key) is unique — the same key string may exist '
  'in multiple namespaces independently. '
  'Example: namespace=''common'', key=''save'' → t(''common.save'').';

COMMENT ON COLUMN translation_keys.namespace_id IS
  'The namespace this key belongs to. References translation_namespaces(id). '
  'ON DELETE RESTRICT: a namespace cannot be deleted while keys exist in it.';

COMMENT ON COLUMN translation_keys.key IS
  'The key string within the namespace. Lowercase snake_case recommended. '
  'Examples: save, cancel, title, submit_button, needs_encouragement. '
  'Combined with namespace name to form the full i18n key: namespace.key.';

COMMENT ON COLUMN translation_keys.description IS
  'Context for translators: what UI element this key represents, where it '
  'appears, and any tone or length constraints. '
  'Example: "Submit button on the weekly log input form. Keep short (≤20 chars)."';

COMMENT ON COLUMN translation_keys.is_active IS
  'False hides this key from the translation admin UI and signals to the '
  'application that the key is deprecated. Existing values are preserved.';

ALTER TABLE translation_keys
  ADD CONSTRAINT uq_translation_keys_namespace_key UNIQUE (namespace_id, key);

CREATE INDEX idx_translation_keys_namespace_id
  ON translation_keys (namespace_id)
  WHERE is_active = true;

CREATE INDEX idx_translation_keys_is_active
  ON translation_keys (is_active);

CREATE TRIGGER trg_translation_keys_set_updated_at
  BEFORE UPDATE ON translation_keys
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =============================================================================
-- TABLE: translation_values
-- Translated text for each (key, language) combination.
-- This is the table the application reads at runtime.
-- =============================================================================
CREATE TABLE translation_values (
  id                   uuid                          PRIMARY KEY DEFAULT gen_random_uuid(),

  translation_key_id   uuid                          NOT NULL
                         REFERENCES translation_keys(id) ON DELETE CASCADE,

  -- References supported_languages(code) per the confirmed project rule.
  -- ON UPDATE CASCADE: if a language code is renamed, values follow automatically.
  -- ON DELETE RESTRICT: a language cannot be removed while translations exist for it.
  language_code        text                          NOT NULL
                         REFERENCES supported_languages(code)
                           ON UPDATE CASCADE
                           ON DELETE RESTRICT,

  -- The translated text for this key in this language.
  value                text                          NOT NULL
                         CHECK (length(trim(value)) > 0),

  -- Whether this value was produced by a machine translation service.
  -- True = needs human review before production use.
  -- False = originally written by a human or already reviewed.
  is_machine_translated boolean                      NOT NULL DEFAULT false,

  -- Review status of this translation value.
  -- ai_generated  → produced by AI/MT, not yet reviewed.
  -- user_reviewed → a human has read it and judged it acceptable.
  -- edited        → a human has modified the machine translation.
  -- approved      → formally approved for production use.
  -- Works together with is_machine_translated:
  --   is_machine_translated = true  + review_status = 'ai_generated' → needs review
  --   is_machine_translated = false + review_status = 'approved'      → production-ready (default)
  -- Default is 'approved' because values inserted without explicit review_status
  -- are assumed to be human-authored or production-ready UI strings.
  -- Machine-translated values must explicitly set review_status = 'ai_generated'
  -- and is_machine_translated = true when inserted.
  review_status        translation_review_status_enum NOT NULL DEFAULT 'approved',

  created_at           timestamptz                   NOT NULL DEFAULT now(),
  updated_at           timestamptz                   NOT NULL DEFAULT now(),

  -- A value reviewed/approved by a human should not be flagged as machine-translated.
  -- This constraint catches inconsistent state from application bugs.
  CONSTRAINT chk_translation_values_review_status_consistent
    CHECK (
      is_machine_translated = true
      OR review_status IN ('user_reviewed', 'edited', 'approved')
    )
);

COMMENT ON TABLE translation_values IS
  'Translated text for each (translation_key, language) combination. '
  'This is the table the application reads at runtime to render UI text. '
  'One row per key+language pair. Includes review metadata to track whether '
  'values are machine-translated or human-approved. '
  'language_code references supported_languages(code) per project convention.';

COMMENT ON COLUMN translation_values.translation_key_id IS
  'The key this value translates. References translation_keys(id). '
  'ON DELETE CASCADE: deleting a key removes all its translations.';

COMMENT ON COLUMN translation_values.language_code IS
  'BCP 47 language code. References supported_languages(code). '
  'ON UPDATE CASCADE: code renames propagate automatically. '
  'ON DELETE RESTRICT: cannot remove a language while translations exist for it.';

COMMENT ON COLUMN translation_values.value IS
  'The translated text. Must not be blank.';

COMMENT ON COLUMN translation_values.is_machine_translated IS
  'True if this value was produced by a machine translation service (AI/MT). '
  'Machine-translated values should be reviewed before production use. '
  'Set to false once a human has reviewed and approved the value.';

COMMENT ON COLUMN translation_values.review_status IS
  'Review lifecycle of this translation value. Uses translation_review_status_enum. '
  'ai_generated  → MT output, not yet reviewed. '
  'user_reviewed → human has read and accepted it. '
  'edited        → human has modified the machine output. '
  'approved      → formally signed off for production (default). '
  'Default is ''approved'': values inserted without explicit review_status are '
  'assumed to be human-authored or production-ready. Machine-translated values '
  'must explicitly set review_status = ''ai_generated'' and '
  'is_machine_translated = true on insert. '
  'Combine with is_machine_translated to drive the translation admin review queue.';

COMMENT ON CONSTRAINT chk_translation_values_review_status_consistent ON translation_values IS
  'A value with is_machine_translated = false must have a human review status '
  '(user_reviewed, edited, or approved). '
  'Prevents application bugs from marking a human-written string as ai_generated.';

-- Unique constraint: one value per (key, language)
ALTER TABLE translation_values
  ADD CONSTRAINT uq_translation_values_key_language
    UNIQUE (translation_key_id, language_code);

-- Primary runtime lookup: find translation for a given key in a given language
CREATE INDEX idx_translation_values_key_language
  ON translation_values (translation_key_id, language_code);

-- Review queue: find all values needing human review
CREATE INDEX idx_translation_values_review_status
  ON translation_values (review_status)
  WHERE is_machine_translated = true;

-- Language-scoped lookup: load all translations for a given language
CREATE INDEX idx_translation_values_language_code
  ON translation_values (language_code);

CREATE TRIGGER trg_translation_values_set_updated_at
  BEFORE UPDATE ON translation_values
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =============================================================================
-- SEED DATA: translation_namespaces
--
-- Seven required namespaces from the spec and requirements.
-- Sort order reflects rough usage frequency / importance.
--
-- ON CONFLICT (name) DO NOTHING — idempotent.
-- =============================================================================
INSERT INTO translation_namespaces (name, description, is_active)
VALUES
  (
    'common',
    'Shared UI elements used across the entire platform: buttons (save, cancel, '
    'delete, confirm), form labels, generic error messages, status labels, '
    'pagination controls, and other reusable text.',
    true
  ),
  (
    'auth',
    'Authentication and onboarding screens: login, signup, password reset, '
    'invitation acceptance, language selection, and account setup.',
    true
  ),
  (
    'dashboard',
    'Dashboard screens and summary views: titles, section headings, metric '
    'labels, achievement summaries, and navigation items.',
    true
  ),
  (
    'goals',
    'Goal management screens: goal categories, units, target labels, '
    'goal status names, and goal-related actions.',
    true
  ),
  (
    'weekly_logs',
    'Weekly input and reflection screens: input labels, reflection prompts, '
    'submission messages, blocker fields, coaching request text, and '
    'sync status indicators.',
    true
  ),
  (
    'coaching',
    'Coaching relationship screens: feedback labels, care prompt messages, '
    'coaching question prompts, level progression text, generation labels, '
    'and coach/coachee status names.',
    true
  ),
  (
    'admin',
    'Admin and management screens: user management labels, approval queue text, '
    'organisation setup, role assignment, audit log viewer, and system settings.',
    true
  )
ON CONFLICT (name) DO NOTHING;


-- =============================================================================
-- End of 0009_create_i18n.sql
--
-- Objects created:
--   TABLE      translation_namespaces
--   CONSTRAINT uq_translation_namespaces_name             (unique name)
--   INDEX      idx_translation_namespaces_is_active
--   TRIGGER    trg_translation_namespaces_set_updated_at
--
--   TABLE      translation_keys
--   CONSTRAINT uq_translation_keys_namespace_key          (unique namespace+key)
--   INDEX      idx_translation_keys_namespace_id
--   INDEX      idx_translation_keys_is_active
--   TRIGGER    trg_translation_keys_set_updated_at
--
--   TABLE      translation_values
--   CONSTRAINT uq_translation_values_key_language         (unique key+language)
--   CONSTRAINT chk_translation_values_review_status_consistent
--   INDEX      idx_translation_values_key_language        (runtime lookup)
--   INDEX      idx_translation_values_review_status       (review queue)
--   INDEX      idx_translation_values_language_code       (language load)
--   TRIGGER    trg_translation_values_set_updated_at
--
--   ROWS       7 seed namespaces                          (common, auth,
--              dashboard, goals, weekly_logs, coaching, admin)
--
-- Key design decisions:
--   - Three normalised tables instead of one flat language_translations table
--   - Namespace names are lowercase-enforced by CHECK constraint
--   - translation_values.language_code → supported_languages(code)
--     ON UPDATE CASCADE, ON DELETE RESTRICT
--   - review_status included (requirement 9 — useful): drives translation
--     admin review queue alongside is_machine_translated
--   - description on translation_keys (not translation_values) — describes
--     the key's purpose/context for translators
--   - No deleted_at — is_active = false is sufficient for obsolete entries
--   - translated_contents (user-generated content translation) deferred
-- =============================================================================
