import { NextResponse } from "next/server";
import { requireAdminProfile } from "@/lib/auth/require-admin-profile";
import { hasRole } from "@/lib/auth/has-role";
import { getAdminOrganizations } from "@/lib/api/admin/organizations";
import {
  getOrganizationTypeLabel,
  isOrganizationType,
  type AdminOrganizationSummary,
} from "@/lib/api/admin/organizations";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { normalizeTimezone } from "@/lib/timezone";
import type { OrganizationType } from "@/types/database";

type OrganizationBody = {
  country_id?: unknown;
  default_timezone?: unknown;
  id?: unknown;
  is_active?: unknown;
  name?: unknown;
  organization_type?: unknown;
};

type ExistingOrganization = {
  id: string;
  country_id: string;
  name: string;
};

type CountryRow = {
  id: string;
  is_active: boolean | null;
};

type OrganizationMutationRow = {
  id: string;
  country_id: string;
  default_timezone: string | null;
  organization_type: OrganizationType;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type OrganizationInsertValues = {
  country_id: string;
  default_timezone: string | null;
  is_active: boolean;
  name: string;
  organization_type: OrganizationType;
};

type OrganizationUpdateValues = {
  country_id?: string;
  default_timezone?: string | null;
  is_active?: boolean;
  name?: string;
  organization_type?: OrganizationType;
  updated_at: string;
};

type OrganizationMutationResult = Promise<{
  data: OrganizationMutationRow | null;
  error: { code?: string; details?: string; message?: string } | null;
}>;

type OrganizationsMutationTable = {
  insert: (values: OrganizationInsertValues) => {
    select: (columns: string) => {
      single: () => OrganizationMutationResult;
    };
  };
  update: (values: OrganizationUpdateValues) => {
    eq: (column: "id", value: string) => {
      select: (columns: string) => {
        single: () => OrganizationMutationResult;
      };
    };
  };
};

const noStoreHeaders = {
  "Cache-Control": "no-store",
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  return typeof value === "string" ? value.trim() : "";
}

function normalizeUuid(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  const normalized = value.trim();
  return normalized === "all" ? "" : normalized;
}

function normalizeOrganizationType(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return isOrganizationType(normalized) ? normalized : null;
}

function normalizeOptionalTimezone(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return { ok: true as const, value: null };
  }

  if (typeof value !== "string") {
    return {
      ok: false as const,
      message: "기관/조직 기본 시간대를 확인해 주세요.",
    };
  }

  const timezone = normalizeTimezone(value);
  if (!timezone) {
    return {
      ok: false as const,
      message: "기관/조직 기본 시간대는 올바른 IANA timezone이어야 합니다.",
    };
  }

  return { ok: true as const, value: timezone };
}

async function loadExistingOrganizations() {
  const { client, error: clientError } = createSupabaseServiceClient();

  if (!client) {
    return {
      error:
        clientError ?? "기관 및 단체 관리를 위한 서버 설정이 준비되지 않았습니다.",
      organizations: [] as ExistingOrganization[],
    };
  }

  const { data, error } = await client
    .from("organizations")
    .select("id, country_id, name, deleted_at")
    .is("deleted_at", null);

  if (error) {
    console.error("[ADMIN_ORGANIZATIONS_DUPLICATE_LOOKUP_FAILED]", {
      message: error.message,
      code: error.code,
      details: error.details,
    });

    return {
      error: "기관 및 단체 정보를 확인하지 못했습니다.",
      organizations: [] as ExistingOrganization[],
    };
  }

  return {
    error: null,
    organizations: (data ?? []) as ExistingOrganization[],
  };
}

function hasDuplicateOrganization(
  organizations: ExistingOrganization[],
  countryId: string,
  name: string,
  currentId?: string,
) {
  const normalizedName = name.trim().toLowerCase();

  return organizations.some((organization) => {
    if (currentId && organization.id === currentId) {
      return false;
    }

    return (
      organization.country_id === countryId &&
      organization.name.trim().toLowerCase() === normalizedName
    );
  });
}

async function verifyCountry(countryId: string) {
  const { client, error: clientError } = createSupabaseServiceClient();

  if (!client) {
    return {
      error:
        clientError ?? "국가 확인을 위한 서버 설정이 준비되지 않았습니다.",
      status: 500,
    };
  }

  const { data, error } = await client
    .from("countries")
    .select("id, is_active")
    .eq("id", countryId)
    .maybeSingle();

  if (error) {
    console.error("[ADMIN_ORGANIZATION_COUNTRY_LOOKUP_FAILED]", {
      message: error.message,
      code: error.code,
      details: error.details,
    });

    return {
      error: "국가 정보를 확인하지 못했습니다.",
      status: 500,
    };
  }

  const country = data as CountryRow | null;

  if (!country) {
    return {
      error: "선택한 국가를 찾을 수 없습니다.",
      status: 404,
    };
  }

  if (country.is_active === false) {
    return {
      error: "선택한 국가는 현재 사용할 수 없습니다.",
      status: 400,
    };
  }

  return {
    error: null,
    status: 200,
  };
}

