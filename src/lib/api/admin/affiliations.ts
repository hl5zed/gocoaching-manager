import "server-only";

import { createSupabaseServiceClient } from "@/lib/supabase/service";

export type AdminAffiliationCountryOption = {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
};

export type AdminAffiliationOrganizationOption = {
  id: string;
  country_id: string;
  name: string;
  is_active: boolean;
};

export type AdminRegionSummary = {
  id: string;
  country_id: string | null;
  name: string;
  created_at: string;
  updated_at: string;
};

export type AdminChurchSummary = {
  id: string;
  organization_id: string | null;
  name: string;
  created_at: string;
  updated_at: string;
};

export type AdminGroupSummary = {
  id: string;
  church_id: string | null;
  name: string;
  created_at: string;
  updated_at: string;
};

type CountryRow = {
  id: string;
  name: string;
  code: string | null;
  is_active: boolean | null;
};

type OrganizationRow = {
  id: string;
  country_id: string;
  name: string;
  is_active: boolean | null;
  deleted_at?: string | null;
};

type RegionRow = {
  id: string;
  country_id: string | null;
  name: string;
  created_at: string;
  updated_at: string;
};

type ChurchRow = {
  id: string;
  organization_id: string | null;
  name: string;
  created_at: string;
  updated_at: string;
};

type GroupRow = {
  id: string;
  church_id: string | null;
  name: string;
  created_at: string;
  updated_at: string;
};

function normalizeErrorMessage(errors: string[]) {
  return errors.length > 0 ? errors.join(" ") : null;
}

export async function getAdminAffiliations() {
  const { client, error: clientError } = createSupabaseServiceClient();

  if (!client) {
    return {
      churches: [] as AdminChurchSummary[],
      countries: [] as AdminAffiliationCountryOption[],
      error:
        clientError ?? "소속 선택값 관리를 위한 서버 설정이 준비되지 않았습니다.",
      groups: [] as AdminGroupSummary[],
      organizations: [] as AdminAffiliationOrganizationOption[],
      regions: [] as AdminRegionSummary[],
    };
  }

  const [
    countriesResult,
    organizationsResult,
    regionsResult,
    churchesResult,
    groupsResult,
  ] = await Promise.all([
    client
      .from("countries")
      .select("id, name, code, is_active")
      .order("name", { ascending: true }),
    client
      .from("organizations")
      .select("id, country_id, name, is_active, deleted_at")
      .is("deleted_at", null)
      .order("name", { ascending: true }),
    client
      .from("regions")
      .select("id, country_id, name, created_at, updated_at")
      .order("name", { ascending: true }),
    client
      .from("churches")
      .select("id, organization_id, name, created_at, updated_at")
      .order("name", { ascending: true }),
    client
      .from("groups")
      .select("id, church_id, name, created_at, updated_at")
      .order("name", { ascending: true }),
  ]);

  const errors: string[] = [];

  if (countriesResult.error) {
    console.error("[ADMIN_AFFILIATIONS_COUNTRIES_LOOKUP_FAILED]", {
      code: countriesResult.error.code,
      details: countriesResult.error.details,
      message: countriesResult.error.message,
    });
    errors.push("국가 목록을 불러오지 못했습니다.");
  }

  if (organizationsResult.error) {
    console.error("[ADMIN_AFFILIATIONS_ORGANIZATIONS_LOOKUP_FAILED]", {
      code: organizationsResult.error.code,
      details: organizationsResult.error.details,
      message: organizationsResult.error.message,
    });
    errors.push("소속 기관/교회 목록을 불러오지 못했습니다.");
  }

  if (regionsResult.error) {
    console.error("[ADMIN_AFFILIATIONS_REGIONS_LOOKUP_FAILED]", {
      code: regionsResult.error.code,
      details: regionsResult.error.details,
      message: regionsResult.error.message,
    });
    errors.push("지역/도시 목록을 불러오지 못했습니다.");
  }

  if (churchesResult.error) {
    console.error("[ADMIN_AFFILIATIONS_CHURCHES_LOOKUP_FAILED]", {
      code: churchesResult.error.code,
      details: churchesResult.error.details,
      message: churchesResult.error.message,
    });
    errors.push("세부 교회 목록을 불러오지 못했습니다.");
  }

  if (groupsResult.error) {
    console.error("[ADMIN_AFFILIATIONS_GROUPS_LOOKUP_FAILED]", {
      code: groupsResult.error.code,
      details: groupsResult.error.details,
      message: groupsResult.error.message,
    });
    errors.push("그룹/팀/목장 목록을 불러오지 못했습니다.");
  }

  const countries = ((countriesResult.data ?? []) as CountryRow[]).map(
    (country) => ({
      id: country.id,
      name: country.name,
      code: country.code ?? "",
      is_active: country.is_active !== false,
    }),
  );

  const organizations = ((organizationsResult.data ?? []) as OrganizationRow[])
    .filter((organization) => organization.deleted_at == null)
    .map((organization) => ({
      id: organization.id,
      country_id: organization.country_id,
      name: organization.name,
      is_active: organization.is_active !== false,
    }));

  return {
    churches: ((churchesResult.data ?? []) as ChurchRow[]).map((church) => ({
      id: church.id,
      organization_id: church.organization_id ?? null,
      name: church.name,
      created_at: church.created_at,
      updated_at: church.updated_at,
    })),
    countries,
    error: normalizeErrorMessage(errors),
    groups: ((groupsResult.data ?? []) as GroupRow[]).map((group) => ({
      id: group.id,
      church_id: group.church_id ?? null,
      name: group.name,
      created_at: group.created_at,
      updated_at: group.updated_at,
    })),
    organizations,
    regions: ((regionsResult.data ?? []) as RegionRow[]).map((region) => ({
      id: region.id,
      country_id: region.country_id ?? null,
      name: region.name,
      created_at: region.created_at,
      updated_at: region.updated_at,
    })),
  };
}
