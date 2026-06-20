import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/getSession";
import {
  getCoachRelationships,
  type CoachRelationshipListItem,
} from "@/lib/api/coach/relationships";
import type {
  CoachingRelationshipStatus,
  RelationshipType,
} from "@/types/database";
import {
  formatScope,
  getRelationshipTypeLabel,
  getStatusLabel,
} from "@/lib/ui/labels";

export const dynamic = "force-dynamic";

const STATUS_OPTIONS: Array<{
  value: "all" | CoachingRelationshipStatus;
  label: string;
}> = [
  { value: "all", label: "전체 상태" },
  { value: "active", label: "활성" },
  { value: "paused", label: "일시 중지" },
  { value: "ended", label: "종료" },
  { value: "archived", label: "보관됨" },
];

const TYPE_OPTIONS: Array<{
  value: "all" | RelationshipType;
  label: string;
}> = [
  { value: "all", label: "전체 관계 유형" },
  { value: "individual_coaching", label: "개인 코칭" },
  { value: "group_coaching", label: "그룹 코칭" },
  { value: "leadership_coaching", label: "리더십 코칭" },
  { value: "pastoral_coaching", label: "목회 코칭" },
  { value: "missionary_coaching", label: "선교 코칭" },
];

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function shortenId(value: string) {
  if (value.length <= 12) {
    return value;
  }

  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

function getCoacheeLabel(relationship: CoachRelationshipListItem) {
  return (
    relationship.coachee?.display_name ||
    relationship.coachee?.full_name ||
    relationship.coachee?.email ||
    shortenId(relationship.coacheeId)
  );
}

function relationshipStatusBadgeClass(status: CoachingRelationshipStatus) {
  switch (status) {
    case "active":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "paused":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "ended":
      return "border-line-base bg-surface-sunken text-ink-base";
    case "archived":
      return "border-line-base bg-surface-sunken text-ink-muted";
    default:
      return "border-line-base bg-surface-sunken text-ink-base";
  }
}

function relationshipTypeBadgeClass(type: RelationshipType) {
  switch (type) {
    case "individual_coaching":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "group_coaching":
      return "border-violet-200 bg-violet-50 text-violet-700";
    case "leadership_coaching":
      return "border-indigo-200 bg-indigo-50 text-indigo-700";
    case "pastoral_coaching":
      return "border-teal-200 bg-teal-50 text-teal-700";
    case "missionary_coaching":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "border-line-base bg-surface-sunken text-ink-base";
  }
}

function createPageHref(
  page: number,
  filters: { q: string; status: string; type: string },
) {
  const params = new URLSearchParams();

  if (filters.q) {
    params.set("q", filters.q);
  }

  if (filters.status !== "all") {
    params.set("status", filters.status);
  }

  if (filters.type !== "all") {
    params.set("type", filters.type);
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  const query = params.toString();

  return query.length > 0
    ? `/coach/relationships?${query}`
    : "/coach/relationships";
}

function createDetailHref(
  relationshipId: string,
  filters: { q: string; status: string; type: string; page: number },
) {
  const from = createPageHref(filters.page, filters);
  const params = new URLSearchParams({ from });

  return `/coach/relationships/${relationshipId}?${params.toString()}`;
}

export default async function CoachRelationshipsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string | string[];
    status?: string | string[];
    type?: string | string[];
    page?: string | string[];
  }>;
}) {
  const session = await getSession();

  if (!session.user) {
    redirect("/login?redirectTo=%2Fcoach%2Frelationships");
  }

  const resolvedSearchParams = await searchParams;
  const result = await getCoachRelationships(resolvedSearchParams);

  if (!result.ok && result.error.code === "UNAUTHORIZED") {
    redirect("/login?redirectTo=%2Fcoach%2Frelationships");
  }

  if (!result.ok && result.error.code === "FORBIDDEN") {
    notFound();
  }

  if (!result.ok) {
    return (
      <main className="min-h-screen bg-surface-app px-6 py-10 text-ink-strong">
        <section className="mx-auto w-full max-w-6xl">
          <p className="text-sm font-medium uppercase tracking-wide text-ink-faint">
            코치
          </p>
          <h1 className="mt-3 text-3xl font-semibold">코칭 관계</h1>
          <div className="mt-8 rounded-control border border-red-200 bg-red-50 p-4 text-red-800">
            지금 코칭 관계를 불러올 수 없습니다.
          </div>
        </section>
      </main>
    );
  }

  const { filters, pagination, profile, relationships } = result.data;

  return (
    <main className="min-h-screen bg-surface-app px-6 py-10 text-ink-strong">
      <section className="mx-auto w-full max-w-6xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-ink-faint">
              코치
            </p>
            <h1 className="mt-3 text-3xl font-semibold">코칭 관계</h1>
            <p className="mt-3 max-w-3xl text-ink-muted">
              내 코치 프로필에 연결된 코칭 관계를 읽기 전용으로 확인할 수
              있습니다.
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 text-sm">
            <Link className="font-medium text-brand-600 underline" href="/coach">
              코치 홈으로 돌아가기
            </Link>
            <Link
              className="font-medium text-brand-600 underline"
              href="/dashboard"
            >
              대시보드로 돌아가기
            </Link>
          </div>
        </div>

        {profile === null ? (
          <section className="mt-8 rounded-card border border-line-base bg-surface-card p-6">
            <p className="text-ink-base">아직 프로필이 생성되지 않았습니다.</p>
            <p className="mt-2 text-ink-muted">
              초대를 받으셨다면 먼저 초대를 수락해 주세요.
            </p>
            <div className="mt-4">
              <Link
                className="text-sm font-medium text-brand-600 underline"
                href="/profile"
              >
                프로필 보기
              </Link>
            </div>
          </section>
        ) : (
          <>
            <section className="mt-8 rounded-card border border-line-base bg-surface-card p-6">
              <form className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px_260px]">
                <div>
                  <label
                    className="block text-sm font-medium text-ink-base"
                    htmlFor="q"
                  >
                    코치이 검색
                  </label>
                  <input
                    className="mt-2 w-full rounded-md border border-line-base bg-surface-card px-3 py-2 text-sm text-ink-strong shadow-sm outline-none ring-0 placeholder:text-ink-faint focus:border-brand-600"
                    defaultValue={filters.q}
                    id="q"
                    name="q"
                    placeholder="이름 또는 이메일"
                    type="search"
                  />
                </div>
                <div>
                  <label
                    className="block text-sm font-medium text-ink-base"
                    htmlFor="status"
                  >
                    상태
                  </label>
                  <select
                    className="mt-2 w-full rounded-md border border-line-base bg-surface-card px-3 py-2 text-sm text-ink-strong shadow-sm outline-none ring-0 focus:border-brand-600"
                    defaultValue={filters.status}
                    id="status"
                    name="status"
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    className="block text-sm font-medium text-ink-base"
                    htmlFor="type"
                  >
                    관계 유형
                  </label>
                  <select
                    className="mt-2 w-full rounded-md border border-line-base bg-surface-card px-3 py-2 text-sm text-ink-strong shadow-sm outline-none ring-0 focus:border-brand-600"
                    defaultValue={filters.type}
                    id="type"
                    name="type"
                  >
                    {TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-3">
                  <button
                    className="inline-flex rounded-control bg-navy-900 px-4 py-2.5 text-sm font-medium text-white"
                    type="submit"
                  >
                    필터 적용
                  </button>
                </div>
              </form>
            </section>

            <section className="mt-6 rounded-card border border-line-base bg-surface-card p-6">
              {relationships.length === 0 ? (
                <p className="text-ink-base">코칭 관계가 없습니다.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[920px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-line-base text-ink-faint">
                        <th className="px-3 py-2 font-medium">코치이</th>
                        <th className="px-3 py-2 font-medium">관계 유형</th>
                        <th className="px-3 py-2 font-medium">상태</th>
                        <th className="px-3 py-2 font-medium">범위</th>
                        <th className="px-3 py-2 font-medium">시작일</th>
                        <th className="px-3 py-2 font-medium">종료일</th>
                        <th className="px-3 py-2 font-medium">생성일</th>
                        <th className="px-3 py-2 font-medium">작업</th>
                      </tr>
                    </thead>
                    <tbody>
                      {relationships.map((relationship) => (
                        <tr
                          className="border-b border-line-soft text-ink-base"
                          key={relationship.id}
                        >
                          <td className="px-3 py-3">
                            <Link
                              className="font-medium text-ink-strong underline"
                              href={createDetailHref(relationship.id, filters)}
                            >
                              {getCoacheeLabel(relationship)}
                            </Link>
                            {relationship.coachee?.email &&
                              relationship.coachee.email !==
                                getCoacheeLabel(relationship) && (
                                <div className="mt-1 text-xs text-ink-faint">
                                  {relationship.coachee.email}
                                </div>
                              )}
                          </td>
                          <td className="px-3 py-3">
                            <span
                              className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${relationshipTypeBadgeClass(
                                relationship.relationshipType,
                              )}`}
                            >
                              {getRelationshipTypeLabel(
                                relationship.relationshipType,
                              )}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <span
                              className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${relationshipStatusBadgeClass(
                                relationship.status,
                              )}`}
                            >
                              {getStatusLabel(relationship.status)}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            {formatScope(
                              relationship.scopeType,
                              relationship.scopeId,
                            )}
                          </td>
                          <td className="px-3 py-3">
                            {formatDate(relationship.startedAt)}
                          </td>
                          <td className="px-3 py-3">
                            {formatDate(relationship.endedAt)}
                          </td>
                          <td className="px-3 py-3">
                            {formatDate(relationship.createdAt)}
                          </td>
                          <td className="px-3 py-3">
                            <Link
                              className="text-sm font-medium text-brand-600 underline"
                              href={createDetailHref(relationship.id, filters)}
                            >
                              보기
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="mt-6 flex items-center justify-between gap-3 border-t border-line-soft pt-4 text-sm text-ink-muted">
                <p>{pagination.page}페이지</p>
                <div className="flex items-center gap-3">
                  {pagination.page > 1 ? (
                    <Link
                      className="font-medium text-brand-600 underline"
                      href={createPageHref(pagination.page - 1, filters)}
                    >
                      이전
                    </Link>
                  ) : (
                    <span className="text-ink-faint">이전</span>
                  )}
                  {pagination.hasNext ? (
                    <Link
                      className="font-medium text-brand-600 underline"
                      href={createPageHref(pagination.page + 1, filters)}
                    >
                      다음
                    </Link>
                  ) : (
                    <span className="text-ink-faint">다음</span>
                  )}
                </div>
              </div>
            </section>
          </>
        )}
      </section>
    </main>
  );
}
