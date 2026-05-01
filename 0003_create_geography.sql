-- =============================================================================
-- Migration: 0003_create_geography.sql
-- Project:   GOThriveCoaching
-- Purpose:   Create the six global-structure / geography tables that form the
--            organisational hierarchy of the platform.
--
-- Creation order (each table FKs only to tables already created):
--
--   supported_languages  ← exists from 0002
--         ↓
--   countries
--         ↓
--   regions              ← FK → countries
--         ↓
--   organizations        ← FK → countries, regions, supported_languages
--         ↓
--   churches             ← FK → organizations, countries, regions
--         ↓
--   groups               ← FK → churches, organizations
--         ↓
--   cohorts              ← FK → groups, churches, organizations
--
-- Design notes:
--   - UUID primary keys throughout. Geography records are referenced by
--     coaching_relationships, user_roles, invitations, stats_snapshots, and
--     profiles. UUIDs prevent collision in multi-environment merges and are
--     consistent with Supabase conventions.
--   - default_language references supported_languages(code) per the confirmed
--     project rule. Nullable: lower-level structures inherit from parent.
--   - default_timezone stored as text (IANA timezone name, e.g. 'Asia/Seoul').
--     Nullable for the same inheritance reason.
--   - Soft delete (deleted_at) on all six tables. These records anchor
--     coaching relationships, roles, and snapshots; permanent deletion would
--     orphan historical data.
--   - All timestamps stored in UTC (timestamptz).
--   - updated_at maintained by the reusable set_updated_at() trigger from 0002.
-- =============================================================================


-- =============================================================================
-- TABLE: countries
-- Top-level geography node. Anchors regions, organizations, and profiles.
-- =============================================================================
CREATE TABLE countries (
  id                uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text         NOT NULL CHECK (length(trim(name)) > 0),
  code              text         NOT NULL,          -- ISO 3166-1 alpha-2, e.g. KR, TH, US
  default_language  text         REFERENCES supported_languages(code) ON UPDATE CASCADE ON DELETE SET NULL,
  default_timezone  text,                           -- IANA timezone name, e.g. 'Asia/Seoul'
  is_active         boolean      NOT NULL DEFAULT true,
  created_at        timestamptz  NOT NULL DEFAULT now(),
  updated_at        timestamptz  NOT NULL DEFAULT now(),
  deleted_at        timestamptz
);

COMMENT ON TABLE countries IS
  'Top-level geography node. Every region, organisation, and church ultimately '
  'belongs to a country. Soft-deleted rows are excluded from normal views but '
  'preserved for historical analytics and lineage tracking.';

COMMENT ON COLUMN countries.code IS
  'ISO 3166-1 alpha-2 country code (e.g. KR, TH, US). Unique across the table.';

COMMENT ON COLUMN countries.default_language IS
  'Fallback language for all structures under this country when no closer '
  'default_language is set. References supported_languages(code).';

COMMENT ON COLUMN countries.default_timezone IS
  'IANA timezone name used as fallback for all structures under this country '
  '(e.g. Asia/Seoul, Asia/Bangkok, UTC).';

-- Unique constraint: country code must be globally unique
ALTER TABLE countries
  ADD CONSTRAINT uq_countries_code UNIQUE (code);

-- Indexes
CREATE INDEX idx_countries_is_active
  ON countries (is_active)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_countries_deleted_at
  ON countries (deleted_at);

-- Trigger
CREATE TRIGGER trg_countries_set_updated_at
  BEFORE UPDATE ON countries
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =============================================================================
-- TABLE: regions
-- Optional mid-tier between country and organisation.
-- A region always belongs to one country.
-- =============================================================================
CREATE TABLE regions (
  id                uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id        uuid         NOT NULL REFERENCES countries(id) ON DELETE RESTRICT,
  name              text         NOT NULL CHECK (length(trim(name)) > 0),
  code              text         NOT NULL,          -- Internal region code, scoped within country
  default_language  text         REFERENCES supported_languages(code) ON UPDATE CASCADE ON DELETE SET NULL,
  default_timezone  text,
  is_active         boolean      NOT NULL DEFAULT true,
  created_at        timestamptz  NOT NULL DEFAULT now(),
  updated_at        timestamptz  NOT NULL DEFAULT now(),
  deleted_at        timestamptz
);

COMMENT ON TABLE regions IS
  'Optional mid-tier geography node between country and organisation. '
  'Not all organisations require a region. Soft-deleted rows are preserved '
  'for historical scoping of analytics and user roles.';

