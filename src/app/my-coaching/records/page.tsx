import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/getSession";
import { getDailyRecords } from "@/lib/api/my-coaching/daily-records";
import { getMonthlyReflections } from "@/lib/api/my-coaching/monthly-reflections";
import { getRecentMyWeeklyLogs } from "@/lib/api/my-coaching/weekly-log";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  DEFAULT_TIMEZONE,
  formatDateInTimezone,
  formatDateTimeInTimezone,
  getEffectiveTimezone,
  getTodayDateInTimezone,
} from "@/lib/timezone";
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  FieldLabel,
  FieldText,
  SelectInput,
  TextInput,
} from "@/components/ui";
import { PrintRecordsButton } from "./PrintRecordsButton";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { I18nText } from "@/lib/i18n/I18nProvider";

export const dynamic = "force-dynamic";
const RECENT_RECORDS_LIMIT = 3;
const RECORDS_PAGE_LIST_LIMIT = 200;

type RecordTypeFilter = "all" | "daily" | "weekly" | "monthly";
type StatusFilter = "all" | "draft" | "submitted" | "reviewed" | "unknown";
type VisibilityFilter = "all" | "private" | "coach";
type SortOption = "newest" | "oldest" | "type" | "status";
type RecordType = "daily" | "weekly" | "monthly";

type CombinedRecord = {
  id: string;
  type: RecordType;
  title: string;
  dateLabel: string;
  sortDate: string;
  printDate: string | null;
  printEndDate: string | null;
  printMonth: string | null;
  status: string | null;
  visibility: string | null;
  sharedWithCoach: boolean | null;
  searchText: string;
  href: string;
  primaryLabel: string;
  primaryText: string | null;
  secondaryLabel: string;
  secondaryText: string | null;
  metaLabel?: string;
  metaText?: string;
};

type RecordGroups = {
  all: CombinedRecord[];
  daily: CombinedRecord[];
  monthly: CombinedRecord[];
  weekly: CombinedRecord[];
};

function createRecordGroups(): RecordGroups {
  return {
    all: [],
    daily: [],
    monthly: [],
    weekly: [],
  };
}

function addRecordToGroups(groups: RecordGroups, record: CombinedRecord) {
  groups.all.push(record);
  groups[record.type].push(record);
}

function normalizeParam(
  value: string | string[] | undefined,
  fallback = "",
) {
  if (Array.isArray(value)) {
    return value[0] ?? fallback;
  }

  return value ?? fallback;
}

function normalizeRecordType(value: string): RecordTypeFilter {
  return value === "daily" ||
    value === "weekly" ||
    value === "monthly" ||
    value === "all"
    ? value
    : "all";
}

function normalizeStatus(value: string): StatusFilter {
  return value === "draft" ||
    value === "submitted" ||
    value === "reviewed" ||
    value === "unknown" ||
    value === "all"
    ? value
    : "all";
}

function normalizeVisibility(value: string): VisibilityFilter {
  return value === "private" || value === "coach" || value === "all"
    ? value
    : "all";
}

function normalizeSort(value: string): SortOption {
  return value === "newest" ||
    value === "oldest" ||
    value === "type" ||
    value === "status"
    ? value
    : "newest";
}

function formatDate(value: string | null, timezone = DEFAULT_TIMEZONE) {
  return value ? formatDateInTimezone(value, timezone) : "-";
}

function formatDateTime(value: string | null, timezone = DEFAULT_TIMEZONE) {
  return value ? formatDateTimeInTimezone(value, timezone) : "-";
}

function formatWeekRange(weekStart: string, weekEnd: string, timezone = DEFAULT_TIMEZONE) {
  return `${formatDate(weekStart, timezone)} - ${formatDate(weekEnd, timezone)}`;
}

function formatLocalDateForFilename(timezone = DEFAULT_TIMEZONE) {
  return getTodayDateInTimezone(timezone);
}

function getFilenameDate(value: string | null, fallback: string) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback;
}

function getFilenameMonth(value: string | null, fallback: string) {
  return value && /^\d{4}-\d{2}$/.test(value) ? value : fallback;
}

function displayText(value: string | null, fallback = "-") {
  return value && value.trim().length > 0 ? value : fallback;
}

