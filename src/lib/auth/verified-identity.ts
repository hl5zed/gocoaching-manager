import { headers } from "next/headers";
import { isActiveLocale, type ActiveLocale } from "@/lib/i18n/config";
import {
  PROFILE_ID_HEADER,
  PROFILE_LOCALE_HEADER,
  PROFILE_LOCALE_KNOWN_HEADER,
} from "@/lib/auth/identity-headers";

export type VerifiedProfileLocaleResolution =
  | { kind: "unknown" }
  | { kind: "resolved"; locale: ActiveLocale | null };

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

/**
 * middleware가 profile context에서 active preferred_locale만 전달.
 * null/비활성은 getVerifiedProfileLocaleResolution() 사용.
 */
export async function getVerifiedProfileLocale(): Promise<ActiveLocale | null> {
  try {
    const headerStore = await headers();
    const value = headerStore.get(PROFILE_LOCALE_HEADER);
    return isActiveLocale(value) ? value : null;
  } catch {
    return null;
  }
}

/**
 * middleware profile 조회 완료 여부 + 검증된 locale(null 포함).
 * known이면 Supabase preferred_locale 재조회 불필요.
 */
export async function getVerifiedProfileLocaleResolution(): Promise<VerifiedProfileLocaleResolution> {
  try {
    const headerStore = await headers();

    if (headerStore.get(PROFILE_LOCALE_KNOWN_HEADER) !== "1") {
      return { kind: "unknown" };
    }

    const value = headerStore.get(PROFILE_LOCALE_HEADER);
    return {
      kind: "resolved",
      locale: isActiveLocale(value) ? value : null,
    };
  } catch {
    return { kind: "unknown" };
  }
}
