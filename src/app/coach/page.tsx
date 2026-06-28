import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/getSession";
import {
  getCoachDashboard,
  type CoachDashboardCoacheeStatus,
} from "@/lib/api/coach/dashboard";
import { getCoachMoksilgi } from "@/lib/api/coach/moksilgi";
import { getCurrentYearInTimezone, DEFAULT_TIMEZONE } from "@/lib/timezone";
import Link from "next/link";
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ProgressBar,
} from "@/components/ui";

const WEEKLY_STATUS_LABELS: Record<string, string> = {
  draft: "임시저장",
  submitted: "제출완료",
  reviewed: "검토완료",
  none: "기록 없음",
};

function formatDate(value: string | null | undefined) {
  if (!value) return "미등록";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "미등록";
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
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.min(Math.max((value / total) * 100, 0), 100);
}

function weeklyStatusTone(status: string) {
  if (status === "reviewed" || status === "submitted") return "success";
  if (status === "draft") return "warning";
  return "neutral";
}

function WeeklyStatusBadge({ status }: { status: string }) {
  return (
    <Badge tone={weeklyStatusTone(status)}>
      {getWeeklyStatusLabel(status)}
    </Badge>
  );
}

function MoksilgiProgressCell({ planId, rate }: { planId: string | undefined; rate: number | undefined }) {
  if (rate === undefined || planId === undefined) {
    return <span className="text-xs text-ink-faint">-</span>;
  }
  const pct = Math.min(Math.max(rate, 0), 100);
  return (
    <div className="min-w-[80px]">
      <div className="text-xs text-ink-muted">{pct.toFixed(1)}%</div>
      <ProgressBar className="mt-1" showValue={false} value={pct} />
    </div>
  );
}

function SummaryMetricCard({
  description,
  href,
  progressValue,
  title,
  value,
  warn,
}: {
  description: string;
  href?: string;
  progressValue?: number;
  title: string;
  value: string;
  warn?: boolean;
}) {
  const inner = (
    <CardContent className="p-4">
      <p className="break-words text-sm text-ink-faint">{title}</p>
      <p className={`mt-2 break-words text-2xl font-semibold ${warn ? "text-amber-600" : ""}`}>
        {value}
      </p>
      {typeof progressValue === "number" ? (
        <ProgressBar
          className="mt-3"
          showValue={false}
          value={progressValue}
        />
      ) : null}
      <p className="mt-3 break-words text-xs leading-5 text-ink-faint">{description}</p>
      {href ? (
        <p className={`mt-2 text-xs font-medium ${warn ? "text-amber-600" : "text-brand-600"}`}>
          자세히 보기 →
        </p>
      ) : null}
    </CardContent>
  );

  if (href) {
    return (
      <Link href={href} className="block transition hover:opacity-80">
        <Card
          className={`h-full cursor-pointer hover:shadow-sm ${
            warn
              ? "border-amber-300 hover:border-amber-400"
              : "hover:border-brand-400"
          }`}
        >
          {inner}
        </Card>
      </Link>
    );
  }

  return <Card>{inner}</Card>;
}

