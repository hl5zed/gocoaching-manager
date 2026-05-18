import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/getSession";
import type { ProfileRow, ScopeType, UserRole } from "@/types/database";

export type MyProfileRole = {
  role: UserRole;
  scope_type: ScopeType;
  scope_id: string | null;
  status: "active";
  assigned_at: string;
};

export type MyProfileData = {
  authEmail: string | null;
  profile:
    | Pick<
        ProfileRow,
        | "id"
        | "email"
        | "full_name"
        | "display_name"
        | "phone"
        | "primary_role"
        | "country_id"
        | "organization_id"
        | "church_id"
        | "ministry_position"
        | "timezone"
        | "generation_number"
        | "status"
        | "created_at"
        | "updated_at"
      > & {
        church_name: string | null;
        country_code: string | null;
        country_name: string | null;
        organization_name: string | null;
      }
    | null;
  roles: MyProfileRole[];
};

export type MyProfileResult =
  | {
      ok: true;
      data: MyProfileData;
    }
  | {
      ok: false;
      error: {
        code: "UNAUTHORIZED" | "PROFILE_FETCH_FAILED";
        message: string;
      };
    };

type ProfileRecord = Pick<
  ProfileRow,
  | "id"
  | "email"
  | "full_name"
  | "display_name"
  | "phone"
  | "primary_role"
  | "country_id"
  | "organization_id"
  | "church_id"
  | "ministry_position"
  | "timezone"
  | "generation_number"
  | "status"
  | "created_at"
  | "updated_at"
>;

type CountryLookup = {
  code: string | null;
  name: string | null;
};

type NameLookup = {
  name: string | null;
};

type RoleRecord = {
  role: UserRole;
  scope_type: ScopeType;
  scope_id: string | null;
  status: "active";
  granted_at: string;
};

type ProfilePerformanceLogger = {
  mark: (stage: string, resultCount?: number) => void;
};

export async function getMyProfile(
  perf?: ProfilePerformanceLogger,
): Promise<MyProfileResult> {
  const session = await getSession();

  if (!session.user) {
    return {
      ok: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication is required.",
      },
    };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select(
        "id, email, full_name, display_name, phone, primary_role, country_id, organization_id, church_id, ministry_position, timezone, generation_number, status, created_at, updated_at",
      )
      .eq("auth_user_id", session.user.id)
      .is("deleted_at", null)
      .neq("status", "anonymized")
      .maybeSingle();
    perf?.mark("auth.profile_lookup", profile ? 1 : 0);

    if (profileError) {
      return {
        ok: false,
        error: {
          code: "PROFILE_FETCH_FAILED",
          message: "Unable to load your profile right now.",
        },
      };
    }

    if (!profile) {
      return {
        ok: true,
        data: {
          authEmail: session.user.email,
          profile: null,
          roles: [],
        },
      };
    }

    const profileRecord = profile as ProfileRecord;
    const [countryResult, organizationResult, churchResult] = await Promise.all([
      profileRecord.country_id
        ? supabase
            .from("countries")
            .select("name, code")
            .eq("id", profileRecord.country_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      profileRecord.organization_id
        ? supabase
            .from("organizations")
            .select("name")
            .eq("id", profileRecord.organization_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      profileRecord.church_id
        ? supabase
            .from("churches")
            .select("name")
            .eq("id", profileRecord.church_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
    perf?.mark(
      "profile.affiliations_query",
      [countryResult.data, organizationResult.data, churchResult.data].filter(
        Boolean,
      ).length,
    );

    const country = countryResult.data as CountryLookup | null;
    const organization = organizationResult.data as NameLookup | null;
    const church = churchResult.data as NameLookup | null;

    const { data: roles, error: rolesError } = await supabase
      .from("user_roles")
      .select("role, scope_type, scope_id, status, granted_at")
      .eq("profile_id", profileRecord.id)
      .eq("status", "active")
      .eq("is_active", true)
      .is("deleted_at", null)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
    perf?.mark("profile.roles_query", roles?.length ?? 0);

    if (rolesError) {
      return {
        ok: false,
        error: {
          code: "PROFILE_FETCH_FAILED",
          message: "Unable to load your profile right now.",
        },
      };
    }

    return {
      ok: true,
      data: {
        authEmail: session.user.email,
        profile: {
          ...profileRecord,
          church_name: church?.name ?? null,
          country_code: country?.code ?? null,
          country_name: country?.name ?? null,
          organization_name: organization?.name ?? null,
        },
        roles: ((roles ?? []) as RoleRecord[]).map((role) => ({
          role: role.role,
          scope_type: role.scope_type,
          scope_id: role.scope_id,
          status: role.status,
          assigned_at: role.granted_at,
        })),
      },
    };
  } catch {
    return {
      ok: false,
      error: {
        code: "PROFILE_FETCH_FAILED",
        message: "Unable to load your profile right now.",
      },
    };
  }
}
