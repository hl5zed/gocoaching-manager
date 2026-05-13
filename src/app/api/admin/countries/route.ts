import { NextResponse } from "next/server";
import { requireAdminProfile } from "@/lib/auth/require-admin-profile";
import { hasRole } from "@/lib/auth/has-role";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { getAdminCountries } from "@/lib/api/admin/countries";

type CountryBody = {
  code?: unknown;
  id?: unknown;
  is_active?: unknown;
  name?: unknown;
};

type ExistingCountry = {
  id: string;
  name: string;
  code: string;
};

type CountryMutationRow = {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type CountryInsertValues = {
  name: string;
  code: string;
  is_active: boolean;
};

type CountryUpdateValues = {
  code?: string;
  is_active?: boolean;
  name?: string;
  updated_at: string;
};

type CountryMutationResult = Promise<{
  data: CountryMutationRow | null;
  error: { message?: string } | null;
}>;

type CountriesMutationTable = {
  insert: (values: CountryInsertValues) => {
    select: (columns: string) => {
      single: () => CountryMutationResult;
    };
  };
  update: (values: CountryUpdateValues) => {
    eq: (column: "id", value: string) => {
      select: (columns: string) => {
        single: () => CountryMutationResult;
      };
    };
  };
};

const noStoreHeaders = {
  "Cache-Control": "no-store",
};

function jsonError(status: number, code: string, message: string) {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code,
        message,
      },
    },
    {
      status,
      headers: noStoreHeaders,
    },
  );
}

async function requireSuperAdminApi() {
  const admin = await requireAdminProfile();

  if (!admin.ok) {
    return admin.status === 401
      ? jsonError(401, admin.code, "로그인이 필요합니다.")
      : jsonError(403, admin.code, "최고관리자 권한이 필요합니다.");
  }

  if (!hasRole(admin.roles, ["super_admin"])) {
    return jsonError(403, "SUPER_ADMIN_REQUIRED", "최고관리자 권한이 필요합니다.");
  }

  return null;
}

