import Link from "next/link";
import { redirect } from "next/navigation";
import { getCoachGoals, type CoachGoalItem } from "@/lib/api/coach/goals";
import type { GoalPriority, GoalStatus } from "@/types/database";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<GoalStatus, string> = {
  active: "진행 중",
  paused: "일시 중지",
  completed: "완료",
  archived: "보관",
};

const PRIORITY_LABEL: Record<GoalPriority, string> = {
  low: "낮음",
  normal: "보통",
  high: "높음",
};

function coacheeName(goal: CoachGoalItem) {
  return (
    goal.coachee_display_name ??
    goal.coachee_full_name ??
    goal.coachee_email ??
    "알 수 없음"
  );
}

function displayValue(value: string | number | null) {
  if (value === null) {
    return "-";
  }

  if (typeof value === "number") {
    return String(value);
  }

  return value.trim().length > 0 ? value : "-";
}

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  return value.slice(0, 10);
}

function statusBadgeClass(status: GoalStatus) {
  switch (status) {
    case "active":
      return "bg-emerald-100 text-emerald-700";
    case "paused":
      return "bg-yellow-100 text-yellow-700";
    case "completed":
      return "bg-blue-100 text-blue-700";
    case "archived":
      return "bg-surface-sunken text-ink-muted";
    default:
      return "bg-surface-sunken text-ink-muted";
  }
}

function priorityBadgeClass(priority: GoalPriority) {
  switch (priority) {
    case "high":
      return "bg-rose-100 text-rose-700";
    case "normal":
      return "bg-surface-sunken text-ink-base";
    case "low":
      return "bg-teal-100 text-teal-700";
    default:
      return "bg-surface-sunken text-ink-muted";
  }
}

function Nav() {
  return (
    <nav className="flex gap-3 text-sm">
      <Link href="/coach" className="text-blue-600 hover:underline">
        코치 홈으로 돌아가기
      </Link>
      <span className="text-ink-faint">/</span>
      <Link href="/dashboard" className="text-blue-600 hover:underline">
        대시보드
      </Link>
    </nav>
  );
}

export default async function CoachGoalsPage() {
  const result = await getCoachGoals();

  if (result.error?.code === "UNAUTHORIZED") {
    redirect("/login?redirectTo=/coach/goals");
  }

  if (result.error?.code === "PROFILE_NOT_FOUND") {
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

  if (result.error?.code === "ACCESS_DENIED") {
    return (
      <main className="min-h-screen bg-surface-app px-6 py-10 text-ink-strong">
        <div className="mx-auto max-w-5xl">
          <Nav />
          <p className="mt-8 rounded-control border border-red-200 bg-red-50 px-4 py-3 text-red-700">
            코치 권한이 없습니다.
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
            지금 코치이 목표를 불러올 수 없습니다.
          </p>
        </div>
      </main>
    );
  }

  const goals = result.data;

  return (
    <main className="min-h-screen bg-surface-app px-6 py-10 text-ink-strong">
      <div className="mx-auto max-w-5xl">
        <Nav />

        <h1 className="mt-6 text-2xl font-semibold">코치이 목표</h1>
        <p className="mt-2 text-sm text-ink-muted">
          담당 코치이들이 작성한 목표를 확인합니다.
        </p>

        {goals.length === 0 ? (
          <p className="mt-8 rounded-md border border-line-base bg-surface-card px-4 py-6 text-center text-ink-faint">
            아직 확인할 코치이 목표가 없습니다.
          </p>
        ) : (
          <div className="mt-6 grid gap-5">
            {goals.map((goal) => (
              <article
                key={goal.id}
                className="rounded-card border border-line-base bg-surface-card p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-ink-faint">코치이</p>
                    <p className="mt-1 text-lg font-semibold text-ink-strong">
                      {coacheeName(goal)}
                    </p>
                    <p className="mt-1 text-sm text-ink-muted">
                      {goal.coachee_email ?? "-"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass(
                        goal.status,
                      )}`}
                    >
                      {STATUS_LABEL[goal.status]}
                    </span>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${priorityBadgeClass(
                        goal.priority,
                      )}`}
                    >
                      {PRIORITY_LABEL[goal.priority]}
                    </span>
                  </div>
                </div>

                <section className="mt-5">
                  <h2 className="text-lg font-semibold text-ink-strong">
                    {goal.title}
                  </h2>
                  <p className="mt-2 whitespace-pre-wrap text-ink-base">
                    {displayValue(goal.description)}
                  </p>
                </section>

                <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <dt className="text-sm font-medium text-ink-faint">분류</dt>
                    <dd className="mt-1 text-ink-strong">
                      {displayValue(goal.category)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-ink-faint">
                      현재값 / 목표값 / 단위
                    </dt>
                    <dd className="mt-1 text-ink-strong">
                      {displayValue(goal.current_value)} /{" "}
                      {displayValue(goal.target_value)} / {displayValue(goal.unit)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-ink-faint">시작일</dt>
                    <dd className="mt-1 text-ink-strong">
                      {formatDate(goal.start_date)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-ink-faint">마감일</dt>
                    <dd className="mt-1 text-ink-strong">
                      {formatDate(goal.due_date)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-ink-faint">완료일</dt>
                    <dd className="mt-1 text-ink-strong">
                      {formatDate(goal.completed_at)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-ink-faint">작성일</dt>
                    <dd className="mt-1 text-ink-strong">
                      {formatDate(goal.created_at)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-ink-faint">수정일</dt>
                    <dd className="mt-1 text-ink-strong">
                      {formatDate(goal.updated_at)}
                    </dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
