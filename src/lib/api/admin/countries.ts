import "server-only";

import { createSupabaseServiceClient } from "@/lib/supabase/service";

export type AdminCountrySummary = {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type AdminCountriesResult = {
  countries: AdminCountrySummary[];
  error: string | null;
};

type CountryLookupRow = {
  id: string;
  name: string;
  code: string;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
};

export async function getAdminCountries(): Promise<AdminCountriesResult> {
  const { client, error: clientError } = createSupabaseServiceClient();

  if (!client) {
    return {
      countries: [],
      error: clientError ?? "국가 목록 조회를 위한 서버 설정이 없습니다.",
    };
  }

  const { data, error } = await client
    .from("countries")
    .select("id, name, code, is_active, created_at, updated_at")
    .order("name", { ascending: true });

  if (error) {
    console.error("[ADMIN_COUNTRIES_LOOKUP_FAILED]", error.message);
    return {
      countries: [],
      error: "국가 목록을 불러오지 못했습니다.",
    };
  }

  return {
    countries: ((data ?? []) as CountryLookupRow[]).map((country) => ({
      id: country.id,
      name: country.name,
      code: country.code,
      is_active: country.is_active !== false,
      created_at: country.created_at,
      updated_at: country.updated_at,
    })),
    error: null,
  };
}