COMMENT ON COLUMN regions.code IS
  'Internal region code, unique within a country (e.g. NORTH, CENTRAL, SEA-TH). '
  'Not an international standard; defined by platform administrators.';

COMMENT ON COLUMN regions.country_id IS
  'The country this region belongs to. Cannot be null; every region has a country.';

-- Unique constraint: region code is unique within a country
ALTER TABLE regions
  ADD CONSTRAINT uq_regions_code_country UNIQUE (code, country_id);

-- Indexes
CREATE INDEX idx_regions_country_id
  ON regions (country_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_regions_deleted_at
  ON regions (deleted_at);

-- Trigger
CREATE TRIGGER trg_regions_set_updated_at
  BEFORE UPDATE ON regions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =============================================================================
-- TABLE: organizations
-- Denomination, mission body, church network, or local ministry.
-- Belongs to a country; optionally scoped to a region.
-- =============================================================================
CREATE TABLE organizations (
  id                  uuid                    PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id          uuid                    NOT NULL REFERENCES countries(id)  ON DELETE RESTRICT,
  region_id           uuid                    REFERENCES regions(id)             ON DELETE SET NULL,
  name                text                    NOT NULL CHECK (length(trim(name)) > 0),
  organization_type   organization_type_enum  NOT NULL,
  default_language    text                    REFERENCES supported_languages(code) ON UPDATE CASCADE ON DELETE SET NULL,
  default_timezone    text,
  is_active           boolean                 NOT NULL DEFAULT true,
  created_at          timestamptz             NOT NULL DEFAULT now(),
  updated_at          timestamptz             NOT NULL DEFAULT now(),
  deleted_at          timestamptz
);

COMMENT ON TABLE organizations IS
  'Denomination, mission body, church network, or local ministry. '
  'Sits below country/region and above churches. A single country may have '
  'multiple organisations of different types.';

COMMENT ON COLUMN organizations.region_id IS
  'Optional. An organisation may belong directly to a country without '
  'an intermediate region.';

COMMENT ON COLUMN organizations.organization_type IS
  'Fixed enum value from organization_type_enum: denomination, mission_body, '
  'church_network, local_ministry, nonprofit, other.';

-- Indexes
CREATE INDEX idx_organizations_country_id
  ON organizations (country_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_organizations_region_id
  ON organizations (region_id)
  WHERE deleted_at IS NULL AND region_id IS NOT NULL;

CREATE INDEX idx_organizations_type
  ON organizations (organization_type)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_organizations_deleted_at
  ON organizations (deleted_at);

-- Trigger
CREATE TRIGGER trg_organizations_set_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =============================================================================
-- TABLE: churches
-- Local church, group, or ministry team that belongs to an organisation.
-- May also carry direct country/region references for scoped analytics.
-- =============================================================================
CREATE TABLE churches (
  id                uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid         NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  country_id        uuid         NOT NULL REFERENCES countries(id)     ON DELETE RESTRICT,
  region_id         uuid         REFERENCES regions(id)               ON DELETE SET NULL,
  name              text         NOT NULL CHECK (length(trim(name)) > 0),
  default_language  text         REFERENCES supported_languages(code) ON UPDATE CASCADE ON DELETE SET NULL,
  default_timezone  text,
  is_active         boolean      NOT NULL DEFAULT true,
  created_at        timestamptz  NOT NULL DEFAULT now(),
  updated_at        timestamptz  NOT NULL DEFAULT now(),
  deleted_at        timestamptz
);

COMMENT ON TABLE churches IS
  'Local church, congregation, or ministry team under an organisation. '
  'Carries direct country_id and region_id for efficient scoped analytics '
  'without requiring a join through organisations.';

COMMENT ON COLUMN churches.country_id IS
  'Denormalised from the parent organisation for fast country-scoped queries. '
  'Must be consistent with organization.country_id.';

COMMENT ON COLUMN churches.region_id IS
  'Optional. May be null if the church does not belong to a named region.';

-- Indexes
CREATE INDEX idx_churches_organization_id
  ON churches (organization_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_churches_country_id
  ON churches (country_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_churches_region_id
  ON churches (region_id)
  WHERE deleted_at IS NULL AND region_id IS NOT NULL;

CREATE INDEX idx_churches_deleted_at
  ON churches (deleted_at);

-- Trigger
CREATE TRIGGER trg_churches_set_updated_at
  BEFORE UPDATE ON churches
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =============================================================================
-- TABLE: groups
-- Small group, ministry team, or training group within a church or organisation.
-- Either church_id or organization_id must be set; both may be set.
-- =============================================================================
CREATE TABLE groups (
  id                uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id         uuid            REFERENCES churches(id)      ON DELETE RESTRICT,
  organization_id   uuid            REFERENCES organizations(id) ON DELETE RESTRICT,
  name              text            NOT NULL CHECK (length(trim(name)) > 0),
  group_type        group_type_enum NOT NULL,
  default_language  text            REFERENCES supported_languages(code) ON UPDATE CASCADE ON DELETE SET NULL,
  default_timezone  text,
  is_active         boolean         NOT NULL DEFAULT true,
  created_at        timestamptz     NOT NULL DEFAULT now(),
  updated_at        timestamptz     NOT NULL DEFAULT now(),
  deleted_at        timestamptz,

  -- A group must belong to at least one parent scope
  CONSTRAINT chk_groups_has_parent
    CHECK (church_id IS NOT NULL OR organization_id IS NOT NULL)
);

COMMENT ON TABLE groups IS
  'Small group, ministry team, cohort group, or training group. '
  'Must belong to at least one of: a church or an organisation. '
  'May belong to both when a church group is also tracked at org level.';

COMMENT ON COLUMN groups.group_type IS
  'Fixed enum value from group_type_enum: ministry_team, small_group, '
  'cohort_group, training_group, regional_group, other.';

COMMENT ON CONSTRAINT chk_groups_has_parent ON groups IS
  'Ensures every group is anchored to at least a church or an organisation. '
  'Prevents orphaned groups that cannot be scoped in analytics or RLS.';

-- Indexes
CREATE INDEX idx_groups_church_id
  ON groups (church_id)
  WHERE deleted_at IS NULL AND church_id IS NOT NULL;

CREATE INDEX idx_groups_organization_id
  ON groups (organization_id)
  WHERE deleted_at IS NULL AND organization_id IS NOT NULL;

CREATE INDEX idx_groups_type
  ON groups (group_type)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_groups_deleted_at
  ON groups (deleted_at);

-- Trigger
CREATE TRIGGER trg_groups_set_updated_at
  BEFORE UPDATE ON groups
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =============================================================================
-- TABLE: cohorts
-- A named cohort or generation within a group, church, or organisation.
-- Typically represents one intake year of a coaching programme.
-- =============================================================================
CREATE TABLE cohorts (
  id                uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id          uuid         REFERENCES groups(id)        ON DELETE RESTRICT,
  church_id         uuid         REFERENCES churches(id)      ON DELETE RESTRICT,
  organization_id   uuid         REFERENCES organizations(id) ON DELETE RESTRICT,
  name              text         NOT NULL CHECK (length(trim(name)) > 0),
  cohort_year       smallint,                    -- Calendar year, e.g. 2024. Nullable for rolling cohorts.
  cohort_label      text         CHECK (cohort_label IS NULL OR length(trim(cohort_label)) > 0),
  default_language  text         REFERENCES supported_languages(code) ON UPDATE CASCADE ON DELETE SET NULL,
  default_timezone  text,
  is_active         boolean      NOT NULL DEFAULT true,
  created_at        timestamptz  NOT NULL DEFAULT now(),
  updated_at        timestamptz  NOT NULL DEFAULT now(),
  deleted_at        timestamptz,

  -- A cohort must belong to at least one parent scope
  CONSTRAINT chk_cohorts_has_parent
    CHECK (group_id IS NOT NULL OR church_id IS NOT NULL OR organization_id IS NOT NULL)
);

COMMENT ON TABLE cohorts IS
  'A named intake cohort or coaching generation within a group, church, or '
  'organisation. Represents one class or programme year. Must be anchored to '
  'at least one parent scope for RLS and analytics.';

COMMENT ON COLUMN cohorts.cohort_year IS
  'Calendar year of the cohort (e.g. 2024). Stored as smallint. '
  'Nullable for rolling or non-year-based cohorts.';

COMMENT ON COLUMN cohorts.cohort_label IS
  'Human-readable cohort label for display. Examples: Spring 2024, 1기, Batch A. '
  'May be set independently of cohort_year.';

COMMENT ON CONSTRAINT chk_cohorts_has_parent ON cohorts IS
  'Ensures every cohort is anchored to at least a group, church, or organisation. '
  'Prevents orphaned cohorts that cannot be scoped in analytics or RLS.';

-- Indexes
CREATE INDEX idx_cohorts_group_id
  ON cohorts (group_id)
  WHERE deleted_at IS NULL AND group_id IS NOT NULL;

CREATE INDEX idx_cohorts_church_id
  ON cohorts (church_id)
  WHERE deleted_at IS NULL AND church_id IS NOT NULL;

CREATE INDEX idx_cohorts_organization_id
  ON cohorts (organization_id)
  WHERE deleted_at IS NULL AND organization_id IS NOT NULL;

CREATE INDEX idx_cohorts_year
  ON cohorts (cohort_year)
  WHERE deleted_at IS NULL AND cohort_year IS NOT NULL;

CREATE INDEX idx_cohorts_deleted_at
  ON cohorts (deleted_at);

-- Trigger
CREATE TRIGGER trg_cohorts_set_updated_at
  BEFORE UPDATE ON cohorts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =============================================================================
-- HIERARCHY CONSISTENCY TRIGGERS
-- Purpose:
--   Enforce cross-table parent-child consistency that CHECK constraints cannot
--   enforce (CHECK constraints only see the current row; these rules require
--   looking up parent records in other tables).
--
-- Strategy:
--   Rule A — churches.country_id must equal organizations.country_id  → EXCEPTION
--   Rule B — churches.region_id should equal organizations.region_id
--             when both are not null                                   → WARNING
--   Rule C — groups.organization_id must equal churches.organization_id
--             when group.church_id is not null                        → EXCEPTION
--   Rule D — cohorts: if group_id and church_id are both set, the
--             group's church_id must match the cohort's church_id;
--             if group_id and organization_id are both set, the group's
--             organization_id must match the cohort's organization_id  → EXCEPTION
--
-- Rule B uses RAISE WARNING (not EXCEPTION) because region is optional and
-- inheritable. An organisation can span regions; a church may be legitimately
-- assigned to a different sub-region. The warning surfaces the mismatch
-- without blocking the operation.
--
-- All trigger functions are BEFORE INSERT OR UPDATE so the check runs inside
-- the same transaction and rolls back cleanly on EXCEPTION.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- TRIGGER FUNCTION: check_church_hierarchy_consistency
-- Rules A and B: validate churches against their parent organisation.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_church_hierarchy_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  org_country_id uuid;
  org_region_id  uuid;
BEGIN
  -- Load parent organisation fields
  SELECT country_id, region_id
    INTO org_country_id, org_region_id
    FROM organizations
   WHERE id = NEW.organization_id;

  -- Rule A: country_id must match (hard constraint)
  IF NEW.country_id IS DISTINCT FROM org_country_id THEN
    RAISE EXCEPTION
      'churches.country_id (%) must match organizations.country_id (%) '
      'for organization_id = %',
      NEW.country_id, org_country_id, NEW.organization_id;
  END IF;

  -- Rule B: region_id should match when both are not null (soft warning)
  IF NEW.region_id IS NOT NULL
     AND org_region_id IS NOT NULL
     AND NEW.region_id IS DISTINCT FROM org_region_id THEN
    RAISE WARNING
      'churches.region_id (%) does not match organizations.region_id (%) '
      'for organization_id = %. Verify this is intentional.',
      NEW.region_id, org_region_id, NEW.organization_id;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION check_church_hierarchy_consistency() IS
  'BEFORE INSERT OR UPDATE trigger on churches. '
  'Rule A: raises EXCEPTION if churches.country_id != organizations.country_id. '
  'Rule B: raises WARNING if both churches.region_id and organizations.region_id '
  'are set but differ (soft check — does not block).';

CREATE TRIGGER trg_churches_hierarchy_consistency
  BEFORE INSERT OR UPDATE ON churches
  FOR EACH ROW EXECUTE FUNCTION check_church_hierarchy_consistency();


-- -----------------------------------------------------------------------------
-- TRIGGER FUNCTION: check_group_hierarchy_consistency
-- Rule C: when a group has a church_id, its organization_id must match
-- the church's organization_id.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_group_hierarchy_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  church_org_id uuid;
BEGIN
  -- Only applies when both church_id and organization_id are set
  IF NEW.church_id IS NOT NULL AND NEW.organization_id IS NOT NULL THEN

    SELECT organization_id
      INTO church_org_id
      FROM churches
     WHERE id = NEW.church_id;

    IF NEW.organization_id IS DISTINCT FROM church_org_id THEN
      RAISE EXCEPTION
        'groups.organization_id (%) must match churches.organization_id (%) '
        'for church_id = %',
        NEW.organization_id, church_org_id, NEW.church_id;
    END IF;

  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION check_group_hierarchy_consistency() IS
  'BEFORE INSERT OR UPDATE trigger on groups. '
  'Rule C: when both church_id and organization_id are set, raises EXCEPTION '
  'if groups.organization_id != churches.organization_id.';

CREATE TRIGGER trg_groups_hierarchy_consistency
  BEFORE INSERT OR UPDATE ON groups
  FOR EACH ROW EXECUTE FUNCTION check_group_hierarchy_consistency();


-- -----------------------------------------------------------------------------
-- TRIGGER FUNCTION: check_cohort_hierarchy_consistency
-- Rule D: cohort parent references must be consistent with group/church/org
-- hierarchy.
--   D1: if cohort has group_id and church_id, group.church_id must match.
--   D2: if cohort has group_id and organization_id, group.organization_id
--       must match.
--   D3: if cohort has church_id and organization_id, church.organization_id
--       must match.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_cohort_hierarchy_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  grp_church_id   uuid;
  grp_org_id      uuid;
  church_org_id   uuid;
BEGIN
  -- D1 + D2: validate against parent group when group_id is set
  IF NEW.group_id IS NOT NULL THEN

    SELECT church_id, organization_id
      INTO grp_church_id, grp_org_id
      FROM groups
     WHERE id = NEW.group_id;

    -- D1: cohort's church_id must match group's church_id
    IF NEW.church_id IS NOT NULL
       AND grp_church_id IS NOT NULL
       AND NEW.church_id IS DISTINCT FROM grp_church_id THEN
      RAISE EXCEPTION
        'cohorts.church_id (%) must match groups.church_id (%) '
        'for group_id = %',
        NEW.church_id, grp_church_id, NEW.group_id;
    END IF;

    -- D2: cohort's organization_id must match group's organization_id
    IF NEW.organization_id IS NOT NULL
       AND grp_org_id IS NOT NULL
       AND NEW.organization_id IS DISTINCT FROM grp_org_id THEN
      RAISE EXCEPTION
        'cohorts.organization_id (%) must match groups.organization_id (%) '
        'for group_id = %',
        NEW.organization_id, grp_org_id, NEW.group_id;
    END IF;

  END IF;

  -- D3: validate church against organization when both are set directly
  IF NEW.church_id IS NOT NULL AND NEW.organization_id IS NOT NULL THEN

    SELECT organization_id
      INTO church_org_id
      FROM churches
     WHERE id = NEW.church_id;

    IF NEW.organization_id IS DISTINCT FROM church_org_id THEN
      RAISE EXCEPTION
        'cohorts.organization_id (%) must match churches.organization_id (%) '
        'for church_id = %',
        NEW.organization_id, church_org_id, NEW.church_id;
    END IF;

  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION check_cohort_hierarchy_consistency() IS
  'BEFORE INSERT OR UPDATE trigger on cohorts. '
  'Rule D1: cohort.church_id must match group.church_id when both set. '
  'Rule D2: cohort.organization_id must match group.organization_id when both set. '
  'Rule D3: cohort.organization_id must match church.organization_id when both set.';

CREATE TRIGGER trg_cohorts_hierarchy_consistency
  BEFORE INSERT OR UPDATE ON cohorts
  FOR EACH ROW EXECUTE FUNCTION check_cohort_hierarchy_consistency();


-- =============================================================================
-- End of 0003_create_geography.sql
--
-- Tables created (6):
--   countries       — top-level geography node
--   regions         — optional mid-tier, scoped within a country
--   organizations   — denomination, mission body, church network, ministry
--   churches        — local church or congregation under an organisation
--   groups          — small group or ministry team within a church/org
--   cohorts         — intake cohort or coaching generation within a group/church/org
--
-- All tables:
--   - UUID primary keys (requires pgcrypto from 0000_create_extensions.sql)
--   - name columns: CHECK (length(trim(name)) > 0) — blank names rejected
--   - cohort_label: CHECK allows NULL, rejects blank strings
--   - default_language → supported_languages(code)
--   - default_timezone as IANA text
--   - soft delete via deleted_at
--   - updated_at via set_updated_at() trigger from 0002
--   - FK indexes on all join columns
--
-- Hierarchy consistency triggers (BEFORE INSERT OR UPDATE):
--   trg_churches_hierarchy_consistency  — Rules A (EXCEPTION) and B (WARNING)
--   trg_groups_hierarchy_consistency    — Rule C (EXCEPTION)
--   trg_cohorts_hierarchy_consistency   — Rules D1, D2, D3 (EXCEPTION)
-- =============================================================================

