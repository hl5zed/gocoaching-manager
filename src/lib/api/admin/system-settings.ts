import { createSupabaseServiceClient } from "@/lib/supabase/service";
import {
  DEFAULT_PRINT_OPTIONS,
  normalizePrintOptions,
  type PrintOptions,
} from "@/lib/print/print-options";

export type SystemDefaultLocale = "ko" | "en";

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

const DEFAULT_GLOBAL_SYSTEM_SETTINGS: GlobalSystemSettings = {
  default_locale: "ko",
  default_country_id: null,
  invitation_expires_in_days: 7,
  print_options: DEFAULT_PRINT_OPTIONS,
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
