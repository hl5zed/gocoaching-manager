"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/useI18n";
import { Badge } from "@/components/ui/Badge";
import {
  getClientTimezone,
  getCurrentMonthInTimezone,
  getCurrentYearInTimezone,
} from "@/lib/timezone";
import { isValidNumberInRange } from "@/lib/validation/common";

type MonthlyReflectionStatus = "draft" | "submitted" | "reviewed";
type MonthlyReflectionVisibility = "private" | "coach";
type MonthlySortKey = "year_month" | "created_at" | "updated_at" | "status";
type SortDirection = "asc" | "desc";
type StatusFilter = "all" | MonthlyReflectionStatus;
type VisibilityFilter = "all" | MonthlyReflectionVisibility;

type MonthlyReflection = {
  id: string;
  year: number;
  month: number;
  summary: string | null;
  growth_points: string | null;
  difficulty: string | null;
  next_month_plan: string | null;
  visibility: MonthlyReflectionVisibility;
  shared_with_coach: boolean;
  status: MonthlyReflectionStatus;
  submitted_at: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

type FormState = {
  year: string;
  month: string;
  summary: string;
  growth_points: string;
  difficulty: string;
  next_month_plan: string;
  visibility: MonthlyReflectionVisibility;
  shared_with_coach: boolean;
  status: MonthlyReflectionStatus;
};

function createInitialFormState(): FormState {
  const timezone = getClientTimezone();

  return {
    year: String(getCurrentYearInTimezone(timezone)),
    month: String(getCurrentMonthInTimezone(timezone)),
    summary: "",
    growth_points: "",
    difficulty: "",
    next_month_plan: "",
    visibility: "private",
    shared_with_coach: false,
    status: "draft",
  };
}

function createEmptyFormState(): FormState {
  return {
    ...createInitialFormState(),
    year: "",
    month: "",
  };
}

const statusLabelMeta: Record<MonthlyReflectionStatus, { fallback: string; key: string }> = {
  draft: {
    fallback: "임시저장",
    key: "myCoaching.records.monthlyPage.form.status.draft",
  },
  submitted: {
    fallback: "제출",
    key: "myCoaching.records.monthlyPage.form.status.submitted",
  },
  reviewed: {
    fallback: "검토완료",
    key: "myCoaching.records.monthlyPage.form.status.reviewed",
  },
};

const visibilityLabelMeta: Record<
  MonthlyReflectionVisibility,
  { fallback: string; key: string }
> = {
  private: {
    fallback: "나만 보기",
    key: "myCoaching.records.monthlyPage.form.visibility.private",
  },
  coach: {
    fallback: "코치에게 공유",
    key: "myCoaching.records.monthlyPage.form.visibility.coach",
  },
};

const monthOptions = Array.from({ length: 12 }, (_, index) => index + 1);

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
    const label = statusLabelMeta[status as MonthlyReflectionStatus];
    return t(label.key, label.fallback);
  }

  return t("myCoaching.records.monthlyPage.form.status.unknown", "확인 필요");
}

function getStatusSortLabel(status: string) {
  if (status in statusLabelMeta) {
    return statusLabelMeta[status as MonthlyReflectionStatus].fallback;
  }

  return "확인 필요";
}

function getVisibilityLabel(
  visibility: string,
  t: (key: string, fallback?: string) => string,
) {
  if (visibility in visibilityLabelMeta) {
    const label = visibilityLabelMeta[visibility as MonthlyReflectionVisibility];
    return t(label.key, label.fallback);
  }

  return t("myCoaching.records.monthlyPage.form.visibility.unknown", "미지정");
}

function toNullableText(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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
  if (status === 401) {
    return t("myCoaching.records.monthlyPage.form.errors.loginRequired", "로그인이 필요합니다.");
  }

  if (status === 403) {
    return t("myCoaching.records.monthlyPage.form.errors.forbidden", "이 월간 회고에 접근할 권한이 없습니다.");
  }

  if (status === 404) {
    return t("myCoaching.records.monthlyPage.form.errors.notFound", "월간 회고를 찾을 수 없습니다.");
  }

  if (status === 500) {
    return t("myCoaching.records.monthlyPage.form.errors.processFailed", "월간 회고 처리에 실패했습니다.");
  }

  return getErrorMessage(payload, t("myCoaching.records.monthlyPage.form.errors.processFailed", "월간 회고 처리에 실패했습니다."));
}