function normalizeRequiredText(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function normalizeCode(value: unknown) {
  return normalizeRequiredText(value).toUpperCase();
}

function isValidCountryCode(value: string) {
  return /^[A-Z]{2,3}$/.test(value);
}

function normalizeId(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function loadExistingCountries() {
  const { client, error: clientError } = createSupabaseServiceClient();

  if (!client) {
    return {
      countries: [] as ExistingCountry[],
      error:
        clientError ?? "국가 관리를 위한 서버 설정이 준비되지 않았습니다.",
    };
  }

  const { data, error } = await client
    .from("countries")
    .select("id, name, code");

  if (error) {
    console.error("[ADMIN_COUNTRIES_DUPLICATE_LOOKUP_FAILED]", error.message);
    return {
      countries: [] as ExistingCountry[],
      error: "국가 정보를 확인하지 못했습니다.",
    };
  }

  return {
    countries: (data ?? []) as ExistingCountry[],
    error: null,
  };
}

function hasDuplicateCountry(
  countries: ExistingCountry[],
  name: string,
  code: string,
  currentId?: string,
) {
  const normalizedName = name.trim().toLowerCase();
  const normalizedCode = code.trim().toUpperCase();

  return countries.some((country) => {
    if (currentId && country.id === currentId) {
      return false;
    }

    return (
      country.name.trim().toLowerCase() === normalizedName ||
      country.code.trim().toUpperCase() === normalizedCode
    );
  });
}

export async function GET() {
  const authError = await requireSuperAdminApi();

  if (authError) {
    return authError;
  }

  const result = await getAdminCountries();

  if (result.error) {
    return jsonError(500, "COUNTRIES_LOOKUP_FAILED", result.error);
  }

  return NextResponse.json(
    {
      ok: true,
      data: {
        countries: result.countries,
      },
    },
    {
      status: 200,
      headers: noStoreHeaders,
    },
  );
}

export async function POST(request: Request) {
  const authError = await requireSuperAdminApi();

  if (authError) {
    return authError;
  }

  let body: CountryBody;

  try {
    body = (await request.json()) as CountryBody;
  } catch {
    return jsonError(400, "INVALID_BODY", "요청 본문을 확인해 주세요.");
  }

  const name = normalizeRequiredText(body.name);
  const code = normalizeCode(body.code);

  if (!name) {
    return jsonError(400, "INVALID_NAME", "국가명을 입력해 주세요.");
  }

  if (!code || !isValidCountryCode(code)) {
    return jsonError(
      400,
      "INVALID_CODE",
      "국가 코드는 영문 대문자 2~3자리로 입력해 주세요.",
    );
  }

  const existing = await loadExistingCountries();

  if (existing.error) {
    return jsonError(500, "COUNTRIES_LOOKUP_FAILED", existing.error);
  }

  if (hasDuplicateCountry(existing.countries, name, code)) {
    return jsonError(
      409,
      "COUNTRY_DUPLICATE",
      "이미 등록된 국가명 또는 국가 코드입니다.",
    );
  }

  const { client, error: clientError } = createSupabaseServiceClient();

  if (!client) {
    return jsonError(
      500,
      "SERVICE_CLIENT_UNAVAILABLE",
      clientError ?? "국가 추가를 위한 서버 설정이 준비되지 않았습니다.",
    );
  }

  const countriesTable = client.from("countries") as unknown as CountriesMutationTable;
  const { data, error } = await countriesTable
    .insert({
      name,
      code,
      is_active: true,
    })
    .select("id, name, code, is_active, created_at, updated_at")
    .single();

  if (error) {
    console.error("[ADMIN_COUNTRY_CREATE_FAILED]", error.message);
    return jsonError(500, "COUNTRY_CREATE_FAILED", "국가 추가에 실패했습니다.");
  }

  return NextResponse.json(
    {
      ok: true,
      data: {
        country: data,
        message: "국가가 추가되었습니다.",
      },
    },
    {
      status: 201,
      headers: noStoreHeaders,
    },
  );
}

export async function PATCH(request: Request) {
  const authError = await requireSuperAdminApi();

  if (authError) {
    return authError;
  }

  let body: CountryBody;

  try {
    body = (await request.json()) as CountryBody;
  } catch {
    return jsonError(400, "INVALID_BODY", "요청 본문을 확인해 주세요.");
  }

  const id = normalizeId(body.id);

  if (!id) {
    return jsonError(400, "INVALID_ID", "국가 ID를 확인할 수 없습니다.");
  }

  const updateValues: CountryUpdateValues = {
    updated_at: new Date().toISOString(),
  };

  const hasName = Object.hasOwn(body, "name");
  const hasCode = Object.hasOwn(body, "code");
  const hasIsActive = Object.hasOwn(body, "is_active");
  let nextName = "";
  let nextCode = "";

  if (hasName) {
    nextName = normalizeRequiredText(body.name);

    if (!nextName) {
      return jsonError(400, "INVALID_NAME", "국가명을 입력해 주세요.");
    }

    updateValues.name = nextName;
  }

  if (hasCode) {
    nextCode = normalizeCode(body.code);

    if (!nextCode || !isValidCountryCode(nextCode)) {
      return jsonError(
        400,
        "INVALID_CODE",
        "국가 코드는 영문 대문자 2~3자리로 입력해 주세요.",
      );
    }

    updateValues.code = nextCode;
  }

  if (hasIsActive) {
    if (typeof body.is_active !== "boolean") {
      return jsonError(400, "INVALID_STATUS", "사용 여부 값을 확인해 주세요.");
    }

    updateValues.is_active = body.is_active;
  }

  if (!hasName && !hasCode && !hasIsActive) {
    return jsonError(400, "EMPTY_UPDATE", "수정할 내용이 없습니다.");
  }

  const existing = await loadExistingCountries();

  if (existing.error) {
    return jsonError(500, "COUNTRIES_LOOKUP_FAILED", existing.error);
  }

  const currentCountry = existing.countries.find((country) => country.id === id);

  if (!currentCountry) {
    return jsonError(404, "COUNTRY_NOT_FOUND", "국가를 찾을 수 없습니다.");
  }

  const duplicateName = hasName ? nextName : currentCountry.name;
  const duplicateCode = hasCode ? nextCode : currentCountry.code;

  if (hasDuplicateCountry(existing.countries, duplicateName, duplicateCode, id)) {
    return jsonError(
      409,
      "COUNTRY_DUPLICATE",
      "이미 등록된 국가명 또는 국가 코드입니다.",
    );
  }

  const { client, error: clientError } = createSupabaseServiceClient();

  if (!client) {
    return jsonError(
      500,
      "SERVICE_CLIENT_UNAVAILABLE",
      clientError ?? "국가 수정을 위한 서버 설정이 준비되지 않았습니다.",
    );
  }

  const countriesTable = client.from("countries") as unknown as CountriesMutationTable;
  const { data, error } = await countriesTable
    .update(updateValues)
    .eq("id", id)
    .select("id, name, code, is_active, created_at, updated_at")
    .single();

  if (error) {
    console.error("[ADMIN_COUNTRY_UPDATE_FAILED]", error.message);
    return jsonError(500, "COUNTRY_UPDATE_FAILED", "국가 수정에 실패했습니다.");
  }

  return NextResponse.json(
    {
      ok: true,
      data: {
        country: data,
        message: "국가 정보가 수정되었습니다.",
      },
    },
    {
      status: 200,
      headers: noStoreHeaders,
    },
  );
}
