import Link from "next/link";
import { redirect } from "next/navigation";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
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
  FieldLabel,
  ProgressBar,
  TextInput,
} from "@/components/ui";
import {
  getCoachMoksilgi,
  type CoachMoksilgiItem,
} from "@/lib/api/coach/moksilgi";
import {
  DEFAULT_TIMEZONE,
  formatDateInTimezone,
  getCurrentYearInTimezone,
} from "@/lib/timezone";


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

function summaryText(value: string | null) {
  if (!value || value.trim().length === 0) return "-";

  const trimmed = value.trim();
  return trimmed.length > 160 ? `${trimmed.slice(0, 160)}...` : trimmed;
}

function coacheeName(item: CoachMoksilgiItem) {
  return (
    item.coachee_display_name ??
    item.coachee_full_name ??
    item.coachee_email ??
    "알 수 없음"
  );
}

function YearSelector({ year }: { year: number }) {
  return (
    <form className="print-hidden mt-5 flex flex-wrap items-end gap-3" method="get">
      <label className="block min-w-0">
        <FieldLabel>
          <I18nText k="coach.moksilgi.year" fallback="연도" />
        </FieldLabel>
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
        <I18nText k="coach.moksilgi.search" fallback="조회" />
      </Button>
    </form>
  );
}

function Nav() {
  return (
    <nav className="print-hidden flex flex-wrap items-center gap-2 text-sm">
      <ButtonLink href="/coach" icon="arrow-left" size="sm" variant="secondary">
        <I18nText k="coach.moksilgi.backToCoachHome" fallback="코치 홈으로 돌아가기" />
      </ButtonLink>
      <ButtonLink href="/dashboard" icon="dashboard" size="sm" variant="ghost">
        <I18nText k="coach.moksilgi.dashboard" fallback="대시보드" />
      </ButtonLink>
      <LanguageSwitcher />
    </nav>
  );
}

function ProfileMissing() {
  return (
    <main className="min-h-screen bg-surface-app px-6 py-10 text-ink-strong">
      <div className="mx-auto max-w-5xl">
        <p className="rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3 text-yellow-800">
          <I18nText k="dashboard.noProfile" fallback="아직 프로필이 생성되지 않았습니다." />
        </p>
        <Link
          href="/profile"
          className="mt-4 inline-block text-sm font-medium text-blue-600 hover:underline"
        >
          <I18nText k="myCoaching.viewProfile" fallback="프로필 보기" />
        </Link>
      </div>
    </main>
  );
}

