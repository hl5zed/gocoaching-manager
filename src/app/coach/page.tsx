import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/getSession";
import {
  getCoachDashboard,
  type CoachDashboardCoacheeStatus,
} from "@/lib/api/coach/dashboard";
import { PageNavigationButtons } from "@/components/navigation/PageNavigationButtons";
import {
  Badge,
  ButtonLink,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ProgressBar,
} from "@/components/ui";

export const dynamic = "force-dynamic";

const WEEKLY_STATUS_LABELS: Record<string, string> = {
  draft: "임시저장",
  submitted: "제출완료",
  reviewed: "검토완료",
  none: "기록 없음",
};

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "미등록";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "미등록";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getWeeklyStatusLabel(status: string) {
  return WEEKLY_STATUS_LABELS[status] ?? "확인 필요";
}

function getScopeLabel(coachee: CoachDashboardCoacheeStatus) {
  const labels = [coachee.organizationName, coachee.churchName].filter(Boolean);

  return labels.length > 0 ? labels.join(" / ") : "소속 미등록";
}

function ratioPercent(value: number, total: number) {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) {
    return 0;
  }

  return Math.min(Math.max((value / total) * 100, 0), 100);
}

function weeklyStatusTone(status: string) {
  if (status === "reviewed" || status === "submitted") {
    return "success";
  }

  if (status === "draft") {
    return "warning";
  }

  return "neutral";
}

function WeeklyStatusBadge({ status }: { status: string }) {
  return (
    <Badge tone={weeklyStatusTone(status)}>
      {getWeeklyStatusLabel(status)}
    </Badge>
  );
}

function FeedbackBadge({ pending }: { pending: boolean }) {
  return (
    <Badge tone={pending ? "warning" : "success"}>
      {pending ? "대기 있음" : "대기 없음"}
    </Badge>
  );
}

function SummaryMetricCard({
  description,
  progressValue,
  title,
  value,
}: {
  description: string;
  progressValue?: number;
  title: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="break-words text-sm text-ink-faint">{title}</p>
        <p className="mt-2 break-words text-2xl font-semibold">{value}</p>
        {typeof progressValue === "number" ? (
          <ProgressBar className="mt-3" showValue={false} value={progressValue} />
        ) : null}
        <p className="mt-3 break-words text-xs leading-5 text-ink-faint">
          {description}
        </p>
      </CardContent>
    </Card>
  );
}

