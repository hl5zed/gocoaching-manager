import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getCoachWeeklyLogDetail,
  type CoachWeeklyLogDetail,
} from "@/lib/api/coach/weekly-log-detail";


type CoachWeeklyLogDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

const STATUS_LABEL: Record<string, string> = {
  draft: "임시 저장",
  submitted: "제출됨",
  archived: "보관됨",
};

const RELATIONSHIP_TYPE_LABEL: Record<string, string> = {
  individual_coaching: "개인 코칭",
  group_coaching: "그룹 코칭",
  leadership_coaching: "리더십 코칭",
  pastoral_coaching: "목회 코칭",
  missionary_coaching: "선교사 코칭",
};

const SCOPE_TYPE_LABEL: Record<string, string> = {
  global: "전체",
  country: "국가",
  region: "지역",
  organization: "조직",
  church: "교회",
  group: "그룹",
  cohort: "코호트",
  coach: "코치",
};

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

function formatScope(scopeType: string | null, scopeId: string | null) {
  if (!scopeType) {
    return "-";
  }

  if (scopeType === "global") {
    return "전체";
  }

  const scopeLabel = SCOPE_TYPE_LABEL[scopeType] ?? scopeType;

  if (!scopeId) {
    return scopeLabel;
  }

  if (scopeId.length <= 12) {
    return `${scopeLabel}: ${scopeId}`;
  }

  return `${scopeLabel}: ${scopeId.slice(0, 8)}...${scopeId.slice(-4)}`;
}

function relationshipTypeLabel(value: string | null) {
  if (!value) {
    return "-";
  }

  return RELATIONSHIP_TYPE_LABEL[value] ?? value;
}

function statusLabel(value: string) {
  return STATUS_LABEL[value] ?? value;
}

function emptyText(value: string | null) {
  return value && value.trim().length > 0 ? value : "없음";
}

function TopLinks({ id }: { id: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <Link
        href="/coach/weekly-logs"
        className="font-medium text-blue-600 hover:underline"
      >
        ← 주간 기록 목록
      </Link>
      <div className="flex flex-wrap gap-4">
        <Link
          href={`/coach/weekly-logs/${id}/feedback`}
          className="font-medium text-blue-600 hover:underline"
        >
          피드백 작성
        </Link>
      </div>
    </div>
  );
}

function renderContent(log: CoachWeeklyLogDetail) {
  const coacheeName =
    log.coachee_display_name ?? log.coachee_full_name ?? log.coachee_email ?? "-";

  return (
    <main className="min-h-screen bg-surface-app px-6 py-10 text-ink-strong">
      <div className="mx-auto max-w-5xl">
        <TopLinks id={log.id} />

        <h1 className="mt-6 text-2xl font-semibold">주간 기록 상세</h1>

        <section className="mt-6 rounded-card border border-line-base bg-surface-card p-6">
          <h2 className="text-lg font-semibold">기본 정보</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-ink-faint">코치이</dt>
              <dd className="mt-1 text-ink-strong">{coacheeName}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-ink-faint">주간 기간</dt>
              <dd className="mt-1 text-ink-strong">
                {formatDate(log.week_start)} ~ {formatDate(log.week_end)}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-ink-faint">상태</dt>
              <dd className="mt-1 text-ink-strong">{statusLabel(log.status)}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-ink-faint">관계 유형</dt>
              <dd className="mt-1 text-ink-strong">
                {relationshipTypeLabel(log.relationship_type)}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-ink-faint">제출일</dt>
              <dd className="mt-1 text-ink-strong">{formatDate(log.submitted_at)}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-ink-faint">수정일</dt>
              <dd className="mt-1 text-ink-strong">{formatDate(log.updated_at)}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-ink-faint">범위</dt>
              <dd className="mt-1 text-ink-strong">
                {formatScope(log.scope_type, log.scope_id)}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-ink-faint">버전</dt>
              <dd className="mt-1 text-ink-strong">{log.version}</dd>
            </div>
          </dl>
        </section>

        <section className="mt-6 rounded-card border border-line-base bg-surface-card p-6">
          <h2 className="text-lg font-semibold">주간 기록 내용</h2>
          <dl className="mt-4 grid gap-5">
            <div>
              <dt className="text-sm font-medium text-ink-faint">감사 제목</dt>
              <dd className="mt-1 whitespace-pre-wrap text-ink-strong">
                {emptyText(log.gratitude)}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-ink-faint">기도 제목</dt>
              <dd className="mt-1 whitespace-pre-wrap text-ink-strong">
                {emptyText(log.prayer_request)}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-ink-faint">진행 상황</dt>
              <dd className="mt-1 whitespace-pre-wrap text-ink-strong">
                {emptyText(log.progress_summary)}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-ink-faint">어려웠던 점</dt>
              <dd className="mt-1 whitespace-pre-wrap text-ink-strong">
                {emptyText(log.difficulty)}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-ink-faint">
                코치에게 남긴 말
              </dt>
              <dd className="mt-1 whitespace-pre-wrap text-ink-strong">
                {emptyText(log.message_to_coach)}
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </main>
  );
}

function renderProfileMissing() {
  return (
    <main className="min-h-screen bg-surface-app px-6 py-10 text-ink-strong">
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

function renderNotFound() {
  return (
    <main className="min-h-screen bg-surface-app px-6 py-10 text-ink-strong">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/coach/weekly-logs"
          className="font-medium text-blue-600 hover:underline"
        >
          ← 주간 기록 목록
        </Link>
        <p className="mt-6 rounded-md border border-line-base bg-surface-card px-4 py-6 text-ink-base">
          해당 주간 기록을 찾을 수 없습니다.
        </p>
      </div>
    </main>
  );
}

function renderLoadError() {
  return (
    <main className="min-h-screen bg-surface-app px-6 py-10 text-ink-strong">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/coach/weekly-logs"
          className="font-medium text-blue-600 hover:underline"
        >
          ← 주간 기록 목록
        </Link>
        <p className="mt-6 rounded-control border border-red-200 bg-red-50 px-4 py-6 text-red-700">
          지금 주간 기록을 불러올 수 없습니다.
        </p>
      </div>
    </main>
  );
}

export default async function CoachWeeklyLogDetailPage({
  params,
}: CoachWeeklyLogDetailPageProps) {
  const { id } = await params;
  const result = await getCoachWeeklyLogDetail(id);

  if (result.error?.code === "UNAUTHORIZED") {
    redirect(`/login?redirectTo=/coach/weekly-logs/${id}`);
  }

  if (result.error?.code === "PROFILE_NOT_FOUND") {
    return renderProfileMissing();
  }

  if (
    result.error?.code === "NOT_FOUND" ||
    result.error?.code === "ACCESS_DENIED"
  ) {
    return renderNotFound();
  }

  if (result.error) {
    return renderLoadError();
  }

  return renderContent(result.data);
}