function MoksilgiCard({ item }: { item: CoachMoksilgiItem }) {
  return (
    <Card className="print-card">
      <CardContent className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink-faint">
            <I18nText k="coach.moksilgi.coachee" fallback="코치이" />
          </p>
          <p className="mt-1 break-words text-lg font-semibold text-ink-strong">
            {coacheeName(item)}
          </p>
          <p className="mt-1 break-all text-sm text-ink-muted">
            {item.coachee_email ?? "-"}
          </p>
        </div>
        <div className="min-w-[180px] text-left sm:text-right">
          <p className="text-sm font-medium text-ink-faint">
            {item.summary_year}
            <I18nText k="coach.moksilgi.totalAchievementSuffix" fallback="년 총 달성률" />
          </p>
          <p className="mt-1 text-3xl font-semibold text-ink-strong">
            {formatPercent(item.total_achievement_rate)}
          </p>
          <ProgressBar
            className="mt-2 sm:ml-auto sm:w-44"
            showValue={false}
            value={item.total_achievement_rate}
          />
        </div>
      </div>

      <section className="mt-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="break-words text-lg font-semibold text-ink-strong">
              {item.title}
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              {formatDate(item.period_start)} ~ {formatDate(item.period_end)}
            </p>
          </div>
          <Badge tone={statusTone(item.status)}>
            {STATUS_LABEL[item.status] ?? item.status}
          </Badge>
        </div>
      </section>

      <dl className="mt-5 grid gap-4 lg:grid-cols-3">
        <div>
          <dt className="text-sm font-medium text-ink-faint">
            <I18nText k="coach.moksilgi.missionSummary" fallback="사명선언서 요약" />
          </dt>
          <dd className="mt-1 whitespace-pre-wrap text-ink-base">
            {summaryText(item.mission_statement)}
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-ink-faint">
            <I18nText k="coach.moksilgi.visionSummary" fallback="비전 요약" />
          </dt>
          <dd className="mt-1 whitespace-pre-wrap text-ink-base">
            {summaryText(item.vision_statement)}
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-ink-faint">
            <I18nText k="coach.moksilgi.mainGoal" fallback="전체 목표" />
          </dt>
          <dd className="mt-1 whitespace-pre-wrap text-ink-base">
            {summaryText(item.main_goal)}
          </dd>
        </div>
      </dl>

      <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-sm font-medium text-ink-faint">
            <I18nText k="coach.moksilgi.spiritualGrowth" fallback="영적 성장" />
          </dt>
          <dd className="mt-1 text-ink-strong">{formatPercent(item.spiritual_rate)}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-ink-faint">
            <I18nText k="coach.moksilgi.intellectualGrowth" fallback="지적 성장" />
          </dt>
          <dd className="mt-1 text-ink-strong">{formatPercent(item.intellectual_rate)}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-ink-faint">
            <I18nText k="coach.moksilgi.physicalGrowth" fallback="육체적 성장" />
          </dt>
          <dd className="mt-1 text-ink-strong">{formatPercent(item.physical_rate)}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-ink-faint">
            <I18nText k="coach.moksilgi.socialGrowth" fallback="사회적 성장" />
          </dt>
          <dd className="mt-1 text-ink-strong">{formatPercent(item.social_rate)}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-ink-faint">
            <I18nText k="coach.moksilgi.otherGrowth" fallback="기타" />
          </dt>
          <dd className="mt-1 text-ink-strong">{formatPercent(item.other_rate)}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-ink-faint">
            <I18nText k="coach.moksilgi.total" fallback="종합" />
          </dt>
          <dd className="mt-1 text-ink-strong">{formatPercent(item.total_rate)}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-ink-faint">
            <I18nText k="coach.moksilgi.average" fallback="평균" />
          </dt>
          <dd className="mt-1 text-ink-strong">{formatPercent(item.average_rate)}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-ink-faint">
            <I18nText k="coach.moksilgi.updatedAt" fallback="최근 수정일" />
          </dt>
          <dd className="mt-1 text-ink-strong">{formatDate(item.updated_at)}</dd>
        </div>
      </dl>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-sm font-medium text-ink-faint">
            <I18nText k="coach.moksilgi.author" fallback="작성자" />
          </p>
          <p className="mt-1 text-ink-strong">{displayValue(item.author_name)}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-ink-faint">
            <I18nText k="coach.moksilgi.community" fallback="소속/공동체" />
          </p>
          <p className="mt-1 text-ink-strong">{displayValue(item.region_name)}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-ink-faint">
            <I18nText k="coach.moksilgi.coach" fallback="코치" />
          </p>
          <p className="mt-1 text-ink-strong">{displayValue(item.coach_name)}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-ink-faint">
            <I18nText k="coach.moksilgi.summaryMonths" fallback="요약 월 수" />
          </p>
          <p className="mt-1 text-ink-strong">
            {item.summary_count}
            <I18nText k="coach.moksilgi.monthsSuffix" fallback="개월" />
          </p>
        </div>
      </div>

      <div className="mt-5">
        <ButtonLink
          icon="report"
          size="sm"
          href={`/coach/moksilgi/${item.id}?year=${item.summary_year}`}
        >
          <I18nText k="coach.moksilgi.details" fallback="상세 보기" />
        </ButtonLink>
      </div>
      </CardContent>
    </Card>
  );
}