function toFormState(record: MonthlyReflection): FormState {
  return {
    year: String(record.year),
    month: String(record.month),
    summary: record.summary ?? "",
    growth_points: record.growth_points ?? "",
    difficulty: record.difficulty ?? "",
    next_month_plan: record.next_month_plan ?? "",
    visibility: record.visibility,
    shared_with_coach: record.shared_with_coach,
    status: record.status,
  };
}

function isValidYear(value: string) {
  const year = Number(value);
  return Number.isInteger(year) && year >= 2000 && year <= 2100;
}

function isValidMonth(value: string) {
  const month = Number(value);
  return Number.isInteger(month) && month >= 1 && month <= 12;
}

function getSafeVisibility(value: string): MonthlyReflectionVisibility {
  return value === "coach" ? "coach" : "private";
}

function getSafeStatus(value: string): MonthlyReflectionStatus {
  if (value === "submitted" || value === "reviewed") {
    return value;
  }

  return "draft";
}

export function MonthlyReflectionsClient() {
  const { t } = useI18n();
  const [records, setRecords] = useState<MonthlyReflection[]>([]);
  const [form, setForm] = useState<FormState>(() => createInitialFormState());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [filterYear, setFilterYear] = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [visibilityFilter, setVisibilityFilter] =
    useState<VisibilityFilter>("all");
  const [sortKey, setSortKey] = useState<MonthlySortKey>("year_month");
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
          record.summary,
          record.growth_points,
          record.difficulty,
          record.next_month_plan,
        ].some((value) => normalizeSearch(value).includes(normalizedQuery));
      const matchesStatus =
        statusFilter === "all" || record.status === statusFilter;
      const matchesVisibility =
        visibilityFilter === "all" || record.visibility === visibilityFilter;

      return matchesSearch && matchesStatus && matchesVisibility;
    });

    return [...filteredRecords].sort((first, second) => {
      let comparison = 0;

      if (sortKey === "year_month") {
        comparison =
          first.year * 100 + first.month - (second.year * 100 + second.month);
      } else if (sortKey === "status") {
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

  async function loadRecords(filters?: { year: string; month: string }) {
    setIsLoading(true);
    setErrorMessage(null);

    const searchParams = new URLSearchParams();
    const nextFilterYear = filters?.year ?? filterYear;
    const nextFilterMonth = filters?.month ?? filterMonth;

    if (nextFilterYear) {
      searchParams.set("year", nextFilterYear);
    }

    if (nextFilterMonth) {
      searchParams.set("month", nextFilterMonth);
    }

    try {
      const query = searchParams.toString();
      const response = await fetch(
        `/api/my-coaching/records/monthly${query ? `?${query}` : ""}`,
        {
          cache: "no-store",
        },
      );
      const payload: unknown = await response.json();

      if (!response.ok) {
        throw new Error(
          getErrorMessage(
            payload,
            t("myCoaching.records.monthlyPage.form.errors.loadFailed", "월간 회고 목록을 불러오지 못했습니다."),
          ),
        );
      }

      const nextRecords =
        typeof payload === "object" &&
        payload !== null &&
        "records" in payload &&
        Array.isArray(payload.records)
          ? (payload.records as MonthlyReflection[])
          : [];
      setRecords(nextRecords);
      setErrorMessage(null);
      return true;
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : t("myCoaching.records.monthlyPage.form.errors.loadFailed", "월간 회고 목록을 불러오지 못했습니다."),
      );
      return false;
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadRecords();
  }, []);

  function resetForm() {
    setForm(createInitialFormState());
    setEditingId(null);
  }

  function resetFormAfterSave() {
    setForm(createEmptyFormState());
    setEditingId(null);
  }

  function resetFilters() {
    setFilterYear("");
    setFilterMonth("");
    setSearchQuery("");
    setStatusFilter("all");
    setVisibilityFilter("all");
    setSortKey("year_month");
    setSortDirection("desc");
    void loadRecords({ year: "", month: "" });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setErrorMessage(null);

    const yearNumber = Number(form.year);
    const monthNumber = Number(form.month);
    const safeVisibility = getSafeVisibility(form.visibility);
    const safeStatus = getSafeStatus(form.status);

    if (
      !form.year ||
      !Number.isInteger(yearNumber) ||
      !isValidNumberInRange(yearNumber, 2000, 2100) ||
      !isValidYear(form.year)
    ) {
      setErrorMessage(t("myCoaching.records.monthlyPage.form.errors.yearRequired", "연도를 선택해 주세요."));
      return;
    }

    if (
      !form.month ||
      !Number.isInteger(monthNumber) ||
      !isValidNumberInRange(monthNumber, 1, 12) ||
      !isValidMonth(form.month)
    ) {
      setErrorMessage(t("myCoaching.records.monthlyPage.form.errors.monthRequired", "월을 선택해 주세요."));
      return;
    }

    const duplicateRecord = records.find(
      (record) =>
        record.year === yearNumber &&
        record.month === monthNumber &&
        record.id !== editingId,
    );

    if (duplicateRecord) {
      setErrorMessage(
        t(
          "myCoaching.records.monthlyPage.form.errors.duplicate",
          "이미 해당 월의 회고 기록이 있습니다. 기존 기록을 수정해 주세요.",
        ),
      );
      return;
    }

    setIsSaving(true);

    const payload = {
      year: yearNumber,
      month: monthNumber,
      summary: toNullableText(form.summary),
      growth_points: toNullableText(form.growth_points),
      difficulty: toNullableText(form.difficulty),
      next_month_plan: toNullableText(form.next_month_plan),
      visibility: safeVisibility,
      shared_with_coach: safeVisibility === "coach",
      status: safeStatus,
    };

    try {
      const url = editingId
        ? `/api/my-coaching/records/monthly/${editingId}`
        : "/api/my-coaching/records/monthly";
      const response = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const responsePayload: unknown = await response.json();

      if (!response.ok) {
        const serverMessage = getErrorMessage(
          responsePayload,
          editingId
            ? t("myCoaching.records.monthlyPage.form.errors.updateFailed", "월간 회고 수정에 실패했습니다.")
            : t("myCoaching.records.monthlyPage.form.errors.saveFailed", "월간 회고 저장에 실패했습니다."),
        );

        throw new Error(
          response.status === 409
            ? t(
                "myCoaching.records.monthlyPage.form.errors.duplicate",
                "이미 해당 월의 회고 기록이 있습니다. 기존 기록을 수정해 주세요.",
              )
            : serverMessage,
        );
      }

      const successMessage = editingId
        ? t("myCoaching.records.monthlyPage.form.updated", "월간 회고가 수정되었습니다.")
        : t("myCoaching.records.monthlyPage.form.saved", "월간 회고가 저장되었습니다.");
      resetFormAfterSave();
      const loaded = await loadRecords();

      if (loaded) {
        setErrorMessage(null);
        setMessage(successMessage);
      }
    } catch (error) {
      setMessage(null);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : editingId
            ? t("myCoaching.records.monthlyPage.form.errors.updateFailed", "월간 회고 수정에 실패했습니다.")
            : t("myCoaching.records.monthlyPage.form.errors.saveFailed", "월간 회고 저장에 실패했습니다."),
      );
    } finally {
      setIsSaving(false);
    }
  }

  function startEdit(record: MonthlyReflection) {
    setEditingId(record.id);
    setForm(toFormState(record));
    setMessage(null);
    setErrorMessage(null);
  }

  async function removeRecord(record: MonthlyReflection) {
    setMessage(null);
    setErrorMessage(null);

    if (!record.id || record.id.trim().length === 0) {
      setErrorMessage(t("myCoaching.records.monthlyPage.form.errors.notFound", "월간 회고를 찾을 수 없습니다."));
      return;
    }

    const confirmed = window.confirm(
      `${t("myCoaching.records.monthlyPage.form.deleteConfirm", "월간 회고를 삭제하시겠습니까?")}\n\n${t("myCoaching.records.monthlyPage.form.targetMonth", "대상")}: ${record.year}${t("myCoaching.records.monthlyPage.form.yearSuffix", "년")} ${record.month}${t("myCoaching.records.monthlyPage.form.monthSuffix", "월")}\n${t("myCoaching.records.monthlyPage.form.deleteIrreversible", "이 작업은 되돌릴 수 없습니다.")}`,
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(record.id);

    try {
      const response = await fetch(
        `/api/my-coaching/records/monthly/${record.id}`,
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
      setMessage(t("myCoaching.records.monthlyPage.form.removed", "월간 회고가 목록에서 제거되었습니다."));
      void loadRecords();
    } catch (error) {
      setMessage(null);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : t("myCoaching.records.monthlyPage.form.errors.processFailed", "월간 회고 처리에 실패했습니다."),
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mt-6 grid gap-4">
      <section className="rounded-card border border-line-base bg-surface-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">
              {editingRecord
                ? t("myCoaching.records.monthlyPage.form.editTitle", "월간 회고 수정")
                : t("myCoaching.records.monthlyPage.form.createTitle", "월간 회고 작성")}
            </h2>
            <p className="mt-2 text-sm text-ink-muted">
              {t(
                "myCoaching.records.monthlyPage.form.description",
                "한 달의 성장과 다음 달 계획을 정리해 주세요.",
              )}
            </p>
          </div>
          {editingRecord ? (
            <button
              className="rounded-control border border-line-base px-3 py-2 text-sm font-medium text-ink-base"
              onClick={resetForm}
              type="button"
            >
              {t("myCoaching.records.monthlyPage.form.cancelEdit", "수정 취소")}
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
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                className="text-sm font-medium text-ink-base"
                htmlFor="year"
              >
                {t("myCoaching.records.monthlyPage.form.year", "연도")}
              </label>
              <input
                className="mt-1 w-full rounded-control border border-line-base px-3 py-2 text-sm"
                id="year"
                max="2100"
                min="2000"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    year: event.target.value,
                  }))
                }
                type="number"
                value={form.year}
              />
            </div>
            <div>
              <label
                className="text-sm font-medium text-ink-base"
                htmlFor="month"
              >
                {t("myCoaching.records.monthlyPage.form.month", "월")}
              </label>
              <select
                className="mt-1 w-full rounded-control border border-line-base px-3 py-2 text-sm"
                id="month"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    month: event.target.value,
                  }))
                }
                value={form.month}
              >
                <option value="">
                  {t("myCoaching.records.monthlyPage.form.selectMonth", "월 선택")}
                </option>
                {monthOptions.map((month) => (
                  <option key={month} value={month}>
                    {month}
                    {t("myCoaching.records.monthlyPage.form.monthSuffix", "월")}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label
              className="text-sm font-medium text-ink-base"
              htmlFor="summary"
            >
              {t("myCoaching.records.monthlyPage.form.summary", "한 달 요약")}
            </label>
            <textarea
              className="mt-1 min-h-28 w-full rounded-control border border-line-base px-3 py-2 text-sm"
              id="summary"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  summary: event.target.value,
                }))
              }
              value={form.summary}
            />
          </div>

          <div>
            <label
              className="text-sm font-medium text-ink-base"
              htmlFor="growth_points"
            >
              {t("myCoaching.records.monthlyPage.form.growthPoints", "성장한 점")}
            </label>
            <textarea
              className="mt-1 min-h-24 w-full rounded-control border border-line-base px-3 py-2 text-sm"
              id="growth_points"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  growth_points: event.target.value,
                }))
              }
              value={form.growth_points}
            />
          </div>

          <div>
            <label
              className="text-sm font-medium text-ink-base"
              htmlFor="difficulty"
            >
              {t("myCoaching.records.monthlyPage.form.difficulty", "어려웠던 점")}
            </label>
            <textarea
              className="mt-1 min-h-24 w-full rounded-control border border-line-base px-3 py-2 text-sm"
              id="difficulty"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  difficulty: event.target.value,
                }))
              }
              value={form.difficulty}
            />
          </div>

          <div>
            <label
              className="text-sm font-medium text-ink-base"
              htmlFor="next_month_plan"
            >
              {t("myCoaching.records.monthlyPage.form.nextMonthPlan", "다음 달 계획")}
            </label>
            <textarea
              className="mt-1 min-h-24 w-full rounded-control border border-line-base px-3 py-2 text-sm"
              id="next_month_plan"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  next_month_plan: event.target.value,
                }))
              }
              value={form.next_month_plan}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                className="text-sm font-medium text-ink-base"
                htmlFor="visibility"
              >
                {t("myCoaching.records.monthlyPage.form.visibility.label", "공유 옵션")}
              </label>
              <select
                className="mt-1 w-full rounded-control border border-line-base px-3 py-2 text-sm"
                id="visibility"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    visibility:
                      event.target.value as MonthlyReflectionVisibility,
                    shared_with_coach: event.target.value === "coach",
                  }))
                }
                value={form.visibility}
              >
                <option value="private">
                  {t("myCoaching.records.monthlyPage.form.visibility.private", "나만 보기")}
                </option>
                <option value="coach">
                  {t("myCoaching.records.monthlyPage.form.visibility.coach", "코치에게 공유")}
                </option>
              </select>
            </div>

            <div>
              <label
                className="text-sm font-medium text-ink-base"
                htmlFor="status"
              >
                {t("myCoaching.records.monthlyPage.form.status.label", "상태")}
              </label>
              <select
                className="mt-1 w-full rounded-control border border-line-base px-3 py-2 text-sm"
                id="status"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    status: event.target.value as MonthlyReflectionStatus,
                  }))
                }
                value={form.status}
              >
                <option value="draft">
                  {t("myCoaching.records.monthlyPage.form.status.draft", "임시저장")}
                </option>
                <option value="submitted">
                  {t("myCoaching.records.monthlyPage.form.status.submitted", "제출")}
                </option>
                <option disabled value="reviewed">
                  {t("myCoaching.records.monthlyPage.form.status.reviewed", "검토완료")}
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
            {t("myCoaching.records.monthlyPage.form.shareWithCoach", "코치에게 공유")}
          </label>

          <button
            className="w-full rounded-control bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isSaving}
            type="submit"
          >
            {isSaving
              ? t("myCoaching.records.monthlyPage.form.saving", "저장 중...")
              : editingRecord
                ? t("myCoaching.records.monthlyPage.form.update", "월간 회고 수정")
                : t("myCoaching.records.monthlyPage.form.save", "월간 회고 저장")}
          </button>
        </form>
      </section>

      <section className="rounded-card border border-line-base bg-surface-card p-4">
        <div>
          <h2 className="text-lg font-semibold">
            {t("myCoaching.records.monthlyPage.form.listTitle", "나의 월간 회고 목록")}
          </h2>
          <p className="mt-2 text-sm text-ink-muted">
            {t(
              "myCoaching.records.monthlyPage.form.listDescription",
              "최신 연도와 월 순서로 표시됩니다.",
            )}
          </p>
        </div>

        <div className="mt-4 grid gap-3 rounded-control border border-line-base bg-surface-sunken p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label
                className="text-sm font-medium text-ink-base"
                htmlFor="monthly-search"
              >
                {t("myCoaching.records.monthlyPage.form.search", "검색")}
              </label>
              <input
                className="mt-1 w-full rounded-control border border-line-base px-3 py-2 text-sm"
                id="monthly-search"
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={t(
                  "myCoaching.records.monthlyPage.form.searchPlaceholder",
                  "한 달 요약, 성장한 점, 어려웠던 점, 다음 달 계획 검색",
                )}
                type="search"
                value={searchQuery}
              />
            </div>
            <div className="flex items-end">
              <p className="text-sm text-ink-muted">
                {t("myCoaching.records.monthlyPage.form.resultLabel", "월간 회고")}:{" "}
                {t("myCoaching.records.monthlyPage.form.resultCountPrefix", "전체")}{" "}
                {records.length}
                {t("myCoaching.records.monthlyPage.form.resultCountMiddle", "개 중")}{" "}
                {visibleRecords.length}
                {t("myCoaching.records.monthlyPage.form.resultCountSuffix", "개 표시")}
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
            <label
              className="text-sm font-medium text-ink-base"
              htmlFor="filter-year"
            >
              {t("myCoaching.records.monthlyPage.form.yearFilter", "연도 필터")}
            </label>
            <input
              className="mt-1 w-full rounded-control border border-line-base px-3 py-2 text-sm"
              id="filter-year"
              max="2100"
              min="2000"
              onChange={(event) => setFilterYear(event.target.value)}
              placeholder={t("myCoaching.records.monthlyPage.form.yearPlaceholder", "예: 2026")}
              type="number"
              value={filterYear}
            />
          </div>
            <div>
            <label
              className="text-sm font-medium text-ink-base"
              htmlFor="filter-month"
            >
              {t("myCoaching.records.monthlyPage.form.monthFilter", "월 필터")}
            </label>
            <select
              className="mt-1 w-full rounded-control border border-line-base px-3 py-2 text-sm"
              id="filter-month"
              onChange={(event) => setFilterMonth(event.target.value)}
              value={filterMonth}
            >
              <option value="">
                {t("myCoaching.records.monthlyPage.form.all", "전체")}
              </option>
              {monthOptions.map((month) => (
                <option key={month} value={month}>
                  {month}
                  {t("myCoaching.records.monthlyPage.form.monthSuffix", "월")}
                </option>
              ))}
            </select>
          </div>
            <div>
              <label
                className="text-sm font-medium text-ink-base"
                htmlFor="monthly-status-filter"
              >
                {t("myCoaching.records.monthlyPage.form.status.label", "상태")}
              </label>
              <select
                className="mt-1 w-full rounded-control border border-line-base px-3 py-2 text-sm"
                id="monthly-status-filter"
                onChange={(event) =>
                  setStatusFilter(event.target.value as StatusFilter)
                }
                value={statusFilter}
              >
                <option value="all">
                  {t("myCoaching.records.monthlyPage.form.all", "전체")}
                </option>
                <option value="draft">
                  {t("myCoaching.records.monthlyPage.form.status.draft", "임시저장")}
                </option>
                <option value="submitted">
                  {t("myCoaching.records.monthlyPage.form.status.submitted", "제출")}
                </option>
                <option value="reviewed">
                  {t("myCoaching.records.monthlyPage.form.status.reviewed", "검토완료")}
                </option>
              </select>
            </div>
            <div>
              <label
                className="text-sm font-medium text-ink-base"
                htmlFor="monthly-visibility-filter"
              >
                {t("myCoaching.records.monthlyPage.form.visibility.filterLabel", "공유")}
              </label>
              <select
                className="mt-1 w-full rounded-control border border-line-base px-3 py-2 text-sm"
                id="monthly-visibility-filter"
                onChange={(event) =>
                  setVisibilityFilter(event.target.value as VisibilityFilter)
                }
                value={visibilityFilter}
              >
                <option value="all">
                  {t("myCoaching.records.monthlyPage.form.all", "전체")}
                </option>
                <option value="private">
                  {t("myCoaching.records.monthlyPage.form.visibility.private", "나만 보기")}
                </option>
                <option value="coach">
                  {t("myCoaching.records.monthlyPage.form.visibility.coach", "코치에게 공유")}
                </option>
              </select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <div>
              <label
                className="text-sm font-medium text-ink-base"
                htmlFor="monthly-sort-key"
              >
                {t("myCoaching.records.monthlyPage.form.sortBy", "정렬 기준")}
              </label>
              <select
                className="mt-1 w-full rounded-control border border-line-base px-3 py-2 text-sm"
                id="monthly-sort-key"
                onChange={(event) =>
                  setSortKey(event.target.value as MonthlySortKey)
                }
                value={sortKey}
              >
                <option value="year_month">
                  {t("myCoaching.records.monthlyPage.form.yearMonth", "연도/월")}
                </option>
                <option value="created_at">
                  {t("myCoaching.records.monthlyPage.form.createdAt", "작성일")}
                </option>
                <option value="updated_at">
                  {t("myCoaching.records.monthlyPage.form.updatedAt", "수정일")}
                </option>
                <option value="status">
                  {t("myCoaching.records.monthlyPage.form.status.label", "상태")}
                </option>
              </select>
            </div>
            <div>
              <label
                className="text-sm font-medium text-ink-base"
                htmlFor="monthly-sort-direction"
              >
                {t("myCoaching.records.monthlyPage.form.sortDirection", "정렬 방향")}
              </label>
              <select
                className="mt-1 w-full rounded-control border border-line-base px-3 py-2 text-sm"
                id="monthly-sort-direction"
                onChange={(event) =>
                  setSortDirection(event.target.value as SortDirection)
                }
                value={sortDirection}
              >
                <option value="desc">
                  {t("myCoaching.records.monthlyPage.form.desc", "내림차순")}
                </option>
                <option value="asc">
                  {t("myCoaching.records.monthlyPage.form.asc", "오름차순")}
                </option>
              </select>
            </div>
            <div className="flex items-end gap-2">
            <button
              className="rounded-control bg-brand-600 px-3 py-2 text-sm font-medium text-white"
              onClick={() => void loadRecords()}
              type="button"
            >
              {t("myCoaching.records.monthlyPage.form.applyFilters", "필터 적용")}
            </button>
            <button
              className="rounded-control border border-line-base bg-surface-card px-3 py-2 text-sm font-medium text-ink-base"
              onClick={resetFilters}
              type="button"
            >
              {t("myCoaching.records.monthlyPage.form.resetFilters", "초기화")}
            </button>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="mt-5 rounded-control border border-line-base bg-surface-sunken p-4 text-sm text-ink-muted">
            {t("myCoaching.records.monthlyPage.form.loading", "월간 회고를 불러오는 중입니다.")}
          </div>
        ) : records.length === 0 ? (
          <div className="mt-5 rounded-control border border-line-base bg-surface-sunken p-4 text-sm text-ink-muted">
            {t("myCoaching.records.monthlyPage.form.empty", "아직 작성한 월간 회고가 없습니다.")}
          </div>
        ) : visibleRecords.length === 0 ? (
          <div className="mt-5 rounded-control border border-line-base bg-surface-sunken p-4 text-sm text-ink-muted">
            {t(
              "myCoaching.records.monthlyPage.form.noResults",
              "선택한 조건에 해당하는 월간 회고가 없습니다.",
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
                    <p className="text-sm font-medium text-ink-muted">
                      {record.year}
                      {t("myCoaching.records.monthlyPage.form.yearSuffix", "년")}{" "}
                      {record.month}
                      {t("myCoaching.records.monthlyPage.form.monthSuffix", "월")}
                    </p>
                    <h3 className="mt-1 font-semibold text-ink-strong">
                      {t("myCoaching.records.monthlyPage.form.cardTitle", "월간 회고")}
                    </h3>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge tone="info">{getVisibilityLabel(record.visibility, t)}</Badge>
                    <Badge tone="success">{getStatusLabel(record.status, t)}</Badge>
                  </div>
                </div>

                <dl className="mt-4 grid gap-4 text-sm">
                  <div>
                    <dt className="font-medium text-ink-muted">
                      {t("myCoaching.records.monthlyPage.form.summary", "한 달 요약")}
                    </dt>
                    <dd className="mt-1 whitespace-pre-wrap text-ink-base">
                      {displayText(record.summary)}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-ink-muted">
                      {t("myCoaching.records.monthlyPage.form.growthPoints", "성장한 점")}
                    </dt>
                    <dd className="mt-1 whitespace-pre-wrap text-ink-base">
                      {displayText(record.growth_points)}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-ink-muted">
                      {t("myCoaching.records.monthlyPage.form.difficulty", "어려웠던 점")}
                    </dt>
                    <dd className="mt-1 whitespace-pre-wrap text-ink-base">
                      {displayText(record.difficulty)}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-ink-muted">
                      {t("myCoaching.records.monthlyPage.form.nextMonthPlan", "다음 달 계획")}
                    </dt>
                    <dd className="mt-1 whitespace-pre-wrap text-ink-base">
                      {displayText(record.next_month_plan)}
                    </dd>
                  </div>
                </dl>

                <dl className="mt-4 grid gap-3 border-t border-line-base pt-4 text-xs text-ink-muted sm:grid-cols-2">
                  <div>
                    <dt className="font-medium">
                      {t("myCoaching.records.monthlyPage.form.createdAt", "작성일")}
                    </dt>
                    <dd className="mt-1">{formatDateTime(record.created_at)}</dd>
                  </div>
                  <div>
                    <dt className="font-medium">
                      {t("myCoaching.records.monthlyPage.form.updatedAt", "수정일")}
                    </dt>
                    <dd className="mt-1">{formatDateTime(record.updated_at)}</dd>
                  </div>
                  <div>
                    <dt className="font-medium">
                      {t("myCoaching.records.monthlyPage.form.submittedAt", "제출일")}
                    </dt>
                    <dd className="mt-1">
                      {formatDateTime(record.submitted_at)}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium">
                      {t("myCoaching.records.monthlyPage.form.reviewedAt", "검토일")}
                    </dt>
                    <dd className="mt-1">{formatDateTime(record.reviewed_at)}</dd>
                  </div>
                </dl>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    className="rounded-control border border-line-base bg-surface-card px-3 py-2 text-sm font-medium text-ink-base"
                    onClick={() => startEdit(record)}
                    type="button"
                  >
                    {t("myCoaching.records.monthlyPage.form.edit", "수정")}
                  </button>
                  <button
                    className="rounded-control border border-red-200 bg-surface-card px-3 py-2 text-sm font-medium text-red-700"
                    disabled={deletingId === record.id}
                    onClick={() => void removeRecord(record)}
                    type="button"
                  >
                    {deletingId === record.id
                      ? t("myCoaching.records.monthlyPage.form.deleting", "삭제 중...")
                      : t("myCoaching.records.monthlyPage.form.removeFromList", "목록에서 제거")}
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
