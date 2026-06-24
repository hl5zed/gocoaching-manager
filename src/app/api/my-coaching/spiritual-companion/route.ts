import { NextResponse } from "next/server";
import { getAiProvider, type CompanionLocale } from "@/lib/ai/providers";
import { getSession } from "@/lib/auth/getSession";
import { getVerifiedProfileId } from "@/lib/auth/verified-identity";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DEFAULT_TIMEZONE, getTodayDateInTimezone } from "@/lib/timezone";

export const dynamic = "force-dynamic";

const noStoreHeaders = {
  "Cache-Control": "no-store",
};

const DEFAULT_MAX_INPUT_CHARS = 1500;
const DEFAULT_MAX_DAILY_MESSAGES = 5;
const DEFAULT_MAX_OUTPUT_TOKENS = 500;
const ALLOWED_LOCALES = ["ko", "en", "th"] as const;

type ProfileRow = {
  id: string;
  timezone: string | null;
};

type MessageInsert = {
  content: string;
  input_tokens?: number | null;
  model?: string | null;
  output_tokens?: number | null;
  profile_id: string;
  provider: string;
  role: "user" | "assistant";
  user_local_date: string;
};

type MessageRow = {
  content: string;
  created_at: string;
  id: string;
  model: string | null;
  provider: string;
  role: "user" | "assistant" | "system";
  user_local_date: string;
};

type SupabaseQueryError = {
  code?: string;
  details?: string | null;
  hint?: string | null;
  message?: string;
};

type SupabaseMaybeSingleResult<TData> = Promise<{
  data: TData | null;
  error: SupabaseQueryError | null;
}>;

type SupabaseCountResult = Promise<{
  count: number | null;
  error: SupabaseQueryError | null;
}>;

type SupabaseWriteResult = Promise<{
  error: SupabaseQueryError | null;
}>;

type SupabaseListResult<TData> = Promise<{
  data: TData[] | null;
  error: SupabaseQueryError | null;
}>;

type SupabaseRpcResult<TData> = Promise<{
  data: TData | null;
  error: SupabaseQueryError | null;
}>;

type ProfilesTable = {
  select: (columns: "id, timezone") => {
    eq: (column: "auth_user_id" | "id", value: string) => {
      neq: (column: "status", value: "anonymized") => {
        is: (
          column: "deleted_at",
          value: null,
        ) => {
          maybeSingle: () => SupabaseMaybeSingleResult<ProfileRow>;
        };
      };
    };
  };
};

type AiMessagesTable = {
  insert: (values: MessageInsert) => SupabaseWriteResult;
  select: {
    (
      columns: "id",
      options: { count: "exact"; head: true },
    ): AiMessagesCountQuery;
    (
      columns: "id, role, content, provider, model, user_local_date, created_at",
    ): {
      eq: (column: "profile_id", value: string) => {
        is: (column: "deleted_at", value: null) => {
          order: (
            column: "created_at",
            options: { ascending: false },
          ) => {
            limit: (count: number) => SupabaseListResult<MessageRow>;
          };
        };
      };
    };
  };
};

type AiMessagesCountQuery = {
    eq: (
      column: "profile_id" | "role" | "user_local_date",
      value: string,
    ) => AiMessagesCountQuery;
    is: (column: "deleted_at", value: null) => SupabaseCountResult;
};

type SpiritualCompanionSupabaseClient = {
  from(table: "profiles"): ProfilesTable;
  from(table: "ai_companion_messages"): AiMessagesTable;
  rpc: (functionName: "current_profile_id") => SupabaseRpcResult<string>;
};

function jsonResponse(
  body: Record<string, unknown>,
  status: 200 | 201 | 400 | 401 | 403 | 404 | 429 | 500,
) {
  return NextResponse.json(body, {
    headers: noStoreHeaders,
    status,
  });
}

async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function parsePositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeLocale(value: unknown): CompanionLocale {
  return typeof value === "string" &&
    ALLOWED_LOCALES.includes(value as CompanionLocale)
    ? (value as CompanionLocale)
    : "ko";
}

