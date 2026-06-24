import { headers } from "next/headers";
import { PROFILE_ID_HEADER } from "@/lib/auth/identity-headers";

/**
 * 미들웨어가 같은 요청에서 검증한 profile id.
 * 헤더가 없으면 null → 호출부가 기존 auth_user_id 조회 경로로 fallback.
 */
export async function getVerifiedProfileId(): Promise<string | null> {
  try {
    const headerStore = await headers();
    return headerStore.get(PROFILE_ID_HEADER);
  } catch {
    return null;
  }
}
