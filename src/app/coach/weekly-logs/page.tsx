import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getCoachWeeklyLogs,
  type CoachWeeklyLogEntry,
} from "@/lib/api/coach/weekly-logs";
import { getCoachDailyLogs, type CoachDailyLogEntry } from "@/lib/api/coach/daily-logs";
import {
  getCoachMonthlyReflections,
  type CoachMonthlyReflectionEntry,
} from "@/lib/api/coach/monthly-reflections";
import {
  DEFAULT_TIMEZONE,
  getCurrentWeekRangeInTimezone,
  getCurrentMonthInTimezone,
  getCurrentYearInTimezone,
} from "@/lib/timezone";

type ViewType = "daily" | "weekly" | "monthly";
type WeeklyFilterType = "this_week_submitted" | "feedback_pending" | null;
type DailyFilterType = "this_week" | null;
type MonthlyFilterType = "this_month" | null;

const STATUS_LABEL: Record<string, string> = {
  draft: "임시 저장",
  submitted: "제출됨",
  archived: "보관됨",
  reviewed: "검토 완료",
};

const RELATIONSHIP_TYPE_LABEL: Record<string, string> = {
  individual_coaching: "개인 코칭",
  group_coaching: "그룹 코칭",
  leadership_coaching: "리더십 코칭",
  pastoral_coaching: "목회 코칭",
  missionary_coaching: "선교사 코칭",
};

function statusLabel(value: string) {
  return STATUS_LABEL[value] ?? value;
}

function relationshipTypeLabel(value: string | null) {
  if (!value) return "-";
  return RELATIONSHIP_TYPE_LABEL[value] ?? value;
}

function coacheeName(entry: {
  coachee_display_name: string | null;
  coachee_full_name: string | null;
  coachee_email: string | null;
}) {
  return entry.coachee_display_name ?? entry.coachee_full_name ?? entry.coachee_email ?? "-";
}

function formatDate(value: string | null) {
  if (!value) return "-";
  return value.slice(0, 10);
}

function StatusBadge({ status }: { status: string }) {
  let color = "bg-surface-sunken text-ink-muted";
  if (status === "submitted") color = "bg-green-100 text-green-700";
  if (status === "draft") color = "bg-yellow-100 text-yellow-700";
  if (status === "archived") color = "bg-surface-sunken text-ink-faint";
  if (status === "reviewed") color = "bg-blue-100 text-blue-700";
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {statusLabel(status)}
    </span>
  );
}

