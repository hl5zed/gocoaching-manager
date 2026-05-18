import "server-only";

import { ADMIN_WRITE_ROLES, requireAdminProfile } from "@/lib/auth/require-admin-profile";
import { getSession } from "@/lib/auth/getSession";
import { getUserRoles } from "@/lib/auth/get-user-roles";
import { hasRole } from "@/lib/auth/has-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import type { UserRole } from "@/types/database";

export const ANNOUNCEMENT_AUDIENCES = ["all", "admin"] as const;
export const ANNOUNCEMENT_PLACEMENTS = [
  "dashboard",
  "login_after",
  "admin",
] as const;

export type SystemAnnouncementAudience =
  (typeof ANNOUNCEMENT_AUDIENCES)[number];
export type SystemAnnouncementPlacement =
  (typeof ANNOUNCEMENT_PLACEMENTS)[number];

export type SystemAnnouncement = {
  id: string;
  audience: SystemAnnouncementAudience;
  placement: SystemAnnouncementPlacement;
  title: string;
  body: string;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  priority: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type SystemAnnouncementMutationInput = {
  audience?: unknown;
  body?: unknown;
  ends_at?: unknown;
  is_active?: unknown;
  placement?: unknown;
  priority?: unknown;
  starts_at?: unknown;
  title?: unknown;
};

type DynamicSupabaseClient = {
  from: (table: string) => any;
};

type MutationValues = {
  audience?: SystemAnnouncementAudience;
  body?: string;
  ends_at?: string | null;
  is_active?: boolean;
  placement?: SystemAnnouncementPlacement;
  priority?: number;
  starts_at?: string | null;
  title?: string;
  updated_by?: string;
  created_by?: string;
  deleted_at?: string | null;
};

const SELECT_COLUMNS =
  "id,audience,placement,title,body,is_active,starts_at,ends_at,priority,created_by,updated_by,created_at,updated_at,deleted_at";
const ACTIVE_SELECT_COLUMNS =
  "id,audience,placement,title,body,priority,created_at";
const ACTIVE_ANNOUNCEMENTS_CACHE_TTL_MS = 3 * 60 * 1000;

const MUTATION_KEYS = [
  "audience",
  "body",
  "ends_at",
  "is_active",
  "placement",
  "priority",
  "starts_at",
  "title",
] as const;

type ActiveAnnouncementCacheEntry = {
  announcements: SystemAnnouncement[];
  expiresAt: number;
};

const activeAnnouncementsCache = new Map<string, ActiveAnnouncementCacheEntry>();

function getServiceClient(): DynamicSupabaseClient {
  const { client, error } = createSupabaseServiceClient();

  if (!client) {
    throw new Error(error ?? "Supabase service client is not configured.");
  }

  return client as unknown as DynamicSupabaseClient;
}

function isAnnouncementAudience(
  value: unknown,
): value is SystemAnnouncementAudience {
  return ANNOUNCEMENT_AUDIENCES.includes(value as SystemAnnouncementAudience);
}

function isAnnouncementPlacement(
  value: unknown,
): value is SystemAnnouncementPlacement {
  return ANNOUNCEMENT_PLACEMENTS.includes(value as SystemAnnouncementPlacement);
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isMutationRecord(
  input: SystemAnnouncementMutationInput,
): input is SystemAnnouncementMutationInput & Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}

function findUnknownMutationKeys(input: Record<string, unknown>) {
  return Object.keys(input).filter(
    (key) => !MUTATION_KEYS.includes(key as (typeof MUTATION_KEYS)[number]),
  );
}

function normalizeNullableDate(value: unknown) {
  if (value === null || value === "") {
    return {
      ok: true as const,
      value: null,
    };
  }

  if (typeof value !== "string") {
    return {
      ok: false as const,
      error: "날짜 형식이 올바르지 않습니다.",
    };
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return {
      ok: false as const,
      error: "날짜 형식이 올바르지 않습니다.",
    };
  }

  return {
    ok: true as const,
    value: date.toISOString(),
  };
}

function validateAnnouncementInput(
  input: SystemAnnouncementMutationInput,
  mode: "create" | "update",
): { ok: true; values: MutationValues } | { ok: false; error: string } {
  if (!isMutationRecord(input)) {
    return { ok: false, error: "요청 형식이 올바르지 않습니다." };
  }

  const unknownKeys = findUnknownMutationKeys(input);
  if (unknownKeys.length > 0) {
    return {
      ok: false,
      error: `허용되지 않은 공지 항목입니다: ${unknownKeys.join(", ")}`,
    };
  }

  if (mode === "update" && Object.keys(input).length === 0) {
    return { ok: false, error: "수정할 공지 항목이 없습니다." };
  }

  const values: MutationValues = {};

  if (mode === "create" || "title" in input) {
    const title = normalizeText(input.title);
    if (!title) {
      return { ok: false, error: "공지 제목을 입력해 주세요." };
    }
    values.title = title;
  }

  if (mode === "create" || "body" in input) {
    const body = normalizeText(input.body);
    if (!body) {
      return { ok: false, error: "공지 본문을 입력해 주세요." };
    }
    values.body = body;
  }

  if (mode === "create" || "audience" in input) {
    if (!isAnnouncementAudience(input.audience)) {
      return { ok: false, error: "공지 대상을 확인해 주세요." };
    }
    values.audience = input.audience;
  }

  if (mode === "create" || "placement" in input) {
    if (!isAnnouncementPlacement(input.placement)) {
      return { ok: false, error: "공지 표시 위치를 확인해 주세요." };
    }
    values.placement = input.placement;
  }

  if (mode === "create" || "is_active" in input) {
    if (typeof input.is_active !== "boolean") {
      return { ok: false, error: "공지 활성 상태를 확인해 주세요." };
    }
    values.is_active = input.is_active;
  }

  if (mode === "create" || "priority" in input) {
    const priority = input.priority ?? 0;
    if (typeof priority !== "number" || !Number.isInteger(priority)) {
      return { ok: false, error: "공지 우선순위는 정수여야 합니다." };
    }
    values.priority = priority;
  }

  if (mode === "create" || "starts_at" in input) {
    const startsAt = normalizeNullableDate(input.starts_at ?? null);
    if (!startsAt.ok) {
      return { ok: false, error: "공지 시작일을 확인해 주세요." };
    }
    values.starts_at = startsAt.value;
  }

  if (mode === "create" || "ends_at" in input) {
    const endsAt = normalizeNullableDate(input.ends_at ?? null);
    if (!endsAt.ok) {
      return { ok: false, error: "공지 종료일을 확인해 주세요." };
    }
    values.ends_at = endsAt.value;
  }

  if (
    values.starts_at &&
    values.ends_at &&
    new Date(values.ends_at).getTime() <= new Date(values.starts_at).getTime()
  ) {
    return {
      ok: false,
      error: "공지 종료일은 시작일보다 늦어야 합니다.",
    };
  }

  return { ok: true, values };
}

function mapAnnouncement(row: Record<string, unknown>): SystemAnnouncement {
  return {
    id: String(row.id),
    audience: row.audience as SystemAnnouncementAudience,
    placement: row.placement as SystemAnnouncementPlacement,
    title: String(row.title ?? ""),
    body: String(row.body ?? ""),
    is_active: row.is_active === true,
    starts_at: typeof row.starts_at === "string" ? row.starts_at : null,
    ends_at: typeof row.ends_at === "string" ? row.ends_at : null,
    priority:
      typeof row.priority === "number" && Number.isInteger(row.priority)
        ? row.priority
        : 0,
    created_by: typeof row.created_by === "string" ? row.created_by : null,
    updated_by: typeof row.updated_by === "string" ? row.updated_by : null,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
    deleted_at: typeof row.deleted_at === "string" ? row.deleted_at : null,
  };
}

function mapActiveAnnouncement(row: Record<string, unknown>): SystemAnnouncement {
  const createdAt = String(row.created_at ?? "");

  return {
    id: String(row.id),
    audience: row.audience as SystemAnnouncementAudience,
    placement: row.placement as SystemAnnouncementPlacement,
    title: String(row.title ?? ""),
    body: String(row.body ?? ""),
    is_active: true,
    starts_at: null,
    ends_at: null,
    priority:
      typeof row.priority === "number" && Number.isInteger(row.priority)
        ? row.priority
        : 0,
    created_by: null,
    updated_by: null,
    created_at: createdAt,
    updated_at: createdAt,
    deleted_at: null,
  };
}

async function ensureExistingDateRange(
  client: DynamicSupabaseClient,
  id: string,
  values: MutationValues,
) {
  if (!("starts_at" in values) && !("ends_at" in values)) {
    return null;
  }

  const { data, error } = await client
    .from("system_announcements")
    .select("starts_at,ends_at")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    return "공지 정보를 확인하지 못했습니다.";
  }

  const startsAt =
    "starts_at" in values ? values.starts_at : (data.starts_at as string | null);
  const endsAt =
    "ends_at" in values ? values.ends_at : (data.ends_at as string | null);

  if (startsAt && endsAt && new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
    return "공지 종료일은 시작일보다 늦어야 합니다.";
  }

  return null;
}

