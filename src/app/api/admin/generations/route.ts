import { NextResponse } from "next/server";
import { requireAdminProfile } from "@/lib/auth/require-admin-profile";
import { hasRole } from "@/lib/auth/has-role";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { getAdminGenerationOptions } from "@/lib/api/admin/generations";

type GenerationBody = {
  generation_number?: unknown;
  id?: unknown;
  is_active?: unknown;
  label?: unknown;
  sort_order?: unknown;
};

type ExistingGeneration = {
  id: string;
  generation_number: number;
  scope_type: string;
  scope_id: string | null;
};

type GenerationMutationRow = {
  id: string;
  generation_number: number;
  label: string;
  scope_type: string;
  scope_id: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type GenerationInsertValues = {
  generation_number: number;
  label: string;
  scope_type: "global";
  scope_id: null;
  is_active: boolean;
  sort_order: number;
};

type GenerationUpdateValues = {
  generation_number?: number;
  is_active?: boolean;
  label?: string;
  sort_order?: number;
  updated_at: string;
};

type GenerationMutationResult = Promise<{
  data: GenerationMutationRow | null;
  error: { message?: string } | null;
}>;

type GenerationsMutationTable = {
  insert: (values: GenerationInsertValues) => {
    select: (columns: string) => {
      single: () => GenerationMutationResult;
    };
  };
  update: (values: GenerationUpdateValues) => {
    eq: (column: "id", value: string) => {
      select: (columns: string) => {
        single: () => GenerationMutationResult;
      };
    };
  };
};

const noStoreHeaders = {
  "Cache-Control": "no-store",
};

const selectColumns =
  "id, generation_number, label, scope_type, scope_id, is_active, sort_order, created_at, updated_at";

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

function normalizeId(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeLabel(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeInteger(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.trim())
        : Number.NaN;

  return Number.isInteger(parsed) ? parsed : null;
}

async function loadExistingGenerations() {
  const { client, error: clientError } = createSupabaseServiceClient();

  if (!client) {
    return {
      generations: [] as ExistingGeneration[],
      error:
        clientError ?? "세대 옵션 관리를 위한 서버 설정이 준비되지 않았습니다.",
    };
  }

  const { data, error } = await client
    .from("generation_options")
    .select("id, generation_number, scope_type, scope_id")
    .eq("scope_type", "global")
    .is("scope_id", null)
    .is("deleted_at", null);

  if (error) {
    console.error("[ADMIN_GENERATIONS_DUPLICATE_LOOKUP_FAILED]", error.message);
    return {
      generations: [] as ExistingGeneration[],
      error: "세대 옵션 정보를 확인하지 못했습니다.",
    };
  }

  return {
    generations: (data ?? []) as ExistingGeneration[],
    error: null,
  };
}

function hasDuplicateGeneration(
  generations: ExistingGeneration[],
  generationNumber: number,
  currentId?: string,
) {
  return generations.some((generation) => {
    if (currentId && generation.id === currentId) {
      return false;
    }

    return generation.generation_number === generationNumber;
  });
}

export async function GET() {
  const authError = await requireSuperAdminApi();

  if (authError) {
    return authError;
  }

  const result = await getAdminGenerationOptions();

  if (result.error) {
    return jsonError(500, "GENERATIONS_LOOKUP_FAILED", result.error);
  }

  return NextResponse.json(
    {
      ok: true,
      data: {
        generations: result.generations,
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

  let body: GenerationBody;

  try {
    body = (await request.json()) as GenerationBody;
  } catch {
    return jsonError(400, "INVALID_BODY", "요청 본문을 확인해 주세요.");
  }

  const generationNumber = normalizeInteger(body.generation_number);
  const label = normalizeLabel(body.label);
  const sortOrder = normalizeInteger(body.sort_order) ?? generationNumber;

  if (!generationNumber || generationNumber < 1) {
    return jsonError(400, "INVALID_GENERATION", "세대 번호를 확인해 주세요.");
  }

  if (!label) {
    return jsonError(400, "INVALID_LABEL", "표시 이름을 입력해 주세요.");
  }

  if (sortOrder === null) {
    return jsonError(400, "INVALID_SORT_ORDER", "정렬 순서를 확인해 주세요.");
  }

  const existing = await loadExistingGenerations();

  if (existing.error) {
    return jsonError(500, "GENERATIONS_LOOKUP_FAILED", existing.error);
  }

  if (hasDuplicateGeneration(existing.generations, generationNumber)) {
    return jsonError(409, "GENERATION_DUPLICATE", "이미 등록된 세대 번호입니다.");
  }

  const { client, error: clientError } = createSupabaseServiceClient();

  if (!client) {
    return jsonError(
      500,
      "SERVICE_CLIENT_UNAVAILABLE",
      clientError ?? "세대 옵션 추가를 위한 서버 설정이 준비되지 않았습니다.",
    );
  }

  const generationsTable = client
    .from("generation_options") as unknown as GenerationsMutationTable;
  const { data, error } = await generationsTable
    .insert({
      generation_number: generationNumber,
      label,
      scope_type: "global",
      scope_id: null,
      is_active: true,
      sort_order: sortOrder,
    })
    .select(selectColumns)
    .single();

  if (error) {
    console.error("[ADMIN_GENERATION_CREATE_FAILED]", error.message);
    return jsonError(500, "GENERATION_CREATE_FAILED", "세대 옵션 추가에 실패했습니다.");
  }

  return NextResponse.json(
    {
      ok: true,
      data: {
        generation: data,
        message: "세대 옵션이 추가되었습니다.",
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

  let body: GenerationBody;

  try {
    body = (await request.json()) as GenerationBody;
  } catch {
    return jsonError(400, "INVALID_BODY", "요청 본문을 확인해 주세요.");
  }

  const id = normalizeId(body.id);

  if (!id) {
    return jsonError(400, "INVALID_ID", "세대 옵션 ID를 확인할 수 없습니다.");
  }

  const hasGenerationNumber = Object.hasOwn(body, "generation_number");
  const hasLabel = Object.hasOwn(body, "label");
  const hasSortOrder = Object.hasOwn(body, "sort_order");
  const hasIsActive = Object.hasOwn(body, "is_active");
  const updateValues: GenerationUpdateValues = {
    updated_at: new Date().toISOString(),
  };

  if (hasGenerationNumber) {
    const generationNumber = normalizeInteger(body.generation_number);

    if (!generationNumber || generationNumber < 1) {
      return jsonError(400, "INVALID_GENERATION", "세대 번호를 확인해 주세요.");
    }

    updateValues.generation_number = generationNumber;
  }

  if (hasLabel) {
    const label = normalizeLabel(body.label);

    if (!label) {
      return jsonError(400, "INVALID_LABEL", "표시 이름을 입력해 주세요.");
    }

    updateValues.label = label;
  }

  if (hasSortOrder) {
    const sortOrder = normalizeInteger(body.sort_order);

    if (sortOrder === null) {
      return jsonError(400, "INVALID_SORT_ORDER", "정렬 순서를 확인해 주세요.");
    }

    updateValues.sort_order = sortOrder;
  }

  if (hasIsActive) {
    if (typeof body.is_active !== "boolean") {
      return jsonError(400, "INVALID_STATUS", "사용 여부 값을 확인해 주세요.");
    }

    updateValues.is_active = body.is_active;
  }

  if (!hasGenerationNumber && !hasLabel && !hasSortOrder && !hasIsActive) {
    return jsonError(400, "EMPTY_UPDATE", "수정할 내용이 없습니다.");
  }

  const existing = await loadExistingGenerations();

  if (existing.error) {
    return jsonError(500, "GENERATIONS_LOOKUP_FAILED", existing.error);
  }

  const currentGeneration = existing.generations.find(
    (generation) => generation.id === id,
  );

  if (!currentGeneration) {
    return jsonError(404, "GENERATION_NOT_FOUND", "세대 옵션을 찾을 수 없습니다.");
  }

  const nextGenerationNumber =
    updateValues.generation_number ?? currentGeneration.generation_number;

  if (hasDuplicateGeneration(existing.generations, nextGenerationNumber, id)) {
    return jsonError(409, "GENERATION_DUPLICATE", "이미 등록된 세대 번호입니다.");
  }

  const { client, error: clientError } = createSupabaseServiceClient();

  if (!client) {
    return jsonError(
      500,
      "SERVICE_CLIENT_UNAVAILABLE",
      clientError ?? "세대 옵션 수정을 위한 서버 설정이 준비되지 않았습니다.",
    );
  }

  const generationsTable = client
    .from("generation_options") as unknown as GenerationsMutationTable;
  const { data, error } = await generationsTable
    .update(updateValues)
    .eq("id", id)
    .select(selectColumns)
    .single();

  if (error) {
    console.error("[ADMIN_GENERATION_UPDATE_FAILED]", error.message);
    return jsonError(500, "GENERATION_UPDATE_FAILED", "세대 옵션 수정에 실패했습니다.");
  }

  return NextResponse.json(
    {
      ok: true,
      data: {
        generation: data,
        message: "세대 옵션이 수정되었습니다.",
      },
    },
    {
      status: 200,
      headers: noStoreHeaders,
    },
  );
}
