import "server-only";

import {
  ORGANIZATION_TYPES,
  type OrganizationType,
} from "@/types/database";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export type AdminOrganizationCountryOption = {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
};

export type AdminOrganizationSummary = {
  id: string;
  country_id: string;
  country_name: string;
  country_code: string;
  organization_type: OrganizationType;
  organization_type_label: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type RawCountryRow = {
  id: string;
  name: string;
  code: string | null;
  is_active: boolean | null;
};

type RawOrganizationRow = {
  id: string;
  country_id: string;
  organization_type: OrganizationType;
  name: string;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type GetAdminOrganizationsOptions = {
  activeOnly?: boolean;
};

export const ORGANIZATION_TYPE_LABELS: Record<OrganizationType, string> = {
  denomination: "교단/교파",
  mission_body: "선교단체",
  church_network: "교회 네트워크/노회",
  local_ministry: "지역 사역",
  nonprofit: "비영리단체",
  other: "기타",
};

export function getOrganizationTypeLabel(value: string | null | undefined) {
  if (!value || !isOrganizationType(value)) {
    return "기타";
  }

  return ORGANIZATION_TYPE_LABELS[value];
}

export function isOrganizationType(value: string): value is OrganizationType {
  return ORGANIZATION_TYPES.includes(value as OrganizationType);
}

export async function getAdminOrganizations(
  options: GetAdminOrganizationsOptions = {},
) {
  const { client, error: clientError } = createSupabaseServiceClient();

  if (!client) {
    return {
      countries: [] as AdminOrganizationCountryOption[],
      error:
        clientError ?? "기관 및 단체 관리를 위한 서버 설정이 준비되지 않았습니다.",
      organizations: [] as AdminOrganizationSummary[],
    };
  }

  const { data: countriesData, error: countriesError } = await client
    .from("countries")
    .select("id, name, code, is_active")
    .order("name", { ascending: true });

  if (countriesError) {
    console.error("[ADMIN_ORGANIZATIONS_COUNTRIES_LOOKUP_FAILED]", {
      message: countriesError.message,
      code: countriesError.code,
      details: countriesError.details,
    });

    return {
      countries: [] as AdminOrganizationCountryOption[],
      error: "국가 목록을 불러오지 못했습니다.",
      organizations: [] as AdminOrganizationSummary[],
    };
  }

  let query = client
    .from("organizations")
    .select(
      "id, country_id, organization_type, name, is_active, created_at, updated_at, deleted_at",
    )
    .is("deleted_at", null)
    .order("name", { ascending: true });

  if (options.activeOnly) {
    query = query.eq("is_active", true);
  }

  const { data: organizationsData, error: organizationsError } = await query;

  if (organizationsError) {
    console.error("[ADMIN_ORGANIZATIONS_LOOKUP_FAILED]", {
      message: organizationsError.message,
      code: organizationsError.code,
      details: organizationsError.details,
    });

    return {
      countries: [] as AdminOrganizationCountryOption[],
      error: "기관 및 단체 목록을 불러오지 못했습니다.",
      organizations: [] as AdminOrganizationSummary[],
    };
  }

  const countries = ((countriesData ?? []) as RawCountryRow[]).map(
    (country) => ({
      id: country.id,
      name: country.name,
      code: country.code ?? "",
      is_active: country.is_active !== false,
    }),
  );
  const countryMap = new Map(countries.map((country) => [country.id, country]));

  const organizations = ((organizationsData ?? []) as RawOrganizationRow[]).map(
    (organization) => {
      const country = countryMap.get(organization.country_id);

      return {
        id: organization.id,
        country_id: organization.country_id,
        country_name: country?.name ?? "미지정",
        country_code: country?.code ?? "",
        organization_type: organization.organization_type,
        organization_type_label: getOrganizationTypeLabel(
          organization.organization_type,
        ),
        name: organization.name,
        is_active: organization.is_active !== false,
        created_at: organization.created_at,
        updated_at: organization.updated_at,
        deleted_at: organization.deleted_at,
      };
    },
  );

  return {
    countries,
    error: null,
    organizations,
  };
}