function normalizeMessage(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getSpiritualCompanionClient(supabase: unknown) {
  return supabase as SpiritualCompanionSupabaseClient;
}

async function getDbCurrentProfileId(
  supabase: SpiritualCompanionSupabaseClient,
) {
  const { data, error } = await supabase.rpc("current_profile_id");

  if (error) {
    console.error("[SPIRITUAL_COMPANION_CURRENT_PROFILE_RPC_FAILED]", {
      code: error.code,
      details: error.details,
      hint: error.hint,
      message: error.message,
    });
    return {
      dbCurrentProfileId: null,
      error: "현재 로그인 사용자의 DB 프로필을 확인할 수 없습니다.",
      status: 500 as const,
    };
  }

  return {
    dbCurrentProfileId: data,
    error: null,
    status: 200 as const,
  };
}

async function getCurrentProfile() {
  const session = await getSession();

  if (!session.user) {
    return {
      error: "로그인이 필요합니다.",
      profile: null,
      status: 401 as const,
    };
  }

  const supabase = getSpiritualCompanionClient(await createSupabaseServerClient());
  const verifiedProfileId = await getVerifiedProfileId();

  const { data: profile, error } = verifiedProfileId
    ? await supabase
        .from("profiles")
        .select("id, timezone")
        .eq("id", verifiedProfileId)
        .neq("status", "anonymized")
        .is("deleted_at", null)
        .maybeSingle()
    : await supabase
        .from("profiles")
        .select("id, timezone")
        .eq("auth_user_id", session.user.id)
        .neq("status", "anonymized")
        .is("deleted_at", null)
        .maybeSingle();

  if (error) {
    console.error("[SPIRITUAL_COMPANION_PROFILE_QUERY_FAILED]", error.message);
    return {
      error: "프로필을 확인할 수 없습니다.",
      profile: null,
      status: 500 as const,
    };
  }

  if (!profile) {
    return {
      error: "현재 로그인 사용자의 프로필을 찾을 수 없습니다.",
      profile: null,
      status: 404 as const,
    };
  }

  return {
    error: null,
    profile,
    status: 200 as const,
  };
}

async function getVerifiedProfileContext() {
  const currentProfile = await getCurrentProfile();

  if (!currentProfile.profile) {
    return {
      dbCurrentProfileId: null,
      error: currentProfile.error,
      profile: null,
      routeProfileId: null,
      status: currentProfile.status,
      supabase: null,
    };
  }

  const supabase = getSpiritualCompanionClient(await createSupabaseServerClient());
  const routeProfileId = currentProfile.profile.id;
  const dbProfileResult = await getDbCurrentProfileId(supabase);

  if (dbProfileResult.error) {
    return {
      dbCurrentProfileId: null,
      error: dbProfileResult.error,
      profile: currentProfile.profile,
      routeProfileId,
      status: dbProfileResult.status,
      supabase,
    };
  }

  const dbCurrentProfileId = dbProfileResult.dbCurrentProfileId;

  if (!dbCurrentProfileId || dbCurrentProfileId !== routeProfileId) {
    console.error("[SPIRITUAL_COMPANION_PROFILE_ID_MISMATCH]", {
      dbCurrentProfileId,
      routeProfileId,
    });
    return {
      dbCurrentProfileId,
      error: "현재 로그인 사용자의 프로필 권한을 확인할 수 없습니다.",
      profile: currentProfile.profile,
      routeProfileId,
      status: 403 as const,
      supabase,
    };
  }

  return {
    dbCurrentProfileId,
    error: null,
    profile: currentProfile.profile,
    routeProfileId,
    status: 200 as const,
    supabase,
  };
}

export async function GET() {
  const profileContext = await getVerifiedProfileContext();

  if (!profileContext.profile || !profileContext.supabase || !profileContext.dbCurrentProfileId) {
    return jsonResponse(
      {
        message: profileContext.error,
        ok: false,
      },
      profileContext.status,
    );
  }

  const { data, error } = await profileContext.supabase
    .from("ai_companion_messages")
    .select("id, role, content, provider, model, user_local_date, created_at")
    .eq("profile_id", profileContext.dbCurrentProfileId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("[SPIRITUAL_COMPANION_MESSAGES_QUERY_FAILED]", {
      code: error.code,
      details: error.details,
      message: error.message,
      routeProfileId: profileContext.routeProfileId,
      dbCurrentProfileId: profileContext.dbCurrentProfileId,
    });
    return jsonResponse(
      {
        message: "저장된 대화를 불러올 수 없습니다.",
        ok: false,
      },
      500,
    );
  }

  return jsonResponse(
    {
      messages: (data ?? []).slice().reverse(),
      ok: true,
    },
    200,
  );
}

export async function POST(request: Request) {
  const input = await readJson(request);
  const rawInput = input && typeof input === "object" ? input : {};
  const message = normalizeMessage((rawInput as { message?: unknown }).message);
  const locale = normalizeLocale((rawInput as { locale?: unknown }).locale);
  const maxInputChars = parsePositiveInteger(
    process.env.AI_MAX_INPUT_CHARS,
    DEFAULT_MAX_INPUT_CHARS,
  );
  const maxDailyMessages = parsePositiveInteger(
    process.env.AI_MAX_DAILY_MESSAGES,
    DEFAULT_MAX_DAILY_MESSAGES,
  );
  const maxOutputTokens = parsePositiveInteger(
    process.env.AI_MAX_OUTPUT_TOKENS,
    DEFAULT_MAX_OUTPUT_TOKENS,
  );

  if (!message) {
    return jsonResponse(
      {
        message: "메시지를 입력해 주세요.",
        ok: false,
      },
      400,
    );
  }

  if (message.length > maxInputChars) {
    return jsonResponse(
      {
        message: `메시지는 ${maxInputChars}자 이하로 입력해 주세요.`,
        ok: false,
      },
      400,
    );
  }

  const profileContext = await getVerifiedProfileContext();

  if (!profileContext.profile || !profileContext.supabase || !profileContext.dbCurrentProfileId) {
    return jsonResponse(
      {
        message: profileContext.error,
        ok: false,
      },
      profileContext.status,
    );
  }

  const userLocalDate = getTodayDateInTimezone(
    profileContext.profile.timezone ?? DEFAULT_TIMEZONE,
  );

  const { count, error: countError } = await profileContext.supabase
    .from("ai_companion_messages")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profileContext.dbCurrentProfileId)
    .eq("role", "assistant")
    .eq("user_local_date", userLocalDate)
    .is("deleted_at", null);

  if (countError) {
    console.error("[SPIRITUAL_COMPANION_DAILY_LIMIT_QUERY_FAILED]", countError.message);
    return jsonResponse(
      {
        message: "오늘의 대화 가능 횟수를 확인할 수 없습니다.",
        ok: false,
      },
      500,
    );
  }

  const usedToday = count ?? 0;

  if (usedToday >= maxDailyMessages) {
    return jsonResponse(
      {
        message: "오늘의 AI 동반자 응답 횟수를 모두 사용했습니다.",
        ok: false,
        remainingToday: 0,
      },
      429,
    );
  }

  const provider = getAiProvider();

  const { error: userMessageError } = await profileContext.supabase
    .from("ai_companion_messages")
    .insert({
      content: message,
      profile_id: profileContext.dbCurrentProfileId,
      provider: provider.name,
      role: "user",
      user_local_date: userLocalDate,
    });

  if (userMessageError) {
    console.error("[SPIRITUAL_COMPANION_USER_MESSAGE_INSERT_FAILED]", {
      code: userMessageError.code,
      details: userMessageError.details,
      message: userMessageError.message,
      routeProfileId: profileContext.routeProfileId,
      dbCurrentProfileId: profileContext.dbCurrentProfileId,
    });
    return jsonResponse(
      {
        message: "메시지를 저장할 수 없습니다.",
        ok: false,
      },
      500,
    );
  }

  const reply = await provider.generateCompanionReply({
    locale,
    maxOutputTokens,
    userMessage: message,
  });

  const { error: assistantMessageError } = await profileContext.supabase
    .from("ai_companion_messages")
    .insert({
      content: reply.text,
      input_tokens: reply.inputTokens ?? null,
      model: reply.model ?? null,
      output_tokens: reply.outputTokens ?? null,
      profile_id: profileContext.dbCurrentProfileId,
      provider: provider.name,
      role: "assistant",
      user_local_date: userLocalDate,
    });

  if (assistantMessageError) {
    console.error(
      "[SPIRITUAL_COMPANION_ASSISTANT_MESSAGE_INSERT_FAILED]",
      {
        code: assistantMessageError.code,
        details: assistantMessageError.details,
        message: assistantMessageError.message,
        routeProfileId: profileContext.routeProfileId,
        dbCurrentProfileId: profileContext.dbCurrentProfileId,
      },
    );
    return jsonResponse(
      {
        message: "AI 응답을 저장할 수 없습니다.",
        ok: false,
      },
      500,
    );
  }

  return jsonResponse(
    {
      answer: reply.text,
      model: reply.model,
      ok: true,
      provider: provider.name,
      remainingToday: Math.max(maxDailyMessages - usedToday - 1, 0),
    },
    201,
  );
}