export async function getAdminSystemAnnouncements(): Promise<{
  announcements: SystemAnnouncement[];
  error: string | null;
}> {
  try {
    const client = getServiceClient();
    const { data, error } = await client
      .from("system_announcements")
      .select(SELECT_COLUMNS)
      .order("deleted_at", { ascending: true, nullsFirst: true })
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      return {
        announcements: [],
        error: error.message,
      };
    }

    return {
      announcements: ((data ?? []) as Record<string, unknown>[]).map(mapAnnouncement),
      error: null,
    };
  } catch (error) {
    return {
      announcements: [],
      error:
        error instanceof Error
          ? error.message
          : "시스템 공지를 불러오지 못했습니다.",
    };
  }
}

export async function createSystemAnnouncement(
  input: SystemAnnouncementMutationInput,
  actorProfileId: string,
): Promise<{ announcement: SystemAnnouncement | null; error: string | null }> {
  const validation = validateAnnouncementInput(input, "create");
  if (!validation.ok) {
    return { announcement: null, error: validation.error };
  }

  try {
    const client = getServiceClient();
    const { data, error } = await client
      .from("system_announcements")
      .insert({
        ...validation.values,
        created_by: actorProfileId,
        updated_by: actorProfileId,
      })
      .select(SELECT_COLUMNS)
      .single();

    if (error || !data) {
      return {
        announcement: null,
        error: error?.message ?? "시스템 공지를 저장하지 못했습니다.",
      };
    }

    return {
      announcement: mapAnnouncement(data as Record<string, unknown>),
      error: null,
    };
  } catch (error) {
    return {
      announcement: null,
      error:
        error instanceof Error
          ? error.message
          : "시스템 공지를 저장하지 못했습니다.",
    };
  }
}