function TabNav({ current }: { current: ViewType }) {
  const tabs: { view: ViewType; label: string }[] = [
    { view: "daily", label: "하루" },
    { view: "weekly", label: "주간" },
    { view: "monthly", label: "월간" },
  ];
  return (
    <div className="mt-6 flex gap-1 border-b border-line-base">
      {tabs.map(({ view, label }) => {
        const active = current === view;
        return (
          <Link
            key={view}
            href={`/coach/weekly-logs?view=${view}`}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              active
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-ink-muted hover:text-ink-strong"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}

function FilterBadge({ label, clearHref }: { label: string; clearHref: string }) {
  return (
    <div className="mt-4 flex items-center gap-2">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
        <span>필터: {label}</span>
        <Link
          href={clearHref}
          className="ml-1 text-blue-400 hover:text-blue-700"
          aria-label="필터 초기화"
        >
          ✕
        </Link>
      </span>
      <span className="text-xs text-ink-faint">필터를 해제하면 전체 목록을 봅니다.</span>
    </div>
  );
}

function WeeklyLogsTable({ logs }: { logs: CoachWeeklyLogEntry[] }) {
  if (logs.length === 0) {
    return (
      <p className="mt-8 rounded-md border border-line-base bg-surface-card px-4 py-6 text-center text-ink-faint">
        해당 조건의 주간 기록이 없습니다.
      </p>
    );
  }
  return (
    <div className="mt-4 overflow-x-auto rounded-md border border-line-base bg-surface-card">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-line-base bg-surface-sunken text-xs font-medium uppercase tracking-wide text-ink-faint">
          <tr>
            <th className="px-4 py-3">코치이</th>
            <th className="px-4 py-3">주간 기간</th>
            <th className="px-4 py-3">상태</th>
            <th className="px-4 py-3">관계 유형</th>
            <th className="px-4 py-3">제출일</th>
            <th className="px-4 py-3">수정일</th>
            <th className="px-4 py-3">보기</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line-soft">
          {logs.map((entry) => (
            <tr key={entry.id} className="hover:bg-surface-sunken">
              <td className="px-4 py-3 font-medium">{coacheeName(entry)}</td>
              <td className="px-4 py-3">
                {formatDate(entry.week_start)} ~ {formatDate(entry.week_end)}
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={entry.status} />
              </td>
              <td className="px-4 py-3">{relationshipTypeLabel(entry.relationship_type)}</td>
              <td className="px-4 py-3">{formatDate(entry.submitted_at)}</td>
              <td className="px-4 py-3">{formatDate(entry.updated_at)}</td>
              <td className="px-4 py-3">
                <Link
                  href={`/coach/weekly-logs/${entry.id}`}
                  className="font-medium text-blue-600 hover:underline"
                >
                  상세 보기
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DailyLogsTable({ logs }: { logs: CoachDailyLogEntry[] }) {
  if (logs.length === 0) {
    return (
      <p className="mt-8 rounded-md border border-line-base bg-surface-card px-4 py-6 text-center text-ink-faint">
        해당 조건의 하루 기록이 없습니다.
      </p>
    );
  }
  return (
    <div className="mt-4 overflow-x-auto rounded-md border border-line-base bg-surface-card">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-line-base bg-surface-sunken text-xs font-medium uppercase tracking-wide text-ink-faint">
          <tr>
            <th className="px-4 py-3">코치이</th>
            <th className="px-4 py-3">기록 날짜</th>
            <th className="px-4 py-3">상태</th>
            <th className="px-4 py-3">관계 유형</th>
            <th className="px-4 py-3">제출일</th>
            <th className="px-4 py-3">수정일</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line-soft">
          {logs.map((entry) => (
            <tr key={entry.id} className="hover:bg-surface-sunken">
              <td className="px-4 py-3 font-medium">{coacheeName(entry)}</td>
              <td className="px-4 py-3">{formatDate(entry.record_date)}</td>
              <td className="px-4 py-3">
                <StatusBadge status={entry.status} />
              </td>
              <td className="px-4 py-3">{relationshipTypeLabel(entry.relationship_type)}</td>
              <td className="px-4 py-3">{formatDate(entry.submitted_at)}</td>
              <td className="px-4 py-3">{formatDate(entry.updated_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MonthlyReflectionsTable({ reflections }: { reflections: CoachMonthlyReflectionEntry[] }) {
  if (reflections.length === 0) {
    return (
      <p className="mt-8 rounded-md border border-line-base bg-surface-card px-4 py-6 text-center text-ink-faint">
        해당 조건의 월간 회고가 없습니다.
      </p>
    );
  }
  return (
    <div className="mt-4 overflow-x-auto rounded-md border border-line-base bg-surface-card">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-line-base bg-surface-sunken text-xs font-medium uppercase tracking-wide text-ink-faint">
          <tr>
            <th className="px-4 py-3">코치이</th>
            <th className="px-4 py-3">연월</th>
            <th className="px-4 py-3">상태</th>
            <th className="px-4 py-3">관계 유형</th>
            <th className="px-4 py-3">제출일</th>
            <th className="px-4 py-3">검토일</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line-soft">
          {reflections.map((entry) => (
            <tr key={entry.id} className="hover:bg-surface-sunken">
              <td className="px-4 py-3 font-medium">{coacheeName(entry)}</td>
              <td className="px-4 py-3">
                {entry.year}년 {entry.month}월
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={entry.status} />
              </td>
              <td className="px-4 py-3">{relationshipTypeLabel(entry.relationship_type)}</td>
              <td className="px-4 py-3">{formatDate(entry.submitted_at)}</td>
              <td className="px-4 py-3">{formatDate(entry.reviewed_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const VIEW_DESC: Record<ViewType, string> = {
  daily: "담당 코치이가 공유한 하루 기록을 확인합니다.",
  weekly: "담당 코치이가 제출한 주간 기록을 확인합니다.",
  monthly: "담당 코치이가 공유한 월간 회고를 확인합니다.",
};

const WEEKLY_FILTER_LABEL: Record<NonNullable<WeeklyFilterType>, string> = {
  this_week_submitted: "이번 주 제출된 기록",
  feedback_pending: "피드백 대기 (제출 완료)",
};

const DAILY_FILTER_LABEL: Record<NonNullable<DailyFilterType>, string> = {
  this_week: "이번 주 하루 기록",
};

const MONTHLY_FILTER_LABEL: Record<NonNullable<MonthlyFilterType>, string> = {
  this_month: "이번 달 월간 회고",
};

function PageShell({
  children,
  filterBadge,
  view,
}: {
  children: React.ReactNode;
  filterBadge?: React.ReactNode;
  view: ViewType;
}) {
  return (
    <main className="min-h-screen bg-surface-app px-6 py-10 text-ink-strong">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-semibold">기록 현황</h1>
        <p className="mt-1 text-sm text-ink-muted">{VIEW_DESC[view]}</p>
        <TabNav current={view} />
        {filterBadge}
        <div className="mt-2">{children}</div>
      </div>
    </main>
  );
}

function ProfileNotFound() {
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

function ErrorMessage({ message }: { message: string }) {
  return (
    <p className="mt-4 rounded-control border border-red-200 bg-red-50 px-4 py-3 text-red-700">
      {message}
    </p>
  );
}

export default async function CoachRecordsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; filter?: string }>;
}) {
  const params = await searchParams;
  const rawView = params.view;
  const rawFilter = params.filter ?? null;

  const view: ViewType =
    rawView === "daily" || rawView === "monthly" ? rawView : "weekly";

  const tz = DEFAULT_TIMEZONE;
  const weekRange = getCurrentWeekRangeInTimezone(tz);
  const currentYear = getCurrentYearInTimezone(tz);
  const currentMonth = getCurrentMonthInTimezone(tz);

  // ── 주간 뷰 ──────────────────────────────────────────────────────────
  if (view === "weekly") {
    const weeklyFilter: WeeklyFilterType =
      rawFilter === "this_week_submitted" || rawFilter === "feedback_pending"
        ? rawFilter
        : null;

    const result = await getCoachWeeklyLogs();

    if (result.error?.code === "UNAUTHORIZED") {
      redirect("/login?redirectTo=/coach/weekly-logs");
    }
    if (result.error?.code === "PROFILE_NOT_FOUND") {
      return <ProfileNotFound />;
    }

    let logs = result.data ?? [];

    if (weeklyFilter === "this_week_submitted") {
      logs = logs.filter(
        (log) =>
          log.status === "submitted" &&
          log.week_start <= weekRange.weekEnd &&
          log.week_end >= weekRange.weekStart,
      );
    } else if (weeklyFilter === "feedback_pending") {
      logs = logs.filter((log) => log.status === "submitted");
    }

    const filterBadge = weeklyFilter ? (
      <FilterBadge
        label={WEEKLY_FILTER_LABEL[weeklyFilter]}
        clearHref="/coach/weekly-logs?view=weekly"
      />
    ) : undefined;

    return (
      <PageShell view={view} filterBadge={filterBadge}>
        {result.error ? (
          <ErrorMessage message="지금 주간 기록을 불러올 수 없습니다." />
        ) : (
          <>
            {weeklyFilter ? (
              <p className="mt-3 text-xs text-ink-faint">
                {logs.length}건이 표시됩니다.
              </p>
            ) : null}
            <WeeklyLogsTable logs={logs} />
          </>
        )}
      </PageShell>
    );
  }

  // ── 하루 뷰 ──────────────────────────────────────────────────────────
  if (view === "daily") {
    const dailyFilter: DailyFilterType =
      rawFilter === "this_week" ? rawFilter : null;

    const result = await getCoachDailyLogs();

    if (result.error?.code === "UNAUTHORIZED") {
      redirect("/login?redirectTo=/coach/weekly-logs?view=daily");
    }
    if (result.error?.code === "PROFILE_NOT_FOUND") {
      return <ProfileNotFound />;
    }

    let logs = result.data ?? [];

    if (dailyFilter === "this_week") {
      logs = logs.filter(
        (log) =>
          log.record_date >= weekRange.weekStart &&
          log.record_date <= weekRange.weekEnd,
      );
    }

    const filterBadge = dailyFilter ? (
      <FilterBadge
        label={DAILY_FILTER_LABEL[dailyFilter]}
        clearHref="/coach/weekly-logs?view=daily"
      />
    ) : undefined;

    return (
      <PageShell view={view} filterBadge={filterBadge}>
        {result.error ? (
          <ErrorMessage message="지금 하루 기록을 불러올 수 없습니다." />
        ) : (
          <>
            {dailyFilter ? (
              <p className="mt-3 text-xs text-ink-faint">
                {logs.length}건이 표시됩니다.
              </p>
            ) : null}
            <DailyLogsTable logs={logs} />
          </>
        )}
      </PageShell>
    );
  }

  // ── 월간 뷰 ──────────────────────────────────────────────────────────
  const monthlyFilter: MonthlyFilterType =
    rawFilter === "this_month" ? rawFilter : null;

  const result = await getCoachMonthlyReflections();

  if (result.error?.code === "UNAUTHORIZED") {
    redirect("/login?redirectTo=/coach/weekly-logs?view=monthly");
  }
  if (result.error?.code === "PROFILE_NOT_FOUND") {
    return <ProfileNotFound />;
  }

  let reflections = result.data ?? [];

  if (monthlyFilter === "this_month") {
    reflections = reflections.filter(
      (r) => r.year === currentYear && r.month === currentMonth,
    );
  }

  const filterBadge = monthlyFilter ? (
    <FilterBadge
      label={MONTHLY_FILTER_LABEL[monthlyFilter]}
      clearHref="/coach/weekly-logs?view=monthly"
    />
  ) : undefined;

  return (
    <PageShell view={view} filterBadge={filterBadge}>
      {result.error ? (
        <ErrorMessage message="지금 월간 회고를 불러올 수 없습니다." />
      ) : (
        <>
          {monthlyFilter ? (
            <p className="mt-3 text-xs text-ink-faint">
              {reflections.length}건이 표시됩니다.
            </p>
          ) : null}
          <MonthlyReflectionsTable reflections={reflections} />
        </>
      )}
    </PageShell>
  );
}
