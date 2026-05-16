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
  getCoachMoksilgi,
  type CoachMoksilgiItem,
} from "@/lib/api/coach/moksilgi";

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
    </form>
  );
}

function Nav() {
  return (
    <nav className="print-hidden flex flex-wrap gap-2 text-sm">
      <ButtonLink href="/coach" icon="arrow-left" size="sm" variant="secondary">
        코치 홈으로 돌아가기
      </ButtonLink>
      <ButtonLink href="/dashboard" icon="dashboard" size="sm" variant="ghost">
        대시보드
      </ButtonLink>
    </nav>
  );
}

function ProfileMissing() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
      <div className="mx-auto max-w-5xl">
        <p className="rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3 text-yellow-800">
          아직 프로필이 생성되지 않았습니다.
        </p>
        <Link
          href="/profile"
          className="mt-4 inline-block text-sm font-medium text-blue-600 hover:underline"
        >
          프로필 보기
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
          <p className="text-sm font-medium text-slate-500">코치이</p>
          <p className="mt-1 break-words text-lg font-semibold text-slate-950">
            {coacheeName(item)}
          </p>
          <p className="mt-1 break-all text-sm text-slate-600">
            {item.coachee_email ?? "-"}
          </p>
        </div>
        <div className="min-w-[180px] text-left sm:text-right">
          <p className="text-sm font-medium text-slate-500">
            {item.summary_year}년 총 달성률
          </p>
          <p className="mt-1 text-3xl font-semibold text-slate-950">
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
            <h2 className="break-words text-lg font-semibold text-slate-950">
              {item.title}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
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
          <dt className="text-sm font-medium text-slate-500">사명선언서 요약</dt>
          <dd className="mt-1 whitespace-pre-wrap text-slate-700">
            {summaryText(item.mission_statement)}
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-slate-500">비전 요약</dt>
          <dd className="mt-1 whitespace-pre-wrap text-slate-700">
            {summaryText(item.vision_statement)}
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-slate-500">전체 목표</dt>
          <dd className="mt-1 whitespace-pre-wrap text-slate-700">
            {summaryText(item.main_goal)}
          </dd>
        </div>
      </dl>

      <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-sm font-medium text-slate-500">영적 성장</dt>
          <dd className="mt-1 text-slate-950">{formatPercent(item.spiritual_rate)}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-slate-500">지적 성장</dt>
          <dd className="mt-1 text-slate-950">{formatPercent(item.intellectual_rate)}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-slate-500">육체적 성장</dt>
          <dd className="mt-1 text-slate-950">{formatPercent(item.physical_rate)}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-slate-500">사회적 성장</dt>
          <dd className="mt-1 text-slate-950">{formatPercent(item.social_rate)}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-slate-500">기타</dt>
          <dd className="mt-1 text-slate-950">{formatPercent(item.other_rate)}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-slate-500">종합</dt>
          <dd className="mt-1 text-slate-950">{formatPercent(item.total_rate)}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-slate-500">평균</dt>
          <dd className="mt-1 text-slate-950">{formatPercent(item.average_rate)}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-slate-500">최근 수정일</dt>
          <dd className="mt-1 text-slate-950">{formatDate(item.updated_at)}</dd>
        </div>
      </dl>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-sm font-medium text-slate-500">작성자</p>
          <p className="mt-1 text-slate-950">{displayValue(item.author_name)}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500">소속/공동체</p>
          <p className="mt-1 text-slate-950">{displayValue(item.region_name)}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500">코치</p>
          <p className="mt-1 text-slate-950">{displayValue(item.coach_name)}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500">요약 월 수</p>
          <p className="mt-1 text-slate-950">{item.summary_count}개월</p>
        </div>
      </div>

      <div className="mt-5">
        <ButtonLink
          icon="report"
          size="sm"
          href={`/coach/moksilgi/${item.id}?year=${item.summary_year}`}
        >
          상세 보기
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
      <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
        <div className="mx-auto max-w-5xl">
          <Nav />
          <p className="mt-8 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-red-700">
            코치 권한이 없습니다.
          </p>
        </div>
      </main>
    );
  }

  if (result.error) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
        <div className="mx-auto max-w-5xl">
          <Nav />
          <p className="mt-8 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-red-700">
            지금 코치이 목실기를 불러올 수 없습니다.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="print-root min-h-screen bg-[var(--trust-bg)] px-4 py-8 text-slate-950 sm:px-6 lg:py-10">
      <div className="mx-auto max-w-5xl">
        <Nav />

        <div className="print-report-title print-only">
          <h1>코치이 목실기 목록 보고서</h1>
          <p>출력 연도: {year}년</p>
          <p>생성일: {new Date().toLocaleDateString("ko-KR")}</p>
        </div>
        <Card className="print-section mt-6">
          <CardHeader className="flex flex-col gap-4 border-b-0 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <Badge icon="report" tone="info">코치용 목실기</Badge>
              <CardTitle className="mt-3 text-2xl">담당 코치이 목실기</CardTitle>
              <CardDescription className="text-base">
                코치용 목실기 읽기 화면
              </CardDescription>
              <p className="mt-2 max-w-3xl break-words text-sm leading-6 text-slate-600">
              담당 코치이들이 작성한 목표와 실행전략 기획안과 성취 요약을 확인합니다.
              </p>
              <YearSelector year={year} />
            </div>
            <PrintPageButton
              fileName={`moksilgi-coach-list-${year}`}
              label="코치이 목실기 목록 출력"
            />
          </CardHeader>
        </Card>

        {result.data.length === 0 ? (
          <Card className="print-section mt-6">
            <CardContent>
              <p className="text-center text-slate-500">
                아직 확인할 코치이 목실기가 없습니다.
              </p>
              <div className="mt-4 flex justify-center print:hidden">
                <ButtonLink href="/coach" icon="arrow-left" variant="secondary">
                  코치 홈으로 돌아가기
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
