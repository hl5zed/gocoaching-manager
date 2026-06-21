import { redirect } from "next/navigation";
import { getMyCoachingMe, type MyCoachingProfile } from "./me";

export type CoacheePageAuthResult =
  | {
      ok: true;
      profile: MyCoachingProfile;
      authEmail: string | null;
    }
  | {
      ok: false;
      reason: "fetch_failed" | "no_profile";
    };

/**
 * 피코치 my-coaching 페이지 공통: auth + profile 1회 조회.
 * UNAUTHORIZED면 login redirect (무한 redirect 방지: redirectTo는 호출측에서 지정).
 */
export async function requireCoacheePageProfile(
  redirectTo: string,
): Promise<CoacheePageAuthResult> {
  const me = await getMyCoachingMe({ includeRoles: false, includeRelationships: false });

  if (!me.ok && me.error.code === "UNAUTHORIZED") {
    redirect(`/login?redirectTo=${encodeURIComponent(redirectTo)}`);
  }

  if (!me.ok) {
    return { ok: false, reason: "fetch_failed" };
  }

  if (!me.data.profile) {
    return { ok: false, reason: "no_profile" };
  }

  return {
    ok: true,
    profile: me.data.profile,
    authEmail: me.data.authEmail,
  };
}