export async function updateSystemAnnouncement(
  id: string,
  input: SystemAnnouncementMutationInput,
  actorProfileId: string,
): Promise<{ announcement: SystemAnnouncement | null; error: string | null }> {
  const validation = validateAnnouncementInput(input, "update");
  if (!validation.ok) {
    return { announcement: null, error: validation.error };
  }

  try {
    const client = getServiceClient();
    const dateRangeError = await ensureExistingDateRange(client, id, validation.values);
    if (dateRangeError) {
      return { announcement: null, error: dateRangeError };
    }

    const { data, error } = await client
      .from("system_announcements")
      .update({
        ...validation.values,
        updated_by: actorProfileId,
      })
      .eq("id", id)
      .select(SELECT_COLUMNS)
      .single();

    if (error || !data) {
      return {
        announcement: null,
        error: error?.message ?? "시스템 공지를 수정하지 못했습니다.",
      };
    }

    return {
      announcement: mapAnnouncement(data as Record<string, unknown>),
      error: null,
    };
  } catch (error) {
    return {
      announcement: null,
      error:
        error instanceof Error
          ? error.message
          : "시스템 공지를 수정하지 못했습니다.",
    };
  }
}

export async function softDeleteSystemAnnouncement(
  id: string,
  actorProfileId: string,
): Promise<{ announcement: SystemAnnouncement | null; error: string | null }> {
  try {
    const client = getServiceClient();
    const { data, error } = await client
      .from("system_announcements")
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: actorProfileId,
      })
      .eq("id", id)
      .select(SELECT_COLUMNS)
      .single();

    if (error || !data) {
      return {
        announcement: null,
        error: error?.message ?? "시스템 공지를 삭제하지 못했습니다.",
      };
    }

    return {
      announcement: mapAnnouncement(data as Record<string, unknown>),
      error: null,
    };
  } catch (error) {
    return {
      announcement: null,
      error:
        error instanceof Error
          ? error.message
          : "시스템 공지를 삭제하지 못했습니다.",
    };
  }
}

