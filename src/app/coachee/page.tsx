import { redirect } from "next/navigation";
import { CoacheeActionHub } from "@/components/dashboard/CoacheeActionHub";
import { CoacheeTopBar } from "@/components/navigation/CoacheeTopBar";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { getSession } from "@/lib/auth/getSession";
import { getActiveAnnouncementsForCurrentUser } from "@/lib/api/admin/system-announcements";
import { getMyCoachingMe } from "@/lib/api/my-coaching/me";


function displayValue(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "-";
}

export default async function CoacheePage() {
  const session = await getSession();

  if (!session.user) {
    redirect("/login?redirectTo=%2Fcoachee");
  }

  const result = await getMyCoachingMe();

  if (!result.ok && result.error.code === "UNAUTHORIZED") {
    redirect("/login?redirectTo=%2Fcoachee");
  }

  if (!result.ok) {
    return (
      <main className="min-h-screen bg-surface-app px-6 py-10 text-ink-strong">
        <section className="mx-auto w-full max-w-5xl">
          <h1 className="text-3xl font-semibold">코치이 공간</h1>
          <div className="mt-8 rounded-control border border-red-200 bg-red-50 p-4 text-red-800">
            지금 코치이 공간을 불러올 수 없습니다.
          </div>
        </section>
      </main>
    );
  }

  const profile = result.data.profile;
  const displayName =
    profile?.display_name ??
    profile?.full_name ??
    profile?.email ??
    result.data.authEmail ??
    "사용자";
  const announcements = await getActiveAnnouncementsForCurrentUser({
    placement: "dashboard",
    roles: result.data.roles.map((role) => role.role),
  });

  return (
    <>
      <CoacheeTopBar />
      <main className="min-h-screen bg-surface-app px-4 py-6 text-ink-strong sm:px-6 sm:py-10">
        <section className="mx-auto w-full max-w-5xl space-y-6">
          <section className="rounded-card border border-line-base bg-surface-card p-5 shadow-card sm:p-6">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink-faint">코치이</p>
                <h1 className="mt-2 text-2xl font-semibold text-ink-strong sm:text-3xl">
                  코치이 공간
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-muted sm:text-base">
                  오늘의 체크, 목실기, 기록, 성장 목표를 한 곳에서 이어갑니다.
                </p>
              </div>
              <ButtonLink
                className="w-full sm:w-auto"
                href="/coachee/report"
                icon="report"
                size="md"
              >
                인쇄용 보고서 보기
              </ButtonLink>
            </div>

            <div className="mt-6 rounded-control border border-line-soft bg-surface-app p-4">
              <p className="text-sm text-ink-base">
                안녕하세요,{" "}
                <span className="font-semibold text-ink-strong">{displayName}</span>님.
              </p>
              <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium uppercase text-ink-faint">이름</dt>
                  <dd className="mt-1 break-words text-sm font-medium text-ink-strong">
                    {displayValue(profile?.display_name ?? profile?.full_name)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase text-ink-faint">이메일</dt>
                  <dd className="mt-1 break-words text-sm font-medium text-ink-strong">
                    {displayValue(profile?.email ?? result.data.authEmail)}
                  </dd>
                </div>
              </dl>
            </div>
          </section>

          <CoacheeActionHub />

          {announcements.length > 0 ? (
            <section aria-label="시스템 공지" className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge tone="info">시스템 공지</Badge>
                <h2 className="text-base font-semibold text-ink-strong">
                  운영 안내
                </h2>
              </div>
              <div className="grid gap-3">
                {announcements.map((announcement) => (
                  <Card className="border-sky-200 bg-sky-50 shadow-sm" key={announcement.id}>
                    <CardContent className="p-5">
                      <h3 className="break-words text-base font-semibold text-ink-strong">
                        {announcement.title}
                      </h3>
                      <p className="mt-2 whitespace-pre-line break-words text-sm leading-6 text-ink-base">
                        {announcement.body}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          ) : null}
        </section>
      </main>
    </>
  );
}
