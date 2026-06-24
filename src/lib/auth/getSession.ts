import { cache } from "react";
import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  AUTH_EMAIL_HEADER,
  AUTH_USER_ID_HEADER,
} from "@/lib/auth/identity-headers";
import type { GetSessionResult } from "@/types/auth";

/**
 * React cache()로 래핑되어 있어 동일한 서버 요청(렌더 패스) 내에서
 * 여러 번 호출되어도 supabase.auth.getUser() 네트워크 왕복은 1회만 발생합니다.
 *
 * Stage A 최적화: 미들웨어가 같은 요청에서 이미 auth.getUser()로 검증한 식별자를
 * 요청 헤더로 전달한 경우, 그 값을 재사용해 getUser() 원격 왕복을 생략합니다.
 * 헤더가 없으면(미들웨어 매처 밖/공개 경로 등) 기존 getUser() 경로로 fallback합니다.
 */
export const getSession = cache(async function getSession(): Promise<GetSessionResult> {
  // 1) 미들웨어가 검증해 전달한 헤더 우선 사용
  try {
    const headerStore = await headers();
    const headerUserId = headerStore.get(AUTH_USER_ID_HEADER);

    if (headerUserId) {
      return {
        user: {
          id: headerUserId,
          email: headerStore.get(AUTH_EMAIL_HEADER),
        },
        error: null,
      };
    }
  } catch {
    // headers()를 쓸 수 없는 컨텍스트 → 아래 getUser fallback으로 진행
  }

  // 2) fallback: 기존 auth.getUser() 경로 (동작 동일)
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