export async function requireActiveSuperAdminForAnnouncements() {
  const admin = await requireAdminProfile();

  if (!admin.ok) {
    return {
      ok: false as const,
      status: admin.status,
      code: admin.code,
      message: admin.message,
    };
  }

  if (!hasRole(admin.roles, ["super_admin"])) {
    return {
      ok: false as const,
      status: 403,
      code: "SUPER_ADMIN_REQUIRED",
      message: "최고관리자 권한이 필요합니다.",
    };
  }

  const { data: activeProfile, error } = await admin.supabase
    .from("profiles")
    .select("id")
    .eq("id", admin.profile.id)
    .eq("status", "active")
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !activeProfile) {
    return {
      ok: false as const,
      status: 403,
      code: "ACTIVE_PROFILE_REQUIRED",
      message: "활성 최고관리자 계정이 필요합니다.",
    };
  }

  return {
    ok: true as const,
    profileId: admin.profile.id,
  };
}

export async function getActiveAnnouncementsForCurrentUser({
  placement,
  roles: existingRoles,
}: {
  placement: SystemAnnouncementPlacement;
  roles?: UserRole[];
}): Promise<SystemAnnouncement[]> {
  const supabase = await createSupabaseServerClient();
  let roles = existingRoles;

  if (!roles) {
    const session = await getSession();

    if (!session.user) {
      return [];
    }

    try {
      roles = await getUserRoles(supabase, session.user.id);
    } catch {
      return [];
    }
  }

  const isAdmin = hasRole(roles, ADMIN_WRITE_ROLES);
  const audiences: SystemAnnouncementAudience[] = isAdmin ? ["all", "admin"] : ["all"];
  const now = new Date().toISOString();
  const cacheKey = `${placement}:${audiences.join(",")}`;
  const cached = activeAnnouncementsCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.announcements;
  }

  const client = supabase as unknown as DynamicSupabaseClient;
  const { data, error } = await client
    .from("system_announcements")
    .select(ACTIVE_SELECT_COLUMNS)
    .eq("placement", placement)
    .eq("is_active", true)
    .is("deleted_at", null)
    .in("audience", audiences)
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gte.${now}`)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[SYSTEM_ANNOUNCEMENTS_ACTIVE_GET_FAILED]", error.message);
    }
    return [];
  }

  const announcements = ((data ?? []) as Record<string, unknown>[]).map(
    mapActiveAnnouncement,
  );

  // 공지 변경 후 최대 3분 반영 지연 가능.
  activeAnnouncementsCache.set(cacheKey, {
    announcements,
    expiresAt: Date.now() + ACTIVE_ANNOUNCEMENTS_CACHE_TTL_MS,
  });

  return announcements;
}
