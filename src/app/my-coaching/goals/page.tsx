import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getMyCoachingGoals,
  saveMyCoachingGoal,
  updateMyCoachingGoalStatus,
  type MyCoachingGoal,
} from "@/lib/api/my-coaching/goals";
import type { GoalPriority, GoalStatus } from "@/types/database";

export const dynamic = "force-dynamic";

const STATUS_OPTIONS: Array<{ value: GoalStatus; label: string }> = [
  { value: "active", label: "진행 중" },
  { value: "paused", label: "일시 중지" },
  { value: "completed", label: "완료" },
  { value: "archived", label: "보관" },
];

const PRIORITY_OPTIONS: Array<{ value: GoalPriority; label: string }> = [
  { value: "low", label: "낮음" },
  { value: "normal", label: "보통" },
  { value: "high", label: "높음" },
];

function normalizeMessage(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatDateTime(value: string | null) {
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
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
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

function getStatusLabel(status: GoalStatus) {
  return STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
}

function getPriorityLabel(priority: GoalPriority) {
  return (
    PRIORITY_OPTIONS.find((option) => option.value === priority)?.label ?? priority
  );
}

function statusBadgeClass(status: GoalStatus) {
  switch (status) {
    case "active":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "paused":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "completed":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "archived":
      return "border-slate-300 bg-slate-100 text-slate-600";
    default:
      return "border-slate-200 bg-slate-100 text-slate-700";
  }
}

function priorityBadgeClass(priority: GoalPriority) {
  switch (priority) {
    case "high":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "normal":
      return "border-slate-200 bg-slate-50 text-slate-700";
    case "low":
      return "border-teal-200 bg-teal-50 text-teal-700";
    default:
      return "border-slate-200 bg-slate-100 text-slate-700";
  }
}

function GoalForm({ goal }: { goal?: MyCoachingGoal }) {
  const title = goal ? "목표 수정" : "새 목표 만들기";
  const buttonLabel = goal ? "목표 저장" : "목표 저장";

  return (
    <form action={saveGoal} className="space-y-4">
      <input name="goal_id" type="hidden" value={goal?.id ?? ""} />
      <div>
        <label className="block text-sm font-medium text-slate-700" htmlFor={`title-${goal?.id ?? "new"}`}>
          목표 제목
        </label>
        <input
          className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-950 outline-none focus:border-slate-700"
          defaultValue={goal?.title ?? ""}
          id={`title-${goal?.id ?? "new"}`}
          maxLength={120}
          name="title"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700" htmlFor={`description-${goal?.id ?? "new"}`}>
          설명
        </label>
        <textarea
          className="mt-2 min-h-24 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-950 outline-none focus:border-slate-700"
          defaultValue={goal?.description ?? ""}
          id={`description-${goal?.id ?? "new"}`}
          maxLength={2000}
          name="description"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor={`category-${goal?.id ?? "new"}`}>
            분류
          </label>
          <input
            className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-950 outline-none focus:border-slate-700"
            defaultValue={goal?.category ?? ""}
            id={`category-${goal?.id ?? "new"}`}
            maxLength={80}
            name="category"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor={`target-value-${goal?.id ?? "new"}`}>
            목표값
          </label>
          <input
            className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-950 outline-none focus:border-slate-700"
            defaultValue={goal?.target_value ?? ""}
            id={`target-value-${goal?.id ?? "new"}`}
            name="target_value"
            step="any"
            type="number"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor={`current-value-${goal?.id ?? "new"}`}>
            현재값
          </label>
          <input
            className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-950 outline-none focus:border-slate-700"
            defaultValue={goal?.current_value ?? ""}
            id={`current-value-${goal?.id ?? "new"}`}
            name="current_value"
            step="any"
            type="number"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor={`unit-${goal?.id ?? "new"}`}>
            단위
          </label>
          <input
            className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-950 outline-none focus:border-slate-700"
            defaultValue={goal?.unit ?? ""}
            id={`unit-${goal?.id ?? "new"}`}
            maxLength={40}
            name="unit"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor={`priority-${goal?.id ?? "new"}`}>
            우선순위
          </label>
          <select
            className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-950 outline-none focus:border-slate-700"
            defaultValue={goal?.priority ?? "normal"}
            id={`priority-${goal?.id ?? "new"}`}
            name="priority"
          >
            {PRIORITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor={`start-date-${goal?.id ?? "new"}`}>
            시작일
          </label>
          <input
            className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-950 outline-none focus:border-slate-700"
            defaultValue={goal?.start_date ?? ""}
            id={`start-date-${goal?.id ?? "new"}`}
            name="start_date"
            type="date"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor={`due-date-${goal?.id ?? "new"}`}>
            마감일
          </label>
          <input
            className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-950 outline-none focus:border-slate-700"
            defaultValue={goal?.due_date ?? ""}
            id={`due-date-${goal?.id ?? "new"}`}
            name="due_date"
            type="date"
          />
        </div>
      </div>

      <div>
        <button
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          type="submit"
        >
          {buttonLabel}
        </button>
      </div>
      <p className="sr-only">{title}</p>
    </form>
  );
}

async function saveGoal(formData: FormData) {
  "use server";

  const result = await saveMyCoachingGoal({
    goal_id: formData.get("goal_id"),
    title: formData.get("title"),
    description: formData.get("description"),
    category: formData.get("category"),
    target_value: formData.get("target_value"),
    current_value: formData.get("current_value"),
    unit: formData.get("unit"),
    priority: formData.get("priority"),
    start_date: formData.get("start_date"),
    due_date: formData.get("due_date"),
  });

  if (!result.ok) {
    redirect("/my-coaching/goals?error=save");
  }

  redirect("/my-coaching/goals?saved=1");
}

async function changeGoalStatus(formData: FormData) {
  "use server";

  const result = await updateMyCoachingGoalStatus({
    goal_id: formData.get("goal_id"),
    status: formData.get("status"),
  });

  if (!result.ok) {
    redirect("/my-coaching/goals?error=status");
  }

  redirect("/my-coaching/goals?updated=1");
}

export default async function MyCoachingGoalsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const result = await getMyCoachingGoals();

  if (!result.ok && result.error.code === "UNAUTHORIZED") {
    redirect("/login?redirectTo=%2Fmy-coaching%2Fgoals");
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const errorCode = normalizeMessage(resolvedSearchParams.error);
  const saved = normalizeMessage(resolvedSearchParams.saved) === "1";
  const updated = normalizeMessage(resolvedSearchParams.updated) === "1";
  const errorMessage =
    errorCode === "status"
      ? "목표 상태를 변경할 수 없습니다."
      : errorCode === "save"
        ? "목표를 저장할 수 없습니다."
        : "";
  const successMessage = saved
    ? "목표를 저장했습니다."
    : updated
      ? "목표 상태를 변경했습니다."
      : "";

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
      <section className="mx-auto w-full max-w-5xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
              내 코칭
            </p>
            <h1 className="mt-3 text-3xl font-semibold">나의 목표</h1>
            <p className="mt-3 max-w-3xl text-slate-600">
              코칭 과정에서 실천할 목표를 기록하고 관리합니다.
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 text-sm">
            <Link className="font-medium text-slate-700 underline" href="/my-coaching">
              내 코칭 공간으로 돌아가기
            </Link>
            <Link className="font-medium text-slate-700 underline" href="/dashboard">
              대시보드
            </Link>
          </div>
        </div>

        {!result.ok && result.error.code === "PROFILE_NOT_FOUND" ? (
          <section className="mt-8 rounded-md border border-slate-200 bg-white p-6">
            <p className="text-slate-700">아직 프로필이 생성되지 않았습니다.</p>
            <div className="mt-4">
              <Link className="text-sm font-medium text-slate-700 underline" href="/profile">
                프로필 보기
              </Link>
            </div>
          </section>
        ) : !result.ok ? (
          <section className="mt-8 rounded-md border border-red-200 bg-red-50 p-4 text-red-800">
            지금 목표를 불러올 수 없습니다.
          </section>
        ) : (
          <>
            {errorMessage ? (
              <div className="mt-8 rounded-md border border-red-200 bg-red-50 p-4 text-red-800">
                {errorMessage}
              </div>
            ) : null}
            {successMessage ? (
              <div className="mt-8 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
                {successMessage}
              </div>
            ) : null}

            <section className="mt-8 rounded-md border border-slate-200 bg-white p-6">
              <h2 className="text-lg font-semibold">새 목표 만들기</h2>
              <div className="mt-5">
                <GoalForm />
              </div>
            </section>

            <section className="mt-6 rounded-md border border-slate-200 bg-white p-6">
              <h2 className="text-lg font-semibold">목표 목록</h2>
              {result.data.goals.length === 0 ? (
                <p className="mt-4 text-slate-700">
                  아직 등록된 목표가 없습니다.
                </p>
              ) : (
                <div className="mt-5 grid gap-5">
                  {result.data.goals.map((goal) => (
                    <article
                      className="rounded-md border border-slate-200 bg-slate-50 p-5"
                      key={goal.id}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <h3 className="text-lg font-semibold text-slate-950">
                            {goal.title}
                          </h3>
                          <p className="mt-2 whitespace-pre-wrap text-slate-700">
                            {displayValue(goal.description)}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusBadgeClass(goal.status)}`}>
                            {getStatusLabel(goal.status)}
                          </span>
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${priorityBadgeClass(goal.priority)}`}>
                            {getPriorityLabel(goal.priority)}
                          </span>
                        </div>
                      </div>

                      <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <div>
                          <dt className="text-sm font-medium text-slate-500">
                            분류
                          </dt>
                          <dd className="mt-1 text-slate-950">
                            {displayValue(goal.category)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-slate-500">
                            목표값
                          </dt>
                          <dd className="mt-1 text-slate-950">
                            {displayValue(goal.target_value)} {displayValue(goal.unit)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-slate-500">
                            현재값
                          </dt>
                          <dd className="mt-1 text-slate-950">
                            {displayValue(goal.current_value)} {displayValue(goal.unit)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-slate-500">
                            완료일
                          </dt>
                          <dd className="mt-1 text-slate-950">
                            {formatDateTime(goal.completed_at)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-slate-500">
                            시작일
                          </dt>
                          <dd className="mt-1 text-slate-950">
                            {formatDate(goal.start_date)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-slate-500">
                            마감일
                          </dt>
                          <dd className="mt-1 text-slate-950">
                            {formatDate(goal.due_date)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-slate-500">
                            수정일
                          </dt>
                          <dd className="mt-1 text-slate-950">
                            {formatDateTime(goal.updated_at)}
                          </dd>
                        </div>
                      </dl>

                      <div className="mt-6 rounded-md border border-slate-200 bg-white p-4">
                        <h4 className="font-semibold text-slate-950">
                          목표 내용 수정
                        </h4>
                        <div className="mt-4">
                          <GoalForm goal={goal} />
                        </div>
                      </div>

                      <form action={changeGoalStatus} className="mt-4">
                        <input name="goal_id" type="hidden" value={goal.id} />
                        <div className="flex flex-wrap gap-2">
                          {STATUS_OPTIONS.map((option) => (
                            <button
                              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                              disabled={goal.status === option.value}
                              key={option.value}
                              name="status"
                              type="submit"
                              value={option.value}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </form>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </section>
    </main>
  );
}