export default async function CoachMoksilgiPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = searchParams ? await searchParams : {};
  const year = parseYear(params);
  const result = await getCoachMoksilgi(year);

  if (result.error?.code === "UNAUTHORIZED") {
    redirect("/login?redirectTo=/coach/moksilgi");
  }

  if (result.error?.code === "PROFILE_NOT_FOUND") {
    return <ProfileMissing />;
  }

  if (result.error?.code === "ACCESS_DENIED") {
    return (
      <main className="min-h-screen bg-surface-app px-6 py-10 text-ink-strong">
        <div className="mx-auto max-w-5xl">
          <Nav />
          <p className="mt-8 rounded-control border border-red-200 bg-red-50 px-4 py-3 text-red-700">
            <I18nText k="coach.moksilgi.accessDenied" fallback="코치 권한이 없습니다." />
          </p>
        </div>
      </main>
    );
  }

  if (result.error) {
    return (
      <main className="min-h-screen bg-surface-app px-6 py-10 text-ink-strong">
        <div className="mx-auto max-w-5xl">
          <Nav />
          <p className="mt-8 rounded-control border border-red-200 bg-red-50 px-4 py-3 text-red-700">
            <I18nText k="coach.moksilgi.loadFailed" fallback="지금 코치이 목실기를 불러올 수 없습니다." />
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="print-root min-h-screen bg-[var(--trust-bg)] px-4 py-8 text-ink-strong sm:px-6 lg:py-10">
      <div className="mx-auto max-w-5xl">
        <Nav />

        <div className="print-report-title print-only">
          <h1>
            <I18nText k="coach.moksilgi.reportTitle" fallback="코치이 목실기 목록 보고서" />
          </h1>
          <p>
            <I18nText k="coach.moksilgi.printYear" fallback="출력 연도" />: {year}
          </p>
          <p>
            <I18nText k="coach.moksilgi.generatedAt" fallback="생성일" />: {formatDateInTimezone(new Date(), DEFAULT_TIMEZONE)}
          </p>
          <p>
            <I18nText k="coach.moksilgi.timezone" fallback="기준 시간대" />: {DEFAULT_TIMEZONE}
          </p>
        </div>
        <Card className="print-section mt-6">
          <CardHeader className="flex flex-col gap-4 border-b-0 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <Badge icon="report" tone="info">
                <I18nText k="coach.moksilgi.badge" fallback="코치용 목실기" />
              </Badge>
              <CardTitle className="mt-3 text-2xl">
                <I18nText k="coach.moksilgi.title" fallback="담당 코치이 목실기" />
              </CardTitle>
              <CardDescription className="text-base">
                <I18nText k="coach.moksilgi.subtitle" fallback="코치용 목실기 읽기 화면" />
              </CardDescription>
              <p className="mt-2 max-w-3xl break-words text-sm leading-6 text-ink-muted">
                <I18nText
                  k="coach.moksilgi.description"
                  fallback="담당 코치이들이 작성한 목표와 실행전략 기획안과 성취 요약을 확인합니다."
                />
              </p>
              <YearSelector year={year} />
            </div>
            <PrintPageButton
              fileName={`moksilgi-coach-list-${year}`}
              label="코치이 목실기 목록 인쇄/PDF 저장"
            />
            <p className="print-hidden text-sm leading-6 text-ink-faint sm:max-w-xs sm:text-right">
              <I18nText
                k="coach.moksilgi.mobilePrintNotice"
                fallback="모바일 브라우저에서는 PDF 저장 옵션이 기기와 브라우저에 따라 다르게 표시될 수 있습니다. 인쇄창이 열리지 않으면 Safari 또는 Chrome에서 다시 열어 주세요."
              />
            </p>
          </CardHeader>
        </Card>

        {result.data.length === 0 ? (
          <Card className="print-section mt-6">
            <CardContent>
              <p className="text-center text-ink-faint">
                <I18nText k="coach.moksilgi.empty" fallback="아직 확인할 코치이 목실기가 없습니다." />
              </p>
              <div className="mt-4 flex justify-center print:hidden">
                <ButtonLink href="/coach" icon="arrow-left" variant="secondary">
                  <I18nText k="coach.moksilgi.backToCoachHome" fallback="코치 홈으로 돌아가기" />
                </ButtonLink>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="mt-6 grid gap-5">
            {result.data.map((item) => (
              <MoksilgiCard item={item} key={item.id} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
