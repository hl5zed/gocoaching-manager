import { createSupabaseServiceClient } from "@/lib/supabase/service";
import {
  DEFAULT_PRINT_OPTIONS,
  normalizePrintOptions,
  type PrintOptions,
} from "@/lib/print/print-options";
import type { OrganizationType } from "@/types/database";
import { getOrganizationTypeLabel } from "@/lib/api/admin/organizations";

export type SystemDefaultLocale = "ko" | "en";
export type OrganizationDefaultInvitationRole = "coachee";
export type OrganizationDefaultInvitationScopeType = "organization";

export type OrganizationDefaultInvitationRolePolicy = {
  enabled: boolean;
  default_role: OrganizationDefaultInvitationRole;
  default_scope_type: OrganizationDefaultInvitationScopeType;
};

export type OrganizationDefaultRoleSettingsItem = {
  organization_id: string;
  organization_name: string;
  country_id: string;
  country_name: string;
  organization_type: OrganizationType;
  organization_type_label: string;
  policy: OrganizationDefaultInvitationRolePolicy;
};

export type GlobalSystemSettings = {
  default_locale: SystemDefaultLocale;
  default_country_id: string | null;
  invitation_expires_in_days: number;
  print_options: PrintOptions;
};

export type UpdateGlobalSystemSettingsInput = Partial<GlobalSystemSettings>;

type DynamicSupabaseClient = {
  from: (table: string) => any;
};

type RawSystemSetting = {
  key: string;
  value: unknown;
  value_type: string;
};

type RawOrganizationSetting = {
  scope_id: string | null;
  value: unknown;
};

type RawOrganization = {
  id: string;
  country_id: string;
  organization_type: OrganizationType;
  name: string;
  is_active: boolean | null;
  deleted_at: string | null;
};

type RawCountry = {
  id: string;
  name: string;
};

const DEFAULT_GLOBAL_SYSTEM_SETTINGS: GlobalSystemSettings = {
  default_locale: "ko",
  default_country_id: null,
  invitation_expires_in_days: 7,
  print_options: DEFAULT_PRINT_OPTIONS,
};

export const ORGANIZATION_DEFAULT_INVITATION_ROLE_POLICY_KEY =
  "default_invitation_role_policy";

export const DEFAULT_ORGANIZATION_INVITATION_ROLE_POLICY: OrganizationDefaultInvitationRolePolicy =
  {
    enabled: false,
    default_role: "coachee",
    default_scope_type: "organization",
  };

const SETTING_META: Record<
  keyof GlobalSystemSettings,
  { value_type: string; description: string }
> = {
  default_locale: {
    value_type: "locale",
    description: "Global default interface locale for new sessions and fallbacks.",
  },
  default_country_id: {
    value_type: "uuid",
    description: "Global default country used by administrative forms.",
  },
  invitation_expires_in_days: {
    value_type: "number",
    description: "Default invitation expiration period in days.",
  },
  print_options: {
    value_type: "json",
    description: "Default print options for moksilgi, personal records, and reports.",
  },
};

function getDefaultGlobalSystemSettings(): GlobalSystemSettings {
  return {
    ...DEFAULT_GLOBAL_SYSTEM_SETTINGS,
    print_options: { ...DEFAULT_PRINT_OPTIONS },
  };
}

