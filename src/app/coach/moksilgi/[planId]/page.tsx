import Link from "next/link";
import { redirect } from "next/navigation";
import { PrintPageButton } from "@/components/print/PrintPageButton";
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  FieldLabel,
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
import type { Json } from "@/types/database";

export const dynamic = "force-dynamic";

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

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseYear(params: Record<string, string | string[] | undefined>) {
  const today = new Date();
  const year = Number(firstParam(params.year) ?? today.getFullYear());

  return Number.isInteger(year) && year >= 2000 && year <= 2100
    ? year
    : today.getFullYear();
}

function formatPercent(value: number | null | undefined) {
  const numeric = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return `${numeric.toFixed(1)}%`;
}

function formatDate(value: string | null) {
  return value ? value.slice(0, 10) : "-";
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
  items: { label: string; value: string | number | null }[];
}) {
  return (
    <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <div className="min-w-0" key={item.label}>
          <dt className="text-sm font-medium text-slate-500">{item.label}</dt>
          <dd className="mt-1 whitespace-pre-wrap break-words text-slate-950">
            {displayValue(item.value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function PageNav({ planId, year }: { planId: string; year: number }) {
  return (
    <nav className="print-hidden flex flex-wrap gap-2 text-sm">
      <ButtonLink
        href={`/coach/moksilgi?year=${year}`}
        icon="arrow-left"
        size="sm"
        variant="secondary"
      >
        코치이 목실기 목록으로 돌아가기
      </ButtonLink>
      <ButtonLink href="/coach" icon="users" size="sm" variant="ghost">
        코치 홈으로 돌아가기
      </ButtonLink>
      <ButtonLink href="/dashboard" icon="dashboard" size="sm" variant="ghost">
        대시보드
      </ButtonLink>
      <span className="sr-only">{planId}</span>
    </nav>
  );
}

function YearSelector({ planId, year }: { planId: string; year: number }) {
  return (
    <form className="print-hidden mt-5 flex flex-wrap items-end gap-3" method="get">
      <label className="block min-w-0">
        <FieldLabel>연도</FieldLabel>
        <TextInput
          className="mt-2 w-36"
          defaultValue={year}
          max={2100}
          min={2000}
          name="year"
          type="number"
        />
      </label>
      <Button icon="search" type="submit">
        조회
      </Button>
      <ButtonLink
        href={`/coach/moksilgi/${planId}`}
        size="sm"
        variant="ghost"
      >
        올해로 보기
      </ButtonLink>
    </form>
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
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
      <div className="mx-auto max-w-6xl">
        <PageNav planId={planId} year={year} />
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
  title: string;
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
    return <p className="text-slate-500">등록된 핵심가치가 없습니다.</p>;
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {values.map((value, index) => (
        <Card
          className="print-card bg-slate-50"
          key={`${value.value_name}-${index}`}
        >
          <CardContent className="p-4">
          <h3 className="break-words font-semibold text-slate-950">
            {displayValue(value.value_name)}
          </h3>
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
            {displayValue(value.meaning)}
          </p>
          <p className="mt-3 text-sm font-medium text-slate-500">실천 모습</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
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
      <h4 className="break-words font-semibold text-slate-950">{goal.title}</h4>
      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
        {displayValue(goal.description)}
      </p>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-xs font-medium text-slate-500">연간 목표량</dt>
          <dd className="mt-1 text-sm text-slate-950">
            {displayValue(goal.annual_target)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-slate-500">월 목표량</dt>
          <dd className="mt-1 text-sm text-slate-950">
            {displayValue(goal.monthly_target)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-slate-500">단위</dt>
          <dd className="mt-1 text-sm text-slate-950">{displayValue(goal.unit)}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-slate-500">측정 방식</dt>
          <dd className="mt-1 text-sm text-slate-950">
            {MEASUREMENT_LABEL[goal.measurement_type] ?? goal.measurement_type}
          </dd>
        </div>
      </dl>
      <div className="mt-4">
        <p className="text-sm font-medium text-slate-500">실행전략</p>
        {strategies.length === 0 ? (
          <p className="mt-1 text-sm text-slate-500">등록된 실행전략이 없습니다.</p>
        ) : (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
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
    return <p className="text-slate-500">등록된 목표 영역이 없습니다.</p>;
  }

  return (
    <div className="grid gap-5">
      {areas.map((area, index) => {
        const goals = detailGoals.filter((goal) => goal.area_id === area.id);

        return (
          <Card className="print-card bg-slate-50" key={area.id}>
            <CardContent className="p-5">
            <div>
              <h3 className="break-words font-semibold text-slate-950">
                목표 {index + 1}: {area.area_title}
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                {displayValue(area.area_subtitle)}
              </p>
            </div>
            {goals.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">등록된 세부 목표가 없습니다.</p>
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
  const today = new Date();
  const currentMonth =
    today.getFullYear() === year ? today.getMonth() + 1 : null;
  const allRows = [...rows, cumulativeRow];

  return (
    <div className="overflow-x-auto">
      <table className="min-w-[860px] w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-100 text-left text-slate-600">
            <th className="px-3 py-2 font-semibold">목표 / 성취</th>
            <th className="px-3 py-2 font-semibold">목표1: 영적 성장</th>
            <th className="px-3 py-2 font-semibold">목표2: 지적 성장</th>
            <th className="px-3 py-2 font-semibold">목표3: 육체적 성장</th>
            <th className="px-3 py-2 font-semibold">목표4: 사회적 성장</th>
            <th className="px-3 py-2 font-semibold">목표5: 기타</th>
            <th className="px-3 py-2 font-semibold">종합</th>
            <th className="px-3 py-2 font-semibold">평균</th>
          </tr>
        </thead>
        <tbody>
          {allRows.map((row) => {
            const isCumulative = row.month === "cumulative";
            const isCurrentMonth = row.month === currentMonth;
            const rowClass = isCumulative
              ? "bg-slate-950 font-semibold text-white"
              : isCurrentMonth
                ? "border-b border-slate-200 bg-slate-100 font-medium"
                : "border-b border-slate-100";

            return (
              <tr className={rowClass} key={row.month}>
                <th className="whitespace-nowrap px-3 py-2 text-left font-medium">
                  {row.monthLabel}
                  {isCurrentMonth ? (
                    <Badge className="ml-2" tone="info">
                      현재 월
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
  const result = await getCoachMoksilgiDetail(planId, year);

  if (result.error?.code === "UNAUTHORIZED") {
    redirect("/login?redirectTo=/coach/moksilgi");
  }

  if (result.error?.code === "PROFILE_NOT_FOUND") {
    return (
      <ErrorShell planId={planId} year={year}>
        <div className="rounded-md border border-yellow-200 bg-yellow-50 p-4 text-yellow-800">
          아직 프로필이 생성되지 않았습니다.
        </div>
        <Link
          href="/profile"
          className="mt-4 inline-block text-sm font-medium text-blue-600 hover:underline"
        >
          프로필 보기
        </Link>
      </ErrorShell>
    );
  }

  if (result.error?.code === "ACCESS_DENIED") {
    return (
      <ErrorShell planId={planId} year={year}>
        <p className="rounded-md border border-red-200 bg-red-50 p-4 text-red-700">
          코치 권한이 없습니다.
        </p>
      </ErrorShell>
    );
  }

  if (result.error?.code === "NOT_FOUND") {
    return (
      <ErrorShell planId={planId} year={year}>
        <p className="rounded-md border border-slate-200 bg-white p-6 text-slate-700">
          해당 목실기를 찾을 수 없습니다.
        </p>
      </ErrorShell>
    );
  }

  if (result.error) {
    return (
      <ErrorShell planId={planId} year={year}>
        <p className="rounded-md border border-red-200 bg-red-50 p-4 text-red-700">
          지금 목실기 상세 정보를 불러올 수 없습니다.
        </p>
      </ErrorShell>
    );
  }

  const { data } = result;
  const plan = data.plan;
  const coreValues = coreValuesFromJson(plan.core_values_json);

  return (
    <main className="print-root min-h-screen bg-[var(--trust-bg)] px-4 py-8 text-slate-950 sm:px-6 lg:py-10">
      <div className="mx-auto max-w-6xl">
        <PageNav planId={planId} year={year} />

        <div className="print-report-title print-only">
          <h1>코치이 목실기 상세 보고서</h1>
          <p>코치이: {coacheeName(data)}</p>
          <p>출력 연도: {year}년</p>
          <p>생성일: {new Date().toLocaleDateString("ko-KR")}</p>
        </div>
        <Card className="print-section mt-6">
          <CardHeader className="flex flex-col gap-4 border-b-0 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <Badge icon="report" tone="info">코치용 목실기 상세 보기</Badge>
              <CardTitle className="mt-3 text-3xl">코치이 목실기 상세</CardTitle>
              <CardDescription className="text-base">
                목표와 실행전략 기획안
              </CardDescription>
              <p className="mt-3 max-w-3xl break-words text-slate-600">
                담당 코치이가 작성한 목실기와 연간 성취 요약을 확인합니다.
              </p>
              <YearSelector planId={planId} year={year} />
            </div>
            <PrintPageButton
              fileName={`moksilgi-coachee-detail-${year}-${planId.slice(0, 8)}`}
              label="코치이 목실기 상세 인쇄/PDF 저장"
            />
            <p className="print-hidden text-sm leading-6 text-slate-500 lg:max-w-xs lg:text-right">
              모바일 브라우저에서는 PDF 저장 옵션이 기기와 브라우저에 따라
              다르게 표시될 수 있습니다. 인쇄창이 열리지 않으면 Safari 또는
              Chrome에서 다시 열어 주세요.
            </p>
          </CardHeader>
        </Card>

        <Card className="print-section mt-6">
          <CardContent>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-500">
                  {year}년 총 달성률
                </p>
                <p className="mt-2 text-4xl font-semibold">
                  {formatPercent(data.totalAchievementRate)}
                </p>
              </div>
              <ProgressBar
                className="min-w-[220px] flex-1 sm:max-w-sm"
                label="연간 성취율"
                value={data.totalAchievementRate}
              />
            </div>
            {!data.hasSummaryData ? (
              <p className="mt-3 text-sm text-amber-700">
                아직 선택한 연도의 월별 체크리스트 기록이 없습니다.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <div className="mt-6 grid gap-6">
          <Section title="코치이 정보">
            <InfoGrid
              items={[
                { label: "이름", value: coacheeName(data) },
                { label: "이메일", value: data.coachee?.email ?? null },
                { label: "직책", value: plan.role_label },
                { label: "세대", value: plan.generation_label },
                { label: "지역/목장", value: plan.region_name },
                { label: "코치", value: plan.coach_name },
                { label: "지역팀장", value: plan.regional_leader_name },
              ]}
            />
          </Section>

          <Section title="기본 정보">
            <InfoGrid
              items={[
                { label: "제목", value: plan.title },
                { label: "부제", value: plan.subtitle },
                {
                  label: "기간",
                  value: `${formatDate(plan.period_start)} ~ ${formatDate(plan.period_end)}`,
                },
                { label: "작성일", value: formatDate(plan.written_at) },
                { label: "상태", value: STATUS_LABEL[plan.status] ?? plan.status },
                { label: "최근 수정일", value: formatDate(plan.updated_at) },
                { label: "작성자", value: plan.author_name },
                { label: "지역/목장", value: plan.region_name },
                { label: "팀", value: plan.team_name },
              ]}
            />
          </Section>

          <Section title="Ⅰ. 사명선언서">
            <InfoGrid
              items={[
                { label: "사명선언 문장", value: plan.mission_statement },
                { label: "관련 성경구절", value: plan.mission_bible_verse },
                { label: "사명 설명", value: plan.mission_description },
              ]}
            />
          </Section>

          <Section title="Ⅱ. 비전">
            <InfoGrid
              items={[
                { label: "비전 목표 연도", value: plan.vision_year },
                { label: "비전 문장", value: plan.vision_statement },
                { label: "핵심 수치", value: plan.vision_metrics },
                { label: "대상", value: plan.vision_target },
                { label: "비전 설명", value: plan.vision_description },
              ]}
            />
          </Section>

          <Section title="Ⅲ. 핵심가치">
            <CoreValuesSection values={coreValues} />
          </Section>

          <Section title="Ⅳ. 목표">
            <InfoGrid
              items={[
                { label: "전체 목표 문장", value: plan.main_goal },
                { label: "목표 설명", value: plan.main_goal_description },
              ]}
            />
          </Section>

          <Section title="Ⅴ. 목표에 따른 실행전략 기획안">
            <GoalAreasSection areas={data.areas} detailGoals={data.detailGoals} />
          </Section>

          <Section title="개인 목표와 실행전략 성취표">
            <p className="mb-4 text-sm text-slate-600">
              {year}년 연간 대비, 월별누적 성취율입니다. (단위%)
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
