import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getCoachWeeklyLogFeedbackForm,
  saveCoachWeeklyLogFeedback,
  type CoachWeeklyLogFeedbackErrorCode,
  type CoachWeeklyLogFeedbackForm,
} from "@/lib/api/coach/weekly-log-feedback";


type CoachWeeklyLogFeedbackPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<{
    error?: string | string[];
  }>;
};

const STATUS_LABEL: Record<string, string> = {
  draft: "임시 저장",
  submitted: "제출됨",
  archived: "보관됨",
};

const SAVE_ERROR_MESSAGE: Record<CoachWeeklyLogFeedbackErrorCode, string> = {
  UNAUTHORIZED: "로그인이 필요합니다.",
  PROFILE_NOT_FOUND: "아직 프로필이 생성되지 않았습니다.",
  PROFILE_QUERY_FAILED: "프로필을 불러올 수 없습니다.",
  ROLES_QUERY_FAILED: "역할 정보를 불러올 수 없습니다.",
  ACCESS_DENIED: "해당 주간 기록을 찾을 수 없습니다.",
  RELATIONSHIPS_QUERY_FAILED: "코칭 관계를 불러올 수 없습니다.",
  LOG_QUERY_FAILED: "주간 기록을 불러올 수 없습니다.",
  COACHEE_PROFILE_QUERY_FAILED: "코치이 정보를 불러올 수 없습니다.",
  FEEDBACK_QUERY_FAILED: "피드백을 불러올 수 없습니다.",
  VALIDATION_FAILED: "입력 내용을 확인해 주세요.",
  SAVE_FAILED: "피드백을 저장할 수 없습니다.",
  NOT_FOUND: "해당 주간 기록을 찾을 수 없습니다.",
};

async function saveFeedbackAction(formData: FormData) {
  "use server";

  const logId = getFormString(formData, "logId");
  const intent = getFormString(formData, "intent");
  const status = intent === "draft" ? "draft" : "published";

  const result = await saveCoachWeeklyLogFeedback({
    logId,
    feedback_text: getFormString(formData, "feedback_text"),
    encouragement: getFormString(formData, "encouragement"),
    next_step: getFormString(formData, "next_step"),
    status,
  });

  if (result.ok) {
    redirect(`/coach/weekly-logs/${logId}`);
  }

  if (result.error.code === "UNAUTHORIZED") {
    redirect(`/login?redirectTo=/coach/weekly-logs/${logId}/feedback`);
  }

  redirect(
    `/coach/weekly-logs/${logId}/feedback?error=${encodeURIComponent(
      result.error.code,
    )}`,
  );
}

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function getFirstQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

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

function formatText(value: string | null) {
  return value && value.trim().length > 0 ? value : "없음";
}

function renderPageShell(children: React.ReactNode) {
  return (
    <main className="min-h-screen bg-surface-app px-6 py-10 text-ink-strong">
      <div className="mx-auto max-w-5xl">{children}</div>
    </main>
  );
}

function renderTopLinks(id: string) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <Link
        href={`/coach/weekly-logs/${id}`}
        className="font-medium text-blue-600 hover:underline"
      >
        주간 기록 상세로 돌아가기
      </Link>
      <div className="flex flex-wrap gap-4">
        <Link
          href="/coach/weekly-logs"
          className="font-medium text-blue-600 hover:underline"
        >
          주간 기록 목록으로 돌아가기
        </Link>
      </div>
    </div>
  );
}

function renderProfileMissing() {
  return renderPageShell(
    <>
      <p className="rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3 text-yellow-800">
        아직 프로필이 생성되지 않았습니다.
      </p>
      <Link
        href="/profile"
        className="mt-4 inline-block text-sm font-medium text-blue-600 hover:underline"
      >
        프로필 보기
      </Link>
    </>,
  );
}

function renderNotFound(id: string) {
  return renderPageShell(
    <>
      {renderTopLinks(id)}
      <p className="mt-6 rounded-md border border-line-base bg-surface-card px-4 py-6 text-ink-base">
        해당 주간 기록을 찾을 수 없습니다.
      </p>
    </>,
  );
}

function renderLoadError(id: string) {
  return renderPageShell(
    <>
      {renderTopLinks(id)}
      <p className="mt-6 rounded-control border border-red-200 bg-red-50 px-4 py-6 text-red-700">
        지금 피드백 화면을 불러올 수 없습니다.
      </p>
    </>,
  );
}

