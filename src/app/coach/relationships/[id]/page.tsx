import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/getSession";
import { getCoachRelationshipDetail } from "@/lib/api/coach/relationship-detail";
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

function getBackToRelationshipsHref(value: string | string[] | undefined) {
  if (typeof value !== "string") {
    return "/coach/relationships";
  }

  if (!value.startsWith("/coach/relationships")) {
    return "/coach/relationships";
  }

  return value;
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function displayValue(value: string | null | undefined) {
  return value && value.trim().length > 0 ? value : "-";
}

function formatPersonName(person: {
  display_name: string | null;
  full_name: string | null;
  email: string | null;
} | null) {
  if (!person) {
    return "알 수 없음";
  }

  return person.display_name || person.full_name || person.email || "알 수 없음";
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

export default async function CoachRelationshipDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string | string[] }>;
}) {
  const session = await getSession();

  if (!session.user) {
    const resolvedParams = await params;
    redirect(
      `/login?redirectTo=${encodeURIComponent(
        `/coach/relationships/${resolvedParams.id}`,
      )}`,
    );
  }

  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const backToRelationshipsHref = getBackToRelationshipsHref(
    resolvedSearchParams.from,
  );
  const result = await getCoachRelationshipDetail(resolvedParams.id);

  if (!result.ok && result.error.code === "UNAUTHORIZED") {
    redirect(
      `/login?redirectTo=${encodeURIComponent(
        `/coach/relationships/${resolvedParams.id}`,
      )}`,
    );
  }

  if (!result.ok && result.error.code === "FORBIDDEN") {
    notFound();
  }

  if (!result.ok) {
    return (
      <main className="min-h-screen bg-surface-app px-6 py-10 text-ink-strong">
        <section className="mx-auto w-full max-w-5xl">
          <p className="text-sm font-medium uppercase tracking-wide text-ink-faint">
            코치
          </p>
          <h1 className="mt-3 text-3xl font-semibold">코칭 관계 상세</h1>
          <div className="mt-8 rounded-control border border-red-200 bg-red-50 p-4 text-red-800">
            지금 코칭 관계를 불러올 수 없습니다.
          </div>
        </section>
      </main>
    );
  }

  const { profile, relationship } = result.data;

  if (profile === null) {
    return (
      <main className="min-h-screen bg-surface-app px-6 py-10 text-ink-strong">
        <section className="mx-auto w-full max-w-5xl">
          <p className="text-sm font-medium uppercase tracking-wide text-ink-faint">
            코치
          </p>
          <h1 className="mt-3 text-3xl font-semibold">
            코칭 관계 상세
          </h1>
          <section className="mt-8 rounded-card border border-line-base bg-surface-card p-6">
            <p className="text-ink-base">
              아직 프로필이 생성되지 않았습니다.
            </p>
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
        </section>
      </main>
    );
  }

  if (!relationship) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-surface-app px-6 py-10 text-ink-strong">
      <section className="mx-auto w-full max-w-5xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-ink-faint">
              코치
            </p>
            <h1 className="mt-3 text-3xl font-semibold">
              코칭 관계 상세
            </h1>
            <p className="mt-3 max-w-3xl text-ink-muted">
              내 코치 프로필에 직접 연결된 코칭 관계를 읽기 전용으로 확인할 수 있습니다.
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 text-sm">
            <Link
              className="font-medium text-brand-600 underline"
              href={backToRelationshipsHref}
            >
              코칭 관계 목록으로 돌아가기
            </Link>
            <Link className="font-medium text-brand-600 underline" href="/coach">
              코치 대시보드로 돌아가기
            </Link>
          </div>
        </div>

        <section className="mt-8 rounded-card border border-line-base bg-surface-card p-6">
          <h2 className="text-lg font-semibold">관계 요약</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-ink-faint">
                관계 유형
              </dt>
              <dd className="mt-2">
                <span
                  className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${relationshipTypeBadgeClass(
                    relationship.relationshipType,
                  )}`}
                >
                  {getRelationshipTypeLabel(relationship.relationshipType)}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-ink-faint">상태</dt>
              <dd className="mt-2">
                <span
                  className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${relationshipStatusBadgeClass(
                    relationship.status,
                  )}`}
                >
                  {getStatusLabel(relationship.status)}
                </span>
              </dd>
            </div>
          </dl>
        </section>

        <section className="mt-6 rounded-card border border-line-base bg-surface-card p-6">
          <h2 className="text-lg font-semibold">코치</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-ink-faint">이름</dt>
              <dd className="mt-1 text-ink-strong">
                {formatPersonName(relationship.coach)}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-ink-faint">이메일</dt>
              <dd className="mt-1 text-ink-strong">
                {displayValue(relationship.coach?.email)}
              </dd>
            </div>
          </dl>
        </section>

        <section className="mt-6 rounded-card border border-line-base bg-surface-card p-6">
          <h2 className="text-lg font-semibold">코치이</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-ink-faint">이름</dt>
              <dd className="mt-1 text-ink-strong">
                {formatPersonName(relationship.coachee)}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-ink-faint">이메일</dt>
              <dd className="mt-1 text-ink-strong">
                {displayValue(relationship.coachee?.email)}
              </dd>
            </div>
          </dl>
        </section>

        <section className="mt-6 rounded-card border border-line-base bg-surface-card p-6">
          <h2 className="text-lg font-semibold">범위</h2>
          <p className="mt-4 text-ink-strong">
            {formatScope(relationship.scopeType, relationship.scopeId)}
          </p>
        </section>

        <section className="mt-6 rounded-card border border-line-base bg-surface-card p-6">
          <h2 className="text-lg font-semibold">일정</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-ink-faint">시작일</dt>
              <dd className="mt-1 text-ink-strong">
                {formatDateTime(relationship.startedAt)}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-ink-faint">종료일</dt>
              <dd className="mt-1 text-ink-strong">
                {formatDateTime(relationship.endedAt)}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-ink-faint">생성일</dt>
              <dd className="mt-1 text-ink-strong">
                {formatDateTime(relationship.createdAt)}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-ink-faint">수정일</dt>
              <dd className="mt-1 text-ink-strong">
                {formatDateTime(relationship.updatedAt)}
              </dd>
            </div>
          </dl>
        </section>

        <section className="mt-6 rounded-card border border-line-base bg-surface-card p-6">
          <h2 className="text-lg font-semibold">다음 단계</h2>
          <div className="mt-4 flex flex-col gap-3">
            <Link
              className="text-sm font-medium text-brand-600 underline"
              href={backToRelationshipsHref}
            >
              코칭 관계 목록으로 돌아가기
            </Link>
            <Link
              className="text-sm font-medium text-brand-600 underline"
              href="/coach"
            >
              코치 대시보드로 돌아가기
            </Link>
            <Link
              className="text-sm font-medium text-brand-600 underline"
              href="/profile"
            >
              내 프로필
            </Link>
          </div>
        </section>
      </section>
    </main>
  );
}
