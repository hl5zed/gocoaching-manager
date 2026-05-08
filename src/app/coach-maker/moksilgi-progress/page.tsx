import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getCoachMakerMoksilgiProgress,
  type CoachMakerMoksilgiProgressAverageRow,
  type CoachMakerMoksilgiProgressFilters,
  type CoachMakerMoksilgiProgressRow,
} from "@/lib/api/coach-maker/moksilgi-progress";

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

function displayValue(value: string | null) {
  return value && value.trim().length > 0 ? value : "-";
}

function personName(row: CoachMakerMoksilgiProgressRow) {
  return row.display_name ?? row.full_name ?? row.email ?? row.author_name ?? "알 수 없음";
}

function monthRate(
  row: CoachMakerMoksilgiProgressRow | CoachMakerMoksilgiProgressAverageRow,
  month: number,
) {
  switch (month) {
    case 1:
      return row.month_1_rate;
    case 2:
      return row.month_2_rate;
    case 3:
      return row.month_3_rate;
    case 4:
      return row.month_4_rate;
    case 5:
      return row.month_5_rate;
    case 6:
      return row.month_6_rate;
    case 7:
      return row.month_7_rate;
    case 8:
      return row.month_8_rate;
    case 9:
      return row.month_9_rate;
    case 10:
      return row.month_10_rate;
    case 11:
      return row.month_11_rate;
    case 12:
      return row.month_12_rate;
    default:
      return 0;
  }
}

function FilterForm({ filters }: { filters: CoachMakerMoksilgiProgressFilters }) {
  return (
    <form className="mt-6 grid gap-4 rounded-md border border-slate-200 bg-white p-5 md:grid-cols-3 lg:grid-cols-6" method="get">
      <label className="block">
        <span className="text-sm font-medium text-slate-700">연도</span>
        <input
          className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
          defaultValue={filters.year}
          max={2100}
          min={2000}
          name="year"
          type="number"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-slate-700">지역</span>
        <input
          className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
          defaultValue={filters.regionName ?? ""}
          name="region"
          type="search"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-slate-700">팀/목장</span>
        <input
          className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
          defaultValue={filters.teamName ?? ""}
          name="team"
          type="search"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-slate-700">직책</span>
        <input
          className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
          defaultValue={filters.roleLabel ?? ""}
          name="role"
          type="search"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-slate-700">세대</span>
        <input
          className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
          defaultValue={filters.generationLabel ?? ""}
          name="generation"
          type="search"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-slate-700">검색어</span>
        <input
          className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
          defaultValue={filters.search ?? ""}
          name="search"
          type="search"
        />
      </label>
      <div className="flex items-end gap-3 md:col-span-3 lg:col-span-6">
        <button
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          type="submit"
        >
          조회
        </button>
        <Link
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          href={`/coach-maker/moksilgi-progress?year=${filters.year}`}
        >
          필터 초기화
        </Link>
      </div>
    </form>
  );
}

function ProfileMissing() {
  return (
    <section className="mt-8 rounded-md border border-slate-200 bg-white p-6">
      <p className="text-slate-700">아직 프로필이 생성되지 않았습니다.</p>
      <Link className="mt-4 inline-block text-sm font-medium text-slate-700 underline" href="/profile">
        프로필 보기
      </Link>
    </section>
  );
}

