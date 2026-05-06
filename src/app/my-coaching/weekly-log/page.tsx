import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/getSession";
import {
  getCurrentWeekRange,
  getMyWeeklyLogPageData,
  saveMyWeeklyLog,
} from "@/lib/api/my-coaching/weekly-log";
import { formatScope, getRelationshipTypeLabel } from "@/lib/ui/labels";

export const dynamic = "force-dynamic";

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

  const currentWeek = result.ok ? result.data.currentWeek : getCurrentWeekRange();

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
      <section className="mx-auto w-full max-w-5xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
              코칭
            </p>
            <h1 className="mt-3 text-3xl font-semibold">주간 기록</h1>
            <p className="mt-3 max-w-3xl text-slate-600">
              이번 주 코칭 관계에 대한 기록을 작성합니다.
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 text-sm">
            <Link
              className="font-medium text-slate-700 underline"
              href="/my-coaching"
            >
              내 코칭 공간으로 돌아가기
            </Link>
            <Link
              className="font-medium text-slate-700 underline"
              href="/dashboard"
            >
              대시보드로 돌아가기
            </Link>
          </div>
        </div>

        {!result.ok ? (
          <section className="mt-8 rounded-md border border-red-200 bg-red-50 p-4 text-red-800">
            지금 주간 기록을 불러올 수 없습니다.
          </section>
        ) : result.data.profile === null ? (
          <section className="mt-8 rounded-md border border-slate-200 bg-white p-6">
            <p className="text-slate-700">아직 프로필이 생성되지 않았습니다.</p>
            <p className="mt-2 text-slate-600">
              초대를 받으셨다면 먼저 초대를 수락해 주세요.
            </p>
            <div className="mt-4">
              <Link
                className="text-sm font-medium text-slate-700 underline"
                href="/profile"
              >
                프로필 보기
              </Link>
            </div>
          </section>
        ) : (
          <>
            <section className="mt-8 rounded-md border border-slate-200 bg-white p-6">
              <h2 className="text-lg font-semibold">이번 주</h2>
              <p className="mt-3 text-slate-700">
                기간: {formatDateRange(currentWeek)}
              </p>
              <p className="mt-2 text-slate-600">
                작성자{" "}
                <span className="font-medium text-slate-950">
                  {result.data.profile.display_name ||
                    result.data.profile.full_name ||
                    result.data.profile.email ||
                    result.data.authEmail ||
                    "사용자"}
                </span>
              </p>
            </section>

            {result.data.relationships.length === 0 ? (
              <section className="mt-6 rounded-md border border-slate-200 bg-white p-6">
                <p className="text-slate-700">아직 배정된 코치가 없습니다.</p>
              </section>
            ) : (
              <>
                <section className="mt-6 rounded-md border border-slate-200 bg-white p-6">
                  <h2 className="text-lg font-semibold">내 코칭 관계</h2>
                  <div className="mt-4 grid gap-4">
                    {result.data.relationships.map((relationship) => (
                      <div
                        className={`rounded-md border p-4 ${
                          result.data.selectedRelationshipId === relationship.id
                            ? "border-slate-900 bg-slate-50"
                            : "border-slate-200"
                        }`}
                        key={relationship.id}
                      >
                        <p className="font-medium text-slate-950">
                          {formatPersonName(relationship.coach)}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          {displayValue(relationship.coach?.email ?? null)}
                        </p>
                        <p className="mt-2 text-sm text-slate-600">
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

                <section className="mt-6 rounded-md border border-slate-200 bg-white p-6">
                  {errorMessage && (
                    <div className="mb-5 rounded-md border border-red-200 bg-red-50 p-4 text-red-800">
                      {errorMessage}
                    </div>
                  )}
                  {successMessage && (
                    <div className="mb-5 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
                      {successMessage}
                    </div>
                  )}

                  <h2 className="text-lg font-semibold">주간 돌아보기</h2>
                  <form action={saveWeeklyLog} className="mt-5 space-y-5">
                    {result.data.relationships.length > 1 && (
                      <div>
                        <label
                          className="block text-sm font-medium text-slate-700"
                          htmlFor="relationship_id"
                        >
                          코칭 관계
                        </label>
                        <select
                          className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-950 outline-none focus:border-slate-700"
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
                        className="block text-sm font-medium text-slate-700"
                        htmlFor="gratitude"
                      >
                        감사 제목
                      </label>
                      <textarea
                        className="mt-2 min-h-28 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-950 outline-none focus:border-slate-700"
                        defaultValue={result.data.weeklyLog?.gratitude ?? ""}
                        id="gratitude"
                        maxLength={2000}
                        name="gratitude"
                      />
                    </div>

                    <div>
                      <label
                        className="block text-sm font-medium text-slate-700"
                        htmlFor="prayer_request"
                      >
                        기도 제목
                      </label>
                      <textarea
                        className="mt-2 min-h-28 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-950 outline-none focus:border-slate-700"
                        defaultValue={result.data.weeklyLog?.prayerRequest ?? ""}
                        id="prayer_request"
                        maxLength={2000}
                        name="prayer_request"
                      />
                    </div>

                    <div>
                      <label
                        className="block text-sm font-medium text-slate-700"
                        htmlFor="progress_summary"
                      >
                        진행 상황
                      </label>
                      <textarea
                        className="mt-2 min-h-28 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-950 outline-none focus:border-slate-700"
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
                        className="block text-sm font-medium text-slate-700"
                        htmlFor="difficulty"
                      >
                        어려웠던 점
                      </label>
                      <textarea
                        className="mt-2 min-h-28 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-950 outline-none focus:border-slate-700"
                        defaultValue={result.data.weeklyLog?.difficulty ?? ""}
                        id="difficulty"
                        maxLength={2000}
                        name="difficulty"
                      />
                    </div>

                    <div>
                      <label
                        className="block text-sm font-medium text-slate-700"
                        htmlFor="message_to_coach"
                      >
                        코치에게 남길 말
                      </label>
                      <textarea
                        className="mt-2 min-h-28 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-950 outline-none focus:border-slate-700"
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
                        className="rounded-md border border-slate-300 px-5 py-2.5 font-medium text-slate-700"
                        name="intent"
                        type="submit"
                        value="draft"
                      >
                        임시 저장
                      </button>
                      <button
                        className="rounded-md bg-slate-950 px-5 py-2.5 font-medium text-white"
                        name="intent"
                        type="submit"
                        value="submitted"
                      >
                        주간 기록 제출
                      </button>
                    </div>
                  </form>
                </section>
              </>
            )}
          </>
        )}
      </section>
    </main>
  );
}
