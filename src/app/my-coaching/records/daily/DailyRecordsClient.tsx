"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/useI18n";
import { Badge } from "@/components/ui/Badge";
import { getClientTimezone, getTodayDateInTimezone } from "@/lib/timezone";
import { isValidDate } from "@/lib/validation/common";

type DailyRecordStatus = "draft" | "submitted" | "reviewed";
type DailyRecordVisibility = "private" | "coach";
type DailySortKey = "record_date" | "created_at" | "updated_at" | "status";
type SortDirection = "asc" | "desc";
type StatusFilter = "all" | DailyRecordStatus;
type VisibilityFilter = "all" | DailyRecordVisibility;

type DailyRecord = {
  id: string;
  record_date: string;
  title: string | null;
  reflection: string | null;
  practice: string | null;
  prayer_request: string | null;
  visibility: DailyRecordVisibility;
  shared_with_coach: boolean;
  status: DailyRecordStatus;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
};

type FormState = {
  record_date: string;
  title: string;
  gratitude: string;
  reflection: string;
  practice: string;
  prayer_request: string;
  visibility: DailyRecordVisibility;
  shared_with_coach: boolean;
  status: DailyRecordStatus;
};

function createInitialFormState(): FormState {
  const timezone = getClientTimezone();

  return {
    record_date: getTodayDateInTimezone(timezone),
    title: "",
    gratitude: "",
    reflection: "",
    practice: "",
    prayer_request: "",
    visibility: "private",
    shared_with_coach: false,
    status: "draft",
  };
}

const statusLabelMeta: Record<DailyRecordStatus, { fallback: string; key: string }> = {
  draft: {
    fallback: "임시저장",
    key: "myCoaching.records.dailyPage.form.status.draft",
  },
  reviewed: {
    fallback: "검토완료",
    key: "myCoaching.records.dailyPage.form.status.reviewed",
  },
  submitted: {
    fallback: "제출",
    key: "myCoaching.records.dailyPage.form.status.submitted",
  },
};

