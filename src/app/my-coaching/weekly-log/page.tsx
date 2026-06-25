import Link from "next/link";
import { redirect } from "next/navigation";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { getSession } from "@/lib/auth/getSession";
import {
  getCurrentWeekRange,
  getMyWeeklyLogPageData,
  removeMyWeeklyLog,
  saveMyWeeklyLog,
} from "@/lib/api/my-coaching/weekly-log";
import { I18nText } from "@/lib/i18n/I18nProvider";
import { formatScope, getRelationshipTypeLabel } from "@/lib/ui/labels";


function normalizeMessage(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function normalizeRelationshipParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function displayValue(value: string | null) {
  return value && value.trim().length > 0 ? value : "-";
}

function renderWeeklyLogMessage(message: string) {
  if (message === "주간 기록을 제출했습니다.") {
    return (
      <I18nText
        k="myCoaching.weeklyLog.form.submitted"
        fallback="주간 기록을 제출했습니다."
      />
    );
  }

  if (message === "주간 기록을 임시 저장했습니다.") {
    return (
      <I18nText
        k="myCoaching.weeklyLog.form.draftSaved"
        fallback="주간 기록을 임시 저장했습니다."
      />
    );
  }

  if (message === "주간 기록이 목록에서 제거되었습니다.") {
    return (
      <I18nText
        k="myCoaching.weeklyLog.form.removed"
        fallback="주간 기록이 목록에서 제거되었습니다."
      />
    );
  }

  if (message === "지금 주간 기록을 저장할 수 없습니다.") {
    return (
      <I18nText
        k="myCoaching.weeklyLog.form.saveFailed"
        fallback="지금 주간 기록을 저장할 수 없습니다."
      />
    );
  }

  if (message === "주간 기록 서비스를 지금 사용할 수 없습니다.") {
    return (
      <I18nText
        k="myCoaching.weeklyLog.form.serviceUnavailable"
        fallback="주간 기록 서비스를 지금 사용할 수 없습니다."
      />
    );
  }

  if (message === "주간 기록 ID를 확인할 수 없습니다.") {
    return (
      <I18nText
        k="myCoaching.weeklyLog.form.invalidId"
        fallback="주간 기록 ID를 확인할 수 없습니다."
      />
    );
  }

  if (message === "주간 기록 처리에 실패했습니다.") {
    return (
      <I18nText
        k="myCoaching.weeklyLog.form.processFailed"
        fallback="주간 기록 처리에 실패했습니다."
      />
    );
  }

  if (message === "주간 기록을 찾을 수 없습니다.") {
    return (
      <I18nText
        k="myCoaching.weeklyLog.form.notFound"
        fallback="주간 기록을 찾을 수 없습니다."
      />
    );
  }

  if (message === "이 주간 기록에 접근할 권한이 없습니다.") {
    return (
      <I18nText
        k="myCoaching.weeklyLog.form.forbidden"
        fallback="이 주간 기록에 접근할 권한이 없습니다."
      />
    );
  }

  if (message === "지금 주간 기록을 불러올 수 없습니다.") {
    return (
      <I18nText
        k="myCoaching.weeklyLog.form.loadFailed"
        fallback="지금 주간 기록을 불러올 수 없습니다."
      />
    );
  }

  return message;
}

function formatPersonName(person: {
  displayName: string | null;
  fullName: string | null;
  email: string | null;
} | null) {
  if (!person) {
    return "알 수 없음";
  }

  return person.displayName || person.fullName || person.email || "알 수 없음";
}

function formatDateRange(range: { weekStart: string; weekEnd: string }) {
  const start = new Date(range.weekStart);
  const end = new Date(range.weekEnd);

  const formatter = new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return `${formatter.format(start)} - ${formatter.format(end)}`;
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

function getWeeklyLogStatusLabel(status: string) {
  if (status === "draft") {
    return (
      <I18nText
        k="myCoaching.weeklyLog.form.status.draft"
        fallback="임시저장"
      />
    );
  }

  if (status === "submitted") {
    return (
      <I18nText
        k="myCoaching.weeklyLog.form.status.submitted"
        fallback="제출완료"
      />
    );
  }

  return (
    <I18nText
      k="myCoaching.weeklyLog.form.status.unknown"
      fallback="확인 필요"
    />
  );
}

function getWeeklyLogStatusClass(status: string) {
  if (status === "submitted") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }

  if (status === "draft") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  return "border-line-base bg-surface-sunken text-ink-base";
}

export default async function MyWeeklyLogPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();

  if (!session.user) {
    redirect("/login?redirectTo=%2Fmy-coaching%2Fweekly-log");
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const selectedRelationshipId = normalizeRelationshipParam(
    resolvedSearchParams.relationship,
  );
  const errorMessage = normalizeMessage(resolvedSearchParams.error);
  const successMessage = normalizeMessage(resolvedSearchParams.success);
  const result = await getMyWeeklyLogPageData({
    relationshipId: selectedRelationshipId,
  });

  if (!result.ok && result.error.code === "UNAUTHORIZED") {
    redirect("/login?redirectTo=%2Fmy-coaching%2Fweekly-log");
  }

  async function saveWeeklyLog(formData: FormData) {
    "use server";

    const saveResult = await saveMyWeeklyLog({
      relationship_id: formData.get("relationship_id"),
      gratitude: formData.get("gratitude"),
      prayer_request: formData.get("prayer_request"),
      progress_summary: formData.get("progress_summary"),
      difficulty: formData.get("difficulty"),
      message_to_coach: formData.get("message_to_coach"),
      intent: formData.get("intent"),
    });

    const relationshipId = formData.get("relationship_id");
    const relationshipQuery =
      typeof relationshipId === "string" && relationshipId.trim().length > 0
        ? `?relationship=${encodeURIComponent(relationshipId)}`
        : "";

    if (!saveResult.ok) {
      const nextError = encodeURIComponent(saveResult.error.message);
      const separator = relationshipQuery ? "&" : "?";
      redirect(
        `/my-coaching/weekly-log${relationshipQuery}${separator}error=${nextError}`,
      );
    }

    const nextSuccess =
      saveResult.data.status === "submitted"
        ? "주간 기록을 제출했습니다."
        : "주간 기록을 임시 저장했습니다.";
    const separator = relationshipQuery ? "&" : "?";
    redirect(
      `/my-coaching/weekly-log${relationshipQuery}${separator}success=${encodeURIComponent(
        nextSuccess,
      )}`,
    );
  }

  async function removeWeeklyLog(formData: FormData) {
    "use server";

    const removeResult = await removeMyWeeklyLog({
      weekly_log_id: formData.get("weekly_log_id"),
    });
    const relationshipId = formData.get("relationship_id");
    const relationshipQuery =
      typeof relationshipId === "string" && relationshipId.trim().length > 0
        ? `?relationship=${encodeURIComponent(relationshipId)}`
        : "";

    if (!removeResult.ok) {
      const nextError = encodeURIComponent(removeResult.error.message);
      const separator = relationshipQuery ? "&" : "?";
      redirect(
        `/my-coaching/weekly-log${relationshipQuery}${separator}error=${nextError}`,
      );
    }

    const separator = relationshipQuery ? "&" : "?";
    redirect(
      `/my-coaching/weekly-log${relationshipQuery}${separator}success=${encodeURIComponent(
        "주간 기록이 목록에서 제거되었습니다.",
      )}`,
    );
  }

  const currentWeek = result.ok ? result.data.currentWeek : getCurrentWeekRange();

  return (
    <main className="min-h-screen bg-surface-app px-6 py-10 text-ink-strong">
      <section className="mx-auto w-full max-w-5xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-ink-faint">
              <I18nText k="myCoaching.weeklyLog.badge" fallback="코칭" />
            </p>
            <h1 className="mt-3 text-3xl font-semibold">
              <I18nText k="myCoaching.weeklyLog.title" fallback="주간 기록" />
            </h1>
            <p className="mt-3 max-w-3xl text-ink-muted">
              <I18nText
                k="myCoaching.weeklyLog.description"
                fallback="이번 주 코칭 관계에 대한 기록을 작성합니다. 현재는 주간 기록을 작성하는 공간이며, 하루 기록과 월간 기록은 단계적으로 확장됩니다."
              />
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 text-sm">
            <LanguageSwitcher />
            <Link
              className="font-medium text-brand-600 underline"
              href="/my-coaching/records"
            >
              <I18nText
                k="myCoaching.weeklyLog.backToRecords"
                fallback="나의 기록으로 돌아가기"
              />
            </Link>
          </div>
        </div>

        {!result.ok ? (
          <section className="mt-8 rounded-control border border-red-200 bg-red-50 p-4 text-red-800">
            <I18nText
              k="myCoaching.weeklyLog.form.loadFailed"
              fallback="지금 주간 기록을 불러올 수 없습니다."
            />
          </section>
        ) : result.data.profile === null ? (
          <section className="mt-8 rounded-card border border-line-base bg-surface-card p-6">
            <p className="text-ink-base">
              <I18nText
                k="myCoaching.weeklyLog.form.noProfile"
                fallback="아직 프로필이 생성되지 않았습니다."
              />
            </p>
            <p className="mt-2 text-ink-muted">
              <I18nText
                k="myCoaching.weeklyLog.form.acceptInvitationFirst"
                fallback="초대를 받으셨다면 먼저 초대를 수락해 주세요."
              />
            </p>
            <div className="mt-4">
              <Link
                className="text-sm font-medium text-brand-600 underline"
                href="/profile"
              >
                <I18nText
                  k="myCoaching.weeklyLog.form.viewProfile"
                  fallback="프로필 보기"
                />
              </Link>
            </div>
          </section>
        ) : (
          <>
            <section className="mt-8 rounded-card border border-line-base bg-surface-card p-6">
              <h2 className="text-lg font-semibold">
                <I18nText k="myCoaching.weeklyLog.form.thisWeek" fallback="이번 주" />
              </h2>
              <p className="mt-3 text-ink-base">
                <I18nText k="myCoaching.weeklyLog.form.period" fallback="기간" />:{" "}
                {formatDateRange(currentWeek)}
              </p>
              <p className="mt-2 text-ink-muted">
                <I18nText k="myCoaching.weeklyLog.form.author" fallback="작성자" />{" "}
                <span className="font-medium text-ink-strong">
                  {result.data.profile.display_name ||
                    result.data.profile.full_name ||
                    result.data.profile.email ||
                    result.data.authEmail ||
                    "사용자"}
                </span>
              </p>
            </section>

            {result.data.relationships.length === 0 ? (
              <section className="mt-6 rounded-card border border-line-base bg-surface-card p-6">
                <p className="text-ink-base">
                  <I18nText
                    k="myCoaching.weeklyLog.form.noCoach"
                    fallback="아직 배정된 코치가 없습니다."
                  />
                </p>
              </section>
            ) : (
              <>
                <section className="mt-6 rounded-card border border-line-base bg-surface-card p-6">
                  <h2 className="text-lg font-semibold">
                    <I18nText
                      k="myCoaching.weeklyLog.form.myRelationships"
                      fallback="내 코칭 관계"
                    />
                  </h2>
                  <div className="mt-4 grid gap-4">
                    {result.data.relationships.map((relationship) => (
                      <div
                        className={`rounded-card border p-4 ${
                          result.data.selectedRelationshipId === relationship.id
                            ? "border-navy-900 bg-surface-sidebar-active"
                            : "border-line-base"
                        }`}
                        key={relationship.id}
                      >
                        <p className="font-medium text-ink-strong">
                          {formatPersonName(relationship.coach)}
                        </p>
                        <p className="mt-1 text-sm text-ink-muted">
                          {displayValue(relationship.coach?.email ?? null)}
                        </p>
                        <p className="mt-2 text-sm text-ink-muted">
                          {getRelationshipTypeLabel(relationship.relationshipType)} /{" "}
                          {formatScope(
                            relationship.scopeType,
                            relationship.scopeId,
                          )}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="mt-6 rounded-card border border-line-base bg-surface-card p-6">
                  {errorMessage && (
                    <div className="mb-5 rounded-control border border-red-200 bg-red-50 p-4 text-red-800">
                      {renderWeeklyLogMessage(errorMessage)}
                    </div>
                  )}
                  {successMessage && (
                    <div className="mb-5 rounded-control border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
                      {renderWeeklyLogMessage(successMessage)}
                    </div>
                  )}

                  <h2 className="text-lg font-semibold">
                    <I18nText
                      k="myCoaching.weeklyLog.form.reviewTitle"
                      fallback="주간 돌아보기"
                    />
                  </h2>
                  {result.data.weeklyLog ? (
                    <div className="mt-4 rounded-control border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                      <I18nText
                        k="myCoaching.weeklyLog.form.existingRecordNotice"
                        fallback="이번 주 기록이 있습니다. 아래 입력란에는 저장된 이번 주 기록 내용이 채워져 있습니다."
                      />
                    </div>
                  ) : null}
                  <form action={saveWeeklyLog} className="mt-5 space-y-5">
                    {result.data.relationships.length > 1 && (
                      <div>
                        <label
                          className="block text-sm font-medium text-ink-base"
                          htmlFor="relationship_id"
                        >
                          <I18nText
                            k="myCoaching.weeklyLog.form.relationship"
                            fallback="코칭 관계"
                          />
                        </label>
                        <select
                          className="mt-2 w-full rounded-control border border-line-base bg-surface-card px-3 py-2 text-ink-strong outline-none focus:border-brand-600"
                          defaultValue={result.data.selectedRelationshipId ?? ""}
                          id="relationship_id"
                          name="relationship_id"
                        >
                          {result.data.relationships.map((relationship) => (
                            <option key={relationship.id} value={relationship.id}>
                              {formatPersonName(relationship.coach)} -{" "}
                              {getRelationshipTypeLabel(
                                relationship.relationshipType,
                              )}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {result.data.relationships.length === 1 && (
                      <input
                        name="relationship_id"
                        type="hidden"
                        value={result.data.relationships[0]?.id ?? ""}
                      />
                    )}

                    <div>
                      <label
                        className="block text-sm font-medium text-ink-base"
                        htmlFor="gratitude"
                      >
                        <I18nText
                          k="myCoaching.weeklyLog.form.gratitude"
                          fallback="감사 제목"
                        />
                      </label>
                      <textarea
                        className="mt-2 min-h-28 w-full rounded-control border border-line-base bg-surface-card px-3 py-2 text-ink-strong outline-none focus:border-brand-600"
                        defaultValue={result.data.weeklyLog?.gratitude ?? ""}
                        id="gratitude"
                        maxLength={2000}
                        name="gratitude"
                      />
                    </div>

                    <div>
                      <label
                        className="block text-sm font-medium text-ink-base"
                        htmlFor="prayer_request"
                      >
                        <I18nText
                          k="myCoaching.weeklyLog.form.prayerRequest"
                          fallback="기도 제목"
                        />
                      </label>
                      <textarea
                        className="mt-2 min-h-28 w-full rounded-control border border-line-base bg-surface-card px-3 py-2 text-ink-strong outline-none focus:border-brand-600"
                        defaultValue={result.data.weeklyLog?.prayerRequest ?? ""}
                        id="prayer_request"
                        maxLength={2000}
                        name="prayer_request"
                      />
                    </div>

                    <div>
                      <label
                        className="block text-sm font-medium text-ink-base"
                        htmlFor="progress_summary"
                      >
                        <I18nText
                          k="myCoaching.weeklyLog.form.progressSummary"
                          fallback="진행 상황"
                        />
                      </label>
                      <textarea
                        className="mt-2 min-h-28 w-full rounded-control border border-line-base bg-surface-card px-3 py-2 text-ink-strong outline-none focus:border-brand-600"
                        defaultValue={
                          result.data.weeklyLog?.progressSummary ?? ""
                        }
                        id="progress_summary"
                        maxLength={2000}
                        name="progress_summary"
                      />
                    </div>

                    <div>
                      <label
                        className="block text-sm font-medium text-ink-base"
                        htmlFor="difficulty"
                      >
                        <I18nText
                          k="myCoaching.weeklyLog.form.difficulty"
                          fallback="어려웠던 점"
                        />
                      </label>
                      <textarea
                        className="mt-2 min-h-28 w-full rounded-control border border-line-base bg-surface-card px-3 py-2 text-ink-strong outline-none focus:border-brand-600"
                        defaultValue={result.data.weeklyLog?.difficulty ?? ""}
                        id="difficulty"
                        maxLength={2000}
                        name="difficulty"
                      />
                    </div>

                    <div>
                      <label
                        className="block text-sm font-medium text-ink-base"
                        htmlFor="message_to_coach"
                      >
                        <I18nText
                          k="myCoaching.weeklyLog.form.messageToCoach"
                          fallback="코치에게 남길 말"
                        />
                      </label>
                      <textarea
                        className="mt-2 min-h-28 w-full rounded-control border border-line-base bg-surface-card px-3 py-2 text-ink-strong outline-none focus:border-brand-600"
                        defaultValue={
                          result.data.weeklyLog?.messageToCoach ?? ""
                        }
                        id="message_to_coach"
                        maxLength={2000}
                        name="message_to_coach"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        className="rounded-control border border-line-base px-5 py-2.5 font-medium text-ink-base"
                        name="intent"
                        type="submit"
                        value="draft"
                      >
                        <I18nText
                          k="myCoaching.weeklyLog.form.saveDraft"
                          fallback="임시 저장"
                        />
                      </button>
                      <button
                        className="rounded-control bg-navy-900 px-5 py-2.5 font-medium text-white"
                        name="intent"
                        type="submit"
                        value="submitted"
                      >
                        <I18nText
                          k="myCoaching.weeklyLog.form.submit"
                          fallback="주간 기록 제출"
                        />
                      </button>
                    </div>
                  </form>

                  {result.data.weeklyLog ? (
                    <form action={removeWeeklyLog} className="mt-4">
                      <input
                        name="weekly_log_id"
                        type="hidden"
                        value={result.data.weeklyLog.id}
                      />
                      <input
                        name="relationship_id"
                        type="hidden"
                        value={result.data.selectedRelationshipId ?? ""}
                      />
                      <button
                        className="rounded-control border border-red-200 bg-surface-card px-5 py-2.5 font-medium text-red-700"
                        type="submit"
                      >
                        <I18nText
                          k="myCoaching.weeklyLog.form.removeFromList"
                          fallback="목록에서 제거"
                        />
                      </button>
                    </form>
                  ) : null}
                </section>

                <section className="mt-6 rounded-card border border-line-base bg-surface-card p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold">
                        <I18nText
                          k="myCoaching.weeklyLog.form.myWeeklyLogs"
                          fallback="나의 주간 기록"
                        />
                      </h2>
                      <p className="mt-2 text-sm text-ink-muted">
                        <I18nText
                          k="myCoaching.weeklyLog.form.myWeeklyLogsDescription"
                          fallback="현재 선택한 코칭 관계의 주간 기록을 최신순으로 확인합니다."
                        />
                      </p>
                    </div>
                    <p className="rounded-full border border-line-base bg-surface-sunken px-3 py-1 text-sm text-ink-muted">
                      <I18nText k="myCoaching.weeklyLog.form.total" fallback="전체" />{" "}
                      {result.data.weeklyLogs.length}
                      <I18nText k="myCoaching.weeklyLog.form.countSuffix" fallback="개" />
                    </p>
                  </div>

                  {result.data.weeklyLogs.length === 0 ? (
                    <div className="mt-5 rounded-control border border-line-base bg-surface-sunken p-4 text-sm text-ink-muted">
                      <I18nText
                        k="myCoaching.weeklyLog.form.empty"
                        fallback="아직 작성한 주간 기록이 없습니다."
                      />
                    </div>
                  ) : (
                    <div className="mt-5 space-y-4">
                      {result.data.weeklyLogs.map((weeklyLog) => (
                        <article
                          className="rounded-card border border-line-base bg-surface-sunken p-4"
                          key={weeklyLog.id}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-ink-faint">
                                <I18nText
                                  k="myCoaching.weeklyLog.form.weeklyPeriod"
                                  fallback="주간 기간"
                                />
                              </p>
                              <h3 className="mt-1 font-semibold text-ink-strong">
                                {formatDateRange({
                                  weekStart: weeklyLog.weekStart,
                                  weekEnd: weeklyLog.weekEnd,
                                })}
                              </h3>
                            </div>
                            <span
                              className={`rounded-full border px-3 py-1 text-xs font-medium ${getWeeklyLogStatusClass(
                                weeklyLog.status,
                              )}`}
                            >
                              {getWeeklyLogStatusLabel(weeklyLog.status)}
                            </span>
                          </div>

                          <dl className="mt-4 grid gap-4 text-sm">
                            <div>
                              <dt className="font-medium text-ink-faint">
                                <I18nText
                                  k="myCoaching.weeklyLog.form.gratitudeContent"
                                  fallback="감사 내용"
                                />
                              </dt>
                              <dd className="mt-1 whitespace-pre-wrap text-ink-base">
                                {displayValue(weeklyLog.gratitude)}
                              </dd>
                            </div>
                            <div>
                              <dt className="font-medium text-ink-faint">
                                <I18nText
                                  k="myCoaching.weeklyLog.form.prayerRequest"
                                  fallback="기도 제목"
                                />
                              </dt>
                              <dd className="mt-1 whitespace-pre-wrap text-ink-base">
                                {displayValue(weeklyLog.prayerRequest)}
                              </dd>
                            </div>
                            <div>
                              <dt className="font-medium text-ink-faint">
                                <I18nText
                                  k="myCoaching.weeklyLog.form.progressSummary"
                                  fallback="진행 요약"
                                />
                              </dt>
                              <dd className="mt-1 whitespace-pre-wrap text-ink-base">
                                {displayValue(weeklyLog.progressSummary)}
                              </dd>
                            </div>
                            <div>
                              <dt className="font-medium text-ink-faint">
                                <I18nText
                                  k="myCoaching.weeklyLog.form.difficulty"
                                  fallback="어려웠던 점"
                                />
                              </dt>
                              <dd className="mt-1 whitespace-pre-wrap text-ink-base">
                                {displayValue(weeklyLog.difficulty)}
                              </dd>
                            </div>
                            <div>
                              <dt className="font-medium text-ink-faint">
                                <I18nText
                                  k="myCoaching.weeklyLog.form.coachMessage"
                                  fallback="코치에게 남긴 메시지"
                                />
                              </dt>
                              <dd className="mt-1 whitespace-pre-wrap text-ink-base">
                                {displayValue(weeklyLog.messageToCoach)}
                              </dd>
                            </div>
                          </dl>

                          <dl className="mt-4 grid gap-3 border-t border-line-soft pt-4 text-xs text-ink-muted sm:grid-cols-3">
                            <div>
                              <dt className="font-medium">
                                <I18nText
                                  k="myCoaching.weeklyLog.form.submittedAt"
                                  fallback="제출일"
                                />
                              </dt>
                              <dd className="mt-1">
                                {formatDateTime(weeklyLog.submittedAt)}
                              </dd>
                            </div>
                            <div>
                              <dt className="font-medium">
                                <I18nText
                                  k="myCoaching.weeklyLog.form.createdAt"
                                  fallback="작성일"
                                />
                              </dt>
                              <dd className="mt-1">
                                {formatDateTime(weeklyLog.createdAt)}
                              </dd>
                            </div>
                            <div>
                              <dt className="font-medium">
                                <I18nText
                                  k="myCoaching.weeklyLog.form.updatedAt"
                                  fallback="수정일"
                                />
                              </dt>
                              <dd className="mt-1">
                                {formatDateTime(weeklyLog.updatedAt)}
                              </dd>
                            </div>
                          </dl>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}
          </>
        )}
      </section>
    </main>
  );
}
