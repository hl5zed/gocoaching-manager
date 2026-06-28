import Link from "next/link";
import { redirect } from "next/navigation";
import { PrintPageButton } from "@/components/print/PrintPageButton";
import { I18nText } from "@/lib/i18n/I18nProvider";
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,

  ProgressBar,
  TextInput,
} from "@/components/ui";
import {
  getCoachMoksilgiDetail,
  type CoachMoksilgiDetail,
  type CoachMoksilgiDetailGoal,
  type CoachMoksilgiGoalArea,
  type CoachMoksilgiSummaryRow,
} from "@/lib/api/coach/moksilgi-detail";
import {
  getCoachMoksilgiPlanStatus,
  createCoachReview,
  REVIEW_STATUS_LABELS,
  PLAN_VERSION_TYPE_LABELS,
  type CoachPlanReview,
} from "@/lib/api/coach/moksilgi-review";
import type { MoksilgiReviewStatus } from "@/types/database";
import {
  DEFAULT_TIMEZONE,
  formatDateInTimezone,
  getCurrentMonthInTimezone,
  getCurrentYearInTimezone,
} from "@/lib/timezone";
import type { Json } from "@/types/database";


const STATUS_LABEL: Record<string, string> = {
  draft: "임시 저장",
  active: "활성",
  archived: "보관",
};

function statusTone(status: string): "success" | "warning" | "neutral" | "info" {
  if (status === "active") return "success";
  if (status === "draft") return "warning";
  if (status === "archived") return "neutral";
  return "info";
}

const MEASUREMENT_LABEL: Record<string, string> = {
  daily_check: "매일 실행 확인",
  weekly_count: "매주 실행 확인",
  monthly_number: "월간 수치 입력",
  monthly_comment: "COMMENT",
};

type CoreValueItem = {
  value_name: string;
  meaning: string;
  practice_example: string;
};

const VALID_REVIEW_STATUSES = new Set<MoksilgiReviewStatus>([
  "reviewing",
  "changes_requested",
  "confirmed",
  "approved",
]);

async function saveReviewAction(formData: FormData) {
  "use server";

  const planId = String(formData.get("plan_id") ?? "");
  const reviewStatusRaw = String(formData.get("review_status") ?? "");
  const feedbackContent = String(formData.get("feedback_content") ?? "");

  const reviewStatus = VALID_REVIEW_STATUSES.has(
    reviewStatusRaw as MoksilgiReviewStatus,
  )
    ? (reviewStatusRaw as MoksilgiReviewStatus)
    : "reviewing";

  const result = await createCoachReview({
    plan_id: planId,
    review_status: reviewStatus,
    feedback_content: feedbackContent,
  });

  if (!result.ok) {
    redirect(`/coach/moksilgi/${planId}?error=review`);
  }

  redirect(`/coach/moksilgi/${planId}?saved=review`);
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseYear(params: Record<string, string | string[] | undefined>) {
  const currentYear = getCurrentYearInTimezone(DEFAULT_TIMEZONE);
  const year = Number(firstParam(params.year) ?? currentYear);

  return Number.isInteger(year) && year >= 2000 && year <= 2100
    ? year
    : currentYear;
}

function formatPercent(value: number | null | undefined) {
  const numeric = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return `${numeric.toFixed(1)}%`;
}

function formatDate(value: string | null) {
  return value ? formatDateInTimezone(value, DEFAULT_TIMEZONE) : "-";
}

function displayValue(value: string | number | null) {
  if (value === null) return "-";
  if (typeof value === "number") return String(value);
  return value.trim().length > 0 ? value : "-";
}

function coacheeName(data: CoachMoksilgiDetail) {
  return (
    data.coachee?.display_name ??
    data.coachee?.full_name ??
    data.coachee?.email ??
    "알 수 없음"
  );
}

function stringFromJson(value: Json | undefined) {
  return typeof value === "string" ? value : "";
}

function coreValuesFromJson(value: Json) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const record = item as Record<string, Json>;

      return {
        value_name: stringFromJson(record.value_name),
        meaning: stringFromJson(record.meaning),
        practice_example: stringFromJson(record.practice_example),
      } satisfies CoreValueItem;
    })
    .filter((item): item is CoreValueItem => item !== null)
    .filter(
      (item) =>
        item.value_name.trim().length > 0 ||
        item.meaning.trim().length > 0 ||
        item.practice_example.trim().length > 0,
    );
}