function ProgressTable({
  averageRow,
  rows,
  year,
}: {
  averageRow: CoachMakerMoksilgiProgressAverageRow;
  rows: CoachMakerMoksilgiProgressRow[];
  year: number;
}) {
  return (
    <section className="mt-6 rounded-md border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-semibold">전체 목실기 성취 현황</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-[1280px] w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-100 text-slate-600">
              <th className="px-3 py-2 font-semibold">순번</th>
              <th className="px-3 py-2 font-semibold">이름</th>
              <th className="px-3 py-2 font-semibold">직책</th>
              <th className="px-3 py-2 font-semibold">세대별</th>
              {MONTHS.map((month) => (
                <th className="px-3 py-2 font-semibold" key={month}>
                  {month}월
                </th>
              ))}
              <th className="px-3 py-2 font-semibold">누적</th>
              <th className="px-3 py-2 font-semibold">상세</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr className="border-b border-slate-100 text-slate-800" key={row.plan_id}>
                <td className="px-3 py-3">{row.index}</td>
                <td className="px-3 py-3">
                  <p className="font-medium text-slate-950">{personName(row)}</p>
                  <p className="mt-1 text-xs text-slate-500">{displayValue(row.email)}</p>
                </td>
                <td className="px-3 py-3">{displayValue(row.role_label)}</td>
                <td className="px-3 py-3">{displayValue(row.generation_label)}</td>
                {MONTHS.map((month) => (
                  <td className="px-3 py-3" key={month}>
                    {formatPercent(monthRate(row, month))}
                  </td>
                ))}
                <td className="px-3 py-3 font-semibold">
                  {formatPercent(row.cumulative_rate)}
                </td>
                <td className="px-3 py-3">
                  <Link
                    className="text-sm font-medium text-slate-700 underline"
                    href={`/coach/moksilgi/${row.plan_id}?year=${year}`}
                  >
                    상세
                  </Link>
                </td>
              </tr>
            ))}
            <tr className="bg-slate-950 font-semibold text-white">
              <th className="px-3 py-3" colSpan={4}>
                평균 성취
              </th>
              {MONTHS.map((month) => (
                <td className="px-3 py-3" key={month}>
                  {formatPercent(monthRate(averageRow, month))}
                </td>
              ))}
              <td className="px-3 py-3">{formatPercent(averageRow.cumulative_rate)}</td>
              <td className="px-3 py-3">-</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default async function CoachMakerMoksilgiProgressPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = searchParams ? await searchParams : {};
  const filters = parseFilters(params);
  const result = await getCoachMakerMoksilgiProgress(filters);

  if (result.error?.code === "UNAUTHORIZED") {
    redirect("/login?redirectTo=/coach-maker/moksilgi-progress");
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
      <section className="mx-auto w-full max-w-7xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
              코치메이커 전체 목실기 성취 현황
            </p>
            <h1 className="mt-3 text-3xl font-semibold">전체 목실기 성취 현황</h1>
            <p className="mt-2 text-lg text-slate-700">
              코치메이커용 목실기 진행 현황
            </p>
            <p className="mt-3 max-w-3xl text-slate-600">
              지역/팀의 코치와 코치이 목실기 월별 성취율을 한눈에 확인합니다.
            </p>
          </div>
          <Link className="text-sm font-medium text-slate-700 underline" href="/dashboard">
            대시보드
          </Link>
        </div>

        <FilterForm filters={filters} />

        {result.error?.code === "PROFILE_NOT_FOUND" ? (
          <ProfileMissing />
        ) : result.error?.code === "ACCESS_DENIED" ? (
          <section className="mt-8 rounded-md border border-red-200 bg-red-50 p-4 text-red-800">
            코치메이커 권한이 없습니다.
          </section>
        ) : result.error ? (
          <section className="mt-8 rounded-md border border-red-200 bg-red-50 p-4 text-red-800">
            지금 전체 목실기 성취 현황을 불러올 수 없습니다.
          </section>
        ) : (
          <>
            <section className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-md border border-slate-200 bg-white p-5">
                <p className="text-sm font-medium text-slate-500">전체 성취(UP TO CURRENT)</p>
                <p className="mt-2 text-3xl font-semibold">
                  {formatPercent(result.data.upToCurrentRate)}
                </p>
              </div>
              <div className="rounded-md border border-slate-200 bg-white p-5">
                <p className="text-sm font-medium text-slate-500">조회 연도</p>
                <p className="mt-2 text-3xl font-semibold">{result.data.year}</p>
              </div>
              <div className="rounded-md border border-slate-200 bg-white p-5">
                <p className="text-sm font-medium text-slate-500">조회 범위</p>
                <p className="mt-2 text-sm text-slate-700">
                  {result.data.scopeMode === "all"
                    ? "전체 비삭제 목실기"
                    : "직접 코칭 관계 기준"}
                </p>
              </div>
            </section>

            {result.data.rows.length === 0 ? (
              <p className="mt-8 rounded-md border border-slate-200 bg-white px-4 py-6 text-center text-slate-500">
                아직 확인할 목실기 성취 현황이 없습니다.
              </p>
            ) : (
              <ProgressTable
                averageRow={result.data.averageRow}
                rows={result.data.rows}
                year={result.data.year}
              />
            )}
          </>
        )}
      </section>
    </main>
  );
}
