import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { GetSessionResult } from "@/types/auth";

/**
 * React cache()로 래핑되어 있어 동일한 서버 요청(렌더 패스) 내에서
 * 여러 번 호출되어도 supabase.auth.getUser() 네트워크 왕복은 1회만 발생합니다.
 */
export const getSession = cache(async function getSession(): Promise<GetSessionResult> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
      return { user: null, error: error?.message ?? "No authenticated user" };
    }

    return {
      user: {
        id: data.user.id,
        email: data.user.email ?? null,
      },
      error: null,
    };
  } catch (error) {
    return {
      user: null,
      error:
        error instanceof Error
          ? error.message
          : "Authentication service is unavailable.",
    };
  }
});
