import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import {
  getCoachMakerMoksilgiProgress,
  type CoachMakerMoksilgiProgressFilters,
  type CoachMakerMoksilgiProgressRow,
} from "@/lib/api/coach-maker/moksilgi-progress";
import { PageNavigationButtons } from "@/components/navigation/PageNavigationButtons";
import { PrintPageButton } from "@/components/print/PrintPageButton";
import {
  Button,
  ButtonLink,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  FieldLabel,
  FieldText,
  ProgressBar,
  TextInput,
} from "@/components/ui";
import { I18nText } from "@/lib/i18n/I18nProvider";
import { MoksilgiProgressClientTable } from "./MoksilgiProgressClientTable";

export const dynamic = "force-dynamic";

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function textParam(value: string | string[] | undefined) {
  const text = firstParam(value)?.trim();
  return text && text.length > 0 ? text : null;
}

function parseYear(params: Record<string, string | string[] | undefined>) {
  const today = new Date();
  const year = Number(firstParam(params.year) ?? today.getFullYear());

  return Number.isInteger(year) && year >= 2000 && year <= 2100
    ? year
    : today.getFullYear();
}

function parseFilters(
  params: Record<string, string | string[] | undefined>,
): CoachMakerMoksilgiProgressFilters {
  return {
    year: parseYear(params),
    teamName: textParam(params.team),
    regionName: textParam(params.region),
    roleLabel: textParam(params.role),
    generationLabel: textParam(params.generation),
    search: textParam(params.search),
  };
}

function formatPercent(value: number | null | undefined) {
  const numeric = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return `${numeric.toFixed(1)}%`;
}

function safeNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function monthRate(row: CoachMakerMoksilgiProgressRow, month: number) {
  const key = `month_${month}_rate` as keyof CoachMakerMoksilgiProgressRow;
  const value = row[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function currentMonthCutoff(year: number) {
  const today = new Date();

  if (year < today.getFullYear()) return 12;
  if (year > today.getFullYear()) return 0;
  return today.getMonth() + 1;
}

function upToCurrentRate(row: CoachMakerMoksilgiProgressRow, year: number) {
  const cutoff = currentMonthCutoff(year);
  if (cutoff <= 0) return 0;

  return average(MONTHS.slice(0, cutoff).map((month) => monthRate(row, month)));
}

function hasProgressInput(row: CoachMakerMoksilgiProgressRow) {
  return MONTHS.some((month) => monthRate(row, month) > 0)
    || safeNumber(row.cumulative_rate) > 0;
}

function attentionCounts(rows: CoachMakerMoksilgiProgressRow[], year: number) {
  return rows.reduce(
    (counts, row) => {
      if (!hasProgressInput(row)) {
        return { ...counts, missing: counts.missing + 1 };
      }

      if (upToCurrentRate(row, year) < 50) {
        return { ...counts, attention: counts.attention + 1 };
      }

      return counts;
    },
    { attention: 0, missing: 0 },
  );
}

function progressStatusCounts(rows: CoachMakerMoksilgiProgressRow[]) {
  return rows.reduce(
    (counts, row) => {
      const rate = typeof row.cumulative_rate === "number" && Number.isFinite(row.cumulative_rate)
        ? row.cumulative_rate
        : 0;

      if (rate >= 100) {
        return { ...counts, completed: counts.completed + 1 };
      }

      if (rate > 0) {
        return { ...counts, inProgress: counts.inProgress + 1 };
      }

      return { ...counts, notStarted: counts.notStarted + 1 };
    },
    { completed: 0, inProgress: 0, notStarted: 0 },
  );
}

function SummaryCard({
  description,
  progressValue,
  title,
  value,
}: {
  description: string;
  progressValue?: number;
  title: ReactNode;
  value: ReactNode;
}) {
  return (
    <Card>
      <CardContent className="min-w-0 p-5">
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <p className="mt-2 break-words text-3xl font-semibold">{value}</p>
        {typeof progressValue === "number" ? (
          <ProgressBar className="mt-4" showValue={false} value={progressValue} />
        ) : null}
        <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
      </CardContent>
    </Card>
  );
}

function FilterForm({ filters }: { filters: CoachMakerMoksilgiProgressFilters }) {
  return (
    <Card className="print-hidden mt-6">
      <CardHeader>
        <CardTitle className="text-lg">데이터 조회 조건</CardTitle>
        <CardDescription>
          상단 조회 조건은 서버에서 새 데이터를 불러오는 기준입니다.
          연도, 지역, 팀, 직책, 세대, 검색어 조건이 전체 조회 범위를
          바꿉니다.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" method="get">
          <FieldLabel>
            <FieldText>
              <I18nText k="moksilgi.year" fallback="연도" />
            </FieldText>
            <TextInput
              defaultValue={filters.year}
              max={2100}
              min={2000}
              name="year"
              type="number"
            />
          </FieldLabel>
          <FieldLabel>
            <FieldText>
              <I18nText k="moksilgi.region" fallback="지역/도시" />
            </FieldText>
            <TextInput
              defaultValue={filters.regionName ?? ""}
              name="region"
              placeholder="예: 치앙라이"
              type="search"
            />
          </FieldLabel>
          <FieldLabel>
            <FieldText>
              <I18nText k="moksilgi.team" fallback="그룹/팀/목장" />
            </FieldText>
            <TextInput
              defaultValue={filters.teamName ?? ""}
              name="team"
              placeholder="예: 코칭그룹"
              type="search"
            />
          </FieldLabel>
          <FieldLabel>
            <FieldText>
              <I18nText k="moksilgi.role" fallback="역할/직책" />
            </FieldText>
            <TextInput
              defaultValue={filters.roleLabel ?? ""}
              name="role"
              type="search"
            />
          </FieldLabel>
          <FieldLabel>
            <FieldText>
              <I18nText k="moksilgi.generation" fallback="세대" />
            </FieldText>
            <TextInput
              defaultValue={filters.generationLabel ?? ""}
              name="generation"
              type="search"
            />
          </FieldLabel>
          <FieldLabel className="lg:col-span-2">
            <FieldText>
              <I18nText k="moksilgi.keyword" fallback="검색어" />
            </FieldText>
            <TextInput
              defaultValue={filters.search ?? ""}
              name="search"
              placeholder="이름, 이메일, 소속 검색"
              type="search"
            />
          </FieldLabel>
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-end">
            <Button className="min-h-10 justify-center" icon="search" type="submit">
              <I18nText k="moksilgi.query" fallback="조회" />
            </Button>
            <ButtonLink
              className="min-h-10 justify-center"
              href={`/coach-maker/moksilgi-progress?year=${filters.year}`}
              icon="filter"
              variant="secondary"
            >
              <I18nText k="moksilgi.resetFilters" fallback="필터 초기화" />
            </ButtonLink>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function ProfileMissing() {
  return (
    <Card className="mt-8">
      <CardContent className="p-6">
      <p className="text-slate-700">아직 프로필이 생성되지 않았습니다.</p>
      <ButtonLink className="mt-4" href="/profile" icon="users" variant="secondary">
        프로필 보기
      </ButtonLink>
      </CardContent>
    </Card>
  );
}

export default async function CoachMakerMoksilgiProgressPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = searchParams ? await searchParams : {};
  const filters = parseFilters(params);
  const initialMemberId = textParam(params.memberId);
  const result = await getCoachMakerMoksilgiProgress(filters);
  const statusCounts = result.data
    ? progressStatusCounts(result.data.rows)
    : { completed: 0, inProgress: 0, notStarted: 0 };
  const careCounts = result.data
    ? attentionCounts(result.data.rows, result.data.year)
    : { attention: 0, missing: 0 };

  if (result.error?.code === "UNAUTHORIZED") {
    redirect("/login?redirectTo=/coach-maker/moksilgi-progress");
  }

  return (
    <main className="print-root min-h-screen bg-[var(--trust-bg)] px-4 py-6 text-slate-950 sm:px-6 sm:py-10">
      <section className="mx-auto w-full max-w-7xl">
        <div className="print-report-title print-only">
          <h1>
            <I18nText k="moksilgi.reportTitle" fallback="목실기 전체 진행 현황 보고서" />
          </h1>
          <p>
            <I18nText k="moksilgi.reportYear" fallback="출력 연도" />: {filters.year}
          </p>
          <p>
            <I18nText k="moksilgi.generatedAt" fallback="생성일" />: {new Date().toLocaleDateString("ko-KR")}
          </p>
        </div>
        <Card>
          <CardHeader className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <CardTitle className="text-2xl sm:text-3xl">
                전체 목실기 성취 현황
              </CardTitle>
              <CardDescription className="mt-3 max-w-3xl text-base">
                <I18nText
                  k="moksilgi.subtitle"
                  fallback="담당 범위의 코치이 목실기 월별 성취율과 관심 필요 대상을 확인합니다."
                />
              </CardDescription>
            </div>
            <div className="flex w-full min-w-0 flex-wrap justify-start gap-2 lg:w-auto lg:justify-end">
              <PageNavigationButtons
                backHref="/coach-maker"
                backLabel="코치메이커로"
                className="justify-start sm:justify-end"
              />
              <PrintPageButton
                fileName={`moksilgi-team-progress-${filters.year}`}
                label="출력"
              />
            </div>
          </CardHeader>
        </Card>

        <FilterForm filters={filters} />

        {result.error?.code === "PROFILE_NOT_FOUND" ? (
          <ProfileMissing />
        ) : result.error?.code === "ACCESS_DENIED" ? (
          <section className="mt-8 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <I18nText k="moksilgi.accessDenied" fallback="코치메이커 권한이 없습니다." />
          </section>
        ) : result.error ? (
          <section className="mt-8 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <I18nText k="moksilgi.loadFailed" fallback="지금 전체 목실기 성취 현황을 불러올 수 없습니다." />
          </section>
        ) : (
          <>
            <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <SummaryCard
                description="현재 필터 조건으로 조회된 목실기 대상자 수입니다."
                title={<I18nText k="moksilgi.totalTargets" fallback="전체 대상자 수" />}
                value={result.data.rows.length}
              />
              <SummaryCard
                description="누적 성취율이 0% 초과 100% 미만인 대상자 수입니다."
                title={<I18nText k="moksilgi.inProgressCount" fallback="진행 중 인원" />}
                value={statusCounts.inProgress}
              />
              <SummaryCard
                description="12개월 누적 성취율이 100% 이상인 대상자 수입니다."
                title={<I18nText k="moksilgi.completedCount" fallback="완료 인원" />}
                value={statusCounts.completed}
              />
              <SummaryCard
                description="현재 월까지 평균 성취율이 50% 미만인 대상자 수입니다."
                title="관심 필요 대상자"
                value={careCounts.attention}
              />
              <SummaryCard
                description="아직 목실기 성취 기록이 없는 대상자 수입니다."
                title="미입력 대상자"
                value={careCounts.missing}
              />
              <SummaryCard
                description="선택 연도 기준 현재 월까지의 평균 성취율입니다."
                progressValue={result.data.upToCurrentRate}
                title={<I18nText k="moksilgi.upToCurrent" fallback="현재 월까지 평균 성취율" />}
                value={formatPercent(result.data.upToCurrentRate)}
              />
            </section>

            {result.data.rows.length === 0 ? (
              <Card className="mt-8">
                <CardContent className="px-4 py-6 text-center text-slate-500">
                  <p>선택한 조건에 해당하는 목실기 기록이 없습니다.</p>
                  <p className="mt-1">필터를 초기화하거나 다른 조건으로 다시 조회해 주세요.</p>
                </CardContent>
              </Card>
            ) : (
              <>
                <p className="print-hidden mt-6 rounded-md border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-600">
                  화면 내 보기 필터는 이미 조회된 결과 안에서만 표시를
                  좁힙니다. 월별 표는 가로로 스크롤해 전체 내용을 확인하세요.
                </p>
                <MoksilgiProgressClientTable
                  initialMemberId={initialMemberId}
                  relationshipRows={result.data.relationshipRows}
                  rows={result.data.rows}
                  year={result.data.year}
                />
              </>
            )}
          </>
        )}
      </section>
    </main>
  );
}