function renderWeeklyLogSummary(data: CoachWeeklyLogFeedbackForm) {
  const coacheeName =
    data.coachee?.display_name ?? data.coachee?.full_name ?? data.coachee?.email ?? "-";

  return (
    <section className="mt-6 rounded-card border border-line-base bg-surface-card p-6">
      <h2 className="text-lg font-semibold">주간 기록 요약</h2>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-sm font-medium text-ink-faint">코치이</dt>
          <dd className="mt-1 text-ink-strong">{coacheeName}</dd>
          <dd className="mt-1 text-sm text-ink-muted">{data.coachee?.email ?? "-"}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-ink-faint">주간 기간</dt>
          <dd className="mt-1 text-ink-strong">
            {formatDate(data.weeklyLog.week_start)} ~{" "}
            {formatDate(data.weeklyLog.week_end)}
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-ink-faint">상태</dt>
          <dd className="mt-1 text-ink-strong">
            {STATUS_LABEL[data.weeklyLog.status] ?? data.weeklyLog.status}
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-ink-faint">제출일</dt>
          <dd className="mt-1 text-ink-strong">
            {formatDate(data.weeklyLog.submitted_at)}
          </dd>
        </div>
      </dl>

      <dl className="mt-6 grid gap-5">
        <div>
          <dt className="text-sm font-medium text-ink-faint">감사 제목</dt>
          <dd className="mt-1 whitespace-pre-wrap text-ink-strong">
            {formatText(data.weeklyLog.gratitude)}
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-ink-faint">기도 제목</dt>
          <dd className="mt-1 whitespace-pre-wrap text-ink-strong">
            {formatText(data.weeklyLog.prayer_request)}
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-ink-faint">진행 상황</dt>
          <dd className="mt-1 whitespace-pre-wrap text-ink-strong">
            {formatText(data.weeklyLog.progress_summary)}
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-ink-faint">어려웠던 점</dt>
          <dd className="mt-1 whitespace-pre-wrap text-ink-strong">
            {formatText(data.weeklyLog.difficulty)}
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-ink-faint">코치에게 남긴 말</dt>
          <dd className="mt-1 whitespace-pre-wrap text-ink-strong">
            {formatText(data.weeklyLog.message_to_coach)}
          </dd>
        </div>
      </dl>
    </section>
  );
}

function renderFeedbackForm(
  id: string,
  data: CoachWeeklyLogFeedbackForm,
  saveErrorCode: string | undefined,
) {
  const errorMessage =
    saveErrorCode && saveErrorCode in SAVE_ERROR_MESSAGE
      ? SAVE_ERROR_MESSAGE[saveErrorCode as CoachWeeklyLogFeedbackErrorCode]
      : null;

  return renderPageShell(
    <>
      {renderTopLinks(id)}
      <h1 className="mt-6 text-2xl font-semibold">코치 피드백 작성</h1>

      {renderWeeklyLogSummary(data)}

      <section className="mt-6 rounded-card border border-line-base bg-surface-card p-6">
        <h2 className="text-lg font-semibold">피드백</h2>

        {errorMessage ? (
          <p className="mt-4 rounded-control border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </p>
        ) : null}

        <form action={saveFeedbackAction} className="mt-4 grid gap-5">
          <input type="hidden" name="logId" value={id} />

          <label className="grid gap-2">
            <span className="text-sm font-medium text-ink-base">피드백</span>
            <textarea
              name="feedback_text"
              rows={7}
              maxLength={3000}
              defaultValue={data.feedback?.feedback_text ?? ""}
              className="rounded-control border border-line-base px-3 py-2 text-sm text-ink-strong shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-ink-base">격려</span>
            <textarea
              name="encouragement"
              rows={4}
              maxLength={2000}
              defaultValue={data.feedback?.encouragement ?? ""}
              className="rounded-control border border-line-base px-3 py-2 text-sm text-ink-strong shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-ink-base">다음 단계</span>
            <textarea
              name="next_step"
              rows={4}
              maxLength={2000}
              defaultValue={data.feedback?.next_step ?? ""}
              className="rounded-control border border-line-base px-3 py-2 text-sm text-ink-strong shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              name="intent"
              value="draft"
              className="rounded-md border border-line-base bg-surface-card px-4 py-2 text-sm font-medium text-ink-base hover:bg-surface-sunken"
            >
              임시 저장
            </button>
            <button
              type="submit"
              name="intent"
              value="published"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              피드백 게시
            </button>
          </div>
        </form>
      </section>
    </>,
  );
}

export default async function CoachWeeklyLogFeedbackPage({
  params,
  searchParams,
}: CoachWeeklyLogFeedbackPageProps) {
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const saveErrorCode = getFirstQueryValue(resolvedSearchParams.error);
  const result = await getCoachWeeklyLogFeedbackForm(id);

  if (result.error?.code === "UNAUTHORIZED") {
    redirect(`/login?redirectTo=/coach/weekly-logs/${id}/feedback`);
  }

  if (result.error?.code === "PROFILE_NOT_FOUND") {
    return renderProfileMissing();
  }

  if (
    result.error?.code === "NOT_FOUND" ||
    result.error?.code === "ACCESS_DENIED"
  ) {
    return renderNotFound(id);
  }

  if (result.error) {
    return renderLoadError(id);
  }

  return renderFeedbackForm(id, result.data, saveErrorCode);
}
