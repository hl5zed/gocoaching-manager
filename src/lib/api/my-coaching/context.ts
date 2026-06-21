import { getSession } from "@/lib/auth/getSession";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** @deprecated 이름은 legacy 호환용. 실제로는 JWT + RLS server client입니다. */
export type ServiceClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

type ErrorCode =
  | "UNAUTHORIZED"
  | "PROFILE_NOT_FOUND"
  | "PROFILE_QUERY_FAILED"
  | "MOKSILGI_QUERY_FAILED";

type SafeError = { code: ErrorCode; message: string };

export type MoksilgiContext =
  | { ok: true; profileId: string; serviceClient: ServiceClient }
  | { ok: false; error: SafeError };

export async function getMoksilgiContext(options?: {
  logTag?: string;
  serviceClientUnavailableMessage?: string;
  /** 페이지에서 이미 조회한 profile id — profiles 재조회 생략 */
  profileId?: string;
}): Promise<MoksilgiContext> {
  const logTag = options?.logTag ?? "MOKSILGI_SERVER_CLIENT_UNAVAILABLE";
  const unavailableMessage =
    options?.serviceClientUnavailableMessage ?? "지금 월별 체크리스트를 불러올 수 없습니다.";

  let profileId: string;
  let supabase: ServiceClient;

  try {
    supabase = await createSupabaseServerClient();
  } catch (error) {
    console.error(`[${logTag}]`, error);
    return { ok: false, error: { code: "MOKSILGI_QUERY_FAILED", message: unavailableMessage } };
  }

  if (options?.profileId) {
    const session = await getSession();
    if (!session.user) {
      return { ok: false, error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." } };
    }
    profileId = options.profileId;
  } else {
    const session = await getSession();
    if (!session.user) {
      return { ok: false, error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." } };
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("auth_user_id", session.user.id)
      .is("deleted_at", null)
      .neq("status", "anonymized")
      .maybeSingle();

    if (error) {
      return { ok: false, error: { code: "PROFILE_QUERY_FAILED", message: "프로필을 불러올 수 없습니다." } };
    }
    if (!profile) {
      return { ok: false, error: { code: "PROFILE_NOT_FOUND", message: "아직 프로필이 생성되지 않았습니다." } };
    }

    profileId = (profile as { id: string }).id;
  }

  return { ok: true, profileId, serviceClient: supabase };
}
