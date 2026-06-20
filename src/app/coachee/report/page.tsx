import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/getSession";
import {
  getMyCoachingFeedback,
  type MyCoachingFeedbackItem,
} from "@/lib/api/my-coaching/feedback";
import {
  getMyCoachingGoals,
  type MyCoachingGoal,
} from "@/lib/api/my-coaching/goals";
import { getMyCoachingMe } from "@/lib/api/my-coaching/me";
import {
  getMyMoksilgi,
  type MoksilgiCoreValue,
  type MoksilgiDetailGoal,
  type MoksilgiGoalArea,
  type MoksilgiPlan,
} from "@/lib/api/my-coaching/moksilgi";
import {
  getMyMoksilgiSummary,
  type MoksilgiPersonalSummaryRow,
} from "@/lib/api/my-coaching/moksilgi-summary";
import type { GoalPriority, GoalStatus, MoksilgiMeasurementType } from "@/types/database";
import { PrintCoacheeReportButton } from "../PrintCoacheeReportButton";

export const dynamic = "force-dynamic";

const GOAL_STATUS_LABELS: Record<GoalStatus, string> = {
  active: "진행 중",
  archived: "보관",
  completed: "완료",
  paused: "일시 중지",
};

const GOAL_PRIORITY_LABELS: Record<GoalPriority, string> = {
  high: "높음",
  low: "낮음",
  normal: "보통",
};

const MEASUREMENT_TYPE_LABELS: Record<MoksilgiMeasurementType, string> = {
  daily_check: "매일 실행 확인",
  monthly_comment: "COMMENT",
  monthly_number: "월간 수치 입력",
  weekly_count: "매주 실행 확인",
};

type CoreValueShape = {
  meaning: string;
  practice_example: string;
  value_name: string;
};

