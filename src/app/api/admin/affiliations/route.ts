import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { hasRole } from "@/lib/auth/has-role";
import { requireAdminProfile } from "@/lib/auth/require-admin-profile";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

type AffiliationKind = "region" | "church" | "group";
type AffiliationIntent =
  | "create_region"
  | "create_church"
  | "create_group"
  | "update_region"
  | "update_church"
  | "update_group";
type AffiliationMode = "create" | "update";

type AffiliationBody = {
  church_id?: unknown;
  country_id?: unknown;
  group_type?: unknown;
  id?: unknown;
  intent?: unknown;
  kind?: unknown;
  name?: unknown;
  organization_id?: unknown;
};

type RegionMutationRow = {
  id: string;
  country_id: string | null;
  name: string;
  created_at: string;
  updated_at: string;
};

type ChurchMutationRow = {
  id: string;
  organization_id: string | null;
  name: string;
  created_at: string;
  updated_at: string;
};

type GroupMutationRow = {
  id: string;
  church_id: string | null;
  group_type?: string | null;
  name: string;
  created_at: string;
  updated_at: string;
};

type AffiliationMutationValues = Record<string, string | null>;

type AffiliationMutationResult = Promise<{
  data: unknown;
  error: { code?: string; details?: string; message?: string } | null;
}>;

type AffiliationMutationTable = {
  insert: (values: AffiliationMutationValues) => {
    select: (columns: string) => {
      single: () => AffiliationMutationResult;
    };
  };
  update: (values: AffiliationMutationValues) => {
    eq: (column: "id", value: string) => {
      select: (columns: string) => {
        single: () => AffiliationMutationResult;
      };
    };
  };
};

const noStoreHeaders = {
  "Cache-Control": "no-store",
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const GROUP_TYPE_CANDIDATES = [
  "ministry_team",
  "small_group",
  "cohort_group",
  "training_group",
  "regional_group",
  "other",
] as const;
const DEFAULT_GROUP_TYPE = "small_group";

type AffiliationClient = NonNullable<
  ReturnType<typeof createSupabaseServiceClient>["client"]
>;

type ParentLoadResult = {
  error: string | null;
  values?: Record<string, string | null>;
};

function debugMutation(details: {
  error?: string;
  intent: string | null;
  status: "failure" | "success";
  table?: string;
}) {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  console.warn("[ADMIN_AFFILIATION_MUTATION]", details);
}

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
      headers: noStoreHeaders,
      status,
    },
  );
}

function redirectToAffiliations(
  request: Request,
  params: Record<string, string>,
) {
  const url = new URL("/admin/settings/affiliations", request.url);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return NextResponse.redirect(url, 303);
}

