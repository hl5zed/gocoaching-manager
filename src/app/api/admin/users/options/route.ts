import { NextResponse } from "next/server";
import {
  getAdminChurches,
  getAdminGroups,
  getAdminRegions,
  getAdminOrganizations,
} from "@/lib/api/admin/users";
import { getAdminCountries } from "@/lib/api/admin/countries";
import { getActiveGlobalGenerationOptions } from "@/lib/api/admin/generations";
import { resolveAdminProfileScope, type AdminProfileScopeFilter } from "@/lib/auth/admin-scope";
import { requireAdminProfile } from "@/lib/auth/require-admin-profile";
import { createApiPerformanceLogger } from "@/lib/performance";


const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
};

const OPTIONS_CACHE_TTL_MS = 3 * 60 * 1000;

type AdminUsersOptionsPayload = {
  options: {
    countries: unknown[];
    regions: unknown[];
    organizations: unknown[];
    churches: unknown[];
    groups: unknown[];
    generations: Array<{
      generation_number: number;
      label: string;
    }>;
  };
  optionErrors: {
    countries: string | null;
    regions: string | null;
    organizations: string | null;
    churches: string | null;
    groups: string | null;
  };
};

type AdminUsersOptionsCacheEntry = {
  expiresAt: number;
  value: AdminUsersOptionsPayload;
};

const optionsCache = new Map<string, AdminUsersOptionsCacheEntry>();

function markOptionsResult<T>(
  promise: Promise<T>,
  mark: (result: T) => void,
) {
  return promise.then((result) => {
    mark(result);
    return result;
  });
}

function countOptionsPayload(payload: AdminUsersOptionsPayload) {
  return (
    payload.options.countries.length +
    payload.options.regions.length +
    payload.options.organizations.length +
    payload.options.churches.length +
    payload.options.groups.length +
    payload.options.generations.length
  );
}

function hasOptionErrors(payload: AdminUsersOptionsPayload) {
  return Object.values(payload.optionErrors).some(Boolean);
}

function getStringProp(item: unknown, key: string) {
  if (!item || typeof item !== "object") {
    return null;
  }

  const value = (item as Record<string, unknown>)[key];

  return typeof value === "string" && value.length > 0 ? value : null;
}

function getScopedConditions(scope: AdminProfileScopeFilter) {
  if (scope.kind !== "scoped") {
    return [];
  }

  return scope.orFilter
    .split(",")
    .map((condition) => {
      const match = condition.match(
        /^(country_id|region_id|organization_id|church_id|group_id|cohort_id)\.eq\.([0-9a-f-]+)$/i,
      );

      return match
        ? {
            column: match[1],
            value: match[2],
          }
        : null;
    })
    .filter(
      (condition): condition is { column: string; value: string } =>
        condition !== null,
    );
}

function filterOptionsByScope(
  payload: AdminUsersOptionsPayload,
  scope: AdminProfileScopeFilter,
): AdminUsersOptionsPayload {
  if (scope.kind === "global") {
    return payload;
  }

  if (scope.kind === "none") {
    return {
      ...payload,
      options: {
        ...payload.options,
        countries: [],
        regions: [],
        organizations: [],
        churches: [],
        groups: [],
      },
    };
  }

  const organizations = payload.options.organizations;
  const churches = payload.options.churches;
  const groups = payload.options.groups;
  const regions = payload.options.regions;
  const countries = payload.options.countries;
  const orgById = new Map(
    organizations
      .map((organization) => [getStringProp(organization, "id"), organization] as const)
      .filter((entry): entry is readonly [string, unknown] => entry[0] !== null),
  );
  const churchById = new Map(
    churches
      .map((church) => [getStringProp(church, "id"), church] as const)
      .filter((entry): entry is readonly [string, unknown] => entry[0] !== null),
  );
  const groupById = new Map(
    groups
      .map((group) => [getStringProp(group, "id"), group] as const)
      .filter((entry): entry is readonly [string, unknown] => entry[0] !== null),
  );
  const visibleCountryIds = new Set<string>();
  const visibleRegionIds = new Set<string>();
  const visibleOrganizationIds = new Set<string>();
  const visibleChurchIds = new Set<string>();
  const visibleGroupIds = new Set<string>();

  function addOrganization(organizationId: string | null) {
    if (!organizationId) {
      return;
    }

    visibleOrganizationIds.add(organizationId);
    const countryId = getStringProp(orgById.get(organizationId), "country_id");

    if (countryId) {
      visibleCountryIds.add(countryId);
    }
  }

  function addChurch(churchId: string | null) {
    if (!churchId) {
      return;
    }

    visibleChurchIds.add(churchId);
    addOrganization(getStringProp(churchById.get(churchId), "organization_id"));
  }

  function addGroup(groupId: string | null) {
    if (!groupId) {
      return;
    }

    visibleGroupIds.add(groupId);
    addChurch(getStringProp(groupById.get(groupId), "church_id"));
  }

  for (const condition of getScopedConditions(scope)) {
    if (condition.column === "country_id") {
      visibleCountryIds.add(condition.value);

      for (const organization of organizations) {
        if (getStringProp(organization, "country_id") === condition.value) {
          addOrganization(getStringProp(organization, "id"));
        }
      }

      for (const region of regions) {
        if (getStringProp(region, "country_id") === condition.value) {
          visibleRegionIds.add(getStringProp(region, "id") ?? "");
        }
      }
    }

    if (condition.column === "region_id") {
      visibleRegionIds.add(condition.value);
      const region = regions.find(
        (item) => getStringProp(item, "id") === condition.value,
      );
      const countryId = getStringProp(region, "country_id");

      if (countryId) {
        visibleCountryIds.add(countryId);
      }
    }

    if (condition.column === "organization_id") {
      addOrganization(condition.value);
    }

    if (condition.column === "church_id") {
      addChurch(condition.value);
    }

    if (condition.column === "group_id") {
      addGroup(condition.value);
    }
  }

  for (const church of churches) {
    const churchId = getStringProp(church, "id");
    const organizationId = getStringProp(church, "organization_id");

    if (organizationId && visibleOrganizationIds.has(organizationId)) {
      addChurch(churchId);
    }
  }

  for (const group of groups) {
    const groupId = getStringProp(group, "id");
    const churchId = getStringProp(group, "church_id");

    if (churchId && visibleChurchIds.has(churchId)) {
      addGroup(groupId);
    }
  }

  return {
    ...payload,
    options: {
      ...payload.options,
      countries: countries.filter((country) =>
        visibleCountryIds.has(getStringProp(country, "id") ?? ""),
      ),
      regions: regions.filter((region) =>
        visibleRegionIds.has(getStringProp(region, "id") ?? ""),
      ),
      organizations: organizations.filter((organization) =>
        visibleOrganizationIds.has(getStringProp(organization, "id") ?? ""),
      ),
      churches: churches.filter((church) =>
        visibleChurchIds.has(getStringProp(church, "id") ?? ""),
      ),
      groups: groups.filter((group) =>
        visibleGroupIds.has(getStringProp(group, "id") ?? ""),
      ),
    },
  };
}