export default async function CoachPage() {
  const session = await getSession();

  if (!session.user) {
    redirect("/login?redirectTo=%2Fcoach");
  }

  const dashboard = await getCoachDashboard();

  return (
    <main className="min-h-screen bg-[var(--trust-bg)] px-4 py-6 text-ink-strong sm:px-6 sm:py-10">
      <div className="mx-auto max-w-6xl">
        <Card>
          <CardHeader className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <Badge icon="users" tone="info">코치 대시보드</Badge>
              <CardTitle className="mt-3 text-2xl">코치 홈</CardTitle>
              <CardDescription className="mt-2">
                코치 기능을 선택하고 담당 코치이의 최근 기록 상태를 확인해 주세요.
              </CardDescription>
            </div>
            <PageNavigationButtons className="justify-start sm:justify-end" />
          </CardHeader>
        </Card>

        {dashboard.ok ? (
          <section className="mt-8 space-y-5">
            <Card>
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                  <CardTitle>담당 코치이 현황</CardTitle>
                  <CardDescription>
                    {dashboard.data.weekRange.start} ~ {dashboard.data.weekRange.end} 기준
                    주간 제출과 공유 기록 현황입니다.
                  </CardDescription>
                </div>
                <ButtonLink
                  href="/coach/weekly-logs"
                  icon="report"
                  variant="secondary"
                >
                  주간 기록 보기
                </ButtonLink>
              </CardHeader>

              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <SummaryMetricCard
                    description="현재 active 코칭 관계 기준입니다."
                    title="담당 코치이"
                    value={`${dashboard.data.summary.assignedCoacheeCount}명`}
                  />
                  <SummaryMetricCard
                    description="담당 코치이 대비 이번 주 제출 비율입니다."
                    progressValue={ratioPercent(
                      dashboard.data.summary.weeklySubmittedThisWeekCount,
                      dashboard.data.summary.assignedCoacheeCount,
                    )}
                    title="이번 주 제출"
                    value={`${dashboard.data.summary.weeklySubmittedThisWeekCount}명`}
                  />
                  <SummaryMetricCard
                    description="확인이 필요한 이번 주 미제출 인원입니다."
                    progressValue={ratioPercent(
                      dashboard.data.summary.weeklyMissingThisWeekCount,
                      dashboard.data.summary.assignedCoacheeCount,
                    )}
                    title="이번 주 미제출"
                    value={`${dashboard.data.summary.weeklyMissingThisWeekCount}명`}
                  />
                  <SummaryMetricCard
                    description="코치에게 공유된 하루 기록 수입니다."
                    title="공유된 하루 기록"
                    value={`${dashboard.data.summary.sharedDailyRecordCount}개`}
                  />
                  <SummaryMetricCard
                    description="코치에게 공유된 월간 회고 수입니다."
                    title="공유된 월간 회고"
                    value={`${dashboard.data.summary.sharedMonthlyReflectionCount}개`}
                  />
                  <SummaryMetricCard
                    description="피드백 작성이 필요한 기록 수입니다."
                    title="피드백 대기"
                    value={`${dashboard.data.summary.feedbackPendingCount}개`}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>담당 코치이 목록</CardTitle>
                <CardDescription>
                  active 코칭 관계 기준으로 최근 제출/공유 상태만 표시합니다.
                </CardDescription>
              </CardHeader>

              {dashboard.data.coachees.length === 0 ? (
                <CardContent>
                <div className="rounded-lg border border-dashed border-line-base bg-surface-app p-5 text-sm text-ink-muted">
                  현재 배정된 코치이가 없습니다.
                </div>
                </CardContent>
              ) : (
                <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="min-w-[920px] w-full text-left text-sm">
                    <thead className="border-b border-line-base text-xs uppercase text-ink-faint">
                      <tr>
                        <th className="whitespace-nowrap px-3 py-2 font-medium">코치이</th>
                        <th className="whitespace-nowrap px-3 py-2 font-medium">소속</th>
                        <th className="whitespace-nowrap px-3 py-2 font-medium">
                          관계 시작일
                        </th>
                        <th className="whitespace-nowrap px-3 py-2 font-medium">
                          최근 주간 기록
                        </th>
                        <th className="whitespace-nowrap px-3 py-2 font-medium">
                          공유 기록
                        </th>
                        <th className="whitespace-nowrap px-3 py-2 font-medium">
                          피드백
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line-soft">
                      {dashboard.data.coachees.map((coachee) => (
                        <tr
                          key={coachee.relationshipId}
                          className="align-top transition hover:bg-[var(--trust-primary-soft)]/40"
                        >
                          <td className="px-3 py-3">
                            <div className="min-w-0 break-words font-medium text-ink-strong">
                              {coachee.coacheeName}
                            </div>
                            <div className="mt-1 break-all text-xs text-ink-faint">
                              {coachee.coacheeEmail ?? "이메일 미등록"}
                            </div>
                          </td>
                          <td className="px-3 py-3 break-words text-ink-muted">
                            {getScopeLabel(coachee)}
                          </td>
                          <td className="px-3 py-3 text-ink-muted">
                            {formatDate(coachee.startedAt)}
                          </td>
                          <td className="px-3 py-3">
                            <WeeklyStatusBadge status={coachee.latestWeeklyStatus} />
                            <div className="mt-1 text-xs text-ink-faint">
                              제출일: {formatDate(coachee.latestWeeklySubmittedAt)}
                            </div>
                          </td>
                          <td className="px-3 py-3 text-ink-muted">
                            <div>하루 {coachee.sharedDailyCount}개</div>
                            <div className="text-xs text-ink-faint">
                              최근: {formatDate(coachee.latestSharedDailyDate)}
                            </div>
                            <div className="mt-2">월간 {coachee.sharedMonthlyCount}개</div>
                            <div className="text-xs text-ink-faint">
                              최근: {coachee.latestSharedMonthlyLabel ?? "미등록"}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <FeedbackBadge pending={coachee.feedbackPending} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                </CardContent>
              )}
            </Card>
          </section>
        ) : (
          <div className="mt-8 rounded-control border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
            {dashboard.error.message}
          </div>
        )}

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <ButtonLink
            href="/coach/relationships"
            className="h-full flex-col items-start justify-start p-5 text-left"
            icon="users"
            variant="secondary"
          >
            <h2 className="text-lg font-semibold">코칭 관계 보기</h2>
            <p className="mt-1 text-sm text-ink-faint">
              현재 담당 중인 코칭 관계를 확인합니다.
            </p>
          </ButtonLink>

          <ButtonLink
            href="/coach/weekly-logs"
            className="h-full flex-col items-start justify-start p-5 text-left"
            icon="report"
            variant="secondary"
          >
            <h2 className="text-lg font-semibold">주간 기록 보기</h2>
            <p className="mt-1 text-sm text-ink-faint">
              담당 코치이들의 주간 기록을 확인합니다.
            </p>
          </ButtonLink>

          <ButtonLink
            href="/coach/moksilgi"
            className="h-full flex-col items-start justify-start p-5 text-left"
            icon="report"
            variant="secondary"
          >
            <h2 className="text-lg font-semibold">코치이 목실기 보기</h2>
            <p className="mt-1 text-sm text-ink-faint">
              담당 코치이들의 목실기와 성취 요약을 확인합니다.
            </p>
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}
