import { NextResponse } from "next/server";
import {
  getAdminChurches,
  getAdminGroups,
  getAdminRegions,
  getAdminOrganizations,
} from "@/lib/api/admin/users";
import { getAdminCountries } from "@/lib/api/admin/countries";
import { getActiveGlobalGenerationOptions } from "@/lib/api/admin/generations";
import { getSession } from "@/lib/auth/getSession";
import { getVerifiedProfileId } from "@/lib/auth/verified-identity";
import { ADMIN_WRITE_ROLES } from "@/lib/auth/require-admin-profile";
import { hasRole } from "@/lib/auth/has-role";
import { createApiPerformanceLogger } from "@/lib/performance";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/database";


const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
};

const OPTIONS_CACHE_TTL_MS = 3 * 60 * 1000;
const OPTIONS_CACHE_KEY = "global";

type AdminProfileLookupRow = {
  id: string;
};

type AdminRoleLookupRow = {
  role: UserRole;
};

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

async function requireAdminOptionsAccess() {
  const session = await getSession();

  if (!session.user) {
    return {
      ok: false as const,
      status: 401 as const,
      roleCount: 0,
    };
  }

  const supabase = await createSupabaseServerClient();
  const verifiedProfileId = await getVerifiedProfileId();

  const profileQuery = supabase
    .from("profiles")
    .select("id")
    .neq("status", "anonymized")
    .is("deleted_at", null);

  const { data: profile, error: profileError } = verifiedProfileId
    ? await profileQuery.eq("id", verifiedProfileId).maybeSingle()
    : await profileQuery.eq("auth_user_id", session.user.id).maybeSingle();

  if (profileError || !profile) {
    return {
      ok: false as const,
      status: 403 as const,
      roleCount: 0,
    };
  }

  const adminProfile = profile as AdminProfileLookupRow;
  const { data: roles, error: rolesError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("profile_id", adminProfile.id)
    .eq("status", "active")
    .eq("is_active", true)
    .is("deleted_at", null)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

  if (rolesError) {
    return {
      ok: false as const,
      status: 403 as const,
      roleCount: 0,
    };
  }

  const roleValues = ((roles ?? []) as AdminRoleLookupRow[]).map(
    (role) => role.role,
  );

  if (!hasRole(roleValues, ADMIN_WRITE_ROLES)) {
    return {
      ok: false as const,
      status: 403 as const,
      roleCount: roleValues.length,
    };
  }

  return {
    ok: true as const,
    roleCount: roleValues.length,
  };
}

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

export async function GET() {
  const perf = createApiPerformanceLogger("/api/admin/users/options");
  const admin = await requireAdminOptionsAccess();

  if (!admin.ok) {
    perf.mark("auth.permissions_query");
    return NextResponse.json(
      { error: "관리자 권한이 필요합니다." },
      { status: admin.status, headers: NO_STORE_HEADERS },
    );
  }
  perf.mark("auth.permissions_query", admin.roleCount);

  const cachedOptions = optionsCache.get(OPTIONS_CACHE_KEY);

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

  const payload: AdminUsersOptionsPayload = {
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

  const resultCount = countOptionsPayload(payload);
  perf.mark("options.complete", resultCount);

  if (!hasOptionErrors(payload)) {
    // 국가/지역/기관/교회/그룹/세대 변경 직후 최대 3분 반영 지연 가능.
    optionsCache.set(OPTIONS_CACHE_KEY, {
      expiresAt: Date.now() + OPTIONS_CACHE_TTL_MS,
      value: payload,
    });
  }

  return NextResponse.json(payload, { headers: NO_STORE_HEADERS });
}