export async function GET() {
  const perf = createApiPerformanceLogger("/api/admin/users/options");
  const admin = await requireAdminProfile();

  if (!admin.ok) {
    perf.mark("auth.permissions_query");
    return NextResponse.json(
      { error: "관리자 권한이 필요합니다." },
      { status: admin.status, headers: NO_STORE_HEADERS },
    );
  }
  perf.mark("auth.permissions_query", admin.roles.length);

  const scope = await resolveAdminProfileScope(
    admin.supabase,
    admin.profile.id,
    admin.roles,
  );
  const cacheKey =
    scope.kind === "scoped" ? `scoped:${scope.orFilter}` : scope.kind;

  const cachedOptions = optionsCache.get(cacheKey);

  if (cachedOptions && cachedOptions.expiresAt > Date.now()) {
    const resultCount = countOptionsPayload(cachedOptions.value);
    perf.mark("options.cache_hit", resultCount);
    perf.mark("options.complete", resultCount);

    return NextResponse.json(cachedOptions.value, {
      headers: NO_STORE_HEADERS,
    });
  }

  const [
    countriesResult,
    regionsResult,
    organizationsResult,
    churchesResult,
    groupsResult,
    generationOptions,
  ] = await Promise.all([
    markOptionsResult(getAdminCountries(), (result) => {
      perf.mark("options.countries_query", result.countries.length);
    }),
    markOptionsResult(getAdminRegions(), (result) => {
      perf.mark("options.regions_query", result.regions.length);
    }),
    markOptionsResult(getAdminOrganizations(), (result) => {
      perf.mark("options.organizations_query", result.organizations.length);
    }),
    markOptionsResult(getAdminChurches(), (result) => {
      perf.mark("options.churches_query", result.churches.length);
    }),
    markOptionsResult(getAdminGroups(), (result) => {
      perf.mark("options.groups_query", result.groups.length);
    }),
    markOptionsResult(getActiveGlobalGenerationOptions(), (result) => {
      perf.mark("options.generations_query", result.length);
    }),
  ]);

  const rawPayload: AdminUsersOptionsPayload = {
    options: {
      countries: countriesResult.countries.filter((country) => country.is_active),
      regions: regionsResult.regions,
      organizations: organizationsResult.organizations,
      churches: churchesResult.churches,
      groups: groupsResult.groups,
      generations:
        generationOptions.length > 0
          ? generationOptions.map((generation) => ({
              generation_number: generation.generation_number,
              label: generation.label || `${generation.generation_number}세대`,
            }))
          : [],
    },
    optionErrors: {
      countries: countriesResult.error,
      regions: regionsResult.error,
      organizations: organizationsResult.error,
      churches: churchesResult.error,
      groups: groupsResult.error,
    },
  };
  const payload = filterOptionsByScope(rawPayload, scope);

  const resultCount = countOptionsPayload(payload);
  perf.mark("options.complete", resultCount);

  if (!hasOptionErrors(payload)) {
    // 국가/지역/기관/교회/그룹/세대 변경 직후 최대 3분 반영 지연 가능.
    optionsCache.set(cacheKey, {
      expiresAt: Date.now() + OPTIONS_CACHE_TTL_MS,
      value: payload,
    });
  }

  return NextResponse.json(payload, { headers: NO_STORE_HEADERS });
}