function summarizeText(value: string | null, maxLength = 100) {
  const text = value?.replace(/\s+/g, " ").trim() ?? "";

  if (!text) {
    return "-";
  }

  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function normalizeSearch(value: string | null) {
  return (value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

function getRecordTypeLabel(type: RecordType) {
  if (type === "daily") {
    return "하루 기록";
  }

  if (type === "weekly") {
    return "주간 기록";
  }

  return "월간 회고";
}

function getRecordTypeClass(type: RecordType) {
  if (type === "daily") {
    return "border-teal-200 bg-teal-50 text-teal-800";
  }

  if (type === "weekly") {
    return "border-indigo-200 bg-indigo-50 text-indigo-800";
  }

  return "border-rose-200 bg-rose-50 text-rose-800";
}

function getRecordTypeTone(type: RecordType) {
  if (type === "daily") {
    return "success";
  }

  if (type === "weekly") {
    return "info";
  }

  return "warning";
}

function getStatusLabel(status: string | null) {
  if (status === "draft") {
    return "임시저장";
  }

  if (status === "submitted") {
    return "제출완료";
  }

  if (status === "reviewed") {
    return "검토완료";
  }

  return "확인 필요";
}

function getStatusClass(status: string | null) {
  if (status === "submitted") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }

  if (status === "reviewed") {
    return "border-sky-200 bg-sky-50 text-sky-800";
  }

  if (status === "draft") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  return "border-line-base bg-surface-sunken text-ink-base";
}

function getStatusTone(status: string | null) {
  if (status === "submitted" || status === "reviewed") {
    return "success";
  }

  if (status === "draft") {
    return "warning";
  }

  return "neutral";
}

function getVisibilityLabel(
  visibility: string | null,
  sharedWithCoach: boolean | null,
) {
  if (sharedWithCoach || visibility === "coach") {
    return "코치에게 공유";
  }

  if (visibility === "private") {
    return "나만 보기";
  }

  return "미지정";
}

function getVisibilityClass(
  visibility: string | null,
  sharedWithCoach: boolean | null,
) {
  if (sharedWithCoach || visibility === "coach") {
    return "border-violet-200 bg-violet-50 text-violet-800";
  }

  if (visibility === "private") {
    return "border-line-base bg-surface-card text-ink-base";
  }

  return "border-line-base bg-surface-sunken text-ink-base";
}

function getVisibilityTone(
  visibility: string | null,
  sharedWithCoach: boolean | null,
) {
  if (sharedWithCoach || visibility === "coach") {
    return "info";
  }

  return "neutral";
}

function getStatusRank(status: string | null) {
  if (status === "draft") {
    return 1;
  }

  if (status === "submitted") {
    return 2;
  }

  if (status === "reviewed") {
    return 3;
  }

  return 4;
}

function getRecordTypeRank(type: RecordType) {
  if (type === "daily") {
    return 1;
  }

  if (type === "weekly") {
    return 2;
  }

  return 3;
}

function getSortTime(value: string) {
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function matchesVisibilityFilter(
  record: CombinedRecord,
  filter: VisibilityFilter,
) {
  if (filter === "all") {
    return true;
  }

  if (filter === "coach") {
    return record.sharedWithCoach === true || record.visibility === "coach";
  }

  return record.visibility === "private" && record.sharedWithCoach !== true;
}

function matchesStatusFilter(record: CombinedRecord, filter: StatusFilter) {
  if (filter === "all") {
    return true;
  }

  if (filter === "unknown") {
    return (
      record.status !== "draft" &&
      record.status !== "submitted" &&
      record.status !== "reviewed"
    );
  }

  return record.status === filter;
}

function getFilterSummary({
  query,
  sort,
  status,
  type,
  visibility,
}: {
  query: string;
  sort: SortOption;
  status: StatusFilter;
  type: RecordTypeFilter;
  visibility: VisibilityFilter;
}) {
  return (
    <>
      <I18nText k="myCoaching.records.filters.searchLabel" fallback="검색어" />:{" "}
      {query || <I18nText k="myCoaching.records.filters.all" fallback="전체" />}
      {" / "}
      <I18nText k="myCoaching.records.filters.recordType" fallback="기록 유형" />:{" "}
      {recordTypeFilterLabel(type)}
      {" / "}
      <I18nText k="myCoaching.records.filters.status" fallback="상태" />:{" "}
      {statusFilterLabel(status)}
      {" / "}
      <I18nText k="myCoaching.records.filters.visibility" fallback="공유" />:{" "}
      {visibilityFilterLabel(visibility)}
      {" / "}
      <I18nText k="myCoaching.records.filters.sort" fallback="정렬" />:{" "}
      {sortFilterLabel(sort)}
    </>
  );
}

function recordTypeFilterLabel(type: RecordTypeFilter) {
  if (type === "daily") {
    return <I18nText k="myCoaching.records.daily" fallback="하루 기록" />;
  }
  if (type === "weekly") {
    return <I18nText k="myCoaching.records.weekly" fallback="주간 기록" />;
  }
  if (type === "monthly") {
    return <I18nText k="myCoaching.records.monthlyReflection" fallback="월간 회고" />;
  }
  return <I18nText k="myCoaching.records.filters.all" fallback="전체" />;
}

function statusFilterLabel(status: StatusFilter) {
  if (status === "draft") {
    return <I18nText k="myCoaching.records.filters.draft" fallback="임시저장" />;
  }
  if (status === "submitted") {
    return <I18nText k="myCoaching.records.filters.submitted" fallback="제출완료" />;
  }
  if (status === "reviewed") {
    return <I18nText k="myCoaching.records.filters.reviewed" fallback="검토완료" />;
  }
  if (status === "unknown") {
    return <I18nText k="myCoaching.records.filters.unknown" fallback="확인 필요" />;
  }
  return <I18nText k="myCoaching.records.filters.all" fallback="전체" />;
}

function visibilityFilterLabel(visibility: VisibilityFilter) {
  if (visibility === "coach") {
    return <I18nText k="myCoaching.records.filters.coachShared" fallback="코치에게 공유" />;
  }
  if (visibility === "private") {
    return <I18nText k="myCoaching.records.filters.private" fallback="나만 보기" />;
  }
  return <I18nText k="myCoaching.records.filters.all" fallback="전체" />;
}

function sortFilterLabel(sort: SortOption) {
  if (sort === "oldest") {
    return <I18nText k="myCoaching.records.filters.oldest" fallback="오래된순" />;
  }
  if (sort === "type") {
    return <I18nText k="myCoaching.records.filters.typeSort" fallback="기록 유형순" />;
  }
  if (sort === "status") {
    return <I18nText k="myCoaching.records.filters.statusSort" fallback="상태순" />;
  }
  return <I18nText k="myCoaching.records.filters.newest" fallback="최신순" />;
}

function getRecordsResultSectionClass(hasActiveSearchOrFilter: boolean) {
  return [
    "mt-8 rounded-card border border-line-base bg-surface-card p-6 shadow-sm print:block print:border-0 print:p-0 print:shadow-none",
    hasActiveSearchOrFilter ? "" : "hidden",
  ]
    .filter(Boolean)
    .join(" ");
}

function ResultCountText({
  shown,
  total,
}: {
  shown: number;
  total: number;
}) {
  return (
    <>
      <I18nText k="myCoaching.records.filters.resultCountPrefix" fallback="전체" />{" "}
      {total}
      <I18nText k="myCoaching.records.filters.totalSuffix" fallback="개 중" />{" "}
      {shown}
      <I18nText k="myCoaching.records.filters.shownSuffix" fallback="개 표시" />
    </>
  );
}

function compareRecords(
  first: CombinedRecord,
  second: CombinedRecord,
  sortOption: SortOption,
) {
  if (sortOption === "oldest") {
    return getSortTime(first.sortDate) - getSortTime(second.sortDate);
  }

  if (sortOption === "type") {
    const typeComparison =
      getRecordTypeRank(first.type) - getRecordTypeRank(second.type);
    return typeComparison || getSortTime(second.sortDate) - getSortTime(first.sortDate);
  }

  if (sortOption === "status") {
    const statusComparison =
      getStatusRank(first.status) - getStatusRank(second.status);
    return statusComparison || getSortTime(second.sortDate) - getSortTime(first.sortDate);
  }

  return getSortTime(second.sortDate) - getSortTime(first.sortDate);
}

function matchesRecordFilters({
  normalizedQuery,
  record,
  statusFilter,
  typeFilter,
  visibilityFilter,
}: {
  normalizedQuery: string;
  record: CombinedRecord;
  statusFilter: StatusFilter;
  typeFilter: RecordTypeFilter;
  visibilityFilter: VisibilityFilter;
}) {
  const matchesSearch =
    normalizedQuery.length === 0 ||
    normalizeSearch(record.searchText).includes(normalizedQuery);
  const matchesType = typeFilter === "all" || record.type === typeFilter;
  const matchesStatus = matchesStatusFilter(record, statusFilter);
  const matchesVisibility = matchesVisibilityFilter(record, visibilityFilter);

  return matchesSearch && matchesType && matchesStatus && matchesVisibility;
}

function groupRecordsByType(records: CombinedRecord[]) {
  const groups = createRecordGroups();

  for (const record of records) {
    addRecordToGroups(groups, record);
  }

  return groups;
}

function RecordCard({ record }: { record: CombinedRecord }) {
  return (
    <article className="break-inside-avoid rounded-card border border-line-base bg-surface-card p-4 shadow-sm print:mb-3 print:overflow-visible print:bg-white print:shadow-none">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={getRecordTypeTone(record.type)}>
              {getRecordTypeLabel(record.type)}
            </Badge>
            <Badge tone={getStatusTone(record.status)}>
              {getStatusLabel(record.status)}
            </Badge>
            <Badge tone={getVisibilityTone(record.visibility, record.sharedWithCoach)}>
              {getVisibilityLabel(record.visibility, record.sharedWithCoach)}
            </Badge>
          </div>
          <h3 className="mt-3 break-words font-semibold text-ink-strong">{record.title}</h3>
          <p className="mt-1 text-sm text-ink-muted">{record.dateLabel}</p>
        </div>
        <ButtonLink
          className="print:hidden"
          href={record.href}
          size="sm"
          variant="secondary"
        >
          자세히 보기
        </ButtonLink>
      </div>

      <dl className="mt-4 grid gap-3 text-sm text-ink-base">
        <div>
          <dt className="font-medium text-ink-muted">{record.primaryLabel}</dt>
          <dd className="mt-1 whitespace-pre-wrap break-words">
            {summarizeText(record.primaryText, 120)}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-ink-muted">{record.secondaryLabel}</dt>
          <dd className="mt-1 whitespace-pre-wrap break-words">
            {summarizeText(record.secondaryText, 120)}
          </dd>
        </div>
        {record.metaLabel ? (
          <div>
            <dt className="font-medium text-ink-muted">{record.metaLabel}</dt>
            <dd className="mt-1">{record.metaText ?? "-"}</dd>
          </div>
        ) : null}
      </dl>
    </article>
  );
}

export default async function MyCoachingRecordsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();

  if (!session.user) {
    redirect("/login?redirectTo=%2Fmy-coaching%2Frecords");
  }

  const supabase = await createSupabaseServerClient();
  const { data: profileTimezone } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("auth_user_id", session.user.id)
    .is("deleted_at", null)
    .maybeSingle();
  const profileTimezoneRow = profileTimezone as { timezone: string | null } | null;
  const effectiveTimezone = getEffectiveTimezone(profileTimezoneRow?.timezone);
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const query = normalizeParam(resolvedSearchParams.q);
  const typeFilter = normalizeRecordType(
    normalizeParam(resolvedSearchParams.type, "all"),
  );
  const statusFilter = normalizeStatus(
    normalizeParam(resolvedSearchParams.status, "all"),
  );
  const visibilityFilter = normalizeVisibility(
    normalizeParam(resolvedSearchParams.visibility, "all"),
  );
  const sortOption = normalizeSort(
    normalizeParam(resolvedSearchParams.sort, "newest"),
  );
  const hasActiveSearchOrFilter =
    normalizeSearch(query).length > 0 ||
    typeFilter !== "all" ||
    statusFilter !== "all" ||
    visibilityFilter !== "all" ||
    sortOption !== "newest";
  const recordsLimit = hasActiveSearchOrFilter
    ? RECORDS_PAGE_LIST_LIMIT
    : RECENT_RECORDS_LIMIT;
  const buildRecordParams = (recordType: RecordType) => {
    const params = new URLSearchParams({
      limit: String(recordsLimit),
    });

    if (query.trim().length > 0) {
      params.set("q", query.trim());
    }

    if (
      statusFilter !== "all" &&
      statusFilter !== "unknown" &&
      (recordType !== "weekly" || statusFilter !== "reviewed")
    ) {
      params.set("status", statusFilter);
    }

    if (
      visibilityFilter === "private" &&
      (recordType === "daily" || recordType === "monthly")
    ) {
      params.set("visibility", "private");
    }

    return params;
  };
  const [dailyResult, weeklyResult, monthlyResult] = await Promise.all([
    getDailyRecords(buildRecordParams("daily")),
    getRecentMyWeeklyLogs({
      limit: recordsLimit,
      search: query,
      status:
        statusFilter !== "all" && statusFilter !== "unknown"
          ? statusFilter
          : null,
    }),
    getMonthlyReflections(buildRecordParams("monthly")),
  ]);
  const dailyRecords = dailyResult.ok ? dailyResult.data : [];
  const weeklyLogs = weeklyResult.ok ? weeklyResult.data : [];
  const monthlyReflections = monthlyResult.ok ? monthlyResult.data : [];
  const recentDailyRecords = dailyRecords.slice(0, 3);
  const recentWeeklyLogs = weeklyLogs.slice(0, 3);
  const recentMonthlyReflections = monthlyReflections.slice(0, 3);
  const generatedAt = formatDateTimeInTimezone(new Date(), effectiveTimezone);

  const combinedRecords: CombinedRecord[] = [
    ...dailyRecords.map((record): CombinedRecord => ({
      id: record.id,
      type: "daily",
      title: displayText(record.title, "제목 없음"),
      dateLabel: `기록 날짜: ${formatDate(record.record_date, effectiveTimezone)}`,
      sortDate: `${record.record_date}T00:00:00.000Z`,
      printDate: record.record_date,
      printEndDate: null,
      printMonth: null,
      status: record.status,
      visibility: record.visibility,
      sharedWithCoach: record.shared_with_coach,
      searchText: [
        record.title,
        record.reflection,
        record.practice,
        record.prayer_request,
      ]
        .map((value) => value ?? "")
        .join(" "),
      href: "/my-coaching/records/daily",
      primaryLabel: "오늘의 돌아봄",
      primaryText: record.reflection,
      secondaryLabel: "실천/적용",
      secondaryText: record.practice,
      metaLabel: "기도제목",
      metaText: summarizeText(record.prayer_request, 80),
    })),
    ...weeklyLogs.map((weeklyLog): CombinedRecord => ({
      id: weeklyLog.id,
      type: "weekly",
      title: formatWeekRange(weeklyLog.weekStart, weeklyLog.weekEnd, effectiveTimezone),
      dateLabel: `주간 기간: ${formatWeekRange(
        weeklyLog.weekStart,
        weeklyLog.weekEnd,
        effectiveTimezone,
      )}`,
      sortDate: `${weeklyLog.weekStart}T00:00:00.000Z`,
      printDate: weeklyLog.weekStart,
      printEndDate: weeklyLog.weekEnd,
      printMonth: null,
      status: weeklyLog.status,
      visibility: null,
      sharedWithCoach: null,
      searchText: [
        weeklyLog.gratitude,
        weeklyLog.prayerRequest,
        weeklyLog.progressSummary,
        weeklyLog.difficulty,
        weeklyLog.messageToCoach,
      ]
        .map((value) => value ?? "")
        .join(" "),
      href: "/my-coaching/weekly-log",
      primaryLabel: "진행 요약",
      primaryText: weeklyLog.progressSummary,
      secondaryLabel: "감사 내용",
      secondaryText: weeklyLog.gratitude,
      metaLabel: "제출일",
      metaText: formatDateTime(weeklyLog.submittedAt, effectiveTimezone),
    })),
    ...monthlyReflections.map((reflection): CombinedRecord => ({
      id: reflection.id,
      type: "monthly",
      title: `${reflection.year}년 ${reflection.month}월`,
      dateLabel: `연도/월: ${reflection.year}년 ${reflection.month}월`,
      sortDate: `${reflection.year}-${String(reflection.month).padStart(
        2,
        "0",
      )}-01T00:00:00.000Z`,
      printDate: `${reflection.year}-${String(reflection.month).padStart(
        2,
        "0",
      )}-01`,
      printEndDate: null,
      printMonth: `${reflection.year}-${String(reflection.month).padStart(
        2,
        "0",
      )}`,
      status: reflection.status,
      visibility: reflection.visibility,
      sharedWithCoach: reflection.shared_with_coach,
      searchText: [
        reflection.summary,
        reflection.growth_points,
        reflection.difficulty,
        reflection.next_month_plan,
      ]
        .map((value) => value ?? "")
        .join(" "),
      href: "/my-coaching/records/monthly",
      primaryLabel: "한 달 요약",
      primaryText: reflection.summary,
      secondaryLabel: "성장한 점",
      secondaryText: reflection.growth_points,
      metaLabel: "다음 달 계획",
      metaText: summarizeText(reflection.next_month_plan, 80),
    })),
  ];
  const normalizedQuery = normalizeSearch(query);
  const filteredRecords = combinedRecords.filter((record) =>
    matchesRecordFilters({
      normalizedQuery,
      record,
      statusFilter,
      typeFilter,
      visibilityFilter,
    }),
  );
  filteredRecords.sort((first, second) =>
    compareRecords(first, second, sortOption),
  );
  const filterSummary = getFilterSummary({
    query,
    sort: sortOption,
    status: statusFilter,
    type: typeFilter,
    visibility: visibilityFilter,
  });
  const filteredRecordGroups = groupRecordsByType(filteredRecords);
  const recentRecordKeys = new Set<string>();

  for (const record of recentDailyRecords) {
    recentRecordKeys.add(`daily:${record.id}`);
  }

  for (const record of recentWeeklyLogs) {
    recentRecordKeys.add(`weekly:${record.id}`);
  }

  for (const record of recentMonthlyReflections) {
    recentRecordKeys.add(`monthly:${record.id}`);
  }

  const defaultPrintRecordGroups = createRecordGroups();

  for (const record of combinedRecords) {
    if (recentRecordKeys.has(`${record.type}:${record.id}`)) {
      addRecordToGroups(defaultPrintRecordGroups, record);
    }
  }

  const printRecords = hasActiveSearchOrFilter
    ? filteredRecords
    : defaultPrintRecordGroups.all;
  const printRecordGroups = hasActiveSearchOrFilter
    ? filteredRecordGroups
    : defaultPrintRecordGroups;
  const dailyPrintRecords = printRecordGroups.daily;
  const weeklyPrintRecords = printRecordGroups.weekly;
  const monthlyPrintRecords = printRecordGroups.monthly;
  const printRecordCountSummary = `전체 ${printRecords.length}개 / 하루 ${dailyPrintRecords.length}개 / 주간 ${weeklyPrintRecords.length}개 / 월간 ${monthlyPrintRecords.length}개`;
  const filenameToday = formatLocalDateForFilename(effectiveTimezone);
  const filenameMonth = filenameToday.slice(0, 7);
  const suggestedPrintTitles = {
    all: `all-records-${filenameToday}`,
    daily:
      dailyPrintRecords.length === 1
        ? `daily-record-${getFilenameDate(
            dailyPrintRecords[0].printDate,
            filenameToday,
          )}`
        : dailyPrintRecords.length > 1
          ? `daily-records-${filenameToday}`
          : `daily-record-${filenameToday}`,
    weekly:
      weeklyPrintRecords.length === 1
        ? `weekly-record-${getFilenameDate(
            weeklyPrintRecords[0].printDate,
            filenameToday,
          )}-to-${getFilenameDate(
            weeklyPrintRecords[0].printEndDate,
            filenameToday,
          )}`
        : weeklyPrintRecords.length > 1
          ? `weekly-records-${filenameToday}`
          : `weekly-record-${filenameToday}-to-${filenameToday}`,
    monthly:
      monthlyPrintRecords.length === 1
        ? `monthly-review-${getFilenameMonth(
            monthlyPrintRecords[0].printMonth,
            filenameMonth,
          )}`
        : monthlyPrintRecords.length > 1
          ? `monthly-reviews-${filenameToday}`
          : `monthly-review-${filenameMonth}`,
  };

  return (
    <main
      className="min-h-screen bg-surface-app px-4 py-5 text-ink-base print:bg-white print:px-0 print:py-0"
      data-records-print-page
    >
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 14mm;
          }

          [data-records-print-page] {
            color: #0f172a;
            font-size: 11pt;
            line-height: 1.45;
          }

          [data-records-print-page] * {
            box-shadow: none !important;
            text-shadow: none !important;
          }

          [data-records-print-page] a {
            color: inherit;
            text-decoration: none;
          }

          html[data-records-print-range="daily"] [data-records-print-page] [data-print-section]:not([data-print-section="daily"]),
          html[data-records-print-range="weekly"] [data-records-print-page] [data-print-section]:not([data-print-section="weekly"]),
          html[data-records-print-range="monthly"] [data-records-print-page] [data-print-section]:not([data-print-section="monthly"]) {
            display: none !important;
          }

          [data-print-range-label] {
            display: none;
          }

          html:not([data-records-print-range]) [data-print-range-label="all"],
          html[data-records-print-range="all"] [data-print-range-label="all"],
          html[data-records-print-range="daily"] [data-print-range-label="daily"],
          html[data-records-print-range="weekly"] [data-print-range-label="weekly"],
          html[data-records-print-range="monthly"] [data-print-range-label="monthly"] {
            display: inline;
          }

          [data-records-print-page] section[data-print-section] {
            break-inside: auto;
            page-break-inside: auto;
          }

          [data-records-print-page] article {
            break-inside: avoid;
            page-break-inside: avoid;
            max-width: 100%;
            overflow: visible;
          }

          [data-records-print-page] dl,
          [data-records-print-page] dd,
          [data-records-print-page] p {
            overflow-wrap: anywhere;
            word-break: break-word;
          }

          [data-records-print-page] .grid {
            break-inside: auto;
          }
        }
      `}</style>
      <section className="mx-auto w-full max-w-md print:max-w-none">
        <Card className="print:border-0 print:shadow-none">
          <CardHeader className="space-y-5">
          <div className="min-w-0">
            <Badge className="print:hidden" icon="report" tone="info">
              <I18nText k="myCoaching.records.badge" fallback="코칭 기록" />
            </Badge>
            <CardTitle className="mt-3 text-2xl print:hidden sm:text-3xl">
              <I18nText k="myCoaching.records.title" fallback="나의 기록" />
            </CardTitle>
            <h1 className="hidden text-3xl font-semibold print:block">
              <I18nText k="myCoaching.records.reportTitle" fallback="나의 기록 보고서" />
            </h1>
            <CardDescription className="mt-3 max-w-3xl">
              <I18nText
                k="myCoaching.records.description"
                fallback="하루, 주간, 월간 단위로 나의 코칭 여정과 실천 내용을 기록합니다."
              />
            </CardDescription>
            <p className="mt-3 hidden text-sm text-ink-muted print:block">
              <I18nText k="myCoaching.records.generatedAt" fallback="생성일" />: {generatedAt}
            </p>
            <p className="mt-2 hidden text-sm text-ink-muted print:block">
              <I18nText k="myCoaching.records.timezone" fallback="기준 시간대" />: {effectiveTimezone}
            </p>
            <p className="mt-2 hidden text-sm text-ink-muted print:block">
              <I18nText k="myCoaching.records.printRange" fallback="인쇄 범위" />:{" "}
              <span data-print-range-label="all">
                <I18nText k="myCoaching.records.currentResults" fallback="현재 결과 전체" />
              </span>
              <span data-print-range-label="daily">
                <I18nText k="myCoaching.records.daily" fallback="하루 기록" />
              </span>
              <span data-print-range-label="weekly">
                <I18nText k="myCoaching.records.weekly" fallback="주간 기록" />
              </span>
              <span data-print-range-label="monthly">
                <I18nText k="myCoaching.records.monthlyReflection" fallback="월간 회고" />
              </span>
            </p>
            <p className="mt-2 hidden text-sm text-ink-muted print:block">
              <I18nText
                k="myCoaching.records.printBasis"
                fallback="출력 기준: 현재 검색/필터/정렬 결과"
              />
              {!hasActiveSearchOrFilter ? (
                <>
                  {" · "}
                  <I18nText
                    k="myCoaching.records.noFilterRecentPrint"
                    fallback="필터 없음: 최근 기록 기준 출력"
                  />
                </>
              ) : null}
            </p>
            <p className="mt-2 hidden text-sm text-ink-muted print:block">
              <I18nText k="myCoaching.records.appliedFilters" fallback="적용된 필터" />: {filterSummary}
            </p>
            <p className="mt-2 hidden text-sm text-ink-muted print:block">
              <I18nText k="myCoaching.records.recordCount" fallback="기록 수" />: {printRecordCountSummary}
            </p>
          </div>
          <div className="print:hidden">
            <div className="rounded-card border border-line-base bg-surface-card p-3 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="shrink-0">
                  <LanguageSwitcher />
                </div>
                <div className="flex min-w-0 justify-start lg:justify-end">
                  <PrintRecordsButton suggestedTitles={suggestedPrintTitles} />
                </div>
              </div>
            </div>

            <div className="mt-3 rounded-control border border-line-base bg-surface-sunken p-3 text-sm leading-6 text-ink-muted">
              <p>
                <I18nText
                  k="myCoaching.records.printNotice"
                  fallback="현재 검색어, 기록 유형, 상태, 공유, 정렬 기준이 인쇄물에 반영됩니다."
                />
              </p>
              <p className="mt-1">
                <I18nText
                  k="myCoaching.records.printNoticeDetail"
                  fallback="필터가 없으면 최근 하루/주간/월간 기록 중심으로 출력됩니다. 브라우저 인쇄창에서 PDF 저장을 선택할 수 있습니다. 모바일 브라우저에서는 PDF 저장 옵션이 기기와 브라우저에 따라 다르게 표시될 수 있습니다. 인쇄창이 열리지 않으면 Safari 또는 Chrome에서 다시 열어 주세요."
                />
              </p>
            </div>

            <nav className="mt-4 flex flex-col gap-2 border-t border-line-base pt-4 sm:flex-row sm:flex-wrap">
              <ButtonLink href="/my-coaching/moksilgi" icon="report" size="sm" variant="secondary">
                <I18nText k="myCoaching.myMoksilgi" fallback="나의 목실기" />
              </ButtonLink>
            </nav>
          </div>
          </CardHeader>
        </Card>

        <Card className="mt-8 print:hidden">
          <CardHeader>
            <CardTitle>
              <I18nText k="myCoaching.records.chooseType" fallback="기록 방식 선택" />
            </CardTitle>
            <CardDescription>
              <I18nText
                k="myCoaching.records.chooseTypeDescription"
                fallback="하루, 주간, 월간 기록 중 필요한 기록 방식을 선택해 주세요."
              />
            </CardDescription>
          </CardHeader>
          <CardContent>
          <div className="grid gap-3">
            <ButtonLink
              className="h-full flex-col items-start justify-start p-4 text-left"
              href="/my-coaching/records/daily"
              icon="report"
              variant="secondary"
            >
              <p className="font-medium text-ink-strong">
                <I18nText k="myCoaching.records.daily" fallback="하루 기록" />
              </p>
              <p className="mt-2 text-sm text-ink-muted">
                <I18nText
                  k="myCoaching.records.dailyDescription"
                  fallback="오늘의 묵상, 실천, 적용, 기도제목을 간단히 기록합니다."
                />
              </p>
              <p className="mt-4 text-sm font-medium text-ink-base underline">
                <I18nText k="myCoaching.records.writeDaily" fallback="하루 기록 작성" />
              </p>
            </ButtonLink>

            <ButtonLink
              className="h-full flex-col items-start justify-start p-4 text-left"
              href="/my-coaching/weekly-log"
              icon="report"
              variant="secondary"
            >
              <p className="font-medium text-ink-strong">
                <I18nText k="myCoaching.records.weekly" fallback="주간 기록" />
              </p>
              <p className="mt-2 text-sm text-ink-muted">
                <I18nText
                  k="myCoaching.records.weeklyDescription"
                  fallback="한 주간의 목표 실행과 목실기 실천을 정리합니다."
                />
              </p>
              <p className="mt-4 text-sm font-medium text-ink-base underline">
                <I18nText k="myCoaching.records.writeWeekly" fallback="주간 기록 작성" />
              </p>
            </ButtonLink>

            <ButtonLink
              className="h-full flex-col items-start justify-start p-4 text-left"
              href="/my-coaching/records/monthly"
              icon="report"
              variant="secondary"
            >
              <p className="font-medium text-ink-strong">
                <I18nText k="myCoaching.records.monthly" fallback="월간 기록" />
              </p>
              <p className="mt-2 text-sm text-ink-muted">
                <I18nText
                  k="myCoaching.records.monthlyDescription"
                  fallback="한 달 동안의 성장과 다음 달 계획을 정리합니다."
                />
              </p>
              <p className="mt-4 text-sm font-medium text-ink-base underline">
                <I18nText k="myCoaching.records.writeMonthly" fallback="월간 회고 작성" />
              </p>
            </ButtonLink>
          </div>
          </CardContent>
        </Card>

        <Card className="mt-8 print:hidden">
          <CardHeader>
            <CardTitle>
              <I18nText k="myCoaching.records.searchFilterTitle" fallback="나의 기록 검색/필터" />
            </CardTitle>
            <CardDescription>
              <I18nText
                k="myCoaching.records.searchFilterDescription"
                fallback="하루, 주간, 월간 기록을 함께 검색하고 필요한 조건으로 정리합니다."
              />
            </CardDescription>
          </CardHeader>
          <CardContent>
          <form className="mt-5 grid gap-4" method="get">
            <FieldLabel htmlFor="q">
              <FieldText>
                <I18nText k="myCoaching.records.filters.searchLabel" fallback="검색어" />
              </FieldText>
              <TextInput
                defaultValue={query}
                id="q"
                name="q"
                type="search"
              />
              <p className="mt-1 text-xs leading-5 text-ink-muted">
                <I18nText
                  k="myCoaching.records.filters.searchPlaceholder"
                  fallback="제목, 돌아봄, 기도제목, 진행요약, 회고 내용 검색"
                />
              </p>
            </FieldLabel>

            <div className="grid gap-3">
              <FieldLabel htmlFor="type">
                <FieldText>
                  <I18nText k="myCoaching.records.filters.recordType" fallback="기록 유형" />
                </FieldText>
                <SelectInput
                  defaultValue={typeFilter}
                  id="type"
                  name="type"
                >
                  <option value="all">
                    <I18nText k="myCoaching.records.filters.all" fallback="전체" />
                  </option>
                  <option value="daily">
                    <I18nText k="myCoaching.records.daily" fallback="하루 기록" />
                  </option>
                  <option value="weekly">
                    <I18nText k="myCoaching.records.weekly" fallback="주간 기록" />
                  </option>
                  <option value="monthly">
                    <I18nText k="myCoaching.records.monthlyReflection" fallback="월간 회고" />
                  </option>
                </SelectInput>
              </FieldLabel>

              <FieldLabel htmlFor="status">
                <FieldText>
                  <I18nText k="myCoaching.records.filters.status" fallback="상태" />
                </FieldText>
                <SelectInput
                  defaultValue={statusFilter}
                  id="status"
                  name="status"
                >
                  <option value="all">
                    <I18nText k="myCoaching.records.filters.all" fallback="전체" />
                  </option>
                  <option value="draft">
                    <I18nText k="myCoaching.records.filters.draft" fallback="임시저장" />
                  </option>
                  <option value="submitted">
                    <I18nText k="myCoaching.records.filters.submitted" fallback="제출완료" />
                  </option>
                  <option value="reviewed">
                    <I18nText k="myCoaching.records.filters.reviewed" fallback="검토완료" />
                  </option>
                  <option value="unknown">
                    <I18nText k="myCoaching.records.filters.unknown" fallback="확인 필요" />
                  </option>
                </SelectInput>
              </FieldLabel>

              <FieldLabel htmlFor="visibility">
                <FieldText>
                  <I18nText k="myCoaching.records.filters.visibility" fallback="공유" />
                </FieldText>
                <SelectInput
                  defaultValue={visibilityFilter}
                  id="visibility"
                  name="visibility"
                >
                  <option value="all">
                    <I18nText k="myCoaching.records.filters.all" fallback="전체" />
                  </option>
                  <option value="private">
                    <I18nText k="myCoaching.records.filters.private" fallback="나만 보기" />
                  </option>
                  <option value="coach">
                    <I18nText k="myCoaching.records.filters.coachShared" fallback="코치에게 공유" />
                  </option>
                </SelectInput>
              </FieldLabel>

              <FieldLabel htmlFor="sort">
                <FieldText>
                  <I18nText k="myCoaching.records.filters.sort" fallback="정렬" />
                </FieldText>
                <SelectInput
                  defaultValue={sortOption}
                  id="sort"
                  name="sort"
                >
                  <option value="newest">
                    <I18nText k="myCoaching.records.filters.newest" fallback="최신순" />
                  </option>
                  <option value="oldest">
                    <I18nText k="myCoaching.records.filters.oldest" fallback="오래된순" />
                  </option>
                  <option value="type">
                    <I18nText k="myCoaching.records.filters.typeSort" fallback="기록 유형순" />
                  </option>
                  <option value="status">
                    <I18nText k="myCoaching.records.filters.statusSort" fallback="상태순" />
                  </option>
                </SelectInput>
              </FieldLabel>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-ink-muted">
                <ResultCountText
                  shown={filteredRecords.length}
                  total={combinedRecords.length}
                />
              </p>
              <div className="flex flex-wrap gap-2">
                <ButtonLink
                  href="/my-coaching/records"
                  icon="filter"
                  variant="secondary"
                >
                  <I18nText k="myCoaching.records.resetFilters" fallback="필터 초기화" />
                </ButtonLink>
                <Button icon="search" type="submit">
                  <I18nText k="myCoaching.records.applyFilters" fallback="필터 적용" />
                </Button>
              </div>
            </div>
          </form>
          </CardContent>
        </Card>

        <Card className="mt-8 print:hidden">
          <CardHeader>
            <CardTitle>
              <I18nText k="myCoaching.records.recentTitle" fallback="최근 나의 기록" />
            </CardTitle>
            <CardDescription>
              <I18nText
                k="myCoaching.records.recentDescription"
                fallback="하루, 주간, 월간 기록의 최근 내용을 한눈에 확인합니다."
              />
            </CardDescription>
          </CardHeader>

          <CardContent>
          <div className="grid gap-3">
            <Card className="bg-surface-sunken">
              <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-ink-strong">
                    <I18nText k="myCoaching.records.recentDaily" fallback="최근 하루 기록" />
                  </h3>
                  <p className="mt-1 text-sm text-ink-muted">
                    <I18nText k="myCoaching.records.latestDailyThree" fallback="최신 기록 날짜순 3개" />
                  </p>
                </div>
                <ButtonLink
                  className="shrink-0"
                  href="/my-coaching/records/daily"
                  size="sm"
                  variant="secondary"
                >
                  <I18nText k="myCoaching.records.goDaily" fallback="하루 기록으로 이동" />
                </ButtonLink>
              </div>

              {!dailyResult.ok ? (
                <div className="mt-4 rounded-control border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  <I18nText k="myCoaching.records.dailyLoadFailed" fallback="하루 기록을 불러오지 못했습니다." />
                </div>
              ) : recentDailyRecords.length === 0 ? (
                <div className="mt-4 rounded-control border border-line-base bg-surface-card p-3 text-sm text-ink-muted">
                  <I18nText k="myCoaching.records.noDaily" fallback="아직 작성한 하루 기록이 없습니다." />
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {recentDailyRecords.map((record) => (
                    <RecordCard
                      key={record.id}
                      record={{
                        dateLabel: `기록 날짜: ${formatDate(record.record_date, effectiveTimezone)}`,
                        href: "/my-coaching/records/daily",
                        id: record.id,
                        metaLabel: "기도제목",
                        metaText: summarizeText(record.prayer_request, 80),
                        primaryLabel: "오늘의 돌아봄",
                        primaryText: record.reflection,
                        printDate: record.record_date,
                        printEndDate: null,
                        printMonth: null,
                        searchText: "",
                        secondaryLabel: "실천/적용",
                        secondaryText: record.practice,
                        sharedWithCoach: record.shared_with_coach,
                        sortDate: `${record.record_date}T00:00:00.000Z`,
                        status: record.status,
                        title: displayText(record.title, "제목 없음"),
                        type: "daily",
                        visibility: record.visibility,
                      }}
                    />
                  ))}
                </div>
              )}
              </CardContent>
            </Card>

            <Card className="bg-surface-sunken">
              <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-ink-strong">
                    <I18nText k="myCoaching.records.recentWeekly" fallback="최근 주간 기록" />
                  </h3>
                  <p className="mt-1 text-sm text-ink-muted">
                    <I18nText k="myCoaching.records.latestWeeklyThree" fallback="최신 주간 기간순 3개" />
                  </p>
                </div>
                <ButtonLink
                  className="shrink-0"
                  href="/my-coaching/weekly-log"
                  size="sm"
                  variant="secondary"
                >
                  <I18nText k="myCoaching.records.goWeekly" fallback="주간 기록으로 이동" />
                </ButtonLink>
              </div>

              {!weeklyResult.ok ? (
                <div className="mt-4 rounded-control border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  <I18nText k="myCoaching.records.weeklyLoadFailed" fallback="주간 기록을 불러오지 못했습니다." />
                </div>
              ) : recentWeeklyLogs.length === 0 ? (
                <div className="mt-4 rounded-control border border-line-base bg-surface-card p-3 text-sm text-ink-muted">
                  <I18nText k="myCoaching.records.noWeekly" fallback="아직 작성한 주간 기록이 없습니다." />
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {recentWeeklyLogs.map((weeklyLog) => (
                    <RecordCard
                      key={weeklyLog.id}
                      record={{
                        dateLabel: `주간 기간: ${formatWeekRange(
                          weeklyLog.weekStart,
                          weeklyLog.weekEnd,
                          effectiveTimezone,
                        )}`,
                        href: "/my-coaching/weekly-log",
                        id: weeklyLog.id,
                        metaLabel: "제출일",
                        metaText: formatDateTime(weeklyLog.submittedAt, effectiveTimezone),
                        primaryLabel: "진행 요약",
                        primaryText: weeklyLog.progressSummary,
                        printDate: weeklyLog.weekStart,
                        printEndDate: weeklyLog.weekEnd,
                        printMonth: null,
                        searchText: "",
                        secondaryLabel: "감사 내용",
                        secondaryText: weeklyLog.gratitude,
                        sharedWithCoach: null,
                        sortDate: `${weeklyLog.weekStart}T00:00:00.000Z`,
                        status: weeklyLog.status,
                        title: formatWeekRange(
                          weeklyLog.weekStart,
                          weeklyLog.weekEnd,
                          effectiveTimezone,
                        ),
                        type: "weekly",
                        visibility: null,
                      }}
                    />
                  ))}
                </div>
              )}
              </CardContent>
            </Card>

            <Card className="bg-surface-sunken">
              <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-ink-strong">
                    <I18nText k="myCoaching.records.recentMonthly" fallback="최근 월간 회고" />
                  </h3>
                  <p className="mt-1 text-sm text-ink-muted">
                    <I18nText k="myCoaching.records.latestMonthlyThree" fallback="최신 연도/월순 3개" />
                  </p>
                </div>
                <ButtonLink
                  className="shrink-0"
                  href="/my-coaching/records/monthly"
                  size="sm"
                  variant="secondary"
                >
                  <I18nText k="myCoaching.records.goMonthly" fallback="월간 회고로 이동" />
                </ButtonLink>
              </div>

              {!monthlyResult.ok ? (
                <div className="mt-4 rounded-control border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  <I18nText k="myCoaching.records.monthlyLoadFailed" fallback="월간 회고를 불러오지 못했습니다." />
                </div>
              ) : recentMonthlyReflections.length === 0 ? (
                <div className="mt-4 rounded-control border border-line-base bg-surface-card p-3 text-sm text-ink-muted">
                  <I18nText k="myCoaching.records.noMonthly" fallback="아직 작성한 월간 회고가 없습니다." />
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {recentMonthlyReflections.map((reflection) => (
                    <RecordCard
                      key={reflection.id}
                      record={{
                        dateLabel: `연도/월: ${reflection.year}년 ${reflection.month}월`,
                        href: "/my-coaching/records/monthly",
                        id: reflection.id,
                        metaLabel: "다음 달 계획",
                        metaText: summarizeText(reflection.next_month_plan, 80),
                        primaryLabel: "한 달 요약",
                        primaryText: reflection.summary,
                        printDate: `${reflection.year}-${String(
                          reflection.month,
                        ).padStart(2, "0")}-01`,
                        printEndDate: null,
                        printMonth: `${reflection.year}-${String(
                          reflection.month,
                        ).padStart(2, "0")}`,
                        searchText: "",
                        secondaryLabel: "성장한 점",
                        secondaryText: reflection.growth_points,
                        sharedWithCoach: reflection.shared_with_coach,
                        sortDate: `${reflection.year}-${String(
                          reflection.month,
                        ).padStart(2, "0")}-01T00:00:00.000Z`,
                        status: reflection.status,
                        title: `${reflection.year}년 ${reflection.month}월`,
                        type: "monthly",
                        visibility: reflection.visibility,
                      }}
                    />
                  ))}
                </div>
              )}
              </CardContent>
            </Card>
          </div>
          </CardContent>
        </Card>

        <section className={getRecordsResultSectionClass(hasActiveSearchOrFilter)}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">
                <I18nText k="myCoaching.records.searchResults" fallback="검색 결과" />
              </h2>
              <p className="mt-2 text-sm text-ink-muted">
                <ResultCountText
                  shown={printRecords.length}
                  total={combinedRecords.length}
                />
              </p>
              <p className="mt-2 text-sm text-ink-muted">
                <I18nText k="myCoaching.records.appliedFilters" fallback="적용된 필터" />: {filterSummary}
              </p>
            </div>
          </div>

          {printRecords.length === 0 ? (
            <div className="mt-5 rounded-control border border-line-base bg-surface-sunken p-4 text-sm text-ink-muted">
              <p>
                <I18nText
                  k="myCoaching.records.noRecordsForConditions"
                  fallback="선택한 조건 또는 인쇄 범위에 해당하는 기록이 없습니다."
                />
              </p>
              <p className="mt-1">
                <I18nText
                  k="myCoaching.records.resetOrCreate"
                  fallback="필터를 초기화하거나 새 기록을 작성해 주세요."
                />
              </p>
              <div className="mt-4 flex flex-wrap gap-2 print:hidden">
                <ButtonLink
                  href="/my-coaching/records"
                  icon="filter"
                  size="sm"
                  variant="secondary"
                >
                  <I18nText k="myCoaching.records.resetFilters" fallback="필터 초기화" />
                </ButtonLink>
                <ButtonLink
                  href="/my-coaching/records/daily"
                  icon="report"
                  size="sm"
                >
                  <I18nText k="myCoaching.records.writeDaily" fallback="하루 기록 작성" />
                </ButtonLink>
                <ButtonLink
                  href="/my-coaching/weekly-log"
                  icon="report"
                  size="sm"
                  variant="secondary"
                >
                  <I18nText k="myCoaching.records.writeWeekly" fallback="주간 기록 작성" />
                </ButtonLink>
              </div>
            </div>
          ) : (
            <div className="mt-5 grid gap-6">
              <section data-print-section="daily">
                <h3 className="border-b border-line-base pb-2 font-semibold">
                  <I18nText k="myCoaching.records.dailyResults" fallback="하루 기록 결과" />
                </h3>
                {dailyPrintRecords.length === 0 ? (
                  <p className="mt-3 text-sm text-ink-muted">
                    <I18nText
                      k="myCoaching.records.noDailyResults"
                      fallback="선택한 조건에 해당하는 하루 기록이 없습니다."
                    />
                  </p>
                ) : (
                  <div className="mt-3 grid gap-3">
                    {dailyPrintRecords.map((record) => (
                      <RecordCard key={record.id} record={record} />
                    ))}
                  </div>
                )}
              </section>

              <section data-print-section="weekly">
                <h3 className="border-b border-line-base pb-2 font-semibold">
                  <I18nText k="myCoaching.records.weeklyResults" fallback="주간 기록 결과" />
                </h3>
                {weeklyPrintRecords.length === 0 ? (
                  <p className="mt-3 text-sm text-ink-muted">
                    <I18nText
                      k="myCoaching.records.noWeeklyResults"
                      fallback="선택한 조건에 해당하는 주간 기록이 없습니다."
                    />
                  </p>
                ) : (
                  <div className="mt-3 grid gap-3">
                    {weeklyPrintRecords.map((record) => (
                      <RecordCard key={record.id} record={record} />
                    ))}
                  </div>
                )}
              </section>

              <section data-print-section="monthly">
                <h3 className="border-b border-line-base pb-2 font-semibold">
                  <I18nText k="myCoaching.records.monthlyResults" fallback="월간 회고 결과" />
                </h3>
                {monthlyPrintRecords.length === 0 ? (
                  <p className="mt-3 text-sm text-ink-muted">
                    <I18nText
                      k="myCoaching.records.noMonthlyResults"
                      fallback="선택한 조건에 해당하는 월간 회고가 없습니다."
                    />
                  </p>
                ) : (
                  <div className="mt-3 grid gap-3">
                    {monthlyPrintRecords.map((record) => (
                      <RecordCard key={record.id} record={record} />
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