function toOrganizationSummary(
  row: OrganizationMutationRow,
  organizations: AdminOrganizationSummary[],
) {
  const current = organizations.find((organization) => organization.id === row.id);

  if (current) {
    return {
      ...current,
      country_id: row.country_id,
      organization_type: row.organization_type,
      organization_type_label: getOrganizationTypeLabel(row.organization_type),
      name: row.name,
      default_timezone: row.default_timezone,
      is_active: row.is_active,
      created_at: row.created_at,
      updated_at: row.updated_at,
      deleted_at: row.deleted_at,
    };
  }

  const country = organizations.find(
    (organization) => organization.country_id === row.country_id,
  );

  return {
    id: row.id,
    country_id: row.country_id,
    country_name: country?.country_name ?? "미지정",
    country_code: country?.country_code ?? "",
    organization_type: row.organization_type,
    organization_type_label: getOrganizationTypeLabel(row.organization_type),
    name: row.name,
    default_timezone: row.default_timezone,
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  };
}

export async function GET(request: Request) {
  const authError = await requireSuperAdminApi();

  if (authError) {
    return authError;
  }

  const url = new URL(request.url);
  const activeOnly = url.searchParams.get("activeOnly") === "true";
  const result = await getAdminOrganizations({ activeOnly });

  if (result.error) {
    return jsonError(500, "ORGANIZATIONS_LOOKUP_FAILED", result.error);
  }

  return NextResponse.json(
    {
      ok: true,
      data: {
        countries: result.countries,
        organizations: result.organizations,
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

  let body: OrganizationBody;

  try {
    body = (await request.json()) as OrganizationBody;
  } catch {
    return jsonError(400, "INVALID_BODY", "요청 본문을 확인해 주세요.");
  }

  const name = normalizeRequiredText(body.name);
  const countryId = normalizeUuid(body.country_id);
  const organizationType = normalizeOrganizationType(body.organization_type);
  const defaultTimezone = normalizeOptionalTimezone(body.default_timezone);

  if (!name) {
    return jsonError(400, "INVALID_NAME", "기관 및 단체명을 입력해 주세요.");
  }

  if (!countryId || !UUID_PATTERN.test(countryId)) {
    return jsonError(400, "INVALID_COUNTRY", "소속 국가 값이 올바르지 않습니다.");
  }

  if (!organizationType) {
    return jsonError(400, "INVALID_ORGANIZATION_TYPE", "기관 유형을 확인해 주세요.");
  }

  if (!defaultTimezone.ok) {
    return jsonError(400, "INVALID_TIMEZONE", defaultTimezone.message);
  }

  const countryCheck = await verifyCountry(countryId);

  if (countryCheck.error) {
    return jsonError(countryCheck.status, "COUNTRY_LOOKUP_FAILED", countryCheck.error);
  }

  const existing = await loadExistingOrganizations();

  if (existing.error) {
    return jsonError(500, "ORGANIZATIONS_LOOKUP_FAILED", existing.error);
  }

  if (hasDuplicateOrganization(existing.organizations, countryId, name)) {
    return jsonError(
      409,
      "ORGANIZATION_DUPLICATE",
      "이미 등록된 기관 및 단체입니다.",
    );
  }

  const { client, error: clientError } = createSupabaseServiceClient();

  if (!client) {
    return jsonError(
      500,
      "SERVICE_CLIENT_UNAVAILABLE",
      clientError ?? "기관 및 단체 추가를 위한 서버 설정이 준비되지 않았습니다.",
    );
  }

  const organizationsTable = client.from(
    "organizations",
  ) as unknown as OrganizationsMutationTable;
  const { data, error } = await organizationsTable
    .insert({
      country_id: countryId,
      default_timezone: defaultTimezone.value,
      organization_type: organizationType,
      name,
      is_active: true,
    })
    .select(
      "id, country_id, organization_type, name, default_timezone, is_active, created_at, updated_at, deleted_at",
    )
    .single();

  if (error || !data) {
    console.error("[ADMIN_ORGANIZATION_CREATE_FAILED]", {
      message: error?.message ?? "No organization row returned.",
      code: error?.code,
      details: error?.details,
    });

    return jsonError(
      500,
      "ORGANIZATION_CREATE_FAILED",
      "기관 및 단체 추가에 실패했습니다.",
    );
  }

  const refreshed = await getAdminOrganizations();

  return NextResponse.json(
    {
      ok: true,
      data: {
        message: "기관 및 단체가 추가되었습니다.",
        organization: toOrganizationSummary(data, refreshed.organizations),
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

  let body: OrganizationBody;

  try {
    body = (await request.json()) as OrganizationBody;
  } catch {
    return jsonError(400, "INVALID_BODY", "요청 본문을 확인해 주세요.");
  }

  const id = normalizeUuid(body.id);

  if (!id || !UUID_PATTERN.test(id)) {
    return jsonError(400, "INVALID_ID", "기관 및 단체 ID를 확인할 수 없습니다.");
  }

  const updateValues: OrganizationUpdateValues = {
    updated_at: new Date().toISOString(),
  };

  const hasName = Object.hasOwn(body, "name");
  const hasCountryId = Object.hasOwn(body, "country_id");
  const hasDefaultTimezone = Object.hasOwn(body, "default_timezone");
  const hasOrganizationType = Object.hasOwn(body, "organization_type");
  const hasIsActive = Object.hasOwn(body, "is_active");
  let nextName = "";
  let nextCountryId = "";

  if (hasName) {
    nextName = normalizeRequiredText(body.name);

    if (!nextName) {
      return jsonError(400, "INVALID_NAME", "기관 및 단체명을 입력해 주세요.");
    }

    updateValues.name = nextName;
  }

  if (hasCountryId) {
    nextCountryId = normalizeUuid(body.country_id);

    if (!nextCountryId || !UUID_PATTERN.test(nextCountryId)) {
      return jsonError(
        400,
        "INVALID_COUNTRY",
        "소속 국가 값이 올바르지 않습니다.",
      );
    }

    const countryCheck = await verifyCountry(nextCountryId);

    if (countryCheck.error) {
      return jsonError(
        countryCheck.status,
        "COUNTRY_LOOKUP_FAILED",
        countryCheck.error,
      );
    }

    updateValues.country_id = nextCountryId;
  }

  if (hasOrganizationType) {
    const organizationType = normalizeOrganizationType(body.organization_type);

    if (!organizationType) {
      return jsonError(
        400,
        "INVALID_ORGANIZATION_TYPE",
        "기관 유형을 확인해 주세요.",
      );
    }

    updateValues.organization_type = organizationType;
  }

  if (hasDefaultTimezone) {
    const defaultTimezone = normalizeOptionalTimezone(body.default_timezone);

    if (!defaultTimezone.ok) {
      return jsonError(400, "INVALID_TIMEZONE", defaultTimezone.message);
    }

    updateValues.default_timezone = defaultTimezone.value;
  }

  if (hasIsActive) {
    if (typeof body.is_active !== "boolean") {
      return jsonError(400, "INVALID_STATUS", "사용 여부 값을 확인해 주세요.");
    }

    updateValues.is_active = body.is_active;
  }

  if (
    !hasName &&
    !hasCountryId &&
    !hasDefaultTimezone &&
    !hasOrganizationType &&
    !hasIsActive
  ) {
    return jsonError(400, "EMPTY_UPDATE", "수정할 내용이 없습니다.");
  }

  const existing = await loadExistingOrganizations();

  if (existing.error) {
    return jsonError(500, "ORGANIZATIONS_LOOKUP_FAILED", existing.error);
  }

  const currentOrganization = existing.organizations.find(
    (organization) => organization.id === id,
  );

  if (!currentOrganization) {
    return jsonError(
      404,
      "ORGANIZATION_NOT_FOUND",
      "기관 및 단체를 찾을 수 없습니다.",
    );
  }

  const duplicateCountryId = hasCountryId
    ? nextCountryId
    : currentOrganization.country_id;
  const duplicateName = hasName ? nextName : currentOrganization.name;

  if (
    hasDuplicateOrganization(
      existing.organizations,
      duplicateCountryId,
      duplicateName,
      id,
    )
  ) {
    return jsonError(
      409,
      "ORGANIZATION_DUPLICATE",
      "이미 등록된 기관 및 단체입니다.",
    );
  }

  const { client, error: clientError } = createSupabaseServiceClient();

  if (!client) {
    return jsonError(
      500,
      "SERVICE_CLIENT_UNAVAILABLE",
      clientError ?? "기관 및 단체 수정을 위한 서버 설정이 준비되지 않았습니다.",
    );
  }

  const organizationsTable = client.from(
    "organizations",
  ) as unknown as OrganizationsMutationTable;
  const { data, error } = await organizationsTable
    .update(updateValues)
    .eq("id", id)
    .select(
      "id, country_id, organization_type, name, default_timezone, is_active, created_at, updated_at, deleted_at",
    )
    .single();

  if (error || !data) {
    console.error("[ADMIN_ORGANIZATION_UPDATE_FAILED]", {
      message: error?.message ?? "No organization row returned.",
      code: error?.code,
      details: error?.details,
    });

    return jsonError(
      500,
      "ORGANIZATION_UPDATE_FAILED",
      "기관 및 단체 수정에 실패했습니다.",
    );
  }

  const refreshed = await getAdminOrganizations();

  return NextResponse.json(
    {
      ok: true,
      data: {
        message: "기관 및 단체 정보가 수정되었습니다.",
        organization: toOrganizationSummary(data, refreshed.organizations),
      },
    },
    {
      status: 200,
      headers: noStoreHeaders,
    },
  );
}