function mutationError(
  request: Request,
  isFormRequest: boolean,
  status: number,
  code: string,
  message: string,
) {
  if (isFormRequest) {
    return redirectToAffiliations(request, {
      error: message,
    });
  }

  return jsonError(status, code, message);
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

function normalizeKind(value: unknown): AffiliationKind | null {
  return value === "region" || value === "church" || value === "group"
    ? value
    : null;
}

function normalizeIntent(value: unknown): {
  intent: AffiliationIntent;
  kind: AffiliationKind;
  mode: AffiliationMode;
} | null {
  if (value === "create_region") {
    return { intent: value, kind: "region", mode: "create" };
  }

  if (value === "create_church") {
    return { intent: value, kind: "church", mode: "create" };
  }

  if (value === "create_group") {
    return { intent: value, kind: "group", mode: "create" };
  }

  if (value === "update_region") {
    return { intent: value, kind: "region", mode: "update" };
  }

  if (value === "update_church") {
    return { intent: value, kind: "church", mode: "update" };
  }

  if (value === "update_group") {
    return { intent: value, kind: "group", mode: "update" };
  }

  return null;
}

function normalizeName(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeGroupType(value: unknown) {
  if (typeof value !== "string") {
    return DEFAULT_GROUP_TYPE;
  }

  const normalized = value.trim();

  return GROUP_TYPE_CANDIDATES.includes(
    normalized as (typeof GROUP_TYPE_CANDIDATES)[number],
  )
    ? normalized
    : DEFAULT_GROUP_TYPE;
}

function createRegionCode(name: string) {
  const normalized = name
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return normalized || "region";
}

function normalizeNullableUuid(value: unknown) {
  if (value == null) {
    return null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  if (!normalized || normalized === "all") {
    return null;
  }

  return UUID_PATTERN.test(normalized) ? normalized : "__invalid__";
}

function normalizeRequiredUuid(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  const normalized = value.trim();
  return UUID_PATTERN.test(normalized) ? normalized : "";
}

function invalidParentMessage(kind: AffiliationKind) {
  if (kind === "region") {
    return "소속 국가 값을 확인해 주세요.";
  }

  if (kind === "church") {
    return "소속 기관/교회 값을 확인해 주세요.";
  }

  return "세부 교회 값을 확인해 주세요.";
}

async function verifyRegionCodeAvailable(
  client: AffiliationClient,
  code: string,
  countryId: string | null,
  currentId?: string,
) {
  let query = client.from("regions").select("id").eq("code", code).limit(2);

  query = countryId ? query.eq("country_id", countryId) : query.is("country_id", null);

  const { data, error } = await query;

  if (error) {
    console.error("[ADMIN_AFFILIATION_REGION_CODE_LOOKUP_FAILED]", {
      message: error.message,
      code: error.code,
      details: error.details,
    });
    return "지역/도시 코드 중복 여부를 확인하지 못했습니다.";
  }

  const duplicate = ((data ?? []) as { id: string }[]).find(
    (row) => row.id !== currentId,
  );

  return duplicate
    ? "같은 국가에 동일한 지역/도시 코드가 이미 있습니다. 이름을 조금 다르게 입력해 주세요."
    : null;
}

async function loadOrganizationCountryId(
  client: AffiliationClient,
  organizationId: string | null,
) {
  if (!organizationId) {
    return {
      countryId: null,
      error: "소속 기관/교회를 선택해 주세요.",
    };
  }

  const { data, error } = await client
    .from("organizations")
    .select("id, country_id")
    .eq("id", organizationId)
    .maybeSingle();

  if (error) {
    console.error("[ADMIN_AFFILIATION_ORGANIZATION_COUNTRY_LOOKUP_FAILED]", {
      message: error.message,
      code: error.code,
      details: error.details,
    });
    return {
      countryId: null,
      error: "소속 기관/교회 정보를 확인하지 못했습니다.",
    };
  }

  const organization = data as { country_id?: string | null } | null;

  if (!organization?.country_id) {
    return {
      countryId: null,
      error: "선택한 소속 기관/교회의 국가 정보를 찾을 수 없습니다.",
    };
  }

  return {
    countryId: organization.country_id,
    error: null,
  };
}

async function loadChurchParentValues(
  client: AffiliationClient,
  churchId: string | null,
) {
  if (!churchId) {
    return {
      countryId: null,
      error: "세부 교회를 선택해 주세요.",
      organizationId: null,
    };
  }

  const { data, error } = await client
    .from("churches")
    .select("id, organization_id, country_id")
    .eq("id", churchId)
    .maybeSingle();

  if (!error) {
    const church = data as {
      country_id?: string | null;
      organization_id?: string | null;
    } | null;

    if (!church) {
      return {
        countryId: null,
        error: "선택한 세부 교회를 찾을 수 없습니다.",
        organizationId: null,
      };
    }

    return {
      countryId: church.country_id ?? null,
      error: null,
      organizationId: church.organization_id ?? null,
    };
  }

  const fallback = await client
    .from("churches")
    .select("id, organization_id")
    .eq("id", churchId)
    .maybeSingle();

  if (fallback.error) {
    console.error("[ADMIN_AFFILIATION_CHURCH_PARENT_LOOKUP_FAILED]", {
      primaryMessage: error.message,
      fallbackMessage: fallback.error.message,
      fallbackCode: fallback.error.code,
      fallbackDetails: fallback.error.details,
    });
    return {
      countryId: null,
      error: "세부 교회 정보를 확인하지 못했습니다.",
      organizationId: null,
    };
  }

  const church = fallback.data as { organization_id?: string | null } | null;

  if (!church) {
    return {
      countryId: null,
      error: "선택한 세부 교회를 찾을 수 없습니다.",
      organizationId: null,
    };
  }

  const organization = await loadOrganizationCountryId(
    client,
    church.organization_id ?? null,
  );

  return {
    countryId: organization.countryId,
    error: organization.error,
    organizationId: church.organization_id ?? null,
  };
}

function parentColumn(kind: AffiliationKind) {
  if (kind === "region") {
    return "country_id";
  }

  if (kind === "church") {
    return "organization_id";
  }

  return "church_id";
}

function parentValue(kind: AffiliationKind, body: AffiliationBody) {
  if (kind === "region") {
    return normalizeNullableUuid(body.country_id);
  }

  if (kind === "church") {
    return normalizeNullableUuid(body.organization_id);
  }

  return normalizeNullableUuid(body.church_id);
}

function tableName(kind: AffiliationKind) {
  return kind === "region" ? "regions" : kind === "church" ? "churches" : "groups";
}

async function tableSupportsColumn(
  client: AffiliationClient,
  table: "groups",
  column: "country_id" | "organization_id",
) {
  const { error } = await client.from(table).select(column).limit(1);
  return !error;
}

async function buildMutationValues({
  client,
  currentId,
  groupType,
  kind,
  name,
  parentId,
}: {
  client: AffiliationClient;
  currentId?: string;
  groupType?: string;
  kind: AffiliationKind;
  name: string;
  parentId: string | null;
}): Promise<ParentLoadResult> {
  if (kind === "region") {
    const code = createRegionCode(name);
    const duplicateError = await verifyRegionCodeAvailable(
      client,
      code,
      parentId,
      currentId,
    );

    if (duplicateError) {
      return {
        error: duplicateError,
      };
    }

    return {
      error: null,
      values: {
        code,
        country_id: parentId,
        name,
      },
    };
  }

  if (kind === "church") {
    const organization = await loadOrganizationCountryId(client, parentId);

    if (organization.error) {
      return {
        error: organization.error,
      };
    }

    return {
      error: null,
      values: {
        country_id: organization.countryId,
        name,
        organization_id: parentId,
      },
    };
  }

  const church = await loadChurchParentValues(client, parentId);

  if (church.error) {
    return {
      error: church.error,
    };
  }

  const values: Record<string, string | null> = {
    church_id: parentId,
    name,
  };

  if (!currentId) {
    values.group_type = groupType ?? DEFAULT_GROUP_TYPE;
  }

  const [supportsCountryId, supportsOrganizationId] = await Promise.all([
    tableSupportsColumn(client, "groups", "country_id"),
    tableSupportsColumn(client, "groups", "organization_id"),
  ]);

  if (supportsCountryId) {
    values.country_id = church.countryId;
  }

  if (supportsOrganizationId) {
    values.organization_id = church.organizationId;
  }

  return {
    error: null,
    values,
  };
}

function isInvalidGroupTypeError(
  error: { code?: string; message?: string } | null,
) {
  return (
    error?.message?.includes("invalid input value for enum group_type_enum") ??
    false
  );
}

async function insertAffiliationRow({
  kind,
  mutationTable,
  values,
}: {
  kind: AffiliationKind;
  mutationTable: AffiliationMutationTable;
  values: Record<string, string | null>;
}) {
  if (kind !== "group" || !values.group_type) {
    return mutationTable.insert(values).select("*").single();
  }

  const orderedTypes = [
    values.group_type,
    DEFAULT_GROUP_TYPE,
    ...GROUP_TYPE_CANDIDATES,
  ].filter((value, index, values) => values.indexOf(value) === index);
  let lastResult: Awaited<AffiliationMutationResult> | null = null;

  for (const groupType of orderedTypes) {
    const result = await mutationTable
      .insert({
        ...values,
        group_type: groupType,
      })
      .select("*")
      .single();

    if (!isInvalidGroupTypeError(result.error)) {
      return result;
    }

    lastResult = result;
  }

  return (
    lastResult ?? {
      data: null,
      error: {
        message: "groups.group_type 값을 확인할 수 없습니다.",
      },
    }
  );
}

async function readAffiliationBody(request: Request): Promise<{
  body: AffiliationBody;
  isFormRequest: boolean;
}> {
  const contentType = request.headers.get("content-type") ?? "";

  if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    const formData = await request.formData();
    const body: AffiliationBody = {};

    for (const [key, value] of formData.entries()) {
      body[key as keyof AffiliationBody] =
        typeof value === "string" ? value : "";
    }

    return {
      body,
      isFormRequest: true,
    };
  }

  return {
    body: (await request.json()) as AffiliationBody,
    isFormRequest: false,
  };
}

export async function POST(request: Request) {
  const authError = await requireSuperAdminApi();

  if (authError) {
    return authError;
  }

  let body: AffiliationBody;
  let isFormRequest = false;

  try {
    const parsed = await readAffiliationBody(request);
    body = parsed.body;
    isFormRequest = parsed.isFormRequest;
  } catch {
    return mutationError(
      request,
      isFormRequest,
      400,
      "INVALID_BODY",
      "요청 본문을 확인해 주세요.",
    );
  }

  const action = normalizeIntent(body.intent);

  if (!action || action.mode !== "create") {
    return mutationError(
      request,
      isFormRequest,
      400,
      "INVALID_INTENT",
      "소속 선택값 저장 동작을 확인해 주세요.",
    );
  }

  const kind = action.kind;
  const table = tableName(kind);

  const name = normalizeName(body.name);

  if (!name) {
    return mutationError(
      request,
      isFormRequest,
      400,
      "INVALID_NAME",
      "이름을 입력해 주세요.",
    );
  }

  const parentId = parentValue(kind, body);

  if (parentId === "__invalid__") {
    return mutationError(
      request,
      isFormRequest,
      400,
      "INVALID_PARENT",
      invalidParentMessage(kind),
    );
  }

  const { client, error: clientError } = createSupabaseServiceClient();

  if (!client) {
    return mutationError(
      request,
      isFormRequest,
      500,
      "SERVICE_CLIENT_UNAVAILABLE",
      clientError ?? "소속 선택값 추가를 위한 서버 설정이 준비되지 않았습니다.",
    );
  }

  const builtValues = await buildMutationValues({
    client,
    groupType: kind === "group" ? normalizeGroupType(body.group_type) : undefined,
    kind,
    name,
    parentId,
  });

  if (builtValues.error || !builtValues.values) {
    return mutationError(
      request,
      isFormRequest,
      400,
      "INVALID_PARENT",
      builtValues.error ?? "소속 선택값을 확인해 주세요.",
    );
  }

  const mutationTable = client.from(table) as unknown as AffiliationMutationTable;
  const { data, error } = await insertAffiliationRow({
    kind,
    mutationTable,
    values: builtValues.values,
  });

  if (error || !data) {
    debugMutation({
      error: error?.message ?? "No row returned.",
      intent: action.intent,
      status: "failure",
      table,
    });
    console.error("[ADMIN_AFFILIATION_CREATE_FAILED]", {
      kind,
      message: error?.message ?? "No row returned.",
      code: error?.code,
      details: error?.details,
    });

    return mutationError(
      request,
      isFormRequest,
      500,
      "AFFILIATION_CREATE_FAILED",
      "소속 선택값 추가에 실패했습니다.",
    );
  }

  debugMutation({
    intent: action.intent,
    status: "success",
    table,
  });
  revalidatePath("/admin/settings/affiliations");
  revalidatePath("/admin/users");

  if (isFormRequest) {
    return redirectToAffiliations(request, {
      saved: kind,
    });
  }

  return NextResponse.json(
    {
      ok: true,
      data: {
        [kind]: data as RegionMutationRow | ChurchMutationRow | GroupMutationRow,
        message: "소속 선택값이 추가되었습니다.",
      },
    },
    {
      headers: noStoreHeaders,
      status: 201,
    },
  );
}

export async function PATCH(request: Request) {
  const authError = await requireSuperAdminApi();

  if (authError) {
    return authError;
  }

  let body: AffiliationBody;
  let isFormRequest = false;

  try {
    const parsed = await readAffiliationBody(request);
    body = parsed.body;
    isFormRequest = parsed.isFormRequest;
  } catch {
    return mutationError(
      request,
      isFormRequest,
      400,
      "INVALID_BODY",
      "요청 본문을 확인해 주세요.",
    );
  }

  const action = normalizeIntent(body.intent);

  if (!action || action.mode !== "update") {
    return mutationError(
      request,
      isFormRequest,
      400,
      "INVALID_INTENT",
      "소속 선택값 수정 동작을 확인해 주세요.",
    );
  }

  const kind = action.kind;
  const table = tableName(kind);

  const id = normalizeRequiredUuid(body.id);

  if (!id) {
    return mutationError(
      request,
      isFormRequest,
      400,
      "INVALID_ID",
      "소속 선택값 ID를 확인해 주세요.",
    );
  }

  const name = normalizeName(body.name);

  if (!name) {
    return mutationError(
      request,
      isFormRequest,
      400,
      "INVALID_NAME",
      "이름을 입력해 주세요.",
    );
  }

  const parentId = parentValue(kind, body);

  if (parentId === "__invalid__") {
    return mutationError(
      request,
      isFormRequest,
      400,
      "INVALID_PARENT",
      invalidParentMessage(kind),
    );
  }

  const { client, error: clientError } = createSupabaseServiceClient();

  if (!client) {
    return mutationError(
      request,
      isFormRequest,
      500,
      "SERVICE_CLIENT_UNAVAILABLE",
      clientError ?? "소속 선택값 수정을 위한 서버 설정이 준비되지 않았습니다.",
    );
  }

  const builtValues = await buildMutationValues({
    client,
    currentId: id,
    kind,
    name,
    parentId,
  });

  if (builtValues.error || !builtValues.values) {
    return mutationError(
      request,
      isFormRequest,
      400,
      "INVALID_PARENT",
      builtValues.error ?? "소속 선택값을 확인해 주세요.",
    );
  }

  const values = {
    ...builtValues.values,
    updated_at: new Date().toISOString(),
  };
  const mutationTable = client.from(table) as unknown as AffiliationMutationTable;
  const { data, error } = await mutationTable
    .update(values)
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) {
    debugMutation({
      error: error?.message ?? "No row returned.",
      intent: action.intent,
      status: "failure",
      table,
    });
    console.error("[ADMIN_AFFILIATION_UPDATE_FAILED]", {
      kind,
      message: error?.message ?? "No row returned.",
      code: error?.code,
      details: error?.details,
    });

    return mutationError(
      request,
      isFormRequest,
      500,
      "AFFILIATION_UPDATE_FAILED",
      "소속 선택값 수정에 실패했습니다.",
    );
  }

  debugMutation({
    intent: action.intent,
    status: "success",
    table,
  });
  revalidatePath("/admin/settings/affiliations");
  revalidatePath("/admin/users");

  if (isFormRequest) {
    return redirectToAffiliations(request, {
      saved: kind,
    });
  }

  return NextResponse.json(
    {
      ok: true,
      data: {
        [kind]: data as RegionMutationRow | ChurchMutationRow | GroupMutationRow,
        message: "소속 선택값이 수정되었습니다.",
      },
    },
    {
      headers: noStoreHeaders,
      status: 200,
    },
  );
}