function displayValue(value: string | number | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "-";
  }

  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "-";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";

  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatPercent(value: number | null | undefined) {
  const numeric = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return `${numeric.toFixed(1)}%`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeCoreValues(value: unknown): MoksilgiCoreValue[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(isRecord)
    .map((item): CoreValueShape => ({
      meaning: typeof item.meaning === "string" ? item.meaning : "",
      practice_example:
        typeof item.practice_example === "string" ? item.practice_example : "",
      value_name: typeof item.value_name === "string" ? item.value_name : "",
    }))
    .filter(
      (item) =>
        item.value_name.trim().length > 0 ||
        item.meaning.trim().length > 0 ||
        item.practice_example.trim().length > 0,
    );
}

function normalizeStrategies(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value.filter(
    (item): item is string => typeof item === "string" && item.trim().length > 0,
  );
}

function goalsExist({
  detailGoals,
  goals,
  hasSummaryData,
  hasMoksilgiPlan,
}: {
  detailGoals: MoksilgiDetailGoal[];
  goals: MyCoachingGoal[];
  hasMoksilgiPlan: boolean;
  hasSummaryData: boolean;
}) {
  return goals.length > 0 || hasMoksilgiPlan || detailGoals.length > 0 || hasSummaryData;
}

function areaTitle(area: MoksilgiGoalArea) {
  return `목표 ${area.sort_order}: ${area.area_title}`;
}

function goalsByArea(detailGoals: MoksilgiDetailGoal[]) {
  return detailGoals.reduce((map, goal) => {
    const current = map.get(goal.area_id) ?? [];
    current.push(goal);
    map.set(goal.area_id, current);
    return map;
  }, new Map<string, MoksilgiDetailGoal[]>());
}

function personName({
  authEmail,
  displayName,
  email,
  fullName,
}: {
  authEmail: string | null;
  displayName: string | null | undefined;
  email: string | null | undefined;
  fullName: string | null | undefined;
}) {
  return displayName ?? fullName ?? email ?? authEmail ?? "코치이";
}

function EmptyState({ children }: { children?: string }) {
  return (
    <p className="report-card rounded-control border border-line-base px-4 py-5 text-center text-sm text-ink-faint print:border-line-base">
      {children ?? "표시할 목표/목실기 데이터가 없습니다."}
    </p>
  );
}

function GoalSection({ goals }: { goals: MyCoachingGoal[] }) {
  return (
    <section className="report-section mt-8">
      <h2 className="report-section-title border-b border-line-base pb-2 text-xl font-semibold print:text-lg">
        목표
      </h2>
      {goals.length === 0 ? (
        <div className="mt-4">
          <EmptyState />
        </div>
      ) : (
        <div className="mt-4 grid gap-4">
          {goals.map((goal) => (
            <article
              className="report-card rounded-card border border-line-base bg-surface-card p-4"
              key={goal.id}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold">{goal.title}</h3>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-ink-base">
                    {displayValue(goal.description)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full border border-line-base bg-surface-app px-2.5 py-1">
                    {GOAL_STATUS_LABELS[goal.status]}
                  </span>
                  <span className="rounded-full border border-line-base bg-surface-app px-2.5 py-1">
                    {GOAL_PRIORITY_LABELS[goal.priority]}
                  </span>
                </div>
              </div>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <dt className="font-medium text-ink-faint">분류</dt>
                  <dd className="mt-1">{displayValue(goal.category)}</dd>
                </div>
                <div>
                  <dt className="font-medium text-ink-faint">목표값</dt>
                  <dd className="mt-1">
                    {displayValue(goal.target_value)} {displayValue(goal.unit)}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-ink-faint">현재값</dt>
                  <dd className="mt-1">
                    {displayValue(goal.current_value)} {displayValue(goal.unit)}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-ink-faint">마감일</dt>
                  <dd className="mt-1">{formatDate(goal.due_date)}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function MoksilgiSection({
  areas,
  detailGoals,
  plan,
}: {
  areas: MoksilgiGoalArea[];
  detailGoals: MoksilgiDetailGoal[];
  plan: MoksilgiPlan | null;
}) {
  const groupedGoals = goalsByArea(detailGoals);
  const coreValues = normalizeCoreValues(plan?.core_values_json);

  return (
    <section className="report-section mt-8">
      <h2 className="report-section-title border-b border-line-base pb-2 text-xl font-semibold print:text-lg">
        목실기
      </h2>
      {!plan ? (
        <div className="mt-4">
          <EmptyState />
        </div>
      ) : (
        <div className="mt-4 grid gap-4">
          <article className="report-card rounded-card border border-line-base bg-surface-card p-4">
            <h3 className="text-lg font-semibold">{plan.title}</h3>
            <p className="mt-1 text-sm text-ink-muted">{displayValue(plan.subtitle)}</p>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="font-medium text-ink-faint">기간</dt>
                <dd className="mt-1">
                  {formatDate(plan.period_start)} ~ {formatDate(plan.period_end)}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-ink-faint">작성일</dt>
                <dd className="mt-1">{formatDate(plan.written_at)}</dd>
              </div>
              <div>
                <dt className="font-medium text-ink-faint">코치</dt>
                <dd className="mt-1">{displayValue(plan.coach_name)}</dd>
              </div>
              <div>
                <dt className="font-medium text-ink-faint">상태</dt>
                <dd className="mt-1">{plan.status}</dd>
              </div>
            </dl>
          </article>

          <article className="report-card rounded-card border border-line-base bg-surface-card p-4">
            <h3 className="font-semibold">사명과 비전</h3>
            <div className="mt-3 grid gap-4 text-sm md:grid-cols-2">
              <div>
                <p className="font-medium text-ink-faint">사명선언서</p>
                <p className="mt-2 whitespace-pre-wrap break-words leading-6">
                  {displayValue(plan.mission_statement)}
                </p>
              </div>
              <div>
                <p className="font-medium text-ink-faint">비전</p>
                <p className="mt-2 whitespace-pre-wrap break-words leading-6">
                  {displayValue(plan.vision_statement)}
                </p>
              </div>
            </div>
            <div className="mt-4">
              <p className="font-medium text-ink-faint">전체 목표</p>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">
                {displayValue(plan.main_goal)}
              </p>
            </div>
          </article>

          {coreValues.length > 0 ? (
            <article className="report-card rounded-card border border-line-base bg-surface-card p-4">
              <h3 className="font-semibold">핵심가치</h3>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                {coreValues.map((value, index) => (
                  <div className="rounded-md border border-line-base p-3" key={`${value.value_name}-${index}`}>
                    <p className="font-medium">{displayValue(value.value_name)}</p>
                    <p className="mt-2 break-words text-sm text-ink-base">
                      {displayValue(value.meaning)}
                    </p>
                    <p className="mt-2 break-words text-xs text-ink-muted">
                      {displayValue(value.practice_example)}
                    </p>
                  </div>
                ))}
              </div>
            </article>
          ) : null}

          <article className="report-card rounded-card border border-line-base bg-surface-card p-4">
            <h3 className="font-semibold">목표에 따른 실행전략 기획안</h3>
            {detailGoals.length === 0 ? (
              <p className="mt-3 text-sm text-ink-muted">표시할 세부 목표가 없습니다.</p>
            ) : (
              <div className="mt-4 grid gap-4">
                {areas.map((area) => {
                  const goals = groupedGoals.get(area.id) ?? [];

                  if (goals.length === 0) return null;

                  return (
                    <section className="rounded-md border border-line-base p-4" key={area.id}>
                      <h4 className="font-semibold">{areaTitle(area)}</h4>
                      <p className="mt-1 text-sm text-ink-muted">
                        {displayValue(area.area_subtitle)}
                      </p>
                      <div className="mt-3 grid gap-3">
                        {goals.map((goal) => {
                          const strategies = normalizeStrategies(goal.strategies_json);

                          return (
                            <div className="rounded-md bg-surface-app p-3" key={goal.id}>
                              <p className="font-medium">{goal.title}</p>
                              <p className="mt-2 whitespace-pre-wrap break-words text-sm text-ink-base">
                                {displayValue(goal.description)}
                              </p>
                              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                                <div>
                                  <dt className="font-medium text-ink-faint">연간 목표</dt>
                                  <dd>{displayValue(goal.annual_target)} {displayValue(goal.unit)}</dd>
                                </div>
                                <div>
                                  <dt className="font-medium text-ink-faint">월 목표</dt>
                                  <dd>{displayValue(goal.monthly_target)} {displayValue(goal.unit)}</dd>
                                </div>
                                <div>
                                  <dt className="font-medium text-ink-faint">측정 방식</dt>
                                  <dd>{MEASUREMENT_TYPE_LABELS[goal.measurement_type]}</dd>
                                </div>
                              </dl>
                              {strategies.length > 0 ? (
                                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
                                  {strategies.map((strategy, index) => (
                                    <li className="break-words" key={`${goal.id}-strategy-${index}`}>
                                      {strategy}
                                    </li>
                                  ))}
                                </ul>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}
          </article>
        </div>
      )}
    </section>
  );
}

function SummaryTable({
  cumulativeRow,
  hasSummaryData,
  rows,
  year,
}: {
  cumulativeRow: MoksilgiPersonalSummaryRow;
  hasSummaryData: boolean;
  rows: MoksilgiPersonalSummaryRow[];
  year: number;
}) {
  return (
    <section className="report-section mt-8">
      <h2 className="report-section-title border-b border-line-base pb-2 text-xl font-semibold print:text-lg">
        월간 진행 내용
      </h2>
      {!hasSummaryData ? (
        <div className="mt-4">
          <EmptyState>아직 월별 체크리스트 기록이 없습니다.</EmptyState>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto print:overflow-visible">
          <table className="report-table w-full min-w-[760px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-line-base bg-surface-sunken">
                <th className="px-3 py-2">월</th>
                <th className="px-3 py-2">영적 성장</th>
                <th className="px-3 py-2">지적 성장</th>
                <th className="px-3 py-2">육체적 성장</th>
                <th className="px-3 py-2">사회적 성장</th>
                <th className="px-3 py-2">기타</th>
                <th className="px-3 py-2">평균</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr className="border-b border-line-soft" key={row.month}>
                  <th className="px-3 py-2 font-medium">{row.monthLabel}</th>
                  <td className="px-3 py-2">{formatPercent(row.spiritual_rate)}</td>
                  <td className="px-3 py-2">{formatPercent(row.intellectual_rate)}</td>
                  <td className="px-3 py-2">{formatPercent(row.physical_rate)}</td>
                  <td className="px-3 py-2">{formatPercent(row.social_rate)}</td>
                  <td className="px-3 py-2">{formatPercent(row.other_rate)}</td>
                  <td className="px-3 py-2">{formatPercent(row.average_rate)}</td>
                </tr>
              ))}
              <tr className="border-b border-line-base bg-surface-sunken font-semibold">
                <th className="px-3 py-2">{cumulativeRow.monthLabel}</th>
                <td className="px-3 py-2">{formatPercent(cumulativeRow.spiritual_rate)}</td>
                <td className="px-3 py-2">{formatPercent(cumulativeRow.intellectual_rate)}</td>
                <td className="px-3 py-2">{formatPercent(cumulativeRow.physical_rate)}</td>
                <td className="px-3 py-2">{formatPercent(cumulativeRow.social_rate)}</td>
                <td className="px-3 py-2">{formatPercent(cumulativeRow.other_rate)}</td>
                <td className="px-3 py-2">{formatPercent(cumulativeRow.average_rate)}</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-3 text-sm text-ink-muted">
            {year}년 총 달성률: {formatPercent(cumulativeRow.average_rate)}
          </p>
        </div>
      )}
    </section>
  );
}

function FeedbackSection({ feedback }: { feedback: MyCoachingFeedbackItem[] }) {
  return (
    <section className="report-section mt-8">
      <h2 className="report-section-title border-b border-line-base pb-2 text-xl font-semibold print:text-lg">
        코치 피드백
      </h2>
      {feedback.length === 0 ? (
        <div className="mt-4">
          <EmptyState>표시할 코치 피드백이 없습니다.</EmptyState>
        </div>
      ) : (
        <div className="mt-4 grid gap-4">
          {feedback.slice(0, 5).map((item) => (
            <article
              className="report-card rounded-card border border-line-base bg-surface-card p-4"
              key={item.id}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-ink-faint">주간 기간</p>
                  <p className="mt-1 font-semibold">
                    {formatDate(item.week_start)} ~ {formatDate(item.week_end)}
                  </p>
                </div>
                <p className="text-sm text-ink-muted">
                  코치: {displayValue(item.coach_display_name ?? item.coach_full_name ?? item.coach_email)}
                </p>
              </div>
              <div className="mt-4 grid gap-3 text-sm">
                <div>
                  <p className="font-medium text-ink-faint">피드백</p>
                  <p className="mt-1 whitespace-pre-wrap break-words leading-6">
                    {displayValue(item.feedback_text)}
                  </p>
                </div>
                <div>
                  <p className="font-medium text-ink-faint">다음 단계</p>
                  <p className="mt-1 whitespace-pre-wrap break-words leading-6">
                    {displayValue(item.next_step)}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default async function CoacheeReportPage() {
  const session = await getSession();

  if (!session.user) {
    redirect("/login?redirectTo=%2Fcoachee%2Freport");
  }

  const year = new Date().getFullYear();
  const [meResult, goalsResult, moksilgiResult, summaryResult, feedbackResult] =
    await Promise.all([
      getMyCoachingMe(),
      getMyCoachingGoals(),
      getMyMoksilgi(),
      getMyMoksilgiSummary(year),
      getMyCoachingFeedback(),
    ]);

  if (!meResult.ok && meResult.error.code === "UNAUTHORIZED") {
    redirect("/login?redirectTo=%2Fcoachee%2Freport");
  }

  const profile = meResult.ok ? meResult.data.profile : null;
  const authEmail = meResult.ok ? meResult.data.authEmail : session.user.email ?? null;
  const coacheeName = personName({
    authEmail,
    displayName: profile?.display_name,
    email: profile?.email,
    fullName: profile?.full_name,
  });
  const goals = goalsResult.ok ? goalsResult.data.goals : [];
  const plan = moksilgiResult.ok ? moksilgiResult.data.plan : null;
  const areas = moksilgiResult.ok ? moksilgiResult.data.areas : [];
  const detailGoals = moksilgiResult.ok ? moksilgiResult.data.detailGoals : [];
  const summaryRows = summaryResult.ok ? summaryResult.data.rows : [];
  const cumulativeRow = summaryResult.ok ? summaryResult.data.cumulativeRow : null;
  const hasSummaryData = summaryResult.ok ? summaryResult.data.hasSummaryData : false;
  const feedback = feedbackResult.error ? [] : feedbackResult.data;
  const hasAnyData = goalsExist({
    detailGoals,
    goals,
    hasMoksilgiPlan: plan !== null,
    hasSummaryData,
  });

  return (
    <main className="min-h-screen bg-surface-sunken px-6 py-8 text-ink-strong print:bg-surface-card print:px-0 print:py-0">
      <style>
        {`
          @page {
            size: A4 portrait;
            margin: 14mm;
          }

          @media print {
            html,
            body {
              background: #ffffff !important;
              color: #0f172a !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

            .report-controls,
            .print-hidden {
              display: none !important;
            }

            .print-report-shell {
              width: 100% !important;
              max-width: none !important;
              border-radius: 0 !important;
              box-shadow: none !important;
              padding: 0 !important;
            }

            .report-section {
              margin-top: 8mm !important;
              padding-top: 2mm !important;
              border-top: 1px solid #e2e8f0;
              break-inside: auto;
              page-break-inside: auto;
            }

            .report-section-title {
              break-after: avoid;
              page-break-after: avoid;
            }

            .report-card {
              background: #ffffff !important;
              box-shadow: none !important;
              break-inside: avoid;
              page-break-inside: avoid;
              overflow: visible !important;
            }

            .report-table {
              width: 100% !important;
              min-width: 0 !important;
              border-collapse: collapse !important;
              font-size: 10.5pt !important;
              table-layout: fixed;
              page-break-inside: auto;
            }

            .report-table thead {
              display: table-header-group;
            }

            .report-table tr {
              break-inside: avoid;
              page-break-inside: avoid;
            }

            .report-table th,
            .report-table td {
              overflow-wrap: anywhere;
              word-break: break-word;
              vertical-align: top;
            }

            .report-section p,
            .report-section li,
            .report-section dd {
              overflow-wrap: anywhere;
              word-break: break-word;
            }
          }
        `}
      </style>
      <section className="print-report-shell mx-auto max-w-[210mm] rounded-control bg-surface-card p-8 shadow-sm print:max-w-none print:rounded-none print:p-0 print:shadow-none">
        <div className="report-controls mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link
            className="rounded-md border border-line-base bg-surface-card px-4 py-2 text-sm font-semibold text-ink-base hover:bg-surface-sunken"
            href="/coachee"
          >
            코치이 공간으로 돌아가기
          </Link>
          <PrintCoacheeReportButton />
        </div>

        <header className="border-b border-line-base pb-6">
          <p className="text-sm font-semibold text-ink-faint print:text-ink-base">
            코치이 보고서
          </p>
          <h1 className="mt-2 text-3xl font-bold text-ink-strong print:text-2xl">
            목표와 목실기 인쇄용 보고서
          </h1>
          <div className="mt-4 grid gap-2 text-sm text-ink-muted print:text-ink-base sm:grid-cols-2">
            <p>생성일: {formatDateTime(new Date().toISOString())}</p>
            <p>코치이: {coacheeName}</p>
            <p>이메일: {displayValue(profile?.email ?? authEmail)}</p>
            <p>기준 연도: {year}년</p>
          </div>
        </header>

        {!hasAnyData ? (
          <section className="mt-6">
            <EmptyState />
          </section>
        ) : null}

        <GoalSection goals={goals} />
        <MoksilgiSection areas={areas} detailGoals={detailGoals} plan={plan} />

        {cumulativeRow ? (
          <SummaryTable
            cumulativeRow={cumulativeRow}
            hasSummaryData={hasSummaryData}
            rows={summaryRows}
            year={year}
          />
        ) : (
          <section className="report-section mt-8">
            <h2 className="report-section-title border-b border-line-base pb-2 text-xl font-semibold print:text-lg">
              월간 진행 내용
            </h2>
            <div className="mt-4">
              <EmptyState>표시할 월간 진행 내용이 없습니다.</EmptyState>
            </div>
          </section>
        )}

        <FeedbackSection feedback={feedback} />
      </section>
    </main>
  );
}