const visibilityLabelMeta: Record<DailyRecordVisibility, { fallback: string; key: string }> = {
  coach: {
    fallback: "코치에게 공유",
    key: "myCoaching.records.dailyPage.form.visibility.coach",
  },
  private: {
    fallback: "나만 보기",
    key: "myCoaching.records.dailyPage.form.visibility.private",
  },
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

function displayText(value: string | null) {
  return value && value.trim().length > 0 ? value : "-";
}

function normalizeSearch(value: string | null) {
  return (value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

function getDateTimeValue(value: string | null) {
  if (!value) {
    return 0;
  }

  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function getStatusLabel(status: string, t: (key: string, fallback?: string) => string) {
  if (status in statusLabelMeta) {
    const label = statusLabelMeta[status as DailyRecordStatus];
    return t(label.key, label.fallback);
  }

  return t("myCoaching.records.dailyPage.form.status.unknown", "확인 필요");
}

function getVisibilityLabel(
  visibility: string,
  t: (key: string, fallback?: string) => string,
) {
  if (visibility in visibilityLabelMeta) {
    const label = visibilityLabelMeta[visibility as DailyRecordVisibility];
    return t(label.key, label.fallback);
  }

  return t("myCoaching.records.dailyPage.form.visibility.unknown", "미지정");
}

function getStatusSortLabel(status: string) {
  if (status in statusLabelMeta) {
    return statusLabelMeta[status as DailyRecordStatus].fallback;
  }

  return "확인 필요";
}

function toNullableText(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function buildReflectionWithGratitude(gratitude: string, reflection: string) {
  const gratitudeText = gratitude.trim();
  const reflectionText = reflection.trim();

  if (gratitudeText.length === 0 && reflectionText.length === 0) {
    return null;
  }

  if (gratitudeText.length === 0) {
    return reflectionText;
  }

  if (reflectionText.length === 0) {
    return `감사한 일: ${gratitudeText}`;
  }

  return `감사한 일: ${gratitudeText}\n\n오늘 배운 점: ${reflectionText}`;
}

function getErrorMessage(payload: unknown, fallback: string) {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "message" in payload &&
    typeof payload.message === "string"
  ) {
    return payload.message;
  }

  return fallback;
}

function getDeleteErrorMessage(
  status: number,
  payload: unknown,
  t: (key: string, fallback?: string) => string,
) {
  if (status === 400) {
    return t("myCoaching.records.dailyPage.form.errors.invalidId", "하루 기록 ID를 확인할 수 없습니다.");
  }

  if (status === 401) {
    return t("myCoaching.records.dailyPage.form.errors.loginRequired", "로그인이 필요합니다.");
  }

  if (status === 403) {
    return t("myCoaching.records.dailyPage.form.errors.forbidden", "이 하루 기록에 접근할 권한이 없습니다.");
  }

  if (status === 404) {
    return t("myCoaching.records.dailyPage.form.errors.notFound", "하루 기록을 찾을 수 없습니다.");
  }

  if (status === 500) {
    return t("myCoaching.records.dailyPage.form.errors.processFailed", "하루 기록 처리에 실패했습니다.");
  }

  return getErrorMessage(payload, t("myCoaching.records.dailyPage.form.errors.processFailed", "하루 기록 처리에 실패했습니다."));
}

function toFormState(record: DailyRecord): FormState {
  return {
    record_date: record.record_date,
    title: record.title ?? "",
    gratitude: "",
    reflection: record.reflection ?? "",
    practice: record.practice ?? "",
    prayer_request: record.prayer_request ?? "",
    visibility: record.visibility,
    shared_with_coach: record.shared_with_coach,
    status: record.status,
  };
}

export function DailyRecordsClient({
  mode = "full",
  returnTo,
  initialRecords,
}: {
  mode?: "full" | "today";
  returnTo?: string;
  initialRecords?: DailyRecord[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const [records, setRecords] = useState<DailyRecord[]>(initialRecords ?? []);
  const [form, setForm] = useState<FormState>(() => createInitialFormState());
  const [editingId, setEditingId] = useState<string | null>(null);
  const editParamHandled = useRef(false);
  const [isLoading, setIsLoading] = useState(initialRecords === undefined);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [visibilityFilter, setVisibilityFilter] =
    useState<VisibilityFilter>("all");
  const [sortKey, setSortKey] = useState<DailySortKey>("record_date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const editingRecord = useMemo(
    () => records.find((record) => record.id === editingId) ?? null,
    [editingId, records],
  );

  const visibleRecords = useMemo(() => {
    const normalizedQuery = normalizeSearch(searchQuery);

    const filteredRecords = records.filter((record) => {
      const matchesSearch =
        normalizedQuery.length === 0 ||
        [
          record.title,
          record.reflection,
          record.practice,
          record.prayer_request,
        ].some((value) => normalizeSearch(value).includes(normalizedQuery));
      const matchesStatus =
        statusFilter === "all" || record.status === statusFilter;
      const matchesVisibility =
        visibilityFilter === "all" || record.visibility === visibilityFilter;

      return matchesSearch && matchesStatus && matchesVisibility;
    });

    return [...filteredRecords].sort((first, second) => {
      let comparison = 0;

      if (sortKey === "status") {
        comparison = getStatusSortLabel(first.status).localeCompare(
          getStatusSortLabel(second.status),
          "ko-KR",
        );
      } else {
        comparison =
          getDateTimeValue(first[sortKey]) - getDateTimeValue(second[sortKey]);
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [records, searchQuery, sortDirection, sortKey, statusFilter, visibilityFilter]);

  async function loadRecords() {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/my-coaching/records/daily", {
        cache: "no-store",
      });
      const payload: unknown = await response.json();

      if (!response.ok) {
        throw new Error(
          getErrorMessage(payload, t("myCoaching.records.dailyPage.form.errors.loadFailed", "하루 기록 목록을 불러오지 못했습니다.")),
        );
      }

      const nextRecords =
        typeof payload === "object" &&
        payload !== null &&
        "records" in payload &&
        Array.isArray(payload.records)
          ? (payload.records as DailyRecord[])
          : [];
      setRecords(nextRecords);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : t("myCoaching.records.dailyPage.form.errors.loadFailed", "하루 기록 목록을 불러오지 못했습니다."),
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (initialRecords !== undefined) {
      return;
    }

    void loadRecords();
  }, [initialRecords]);

  useEffect(() => {
    const editId = searchParams.get("edit");
    if (!editId || editParamHandled.current || records.length === 0) return;
    const target = records.find((r) => r.id === editId);
    if (!target) return;
    editParamHandled.current = true;
    startEdit(target);
  }, [searchParams, records]);

  function resetForm() {
    setForm(createInitialFormState());
    setEditingId(null);
  }

  function resetListFilters() {
    setSearchQuery("");
    setStatusFilter("all");
    setVisibilityFilter("all");
    setSortKey("record_date");
    setSortDirection("desc");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setErrorMessage(null);

    if (!isValidDate(form.record_date)) {
      setErrorMessage(t("myCoaching.records.dailyPage.form.errors.invalidDate", "올바른 기록 날짜를 선택해 주세요."));
      return;
    }

    setIsSaving(true);

    const payload = {
      record_date: form.record_date,
      title: toNullableText(form.title),
      reflection: buildReflectionWithGratitude(form.gratitude, form.reflection),
      practice: toNullableText(form.practice),
      prayer_request: toNullableText(form.prayer_request),
      visibility: form.visibility,
      shared_with_coach: form.shared_with_coach,
      status: form.status,
    };

    try {
      const url = editingId
        ? `/api/my-coaching/records/daily/${editingId}`
        : "/api/my-coaching/records/daily";
      const response = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const responsePayload: unknown = await response.json();

      if (!response.ok) {
        throw new Error(
          getErrorMessage(
            responsePayload,
            editingId
              ? t("myCoaching.records.dailyPage.form.errors.updateFailed", "하루 기록 수정에 실패했습니다.")
              : t("myCoaching.records.dailyPage.form.errors.saveFailed", "하루 기록 저장에 실패했습니다."),
          ),
        );
      }

      setMessage(
        editingId
          ? t("myCoaching.records.dailyPage.form.updated", "하루 기록이 수정되었습니다.")
          : t("myCoaching.records.dailyPage.form.saved", "하루 기록이 저장되었습니다."),
      );
      resetForm();
      if (mode === "today" && !editingId && returnTo) {
        router.push(returnTo);
        return;
      }
      await loadRecords();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : editingId
            ? t("myCoaching.records.dailyPage.form.errors.updateFailed", "하루 기록 수정에 실패했습니다.")
            : t("myCoaching.records.dailyPage.form.errors.saveFailed", "하루 기록 저장에 실패했습니다."),
      );
    } finally {
      setIsSaving(false);
    }
  }

  function startEdit(record: DailyRecord) {
    setEditingId(record.id);
    setForm(toFormState(record));
    setMessage(null);
    setErrorMessage(null);
  }

  async function removeRecord(record: DailyRecord) {
    setMessage(null);
    setErrorMessage(null);

    if (!record.id || record.id.trim().length === 0) {
      setErrorMessage(t("myCoaching.records.dailyPage.form.errors.notFound", "하루 기록을 찾을 수 없습니다."));
      return;
    }

    const confirmed = window.confirm(
      `${t("myCoaching.records.dailyPage.form.deleteConfirm", "하루 기록을 삭제하시겠습니까?")}\n\n${t("myCoaching.records.dailyPage.form.recordDate", "기록 날짜")}: ${formatDate(
        record.record_date,
      )}\n${t("myCoaching.records.dailyPage.form.deleteIrreversible", "이 작업은 되돌릴 수 없습니다.")}`,
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(record.id);

    try {
      const response = await fetch(
        `/api/my-coaching/records/daily/${record.id}`,
        {
          method: "DELETE",
        },
      );
      const payload: unknown = await response.json();

      if (!response.ok) {
        throw new Error(getDeleteErrorMessage(response.status, payload, t));
      }

      if (editingId === record.id) {
        resetForm();
      }

      setRecords((currentRecords) =>
        currentRecords.filter((currentRecord) => currentRecord.id !== record.id),
      );
      setErrorMessage(null);
      setMessage(t("myCoaching.records.dailyPage.form.removed", "하루 기록이 목록에서 제거되었습니다."));
      void loadRecords();
    } catch (error) {
      setMessage(null);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : t("myCoaching.records.dailyPage.form.errors.processFailed", "하루 기록 처리에 실패했습니다."),
      );
    } finally {
      setDeletingId(null);
    }
  }

  if (mode === "today") {
    return (
      <div className="mt-5">
        <section className="rounded-card border border-line-base bg-surface-card p-4">
          {message ? (
            <div className="mb-3 rounded-control border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              {message}
            </div>
          ) : null}
          {errorMessage ? (
            <div className="mb-3 rounded-control border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {errorMessage}
            </div>
          ) : null}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <p className="text-xs leading-5 text-ink-muted">
              오늘 하루를 짧게 돌아보며 남겨보세요. 한두 줄이면 충분해요. 남긴 내용은 코치와의 다음 코칭 준비에 쓰여요.
            </p>
            <div className="rounded-card border border-line-soft bg-surface-card p-3">
              <label className="text-sm font-medium text-ink-base" htmlFor="title">
                {t("myCoaching.records.dailyPage.form.title", "제목")}{" "}
                <span className="font-normal text-ink-muted">(선택)</span>
              </label>
              <input
                className="mt-1 w-full rounded-control border border-line-base px-3 py-2 text-sm"
                id="title"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                placeholder={t(
                  "myCoaching.records.dailyPage.form.titlePlaceholder",
                  "오늘 기록의 제목",
                )}
                type="text"
                value={form.title}
              />
            </div>
            <div className="rounded-card border border-line-soft bg-surface-card p-3">
              <label className="text-sm font-medium text-ink-base" htmlFor="gratitude">
                감사한 일
              </label>
              <textarea
                className="mt-1 min-h-20 w-full rounded-control border border-line-base px-3 py-2 text-sm"
                id="gratitude"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    gratitude: event.target.value,
                  }))
                }
                placeholder="오늘 감사했던 일을 한두 줄로 적어보세요. 예) 말씀 묵상 시간을 지킬 수 있어 감사했어요."
                value={form.gratitude}
              />
            </div>

            <div className="rounded-card border border-line-soft bg-surface-card p-3">
              <label className="text-sm font-medium text-ink-base" htmlFor="reflection">
                오늘 배운 점
              </label>
              <textarea
                className="mt-1 min-h-24 w-full rounded-control border border-line-base px-3 py-2 text-sm"
                id="reflection"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    reflection: event.target.value,
                  }))
                }
                placeholder="오늘 새롭게 배운 점을 짧게 남겨보세요."
                value={form.reflection}
              />
            </div>

            <details className="rounded-card border border-line-base bg-surface-card">
              <summary className="cursor-pointer list-none px-3 py-2.5 text-sm font-medium text-ink-base">
                기도 제목 · 실행 메모 더 남기기 (선택)
              </summary>
              <div className="space-y-4 px-3 pb-3 pt-1">
            <div>
              <label className="text-sm font-medium text-ink-base" htmlFor="prayer_request">
                기도 제목
              </label>
              <textarea
                className="mt-1 min-h-20 w-full rounded-control border border-line-base px-3 py-2 text-sm"
                id="prayer_request"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    prayer_request: event.target.value,
                  }))
                }
                placeholder="기도가 필요한 내용을 적어보세요."
                value={form.prayer_request}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-ink-base" htmlFor="practice">
                실행 메모
              </label>
              <textarea
                className="mt-1 min-h-20 w-full rounded-control border border-line-base px-3 py-2 text-sm"
                id="practice"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    practice: event.target.value,
                  }))
                }
                placeholder="오늘 바로 실천할 한 가지를 적어보세요."
                value={form.practice}
              />
            </div>

              </div>
            </details>

            <div className="rounded-control border border-line-soft bg-surface-sunken p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-ink-base">코치에게 공유</p>
                  <p className="text-xs text-ink-muted">코치가 이 기록을 볼 수 있어요.</p>
                </div>
                <button
                  aria-label={form.shared_with_coach ? "공유 켬" : "공유 끔"}
                  className={`relative inline-flex h-8 w-14 items-center rounded-full transition ${
                    form.shared_with_coach ? "bg-brand-600" : "bg-ink-faint"
                  }`}
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      shared_with_coach: !current.shared_with_coach,
                      visibility: !current.shared_with_coach ? "coach" : "private",
                    }))
                  }
                  type="button"
                >
                  <span
                    className={`inline-block h-6 w-6 transform rounded-full bg-surface-card transition ${
                      form.shared_with_coach ? "translate-x-7" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>

            <button
              className="w-full rounded-control bg-brand-600 px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isSaving}
              type="submit"
            >
              {isSaving ? "저장 중..." : "오늘 기록 저장"}
            </button>
          </form>
        </section>
      </div>
    );
  }

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <section className="rounded-card border border-line-base bg-surface-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">
              {editingRecord
                ? t("myCoaching.records.dailyPage.form.editTitle", "하루 기록 수정")
                : t("myCoaching.records.dailyPage.form.createTitle", "하루 기록 작성")}
            </h2>
            <p className="mt-2 text-sm text-ink-muted">
              {t(
                "myCoaching.records.dailyPage.form.description",
                "기록 날짜와 오늘의 돌아봄을 남겨 주세요.",
              )}
            </p>
          </div>
          {editingRecord ? (
            <button
              className="rounded-control border border-line-base px-3 py-2 text-sm font-medium text-ink-base"
            onClick={resetForm}
            type="button"
          >
              {t("myCoaching.records.dailyPage.form.cancelEdit", "수정 취소")}
            </button>
          ) : null}
        </div>

        {message ? (
          <div className="mt-4 rounded-control border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            {message}
          </div>
        ) : null}
        {errorMessage ? (
          <div className="mt-4 rounded-control border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {errorMessage}
          </div>
        ) : null}

        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label
              className="text-sm font-medium text-ink-base"
              htmlFor="record_date"
            >
              {t("myCoaching.records.dailyPage.form.recordDate", "기록 날짜")}
            </label>
            <input
              className="mt-1 w-full rounded-control border border-line-base px-3 py-2 text-sm"
              id="record_date"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  record_date: event.target.value,
                }))
              }
              type="date"
              value={form.record_date}
            />
          </div>

          <div>
            <label
              className="text-sm font-medium text-ink-base"
              htmlFor="title"
            >
              {t("myCoaching.records.dailyPage.form.title", "제목")}
            </label>
            <input
              className="mt-1 w-full rounded-control border border-line-base px-3 py-2 text-sm"
              id="title"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
              placeholder={t(
                "myCoaching.records.dailyPage.form.titlePlaceholder",
                "오늘 기록의 제목",
              )}
              type="text"
              value={form.title}
            />
          </div>

          <div>
            <label
              className="text-sm font-medium text-ink-base"
              htmlFor="gratitude"
            >
              감사한 일
            </label>
            <textarea
              className="mt-1 min-h-20 w-full rounded-control border border-line-base px-3 py-2 text-sm"
              id="gratitude"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  gratitude: event.target.value,
                }))
              }
              placeholder="오늘 감사했던 일을 짧게 적어보세요."
              value={form.gratitude}
            />
          </div>

          <div>
            <label
              className="text-sm font-medium text-ink-base"
              htmlFor="reflection"
            >
              오늘 배운 점
            </label>
            <textarea
              className="mt-1 min-h-28 w-full rounded-control border border-line-base px-3 py-2 text-sm"
              id="reflection"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  reflection: event.target.value,
                }))
              }
              value={form.reflection}
            />
          </div>

          <div>
            <label
              className="text-sm font-medium text-ink-base"
              htmlFor="practice"
            >
              실행 메모
            </label>
            <textarea
              className="mt-1 min-h-24 w-full rounded-control border border-line-base px-3 py-2 text-sm"
              id="practice"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  practice: event.target.value,
                }))
              }
              value={form.practice}
            />
          </div>

          <div>
            <label
              className="text-sm font-medium text-ink-base"
              htmlFor="prayer_request"
            >
              기도 제목
            </label>
            <textarea
              className="mt-1 min-h-24 w-full rounded-control border border-line-base px-3 py-2 text-sm"
              id="prayer_request"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  prayer_request: event.target.value,
                }))
              }
              value={form.prayer_request}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                className="text-sm font-medium text-ink-base"
                htmlFor="visibility"
              >
                {t("myCoaching.records.dailyPage.form.visibility.label", "공유 옵션")}
              </label>
              <select
                className="mt-1 w-full rounded-control border border-line-base px-3 py-2 text-sm"
                id="visibility"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    visibility: event.target.value as DailyRecordVisibility,
                    shared_with_coach: event.target.value === "coach",
                  }))
                }
                value={form.visibility}
              >
                <option value="private">
                  {t("myCoaching.records.dailyPage.form.visibility.private", "나만 보기")}
                </option>
                <option value="coach">
                  {t("myCoaching.records.dailyPage.form.visibility.coach", "코치에게 공유")}
                </option>
              </select>
            </div>

            <div>
              <label
                className="text-sm font-medium text-ink-base"
                htmlFor="status"
              >
                {t("myCoaching.records.dailyPage.form.status.label", "상태")}
              </label>
              <select
                className="mt-1 w-full rounded-control border border-line-base px-3 py-2 text-sm"
                id="status"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    status: event.target.value as DailyRecordStatus,
                  }))
                }
                value={form.status}
              >
                <option value="draft">
                  {t("myCoaching.records.dailyPage.form.status.draft", "임시저장")}
                </option>
                <option value="submitted">
                  {t("myCoaching.records.dailyPage.form.status.submitted", "제출")}
                </option>
                <option disabled value="reviewed">
                  {t("myCoaching.records.dailyPage.form.status.reviewed", "검토완료")}
                </option>
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-ink-base">
            <input
              checked={form.shared_with_coach}
              className="h-4 w-4 rounded border-line-base"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  shared_with_coach: event.target.checked,
                  visibility: event.target.checked ? "coach" : current.visibility,
                }))
              }
              type="checkbox"
            />
            코치에게 공유 (코치가 이 기록을 볼 수 있어요)
          </label>

          <button
            className="w-full rounded-control bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isSaving}
            type="submit"
          >
            {isSaving
              ? t("myCoaching.records.dailyPage.form.saving", "저장 중...")
              : editingRecord
                ? t("myCoaching.records.dailyPage.form.update", "하루 기록 수정")
                : t("myCoaching.records.dailyPage.form.save", "하루 기록 저장")}
          </button>
        </form>
      </section>

      <section className="rounded-card border border-line-base bg-surface-card p-6">
        <div>
          <h2 className="text-lg font-semibold">
            {t("myCoaching.records.dailyPage.form.listTitle", "나의 하루 기록 목록")}
          </h2>
          <p className="mt-2 text-sm text-ink-muted">
            {t(
              "myCoaching.records.dailyPage.form.listDescription",
              "최신 기록 날짜순으로 표시됩니다.",
            )}
          </p>
        </div>

        <div className="mt-4 grid gap-3 rounded-control border border-line-base bg-surface-sunken p-4">
          <div>
            <label
              className="text-sm font-medium text-ink-base"
              htmlFor="daily-search"
            >
              {t("myCoaching.records.dailyPage.form.search", "검색")}
            </label>
            <input
              className="mt-1 w-full rounded-control border border-line-base px-3 py-2 text-sm"
              id="daily-search"
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t(
                "myCoaching.records.dailyPage.form.searchPlaceholder",
                "제목, 돌아봄, 실천/적용, 기도제목 검색",
              )}
              type="search"
              value={searchQuery}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label
                className="text-sm font-medium text-ink-base"
                htmlFor="daily-status-filter"
              >
                {t("myCoaching.records.dailyPage.form.status.label", "상태")}
              </label>
              <select
                className="mt-1 w-full rounded-control border border-line-base px-3 py-2 text-sm"
                id="daily-status-filter"
                onChange={(event) =>
                  setStatusFilter(event.target.value as StatusFilter)
                }
                value={statusFilter}
              >
                <option value="all">
                  {t("myCoaching.records.dailyPage.form.all", "전체")}
                </option>
                <option value="draft">
                  {t("myCoaching.records.dailyPage.form.status.draft", "임시저장")}
                </option>
                <option value="submitted">
                  {t("myCoaching.records.dailyPage.form.status.submitted", "제출")}
                </option>
                <option value="reviewed">
                  {t("myCoaching.records.dailyPage.form.status.reviewed", "검토완료")}
                </option>
              </select>
            </div>

            <div>
              <label
                className="text-sm font-medium text-ink-base"
                htmlFor="daily-visibility-filter"
              >
                {t("myCoaching.records.dailyPage.form.visibility.filterLabel", "공유")}
              </label>
              <select
                className="mt-1 w-full rounded-control border border-line-base px-3 py-2 text-sm"
                id="daily-visibility-filter"
                onChange={(event) =>
                  setVisibilityFilter(event.target.value as VisibilityFilter)
                }
                value={visibilityFilter}
              >
                <option value="all">
                  {t("myCoaching.records.dailyPage.form.all", "전체")}
                </option>
                <option value="private">
                  {t("myCoaching.records.dailyPage.form.visibility.private", "나만 보기")}
                </option>
                <option value="coach">
                  {t("myCoaching.records.dailyPage.form.visibility.coach", "코치에게 공유")}
                </option>
              </select>
            </div>

            <div>
              <label
                className="text-sm font-medium text-ink-base"
                htmlFor="daily-sort-key"
              >
                {t("myCoaching.records.dailyPage.form.sortBy", "정렬 기준")}
              </label>
              <select
                className="mt-1 w-full rounded-control border border-line-base px-3 py-2 text-sm"
                id="daily-sort-key"
                onChange={(event) =>
                  setSortKey(event.target.value as DailySortKey)
                }
                value={sortKey}
              >
                <option value="record_date">
                  {t("myCoaching.records.dailyPage.form.recordDate", "기록 날짜")}
                </option>
                <option value="created_at">
                  {t("myCoaching.records.dailyPage.form.createdAt", "작성일")}
                </option>
                <option value="updated_at">
                  {t("myCoaching.records.dailyPage.form.updatedAt", "수정일")}
                </option>
                <option value="status">
                  {t("myCoaching.records.dailyPage.form.status.label", "상태")}
                </option>
              </select>
            </div>

            <div>
              <label
                className="text-sm font-medium text-ink-base"
                htmlFor="daily-sort-direction"
              >
                {t("myCoaching.records.dailyPage.form.sortDirection", "정렬 방향")}
              </label>
              <select
                className="mt-1 w-full rounded-control border border-line-base px-3 py-2 text-sm"
                id="daily-sort-direction"
                onChange={(event) =>
                  setSortDirection(event.target.value as SortDirection)
                }
                value={sortDirection}
              >
                <option value="desc">
                  {t("myCoaching.records.dailyPage.form.desc", "내림차순")}
                </option>
                <option value="asc">
                  {t("myCoaching.records.dailyPage.form.asc", "오름차순")}
                </option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-muted">
              {t("myCoaching.records.dailyPage.form.resultLabel", "하루 기록")}:{" "}
              {t("myCoaching.records.dailyPage.form.resultCountPrefix", "전체")}{" "}
              {records.length}
              {t("myCoaching.records.dailyPage.form.resultCountMiddle", "개 중")}{" "}
              {visibleRecords.length}
              {t("myCoaching.records.dailyPage.form.resultCountSuffix", "개 표시")}
            </p>
            <button
              className="rounded-control border border-line-base bg-surface-card px-3 py-2 text-sm font-medium text-ink-base"
              onClick={resetListFilters}
              type="button"
            >
              {t("myCoaching.records.dailyPage.form.resetFilters", "필터 초기화")}
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="mt-5 rounded-control border border-line-base bg-surface-sunken p-4 text-sm text-ink-muted">
            {t("myCoaching.records.dailyPage.form.loading", "하루 기록을 불러오는 중입니다.")}
          </div>
        ) : records.length === 0 ? (
          <div className="mt-5 rounded-control border border-line-base bg-surface-sunken p-4 text-sm text-ink-muted">
            {t("myCoaching.records.dailyPage.form.empty", "아직 작성한 하루 기록이 없습니다.")}
          </div>
        ) : visibleRecords.length === 0 ? (
          <div className="mt-5 rounded-control border border-line-base bg-surface-sunken p-4 text-sm text-ink-muted">
            {t(
              "myCoaching.records.dailyPage.form.noResults",
              "선택한 조건에 해당하는 하루 기록이 없습니다.",
            )}
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {visibleRecords.map((record) => (
              <article
                className="rounded-control border border-line-base bg-surface-sunken p-4"
                key={record.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-ink-faint">
                      {formatDate(record.record_date)}
                    </p>
                    <h3 className="mt-1 font-semibold text-ink-strong">
                      {displayText(record.title)}
                    </h3>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge tone="info">{getVisibilityLabel(record.visibility, t)}</Badge>
                    <Badge tone="success">{getStatusLabel(record.status, t)}</Badge>
                  </div>
                </div>

                <dl className="mt-4 grid gap-4 text-sm">
                  <div>
                    <dt className="font-medium text-ink-faint">
                      {t("myCoaching.records.dailyPage.form.reflection", "오늘의 돌아봄")}
                    </dt>
                    <dd className="mt-1 whitespace-pre-wrap text-ink-base">
                      {displayText(record.reflection)}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-ink-faint">
                      {t("myCoaching.records.dailyPage.form.practice", "실천/적용")}
                    </dt>
                    <dd className="mt-1 whitespace-pre-wrap text-ink-base">
                      {displayText(record.practice)}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-ink-faint">
                      {t("myCoaching.records.dailyPage.form.prayerRequest", "기도제목")}
                    </dt>
                    <dd className="mt-1 whitespace-pre-wrap text-ink-base">
                      {displayText(record.prayer_request)}
                    </dd>
                  </div>
                </dl>

                <dl className="mt-4 grid gap-3 border-t border-line-base pt-4 text-xs text-ink-muted sm:grid-cols-2">
                  <div>
                    <dt className="font-medium">
                      {t("myCoaching.records.dailyPage.form.createdAt", "작성일")}
                    </dt>
                    <dd className="mt-1">{formatDateTime(record.created_at)}</dd>
                  </div>
                  <div>
                    <dt className="font-medium">
                      {t("myCoaching.records.dailyPage.form.updatedAt", "수정일")}
                    </dt>
                    <dd className="mt-1">{formatDateTime(record.updated_at)}</dd>
                  </div>
                </dl>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    className="rounded-control border border-line-base bg-surface-card px-3 py-2 text-sm font-medium text-ink-base"
                    onClick={() => startEdit(record)}
                    type="button"
                  >
                    {t("myCoaching.records.dailyPage.form.edit", "수정")}
                  </button>
                  <button
                    className="rounded-control border border-red-200 bg-surface-card px-3 py-2 text-sm font-medium text-red-700"
                    disabled={deletingId === record.id}
                    onClick={() => void removeRecord(record)}
                    type="button"
                  >
                    {deletingId === record.id
                      ? t("myCoaching.records.dailyPage.form.deleting", "삭제 중...")
                      : t("myCoaching.records.dailyPage.form.removeFromList", "목록에서 제거")}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