function getDynamicClient(): DynamicSupabaseClient {
  const { client, error } = createSupabaseServiceClient();

  if (!client) {
    throw new Error(error ?? "Supabase service client is not configured.");
  }

  return client as unknown as DynamicSupabaseClient;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseOrganizationDefaultInvitationRolePolicy(
  value: unknown,
): OrganizationDefaultInvitationRolePolicy {
  if (!isRecord(value)) {
    return { ...DEFAULT_ORGANIZATION_INVITATION_ROLE_POLICY };
  }

  return {
    enabled: value.enabled === true,
    default_role: "coachee",
    default_scope_type: "organization",
  };
}

function parseSettings(rows: RawSystemSetting[] | null): GlobalSystemSettings {
  const settings = getDefaultGlobalSystemSettings();

  for (const row of rows ?? []) {
    if (!isRecord(row.value)) {
      continue;
    }

    if (row.key === "default_locale") {
      const locale = row.value.locale;
      if (locale === "ko" || locale === "en") {
        settings.default_locale = locale;
      }
    }

    if (row.key === "default_country_id") {
      const countryId = row.value.country_id;
      settings.default_country_id =
        typeof countryId === "string" && countryId.trim().length > 0
          ? countryId
          : null;
    }

    if (row.key === "invitation_expires_in_days") {
      const days = row.value.days;
      if (
        typeof days === "number" &&
        Number.isInteger(days) &&
        days >= 1 &&
        days <= 30
      ) {
        settings.invitation_expires_in_days = days;
      }
    }

    if (row.key === "print_options") {
      settings.print_options = normalizePrintOptions(row.value);
    }
  }

  return settings;
}

function toSettingValue(key: keyof GlobalSystemSettings, value: GlobalSystemSettings[keyof GlobalSystemSettings]) {
  if (key === "default_locale") {
    return { locale: value };
  }

  if (key === "default_country_id") {
    return { country_id: value };
  }

  if (key === "print_options") {
    return normalizePrintOptions(value);
  }

  return { days: value };
}

export async function getGlobalSystemSettings(): Promise<{
  settings: GlobalSystemSettings;
  error: string | null;
}> {
  let supabase: DynamicSupabaseClient;
  try {
    supabase = getDynamicClient();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "시스템 설정을 불러오지 못했습니다.";

    if (process.env.NODE_ENV === "development") {
      console.warn("[SYSTEM_SETTINGS_CLIENT_FAILED]", message);
    }

    return {
      settings: getDefaultGlobalSystemSettings(),
      error: message,
    };
  }

  const { data, error } = await supabase
    .from("system_settings")
    .select("key,value,value_type")
    .eq("scope_type", "global")
    .is("scope_id", null)
    .in("key", Object.keys(DEFAULT_GLOBAL_SYSTEM_SETTINGS));

  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[SYSTEM_SETTINGS_GET_FAILED]", error.message);
    }

    return {
      settings: getDefaultGlobalSystemSettings(),
      error: error.message,
    };
  }

  return {
    settings: parseSettings(data as RawSystemSetting[] | null),
    error: null,
  };
}

export async function updateGlobalSystemSettings(
  input: UpdateGlobalSystemSettingsInput,
  updatedByProfileId: string,
): Promise<{ settings: GlobalSystemSettings; error: string | null }> {
  let supabase: DynamicSupabaseClient;
  try {
    supabase = getDynamicClient();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "시스템 설정을 저장하지 못했습니다.";

    if (process.env.NODE_ENV === "development") {
      console.warn("[SYSTEM_SETTINGS_CLIENT_FAILED]", message);
    }

    return {
      settings: { ...getDefaultGlobalSystemSettings(), ...input },
      error: message,
    };
  }

  const now = new Date().toISOString();
  const entries = Object.entries(input) as Array<
    [keyof GlobalSystemSettings, GlobalSystemSettings[keyof GlobalSystemSettings]]
  >;

  if (entries.length === 0) {
    return getGlobalSystemSettings();
  }

  const rows = entries.map(([key, value]) => ({
    scope_type: "global",
    scope_id: null,
    key,
    value: toSettingValue(key, value),
    value_type: SETTING_META[key].value_type,
    description: SETTING_META[key].description,
    updated_by: updatedByProfileId,
    updated_at: now,
  }));

  const { error } = await supabase
    .from("system_settings")
    .upsert(rows, {
      onConflict: "scope_type,scope_id,key",
    });

  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[SYSTEM_SETTINGS_UPDATE_FAILED]", error.message);
    }

    return {
      settings: { ...getDefaultGlobalSystemSettings(), ...input },
      error: error.message,
    };
  }

  return getGlobalSystemSettings();
}

export const FALLBACK_INVITATION_EXPIRES_IN_DAYS =
  DEFAULT_GLOBAL_SYSTEM_SETTINGS.invitation_expires_in_days;