function QuickNavCard({
  href,
  icon,
  label,
  sub,
}: {
  href: string;
  icon: string;
  label: string;
  sub: string;
}) {
  return (
    <Link href={href} className="block transition hover:opacity-80">
      <Card className="h-full cursor-pointer hover:border-brand-400 hover:shadow-sm">
        <CardContent className="flex items-center gap-3 p-4">
          <span className="text-2xl" aria-hidden="true">{icon}</span>
          <div className="min-w-0">
            <p className="font-medium text-ink-strong">{label}</p>
            <p className="text-xs text-ink-faint">{sub}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default async function CoachPage() {
  const session = await getSession();

  if (!session.user) {
    redirect("/login?redirectTo=%2Fcoach");
  }

  const currentYear = getCurrentYearInTimezone(DEFAULT_TIMEZONE);
  const [dashboard, moksilgiResult] = await Promise.all([
    getCoachDashboard(),
    getCoachMoksilgi(currentYear),
  ]);

  // profile_id → { rate, planId, version_type }
  const moksilgiMap = new Map<string, { rate: number; planId: string; version_type: string }>();
  if (moksilgiResult.data) {
    for (const item of moksilgiResult.data) {
      const existing = moksilgiMap.get(item.profile_id);
      if (existing === undefined || item.total_achievement_rate > existing.rate) {
        moksilgiMap.set(item.profile_id, {
          rate: item.total_achievement_rate,
          planId: item.id,
          version_type: item.version_type ?? "draft",
        });
      }
    }
  }

  // 검토가 필요한 플랜 수 (submitted or review_requested)
  const REVIEW_NEEDED = new Set(["submitted", "review_requested"]);
  const moksilgiReviewNeededCount = moksilgiResult.data
    ? moksilgiResult.data.filter((item) => REVIEW_NEEDED.has(item.version_type ?? "")).length
    : 0;

  return (
    <main className="min-h-screen bg-[var(--trust-bg)] px-4 py-6 text-ink-strong sm:px-6 sm:py-10">
      <div className="mx-auto max-w-6xl">
        {dashboard.ok ? (
          <section className="space-y-5">

            {/* 헤더 */}
            <Card>
              <CardHeader>
                <div className="min-w-0">
                  <CardTitle className="text-2xl">코치 대시보드</CardTitle>
                  <CardDescription className="mt-1">
                    {dashboard.data.weekRange.start} ~ {dashboard.data.weekRange.end} 기준
                    담당 코치이 현황입니다.
                  </CardDescription>
                </div>
              </CardHeader>

              {/* ① 요약 카드 — Row 1: 담당 코치이 / 목실기 검토 / 피드백 대기 */}
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <SummaryMetricCard
                    description="현재 active 코칭 관계 기준입니다."
                    href="/coach/relationships"
                    title="담당 코치이"
                    value={`${dashboard.data.summary.assignedCoacheeCount}명`}
                  />
                  <SummaryMetricCard
                    description="코치 검토가 필요한 목실기 수입니다."
                    href="/coach/moksilgi"
                    title="목실기 검토"
                    value={`${moksilgiReviewNeededCount}명`}
                    warn={moksilgiReviewNeededCount > 0}
                  />
                  <SummaryMetricCard
                    description="피드백 작성이 필요한 기록 수입니다."
                    href="/coach/weekly-logs?view=weekly&filter=feedback_pending"
                    title="피드백 대기"
                    value={`${dashboard.data.summary.feedbackPendingCount}개`}
                    warn={dashboard.data.summary.feedbackPendingCount > 0}
                  />
                  {/* Row 2: 공유된 하루 기록 / 공유된 주간 기록 / 공유된 월간 회고 */}
                  <SummaryMetricCard
                    description="코치에게 공유된 하루 기록 수입니다."
                    href="/coach/weekly-logs?view=daily&filter=this_week"
                    title="공유된 하루 기록"
                    value={`${dashboard.data.summary.sharedDailyRecordCount}개`}
                  />
                  <SummaryMetricCard
                    description="코치에게 공유된 주간 기록 수입니다."
                    href="/coach/weekly-logs?view=weekly&filter=this_week_submitted"
                    title="공유된 주간 기록"
                    value={`${dashboard.data.summary.weeklySubmittedThisWeekCount}명`}
                  />
                  <SummaryMetricCard
                    description="코치에게 공유된 월간 회고 수입니다."
                    href="/coach/weekly-logs?view=monthly&filter=this_month"
                    title="공유된 월간 회고"
                    value={`${dashboard.data.summary.sharedMonthlyReflectionCount}개`}
                  />
                </div>
              </CardContent>
            </Card>

            {/* ③ 빠른 이동 카드 3개 */}
            <div>
              <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-ink-faint">
                빠른 이동
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <QuickNavCard
                  href="/coach/weekly-logs?view=daily"
                  icon="📅"
                  label="하루 기록"
                  sub="공유된 하루 기록 확인"
                />
                <QuickNavCard
                  href="/coach/weekly-logs?view=weekly"
                  icon="📋"
                  label="주간 기록"
                  sub="주간 기록 및 피드백 작성"
                />
                <QuickNavCard
                  href="/coach/weekly-logs?view=monthly"
                  icon="📊"
                  label="월간 회고"
                  sub="공유된 월간 회고 확인"
                />
              </div>
            </div>

            {/* ② 코치이별 상태 + 직접 액션 버튼 */}
            <Card>
              <CardHeader>
                <CardTitle>담당 코치이 현황</CardTitle>
                <CardDescription>
                  코치이별 기록 상태와 바로가기 버튼을 확인합니다.
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
                    <table className="min-w-[980px] w-full text-left text-sm">
                      <thead className="border-b border-line-base text-xs uppercase text-ink-faint">
                        <tr>
                          <th className="whitespace-nowrap px-3 py-2 font-medium">코치이</th>
                          <th className="whitespace-nowrap px-3 py-2 font-medium">소속</th>
                          <th className="whitespace-nowrap px-3 py-2 font-medium">주간 기록</th>
                          <th className="whitespace-nowrap px-3 py-2 font-medium">하루 / 월간</th>
                          <th className="whitespace-nowrap px-3 py-2 font-medium">목실기 진도</th>
                          <th className="whitespace-nowrap px-3 py-2 font-medium">바로가기</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line-soft">
                        {dashboard.data.coachees.map((coachee) => {
                          const moksilgi = moksilgiMap.get(coachee.coacheeId);
                          return (
                            <tr
                              key={coachee.relationshipId}
                              className="align-top transition hover:bg-[var(--trust-primary-soft)]/40"
                            >
                              {/* 코치이 */}
                              <td className="px-3 py-3">
                                <div className="min-w-0 break-words font-medium text-ink-strong">
                                  {coachee.coacheeName}
                                </div>
                                <div className="mt-1 break-all text-xs text-ink-faint">
                                  {coachee.coacheeEmail ?? "이메일 미등록"}
                                </div>
                              </td>

                              {/* 소속 */}
                              <td className="px-3 py-3 break-words text-ink-muted">
                                {getScopeLabel(coachee)}
                              </td>

                              {/* 주간 기록 상태 + 피드백 여부 */}
                              <td className="px-3 py-3">
                                <WeeklyStatusBadge status={coachee.latestWeeklyStatus} />
                                <div className="mt-1 text-xs text-ink-faint">
                                  제출일: {formatDate(coachee.latestWeeklySubmittedAt)}
                                </div>
                                {coachee.feedbackPending ? (
                                  <div className="mt-1">
                                    <Badge tone="warning">피드백 대기</Badge>
                                  </div>
                                ) : null}
                              </td>

                              {/* 하루 / 월간 공유 */}
                              <td className="px-3 py-3 text-ink-muted">
                                <div className="text-xs">
                                  하루{" "}
                                  <span className="font-medium text-ink-strong">
                                    {coachee.sharedDailyCount}개
                                  </span>
                                  {coachee.latestSharedDailyDate ? (
                                    <span className="ml-1 text-ink-faint">
                                      ({formatDate(coachee.latestSharedDailyDate)})
                                    </span>
                                  ) : null}
                                </div>
                                <div className="mt-1 text-xs">
                                  월간{" "}
                                  <span className="font-medium text-ink-strong">
                                    {coachee.sharedMonthlyCount}개
                                  </span>
                                  {coachee.latestSharedMonthlyLabel ? (
                                    <span className="ml-1 text-ink-faint">
                                      ({coachee.latestSharedMonthlyLabel})
                                    </span>
                                  ) : null}
                                </div>
                              </td>

                              {/* 목실기 진도 + 검토 상태 */}
                              <td className="px-3 py-3">
                                <MoksilgiProgressCell
                                  planId={moksilgi?.planId}
                                  rate={moksilgi?.rate}
                                />
                                {moksilgi?.version_type &&
                                REVIEW_NEEDED.has(moksilgi.version_type) ? (
                                  <div className="mt-1">
                                    <Badge tone="warning">검토 대기</Badge>
                                  </div>
                                ) : null}
                              </td>

                              {/* 바로가기 버튼 묶음 */}
                              <td className="px-3 py-3">
                                <div className="flex flex-wrap gap-1">
                                  {coachee.feedbackPending ? (
                                    <Link
                                      href="/coach/weekly-logs?view=weekly"
                                      className="inline-block rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100"
                                    >
                                      피드백 작성
                                    </Link>
                                  ) : (
                                    <Link
                                      href="/coach/weekly-logs?view=weekly"
                                      className="inline-block rounded border border-line-base px-2 py-1 text-xs font-medium text-ink-muted hover:bg-surface-sunken"
                                    >
                                      주간 기록
                                    </Link>
                                  )}
                                  {moksilgi?.planId ? (
                                    <Link
                                      href={`/coach/moksilgi/${moksilgi.planId}`}
                                      className="inline-block rounded border border-line-base px-2 py-1 text-xs font-medium text-ink-muted hover:bg-surface-sunken"
                                    >
                                      목실기 검토
                                    </Link>
                                  ) : null}
                                  <Link
                                    href={`/coach/relationships/${coachee.relationshipId}`}
                                    className="inline-block rounded border border-line-base px-2 py-1 text-xs font-medium text-ink-muted hover:bg-surface-sunken"
                                  >
                                    관계 상세
                                  </Link>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
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
      </div>
    </main>
  );
}
