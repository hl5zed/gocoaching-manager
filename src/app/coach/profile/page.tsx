import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/getSession";
import { getMyProfile } from "@/lib/api/profile/me";
import { createApiPerformanceLogger } from "@/lib/performance";
import { ProfileView } from "../../profile/ProfileView";

export default async function CoachProfilePage() {
  const perf = createApiPerformanceLogger("/coach/profile");
  const session = await getSession();
  perf.mark("auth.session_check", session.user ? 1 : 0);

  if (!session.user) {
    redirect("/login?redirectTo=%2Fcoach%2Fprofile");
  }

  const result = await getMyProfile(perf);

  if (!result.ok && result.error.code === "UNAUTHORIZED") {
    perf.mark("profile.complete", 0);
    redirect("/login?redirectTo=%2Fcoach%2Fprofile");
  }

  perf.mark("profile.complete", result.ok && result.data.profile ? 1 : 0);

  return (
    <ProfileView
      backHref="/coach"
      backLabel="대시보드로 돌아가기"
      editHref="/coach/profile/edit"
      result={result}
    />
  );
}
