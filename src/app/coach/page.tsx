import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/getSession";
import {
  getCoachDashboard,
  type CoachDashboardCoacheeStatus,
} from "@/lib/api/coach/dashboard";
import { PageNavigationButtons } from "@/components/navigation/PageNavigationButtons";

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

export default async function CoachPage() {
  const session = await getSession();

  if (!session.user) {
    redirect("/login?redirectTo=%2Fcoach");
  }

  const dashboard = await getCoachDashboard();

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">코치 홈</h1>
            <p className="mt-2 text-sm text-slate-600">
              코치 기능을 선택해 주세요.
            </p>
          </div>
          <PageNavigationButtons className="justify-start sm:justify-end" />
        </div>

        {dashboard.ok ? (
          <section className="mt-8 space-y-5">
            <div className="rounded-md border border-slate-200 bg-white p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">담당 코치이 현황</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {dashboard.data.weekRange.start} ~ {dashboard.data.weekRange.end} 기준
                    주간 제출과 공유 기록 현황입니다.
                  </p>
                </div>
                <Link
                  href="/coach/weekly-logs"
                  className="inline-flex w-fit items-center justify-center rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-blue-300 hover:text-blue-700"
                >
                  주간 기록 보기
                </Link>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">담당 코치이</p>
                  <p className="mt-2 text-2xl font-semibold">
                    {dashboard.data.summary.assignedCoacheeCount}명
                  </p>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">이번 주 제출</p>
                  <p className="mt-2 text-2xl font-semibold">
                    {dashboard.data.summary.weeklySubmittedThisWeekCount}명
                  </p>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">이번 주 미제출</p>
                  <p className="mt-2 text-2xl font-semibold">
                    {dashboard.data.summary.weeklyMissingThisWeekCount}명
                  </p>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">공유된 하루 기록</p>
                  <p className="mt-2 text-2xl font-semibold">
                    {dashboard.data.summary.sharedDailyRecordCount}개
                  </p>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">공유된 월간 회고</p>
                  <p className="mt-2 text-2xl font-semibold">
                    {dashboard.data.summary.sharedMonthlyReflectionCount}개
                  </p>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">피드백 대기</p>
                  <p className="mt-2 text-2xl font-semibold">
                    {dashboard.data.summary.feedbackPendingCount}개
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-md border border-slate-200 bg-white p-5">
              <h2 className="text-lg font-semibold">담당 코치이 목록</h2>
              <p className="mt-1 text-sm text-slate-500">
                active 코칭 관계 기준으로 최근 제출/공유 상태만 표시합니다.
              </p>

              {dashboard.data.coachees.length === 0 ? (
                <div className="mt-5 rounded-md border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
                  현재 배정된 코치이가 없습니다.
                </div>
              ) : (
                <div className="mt-5 overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
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
                    <tbody className="divide-y divide-slate-100">
                      {dashboard.data.coachees.map((coachee) => (
                        <tr key={coachee.relationshipId} className="align-top">
                          <td className="px-3 py-3">
                            <div className="font-medium text-slate-900">
                              {coachee.coacheeName}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              {coachee.coacheeEmail ?? "이메일 미등록"}
                            </div>
                          </td>
                          <td className="px-3 py-3 text-slate-600">
                            {getScopeLabel(coachee)}
                          </td>
                          <td className="px-3 py-3 text-slate-600">
                            {formatDate(coachee.startedAt)}
                          </td>
                          <td className="px-3 py-3">
                            <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700">
                              {getWeeklyStatusLabel(coachee.latestWeeklyStatus)}
                            </span>
                            <div className="mt-1 text-xs text-slate-500">
                              제출일: {formatDate(coachee.latestWeeklySubmittedAt)}
                            </div>
                          </td>
                          <td className="px-3 py-3 text-slate-600">
                            <div>하루 {coachee.sharedDailyCount}개</div>
                            <div className="text-xs text-slate-500">
                              최근: {formatDate(coachee.latestSharedDailyDate)}
                            </div>
                            <div className="mt-2">월간 {coachee.sharedMonthlyCount}개</div>
                            <div className="text-xs text-slate-500">
                              최근: {coachee.latestSharedMonthlyLabel ?? "미등록"}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <span
                              className={
                                coachee.feedbackPending
                                  ? "inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700"
                                  : "inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700"
                              }
                            >
                              {coachee.feedbackPending ? "대기 있음" : "대기 없음"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        ) : (
          <div className="mt-8 rounded-md border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
            {dashboard.error.message}
          </div>
        )}

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Link
            href="/coach/relationships"
            className="rounded-md border border-slate-200 bg-white px-5 py-4 transition hover:border-blue-300 hover:shadow-sm"
          >
            <h2 className="text-lg font-semibold">코칭 관계 보기</h2>
            <p className="mt-1 text-sm text-slate-500">
              현재 담당 중인 코칭 관계를 확인합니다.
            </p>
          </Link>

          <Link
            href="/coach/weekly-logs"
            className="rounded-md border border-slate-200 bg-white px-5 py-4 transition hover:border-blue-300 hover:shadow-sm"
          >
            <h2 className="text-lg font-semibold">주간 기록 보기</h2>
            <p className="mt-1 text-sm text-slate-500">
              담당 코치이들의 주간 기록을 확인합니다.
            </p>
          </Link>

          <Link
            href="/coach/moksilgi"
            className="rounded-md border border-slate-200 bg-white px-5 py-4 transition hover:border-blue-300 hover:shadow-sm"
          >
            <h2 className="text-lg font-semibold">코치이 목실기 보기</h2>
            <p className="mt-1 text-sm text-slate-500">
              담당 코치이들의 목실기와 성취 요약을 확인합니다.
            </p>
          </Link>
        </div>
      </div>
    </main>
  );
}
