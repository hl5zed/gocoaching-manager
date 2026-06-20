import Link from "next/link";
import { redirect } from "next/navigation";
import { PrintPageButton } from "@/components/print/PrintPageButton";
import {
  getMyMoksilgiSummary,
  type MoksilgiPersonalSummaryRow,
} from "@/lib/api/my-coaching/moksilgi-summary";

export const dynamic = "force-dynamic";

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

function YearSelector({ year }: { year: number }) {
  return (
    <form className="print-hidden mt-5 flex flex-wrap items-end gap-3" method="get">
      <label className="block">
        <span className="text-sm font-medium text-ink-base">연도</span>
        <input
          className="mt-2 w-36 rounded-control border border-line-base bg-surface-card px-3 py-2"
          defaultValue={year}
          max={2100}
          min={2000}
          name="year"
          type="number"
        />
      </label>
      <button
        className="rounded-control bg-navy-900 px-4 py-2 text-sm font-medium text-white hover:bg-navy-800"
        type="submit"
      >
        조회
      </button>
    </form>
  );
}

function SummaryRow({
  isCurrentMonth,
  row,
}: {
  isCurrentMonth: boolean;
  row: MoksilgiPersonalSummaryRow;
}) {
  const isCumulative = row.month === "cumulative";
  const rowClass = isCumulative
    ? "bg-navy-900 font-semibold text-white"
    : isCurrentMonth
      ? "border-b border-line-base bg-surface-sunken font-medium"
      : "border-b border-line-soft";

  return (
    <tr className={rowClass}>
      <th className="whitespace-nowrap px-3 py-2 text-left font-medium">
        {row.monthLabel}
        {isCurrentMonth ? (
          <span className="ml-2 rounded-full bg-navy-900 px-2 py-0.5 text-xs font-medium text-white">
            현재 월
          </span>
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
}

function AchievementTable({
  cumulativeRow,
  rows,
  year,
}: {
  cumulativeRow: MoksilgiPersonalSummaryRow;
  rows: MoksilgiPersonalSummaryRow[];
  year: number;
}) {
  const today = new Date();
  const currentMonth =
    today.getFullYear() === year ? today.getMonth() + 1 : null;

  return (
    <section className="mt-6 rounded-card border border-line-base bg-surface-card p-6">
      <h2 className="text-lg font-semibold">
        개인 목표와 실행전략 성취표(연간 대비, 월별누적) (단위%)
      </h2>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-[860px] w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line-base bg-surface-sunken text-left text-ink-muted">
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
            {rows.map((row) => (
              <SummaryRow
                isCurrentMonth={row.month === currentMonth}
                key={row.month}
                row={row}
              />
            ))}
            <SummaryRow
              isCurrentMonth={false}
              row={cumulativeRow}
            />
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ProfileMissing() {
  return (
    <section className="mt-8 rounded-card border border-line-base bg-surface-card p-6">
      <p className="text-ink-base">아직 프로필이 생성되지 않았습니다.</p>
      <Link className="mt-4 inline-block text-sm font-medium text-brand-600 underline" href="/profile">
        프로필 보기
      </Link>
    </section>
  );
}

function MonthOverMonthCard({
  rows,
  year,
}: {
  rows: MoksilgiPersonalSummaryRow[];
  year: number;
}) {
  const today = new Date();
  if (today.getFullYear() !== year) return null;

  const currentMonth = today.getMonth() + 1;
  if (currentMonth <= 1) return null;

  const current = rows.find((row) => row.month === currentMonth);
  const previous = rows.find((row) => row.month === currentMonth - 1);
  if (!current || !previous) return null;

  const delta = Math.round((current.total_rate - previous.total_rate) * 10) / 10;
  const tone =
    delta > 0 ? "text-emerald-700" : delta < 0 ? "text-red-700" : "text-ink-muted";
  const arrow = delta > 0 ? "▲" : delta < 0 ? "▼" : "–";
  const sign = delta > 0 ? "+" : "";

  return (
    <section className="mt-6 rounded-card border border-line-base bg-surface-card p-6">
      <p className="text-sm font-medium text-ink-faint">
        이번 달 종합 실행률 (전월 대비)
      </p>
      <div className="mt-2 flex items-baseline gap-3">
        <p className="text-3xl font-semibold text-ink-strong">
          {formatPercent(current.total_rate)}
        </p>
        <p className={`text-lg font-semibold ${tone}`}>
          {arrow} {sign}
          {delta.toFixed(1)}%p
        </p>
      </div>
      <p className="mt-1 text-sm text-ink-muted">
        지난달 {formatPercent(previous.total_rate)} → 이번 달{" "}
        {formatPercent(current.total_rate)}
      </p>
    </section>
  );
}

export default async function MoksilgiSummaryPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = searchParams ? await searchParams : {};
  const year = parseYear(params);
  const result = await getMyMoksilgiSummary(year);

  if (!result.ok && result.error.code === "UNAUTHORIZED") {
    redirect("/login?redirectTo=%2Fmy-coaching%2Fmoksilgi%2Fsummary");
  }

  return (
    <main className="print-root min-h-screen bg-surface-app px-6 py-10 text-ink-strong">
      <section className="mx-auto w-full max-w-6xl">
        <div className="print-report-title print-only">
          <h1>내 목실기 연간 성취 보고서</h1>
          <p>출력 연도: {year}년</p>
          <p>생성일: {new Date().toLocaleDateString("ko-KR")}</p>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-ink-faint">
              목실기 개인 성취표
            </p>
            <h1 className="mt-3 text-3xl font-semibold">
              개인 목표와 실행전략 성취표
            </h1>
            <p className="mt-2 text-lg text-ink-base">목실기 연간 성취 요약</p>
            <p className="mt-3 max-w-3xl text-ink-muted">
              월별 체크리스트에 기록한 내용을 바탕으로 1월부터 12월까지의 성취율을 확인합니다.
            </p>
            <p className="mt-2 max-w-3xl rounded-control border border-line-base bg-surface-sunken px-3 py-2 text-sm text-ink-muted">
              이 화면은 결과를 보는 <span className="font-semibold text-ink-base">리포트</span>예요. 매일 실행 체크는 <span className="font-semibold text-ink-base">체크(월별 체크리스트)</span>에서 하세요.
            </p>
            <YearSelector year={year} />
          </div>
          <div className="flex flex-col items-start gap-2 text-sm">
            <PrintPageButton
              fileName={`moksilgi-my-summary-${year}`}
              label="목실기 성취표 출력"
            />
            <Link className="font-medium text-brand-600 underline" href="/my-coaching/moksilgi">
              목실기 작성으로 돌아가기
            </Link>
          </div>
        </div>

        {!result.ok && result.error.code === "PROFILE_NOT_FOUND" ? (
          <ProfileMissing />
        ) : !result.ok ? (
          <section className="mt-8 rounded-control border border-red-200 bg-red-50 p-4 text-red-800">
            지금 개인 성취표를 불러올 수 없습니다.
          </section>
        ) : !result.data.plan ? (
          <section className="mt-8 rounded-card border border-line-base bg-surface-card p-6">
            <p className="text-ink-base">먼저 목실기 기본 작성 폼을 저장해 주세요.</p>
            <Link className="mt-4 inline-block text-sm font-medium text-brand-600 underline" href="/my-coaching/moksilgi">
              목실기 작성
            </Link>
          </section>
        ) : (
          <div className="mt-8">
            {!result.data.hasSummaryData ? (
              <div className="mb-5 rounded-control border border-amber-200 bg-amber-50 p-4 text-amber-900">
                아직 월별 체크리스트 기록이 없습니다.
              </div>
            ) : null}

            <section className="rounded-card border border-line-base bg-surface-card p-6">
              <p className="text-sm font-medium text-ink-faint">{year}년 총 달성률</p>
              <p className="mt-2 text-4xl font-semibold text-ink-strong">
                {formatPercent(result.data.totalAchievementRate)}
              </p>
            </section>

            <MonthOverMonthCard rows={result.data.rows} year={year} />

            <AchievementTable
              cumulativeRow={result.data.cumulativeRow}
              rows={result.data.rows}
              year={year}
            />

            <section className="mt-6 rounded-card border border-line-base bg-surface-card p-6">
              <p className="text-ink-base">
                {year}년 총 달성률 {formatPercent(result.data.totalAchievementRate)}
              </p>
            </section>
          </div>
        )}
      </section>
    </main>
  );
}