function strategiesFromJson(value: Json) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
}

function InfoGrid({
  items,
}: {
  items: { label: React.ReactNode; value: string | number | null }[];
}) {
  return (
    <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item, index) => (
        <div className="min-w-0" key={index}>
          <dt className="text-sm font-medium text-ink-faint">{item.label}</dt>
          <dd className="mt-1 whitespace-pre-wrap break-words text-ink-strong">
            {displayValue(item.value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function TopBar({
  planId,
  year,
  fileName,
}: {
  planId: string;
  year: number;
  fileName: string;
}) {
  return (
    <div className="print-hidden flex flex-wrap items-center justify-between gap-3">
      <ButtonLink
        href={`/coach/moksilgi?year=${year}`}
        icon="arrow-left"
        size="sm"
        variant="secondary"
      >
        <I18nText k="coach.moksilgi.detail.backToList" fallback="코치이 목실기 목록으로 돌아가기" />
      </ButtonLink>
      <div className="flex flex-wrap items-center gap-2">
        <form className="flex items-center gap-2" method="get">
          <label className="flex items-center gap-2 text-sm text-ink-muted">
            <I18nText k="coach.moksilgi.year" fallback="연도" />
            <TextInput
              className="w-24"
              defaultValue={year}
              max={2100}
              min={2000}
              name="year"
              type="number"
            />
          </label>
          <Button icon="search" size="sm" type="submit" variant="secondary">
            <I18nText k="coach.moksilgi.search" fallback="조회" />
          </Button>
          <ButtonLink
            href={`/coach/moksilgi/${planId}`}
            size="sm"
            variant="ghost"
          >
            <I18nText k="coach.moksilgi.detail.viewCurrentYear" fallback="올해로 보기" />
          </ButtonLink>
        </form>
        <PrintPageButton fileName={fileName} label="인쇄/PDF" />
      </div>
    </div>
  );
}

function ErrorShell({
  children,
  planId,
  year,
}: {
  children: React.ReactNode;
  planId: string;
  year: number;
}) {
  return (
    <main className="min-h-screen bg-surface-app px-6 py-10 text-ink-strong">
      <div className="mx-auto max-w-6xl">
        <TopBar fileName="" planId={planId} year={year} />
        <div className="mt-8">{children}</div>
      </div>
    </main>
  );
}

function Section({
  children,
  title,
}: {
  children: React.ReactNode;
  title: React.ReactNode;
}) {
  return (
    <Card className="print-section">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function CoreValuesSection({ values }: { values: CoreValueItem[] }) {
  if (values.length === 0) {
    return (
      <p className="text-ink-faint">
        <I18nText k="coach.moksilgi.detail.noCoreValues" fallback="등록된 핵심가치가 없습니다." />
      </p>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {values.map((value, index) => (
        <Card
          className="print-card bg-surface-sunken"
          key={`${value.value_name}-${index}`}
        >
          <CardContent className="p-4">
          <h3 className="break-words font-semibold text-ink-strong">
            {displayValue(value.value_name)}
          </h3>
          <p className="mt-2 whitespace-pre-wrap text-sm text-ink-base">
            {displayValue(value.meaning)}
          </p>
          <p className="mt-3 text-sm font-medium text-ink-faint">
            <I18nText k="coach.moksilgi.detail.practiceExample" fallback="실천 모습" />
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-ink-base">
            {displayValue(value.practice_example)}
          </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function DetailGoalCard({ goal }: { goal: CoachMoksilgiDetailGoal }) {
  const strategies = strategiesFromJson(goal.strategies_json);

  return (
    <Card className="print-card">
      <CardContent className="p-4">
      <h4 className="break-words font-semibold text-ink-strong">{goal.title}</h4>
      <p className="mt-2 whitespace-pre-wrap text-sm text-ink-base">
        {displayValue(goal.description)}
      </p>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-xs font-medium text-ink-faint">
            <I18nText k="coach.moksilgi.detail.annualTarget" fallback="연간 목표량" />
          </dt>
          <dd className="mt-1 text-sm text-ink-strong">
            {displayValue(goal.annual_target)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-ink-faint">
            <I18nText k="coach.moksilgi.detail.monthlyTarget" fallback="월 목표량" />
          </dt>
          <dd className="mt-1 text-sm text-ink-strong">
            {displayValue(goal.monthly_target)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-ink-faint">
            <I18nText k="coach.moksilgi.detail.unit" fallback="단위" />
          </dt>
          <dd className="mt-1 text-sm text-ink-strong">{displayValue(goal.unit)}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-ink-faint">
            <I18nText k="coach.moksilgi.detail.measurementType" fallback="측정 방식" />
          </dt>
          <dd className="mt-1 text-sm text-ink-strong">
            {MEASUREMENT_LABEL[goal.measurement_type] ?? goal.measurement_type}
          </dd>
        </div>
      </dl>
      <div className="mt-4">
        <p className="text-sm font-medium text-ink-faint">
          <I18nText k="coach.moksilgi.detail.actionStrategies" fallback="실행전략" />
        </p>
        {strategies.length === 0 ? (
          <p className="mt-1 text-sm text-ink-faint">
            <I18nText k="coach.moksilgi.detail.noActionStrategies" fallback="등록된 실행전략이 없습니다." />
          </p>
        ) : (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-base">
            {strategies.map((strategy, index) => (
              <li key={`${strategy}-${index}`}>{strategy}</li>
            ))}
          </ul>
        )}
      </div>
      </CardContent>
    </Card>
  );
}

function GoalAreasSection({
  areas,
  detailGoals,
}: {
  areas: CoachMoksilgiGoalArea[];
  detailGoals: CoachMoksilgiDetailGoal[];
}) {
  if (areas.length === 0) {
    return (
      <p className="text-ink-faint">
        <I18nText k="coach.moksilgi.detail.noGoalAreas" fallback="등록된 목표 영역이 없습니다." />
      </p>
    );
  }

  return (
    <div className="grid gap-5">
      {areas.map((area, index) => {
        const goals = detailGoals.filter((goal) => goal.area_id === area.id);

        return (
          <Card className="print-card bg-surface-sunken" key={area.id}>
            <CardContent className="p-5">
            <div>
              <h3 className="break-words font-semibold text-ink-strong">
                <I18nText k="coach.moksilgi.detail.goalPrefix" fallback="목표" /> {index + 1}: {area.area_title}
              </h3>
              <p className="mt-1 text-sm text-ink-muted">
                {displayValue(area.area_subtitle)}
              </p>
            </div>
            {goals.length === 0 ? (
              <p className="mt-4 text-sm text-ink-faint">
                <I18nText k="coach.moksilgi.detail.noDetailGoals" fallback="등록된 세부 목표가 없습니다." />
              </p>
            ) : (
              <div className="mt-4 grid gap-3">
                {goals.map((goal) => (
                  <DetailGoalCard goal={goal} key={goal.id} />
                ))}
              </div>
            )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function SummaryTable({
  cumulativeRow,
  rows,
  year,
}: {
  cumulativeRow: CoachMoksilgiSummaryRow;
  rows: CoachMoksilgiSummaryRow[];
  year: number;
}) {
  const currentMonth =
    getCurrentYearInTimezone(DEFAULT_TIMEZONE) === year
      ? getCurrentMonthInTimezone(DEFAULT_TIMEZONE)
      : null;
  const allRows = [...rows, cumulativeRow];

  return (
    <div className="overflow-x-auto">
      <table className="min-w-[860px] w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line-base bg-surface-sunken text-left text-ink-muted">
            <th className="px-3 py-2 font-semibold">
              <I18nText k="coach.moksilgi.detail.goalAchievement" fallback="목표 / 성취" />
            </th>
            <th className="px-3 py-2 font-semibold">
              <I18nText k="coach.moksilgi.detail.goal1Spiritual" fallback="목표1: 영적 성장" />
            </th>
            <th className="px-3 py-2 font-semibold">
              <I18nText k="coach.moksilgi.detail.goal2Intellectual" fallback="목표2: 지적 성장" />
            </th>
            <th className="px-3 py-2 font-semibold">
              <I18nText k="coach.moksilgi.detail.goal3Physical" fallback="목표3: 육체적 성장" />
            </th>
            <th className="px-3 py-2 font-semibold">
              <I18nText k="coach.moksilgi.detail.goal4Social" fallback="목표4: 사회적 성장" />
            </th>
            <th className="px-3 py-2 font-semibold">
              <I18nText k="coach.moksilgi.detail.goal5Other" fallback="목표5: 기타" />
            </th>
            <th className="px-3 py-2 font-semibold">
              <I18nText k="coach.moksilgi.total" fallback="종합" />
            </th>
            <th className="px-3 py-2 font-semibold">
              <I18nText k="coach.moksilgi.average" fallback="평균" />
            </th>
          </tr>
        </thead>
        <tbody>
          {allRows.map((row) => {
            const isCumulative = row.month === "cumulative";
            const isCurrentMonth = row.month === currentMonth;
            const rowClass = isCumulative
              ? "border-b border-line-base font-semibold"
              : isCurrentMonth
                ? "border-b border-line-base bg-brand-50 font-medium"
                : "border-b border-line-soft";

            return (
              <tr className={rowClass} key={row.month}>
                <th className="whitespace-nowrap px-3 py-2 text-left font-medium">
                  {row.monthLabel}
                  {isCurrentMonth ? (
                    <Badge className="ml-2 text-xs" tone="info">
                      <I18nText k="moksilgi.currentMonth" fallback="현재" />
                    </Badge>
                  ) : null}
                </th>
                <td className="px-3 py-2">{formatPercent(row.spiritual_rate)}</td>
                <td className="px-3 py-2">{formatPercent(row.intellectual_rate)}</td>
                <td className="px-3 py-2">{formatPercent(row.physical_rate)}</td>
                <td className="px-3 py-2">{formatPercent(row.social_rate)}</td>
                <td className="px-3 py-2">{formatPercent(row.other_rate)}</td>
                <td className="px-3 py-2">{formatPercent(row.total_rate)}</td>
                <td className="px-3 py-2">{formatPercent(row.average_rate)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default async function CoachMoksilgiDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ planId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { planId } = await params;
  const query = searchParams ? await searchParams : {};
  const year = parseYear(query);
  const savedMsg = firstParam(query.saved);
  const errorMsg = firstParam(query.error);
  const result = await getCoachMoksilgiDetail(planId, year);
  const reviewStatusResult = await getCoachMoksilgiPlanStatus(planId);

  if (result.error?.code === "UNAUTHORIZED") {
    redirect("/login?redirectTo=/coach/moksilgi");
  }

  if (result.error?.code === "PROFILE_NOT_FOUND") {
    return (
      <ErrorShell planId={planId} year={year}>
        <div className="rounded-md border border-yellow-200 bg-yellow-50 p-4 text-yellow-800">
          <I18nText k="dashboard.noProfile" fallback="아직 프로필이 생성되지 않았습니다." />
        </div>
        <Link
          href="/profile"
          className="mt-4 inline-block text-sm font-medium text-blue-600 hover:underline"
        >
          <I18nText k="myCoaching.viewProfile" fallback="프로필 보기" />
        </Link>
      </ErrorShell>
    );
  }

  if (result.error?.code === "ACCESS_DENIED") {
    return (
      <ErrorShell planId={planId} year={year}>
        <p className="rounded-control border border-red-200 bg-red-50 p-4 text-red-700">
          <I18nText k="coach.moksilgi.accessDenied" fallback="코치 권한이 없습니다." />
        </p>
      </ErrorShell>
    );
  }

  if (result.error?.code === "NOT_FOUND") {
    return (
      <ErrorShell planId={planId} year={year}>
        <p className="rounded-card border border-line-base bg-surface-card p-6 text-ink-base">
          <I18nText k="coach.moksilgi.detail.notFound" fallback="해당 목실기를 찾을 수 없습니다." />
        </p>
      </ErrorShell>
    );
  }

  if (result.error) {
    return (
      <ErrorShell planId={planId} year={year}>
        <p className="rounded-control border border-red-200 bg-red-50 p-4 text-red-700">
          <I18nText k="coach.moksilgi.detail.loadFailed" fallback="지금 목실기 상세 정보를 불러올 수 없습니다." />
        </p>
      </ErrorShell>
    );
  }

  const { data } = result;
  const plan = data.plan;
  const coreValues = coreValuesFromJson(plan.core_values_json);

  return (
    <main className="print-root min-h-screen bg-[var(--trust-bg)] px-4 py-8 text-ink-strong sm:px-6 lg:py-10">
      <div className="mx-auto max-w-6xl">
        {/* 인쇄용 헤더 */}
        <div className="print-report-title print-only">
          <h1>
            <I18nText k="coach.moksilgi.detail.reportTitle" fallback="코치이 목실기 상세 보고서" />
          </h1>
          <p>
            <I18nText k="coach.moksilgi.coachee" fallback="코치이" />: {coacheeName(data)}
          </p>
          <p>
            <I18nText k="coach.moksilgi.printYear" fallback="출력 연도" />: {year}년
          </p>
          <p>
            <I18nText k="coach.moksilgi.generatedAt" fallback="생성일" />: {formatDateInTimezone(new Date(), DEFAULT_TIMEZONE)}
          </p>
          <p>
            <I18nText k="coach.moksilgi.timezone" fallback="기준 시간대" />: {DEFAULT_TIMEZONE}
          </p>
        </div>

        {/* 상단 네비게이션 바: 뒤로 가기 + 연도 선택 + 인쇄 */}
        <TopBar
          fileName={`moksilgi-coachee-detail-${year}-${planId.slice(0, 8)}`}
          planId={planId}
          year={year}
        />

        {/* 히어로 카드: 코치이 정보 + 성취율 통합 */}
        <Card className="print-hidden mt-4">
          <CardContent className="pt-5">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <Badge icon="report" tone="info">
                  <I18nText k="coach.moksilgi.detail.badge" fallback="코치용 목실기 상세 보기" />
                </Badge>
                <p className="mt-3 text-xl font-semibold">{coacheeName(data)}</p>
                <p className="mt-1 text-sm text-ink-muted">
                  {data.coachee?.email ?? ""}
                  {plan.role_label ? ` · ${plan.role_label}` : ""}
                  {plan.generation_label ? ` · ${plan.generation_label}` : ""}
                  {plan.coach_name ? ` · 코치: ${plan.coach_name}` : ""}
                  {plan.regional_leader_name ? ` · 지역팀장: ${plan.regional_leader_name}` : ""}
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-sm">
                  <Badge tone={statusTone(plan.status)}>
                    {STATUS_LABEL[plan.status] ?? plan.status}
                  </Badge>
                  {reviewStatusResult.ok ? (
                    <Badge
                      tone={
                        reviewStatusResult.data.plan_version_type === "approved"
                          ? "success"
                          : reviewStatusResult.data.plan_version_type === "review_requested"
                            ? "warning"
                            : reviewStatusResult.data.plan_version_type === "submitted"
                              ? "info"
                              : "neutral"
                      }
                    >
                      {PLAN_VERSION_TYPE_LABELS[reviewStatusResult.data.plan_version_type] ??
                        reviewStatusResult.data.plan_version_type}
                    </Badge>
                  ) : null}
                  {plan.region_name ? (
                    <span className="text-ink-faint">소속: {plan.region_name}</span>
                  ) : null}
                </div>
              </div>
              <div className="shrink-0 sm:text-right">
                <p className="text-sm font-medium text-ink-faint">
                  {year}
                  <I18nText k="coach.moksilgi.totalAchievementSuffix" fallback="년 총 달성률" />
                </p>
                <p className="mt-1 text-4xl font-semibold">
                  {formatPercent(data.totalAchievementRate)}
                </p>
                <ProgressBar
                  className="mt-2 min-w-[200px]"
                  label="연간 성취율"
                  value={data.totalAchievementRate}
                />
                {!data.hasSummaryData ? (
                  <p className="mt-2 text-sm text-amber-700">
                    <I18nText
                      k="coach.moksilgi.detail.noMonthlyRecords"
                      fallback="아직 선택한 연도의 월별 체크리스트 기록이 없습니다."
                    />
                  </p>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 코치 검토 및 피드백 */}
        <div className="print-hidden mt-6">
          <Section title="코치 검토 및 피드백">
            <div className="space-y-5">
              {/* 1. 현재 상태 */}
              {reviewStatusResult.ok ? (
                <div className="flex flex-wrap items-center gap-3 border-b border-line-soft pb-4">
                  <span className="text-sm font-medium text-ink-muted">현재 상태</span>
                  <Badge
                    tone={
                      reviewStatusResult.data.plan_version_type === "approved"
                        ? "success"
                        : reviewStatusResult.data.plan_version_type === "review_requested"
                          ? "warning"
                          : reviewStatusResult.data.plan_version_type === "submitted"
                            ? "info"
                            : "neutral"
                    }
                  >
                    {PLAN_VERSION_TYPE_LABELS[reviewStatusResult.data.plan_version_type] ??
                      reviewStatusResult.data.plan_version_type}
                  </Badge>
                </div>
              ) : null}

              {/* 2. 저장/오류 메시지 */}
              {savedMsg === "review" ? (
                <div className="rounded-control border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                  피드백이 저장되었습니다.
                </div>
              ) : null}
              {errorMsg === "review" ? (
                <div className="rounded-control border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  피드백 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.
                </div>
              ) : null}

              {/* 3. 피드백 이력 */}
              {reviewStatusResult.ok && reviewStatusResult.data.reviews.length > 0 ? (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-ink-muted">피드백 이력</h3>
                  <ul className="divide-y divide-line-soft rounded-card border border-line-base">
                    {reviewStatusResult.data.reviews.map((review: CoachPlanReview) => (
                      <li className="p-4" key={review.id}>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            tone={
                              review.review_status === "approved" || review.review_status === "confirmed"
                                ? "success"
                                : review.review_status === "changes_requested"
                                  ? "warning"
                                  : "info"
                            }
                          >
                            {REVIEW_STATUS_LABELS[review.review_status] ?? review.review_status}
                          </Badge>
                          <span className="text-xs text-ink-faint">
                            {new Date(review.created_at).toLocaleDateString("ko-KR")}
                          </span>
                        </div>
                        {review.feedback_content ? (
                          <p className="mt-2 whitespace-pre-wrap text-sm text-ink-base">
                            {review.feedback_content}
                          </p>
                        ) : (
                          <p className="mt-2 text-sm text-ink-faint">피드백 내용 없음</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {/* 4. 새 피드백 작성 — 상태 무관 단일 폼 */}
              {reviewStatusResult.ok ? (
                <>
                  <h3 className="text-sm font-medium text-ink-muted">새 피드백 작성</h3>
                  <form action={saveReviewAction} className="space-y-4">
                    <input name="plan_id" type="hidden" value={planId} />
                    <div>
                      <label className="block text-sm font-medium text-ink-muted" htmlFor="coach-feedback">
                        피드백 내용
                      </label>
                      <textarea
                        className="mt-2 w-full rounded-control border border-line-base bg-surface-card px-3 py-2 text-ink-base outline-none focus:border-brand-600"
                        id="coach-feedback"
                        maxLength={4000}
                        name="feedback_content"
                        placeholder="피코치에게 전달할 피드백을 작성하세요."
                        rows={5}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-ink-muted" htmlFor="review-status">
                        검토 상태
                      </label>
                      <select
                        className="mt-2 w-full rounded-control border border-line-base bg-surface-card px-3 py-2 text-ink-base outline-none focus:border-brand-600"
                        id="review-status"
                        name="review_status"
                      >
                        <option value="reviewing">검토 중</option>
                        <option value="changes_requested">보완 요청</option>
                      <option value="confirmed">확인 완료</option>
                      <option value="approved">승인</option>
                    </select>
                  </div>
                  <Button type="submit" variant="primary">
                    피드백 저장
                  </Button>
                </form>
                </>
              ) : (
                <p className="text-sm text-ink-faint">
                  {reviewStatusResult.error}
                </p>
              )}
            </div>
          </Section>
        </div>

        <div className="mt-6 grid gap-6">
          {/* 기본 정보: 코치이 정보 + 계획 정보 통합, 소속 중복 제거 */}
          <Section title={<I18nText k="moksilgi.basicInfo" fallback="기본 정보" />}>
            <InfoGrid
              items={[
                { label: <I18nText k="coach.moksilgi.detail.name" fallback="이름" />, value: coacheeName(data) },
                { label: <I18nText k="coach.moksilgi.detail.email" fallback="이메일" />, value: data.coachee?.email ?? null },
                { label: <I18nText k="moksilgi.role" fallback="직책" />, value: plan.role_label },
                { label: <I18nText k="moksilgi.generation" fallback="세대" />, value: plan.generation_label },
                { label: <I18nText k="coach.moksilgi.community" fallback="소속/공동체" />, value: plan.region_name },
                { label: <I18nText k="coach.moksilgi.coach" fallback="코치" />, value: plan.coach_name },
                { label: <I18nText k="coach.moksilgi.detail.regionalLeader" fallback="지역팀장" />, value: plan.regional_leader_name },
                { label: <I18nText k="coach.moksilgi.detail.planTitle" fallback="제목" />, value: plan.title },
                { label: <I18nText k="coach.moksilgi.detail.planSubtitle" fallback="부제" />, value: plan.subtitle },
                {
                  label: <I18nText k="coach.moksilgi.detail.period" fallback="기간" />,
                  value: `${formatDate(plan.period_start)} ~ ${formatDate(plan.period_end)}`,
                },
                { label: <I18nText k="coach.moksilgi.detail.writtenAt" fallback="작성일" />, value: formatDate(plan.written_at) },
                { label: <I18nText k="coach.moksilgi.updatedAt" fallback="최근 수정일" />, value: formatDate(plan.updated_at) },
                { label: <I18nText k="moksilgi.team" fallback="팀/목장" />, value: plan.team_name },
              ]}
            />
          </Section>

          <Section title={<I18nText k="coach.moksilgi.detail.missionSection" fallback="Ⅰ. 사명선언서" />}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="min-w-0">
                <dt className="text-sm font-medium text-ink-faint">
                  <I18nText k="coach.moksilgi.detail.missionStatement" fallback="사명선언 문장" />
                </dt>
                <dd className="mt-1 whitespace-pre-wrap break-words text-ink-strong">
                  {displayValue(plan.mission_statement)}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-sm font-medium text-ink-faint">
                  <I18nText k="coach.moksilgi.detail.bibleVerse" fallback="관련 성경구절" />
                </dt>
                <dd className="mt-1 whitespace-pre-wrap break-words text-ink-strong">
                  {displayValue(plan.mission_bible_verse)}
                </dd>
              </div>
            </div>
            <div className="mission-desc-row mt-4">
              <dt className="text-sm font-medium text-ink-faint">
                <I18nText k="coach.moksilgi.detail.missionDescription" fallback="사명 설명" />
              </dt>
              <dd className="mt-1 whitespace-pre-wrap break-words text-ink-strong">
                {displayValue(plan.mission_description)}
              </dd>
            </div>
          </Section>

          <Section title={<I18nText k="coach.moksilgi.detail.visionSection" fallback="Ⅱ. 비전" />}>
            <Card className="print-card bg-surface-sunken">
              <CardContent className="p-5">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="min-w-0">
                    <dt className="text-sm font-medium text-ink-faint">
                      <I18nText k="coach.moksilgi.detail.visionYear" fallback="비전 목표 연도" />
                    </dt>
                    <dd className="mt-1 whitespace-pre-wrap break-words text-ink-strong">
                      {displayValue(plan.vision_year)}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-sm font-medium text-ink-faint">
                      <I18nText k="coach.moksilgi.detail.visionStatement" fallback="비전 문장" />
                    </dt>
                    <dd className="mt-1 whitespace-pre-wrap break-words text-ink-strong">
                      {displayValue(plan.vision_statement)}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-sm font-medium text-ink-faint">
                      <I18nText k="coach.moksilgi.detail.visionMetrics" fallback="핵심 수치" />
                    </dt>
                    <dd className="mt-1 whitespace-pre-wrap break-words text-ink-strong">
                      {displayValue(plan.vision_metrics)}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-sm font-medium text-ink-faint">
                      <I18nText k="coach.moksilgi.detail.visionTarget" fallback="대상" />
                    </dt>
                    <dd className="mt-1 whitespace-pre-wrap break-words text-ink-strong">
                      {displayValue(plan.vision_target)}
                    </dd>
                  </div>
                </div>
                <div className="mt-4">
                  <dt className="text-sm font-medium text-ink-faint">
                    <I18nText k="coach.moksilgi.detail.visionDescription" fallback="비전 설명" />
                  </dt>
                  <dd className="mt-1 whitespace-pre-wrap break-words text-ink-strong">
                    {displayValue(plan.vision_description)}
                  </dd>
                </div>
              </CardContent>
            </Card>
          </Section>

          <Section title={<I18nText k="coach.moksilgi.detail.coreValuesSection" fallback="Ⅲ. 핵심가치" />}>
            <CoreValuesSection values={coreValues} />
          </Section>

          <Section title={<I18nText k="coach.moksilgi.detail.goalsSection" fallback="Ⅳ. 목표" />}>
            <InfoGrid
              items={[
                { label: <I18nText k="coach.moksilgi.detail.mainGoalStatement" fallback="전체 목표 문장" />, value: plan.main_goal },
                { label: <I18nText k="coach.moksilgi.detail.goalDescription" fallback="목표 설명" />, value: plan.main_goal_description },
              ]}
            />
          </Section>

          <Section title={<I18nText k="coach.moksilgi.detail.actionPlanSection" fallback="Ⅴ. 목표에 따른 실행전략 기획안" />}>
            <GoalAreasSection areas={data.areas} detailGoals={data.detailGoals} />
          </Section>

          <Section title={<I18nText k="coach.moksilgi.detail.achievementTableSection" fallback="개인 목표와 실행전략 성취표" />}>
            <p className="mb-4 text-sm text-ink-muted">
              {year}
              <I18nText
                k="coach.moksilgi.detail.achievementTableHelp"
                fallback="년 연간 대비, 월별누적 성취율입니다. (단위%)"
              />
            </p>
            <SummaryTable
              cumulativeRow={data.cumulativeRow}
              rows={data.summaryRows}
              year={year}
            />
          </Section>

        </div>
      </div>
    </main>
  );
}