export async function getOrganizationDefaultRoleSettings(): Promise<{
  organizations: OrganizationDefaultRoleSettingsItem[];
  error: string | null;
}> {
  let supabase: DynamicSupabaseClient;
  try {
    supabase = getDynamicClient();
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "조직별 기본 권한 설정을 불러오지 못했습니다.";

    if (process.env.NODE_ENV === "development") {
      console.warn("[ORGANIZATION_DEFAULT_ROLES_CLIENT_FAILED]", message);
    }

    return {
      organizations: [],
      error: message,
    };
  }

  const { data: organizationsData, error: organizationsError } = await supabase
    .from("organizations")
    .select("id,country_id,organization_type,name,is_active,deleted_at")
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("name", { ascending: true });

  if (organizationsError) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[ORGANIZATION_DEFAULT_ROLES_ORGANIZATIONS_FAILED]",
        organizationsError.message,
      );
    }

    return {
      organizations: [],
      error: "조직 목록을 불러오지 못했습니다.",
    };
  }

  const organizations = Array.from(
    new Map(
      ((organizationsData ?? []) as RawOrganization[]).map((organization) => [
        organization.id,
        organization,
      ]),
    ).values(),
  );
  if (organizations.length === 0) {
    return {
      organizations: [],
      error: null,
    };
  }

  const countryIds = Array.from(
    new Set(organizations.map((organization) => organization.country_id)),
  );
  const organizationIds = organizations.map((organization) => organization.id);

  const [{ data: countriesData, error: countriesError }, { data: settingsData, error: settingsError }] =
    await Promise.all([
      supabase.from("countries").select("id,name").in("id", countryIds),
      supabase
        .from("system_settings")
        .select("scope_id,value")
        .eq("scope_type", "organization")
        .in("scope_id", organizationIds)
        .eq("key", ORGANIZATION_DEFAULT_INVITATION_ROLE_POLICY_KEY),
    ]);

  if (countriesError || settingsError) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[ORGANIZATION_DEFAULT_ROLES_LOOKUP_FAILED]", {
        countries: countriesError?.message,
        settings: settingsError?.message,
      });
    }

    return {
      organizations: [],
      error: "조직별 기본 권한 설정을 불러오지 못했습니다.",
    };
  }

  const countryMap = new Map(
    ((countriesData ?? []) as RawCountry[]).map((country) => [
      country.id,
      country.name,
    ]),
  );
  const settingMap = new Map(
    ((settingsData ?? []) as RawOrganizationSetting[])
      .filter((setting) => typeof setting.scope_id === "string")
      .map((setting) => [
        setting.scope_id as string,
        parseOrganizationDefaultInvitationRolePolicy(setting.value),
      ]),
  );

  return {
    organizations: organizations.map((organization) => ({
      organization_id: organization.id,
      organization_name: organization.name,
      country_id: organization.country_id,
      country_name: countryMap.get(organization.country_id) ?? "미지정",
      organization_type: organization.organization_type,
      organization_type_label: getOrganizationTypeLabel(
        organization.organization_type,
      ),
      policy:
        settingMap.get(organization.id) ??
        DEFAULT_ORGANIZATION_INVITATION_ROLE_POLICY,
    })),
    error: null,
  };
}

export async function updateOrganizationDefaultRolePolicy({
  defaultRole,
  enabled,
  organizationId,
  updatedByProfileId,
}: {
  organizationId: string;
  enabled: boolean;
  defaultRole: unknown;
  updatedByProfileId: string;
}): Promise<{
  policy: OrganizationDefaultInvitationRolePolicy | null;
  error: string | null;
  status?: number;
}> {
  if (defaultRole !== "coachee") {
    return {
      policy: null,
      error: "1차 기본 권한 정책은 코치이만 허용합니다.",
      status: 400,
    };
  }

  let supabase: DynamicSupabaseClient;
  try {
    supabase = getDynamicClient();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "조직별 기본 권한을 저장하지 못했습니다.";

    if (process.env.NODE_ENV === "development") {
      console.warn("[ORGANIZATION_DEFAULT_ROLE_CLIENT_FAILED]", message);
    }

    return {
      policy: null,
      error: message,
      status: 500,
    };
  }

  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .select("id,is_active,deleted_at")
    .eq("id", organizationId)
    .maybeSingle();

  if (organizationError) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[ORGANIZATION_DEFAULT_ROLE_ORGANIZATION_FAILED]",
        organizationError.message,
      );
    }

    return {
      policy: null,
      error: "조직을 확인하지 못했습니다.",
      status: 500,
    };
  }

  if (
    !organization ||
    organization.is_active !== true ||
    organization.deleted_at !== null
  ) {
    return {
      policy: null,
      error: "활성 조직만 기본 권한 정책을 설정할 수 있습니다.",
      status: 400,
    };
  }

  const policy: OrganizationDefaultInvitationRolePolicy = {
    enabled,
    default_role: "coachee",
    default_scope_type: "organization",
  };
  const now = new Date().toISOString();

  const { error } = await supabase.from("system_settings").upsert(
    {
      scope_type: "organization",
      scope_id: organizationId,
      key: ORGANIZATION_DEFAULT_INVITATION_ROLE_POLICY_KEY,
      value: policy,
      value_type: "json",
      description:
        "Default invitation role suggestion for new users in this organization.",
      updated_by: updatedByProfileId,
      updated_at: now,
    },
    {
      onConflict: "scope_type,scope_id,key",
    },
  );

  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[ORGANIZATION_DEFAULT_ROLE_UPDATE_FAILED]", error.message);
    }

    return {
      policy: null,
      error: "조직별 기본 권한을 저장하지 못했습니다.",
      status: 500,
    };
  }

  return {
    policy,
    error: null,
  };
}
