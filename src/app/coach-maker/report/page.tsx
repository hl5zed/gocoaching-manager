import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getCoachMakerMoksilgiProgress,
  type CoachMakerMoksilgiProgressRow,
} from "@/lib/api/coach-maker/moksilgi-progress";
import {
  getCoachMakerCoachStats,
  type CoachMakerCoachStatsData,
  type CoachMakerCoachStatsRow,
} from "@/lib/api/coach-maker/coach-stats";
import {
  getCoachActionNotesForReport,
  type ActionNoteActionType,
  type ActionNotePriority,
  type ActionNoteStatus,
  type ActionNoteTargetType,
  type CoachActionNoteReportItem,
} from "@/lib/api/coach/action-notes";
import { PrintReportButton } from "./PrintReportButton";
import { ReportFilters } from "./ReportFilters";

export const dynamic = "force-dynamic";

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);
const UNASSIGNED_LABEL = "미지정";

const ACTION_TYPE_LABELS: Record<ActionNoteActionType, string> = {
  coaching_encouragement: "코칭 권면",
  contact_line: "LINE/전화 연락",
  next_meeting_check: "다음 모임 점검",
  other: "기타",
  team_leader_check: "팀장 확인",
};

const PRIORITY_LABELS: Record<ActionNotePriority, string> = {
  high: "높음",
  low: "낮음",
  normal: "보통",
};

const STATUS_LABELS: Record<ActionNoteStatus, string> = {
  archived: "보관됨",
  completed: "완료",
  in_progress: "진행 중",
  open: "진행 전",
};

const TARGET_TYPE_LABELS: Record<ActionNoteTargetType, string> = {
  attention_target: "관심 필요 대상자",
  church: "교회",
  coach: "코치",
  coachee: "코칭 대상자",
  organization: "기관",
  team: "팀",
};

type ReportPageProps = {
  searchParams: Promise<{
    from?: string | string[];
    team?: string | string[];
    to?: string | string[];
    year?: string | string[];
  }>;
};

function safeNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeOptionalText(value: string | string[] | undefined) {
  const trimmed = firstParam(value)?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function normalizeDateParam(value: string | string[] | undefined) {
  const trimmed = firstParam(value)?.trim();
  if (!trimmed) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

function normalizeYear(value: string | string[] | undefined) {
  const numeric = Number(firstParam(value));
  if (Number.isInteger(numeric) && numeric >= 2000 && numeric <= 2100) {
    return numeric;
  }

  return new Date().getFullYear();
}

function formatPercent(value: number | null | undefined) {
  return `${safeNumber(value).toFixed(1)}%`;
}

function displayValue(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "미입력";
}

function teamDisplayValue(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : UNASSIGNED_LABEL;
}

function comparableText(value: string | null | undefined) {
  return (value ?? "").trim().replace(/\s+/g, "").toLowerCase();
}

function matchesTeamFilter(value: string | null | undefined, filter: string | null) {
  if (!filter) return true;

  const normalizedFilter = comparableText(filter);
  const normalizedValue = comparableText(value);

  if (normalizedFilter === comparableText(UNASSIGNED_LABEL)) {
    return normalizedValue.length === 0;
  }

  return normalizedValue.includes(normalizedFilter);
}

function personName(row: CoachMakerMoksilgiProgressRow) {
  return row.display_name ?? row.full_name ?? row.email ?? row.author_name ?? "알 수 없음";
}

function monthRate(row: CoachMakerMoksilgiProgressRow, month: number) {
  switch (month) {
    case 1:
      return row.month_1_rate;
    case 2:
      return row.month_2_rate;
    case 3:
      return row.month_3_rate;
    case 4:
      return row.month_4_rate;
    case 5:
      return row.month_5_rate;
    case 6:
      return row.month_6_rate;
    case 7:
      return row.month_7_rate;
    case 8:
      return row.month_8_rate;
    case 9:
      return row.month_9_rate;
    case 10:
      return row.month_10_rate;
    case 11:
      return row.month_11_rate;
    case 12:
      return row.month_12_rate;
    default:
      return 0;
  }
}

function getCurrentMonthCutoff(year: number) {
  const today = new Date();

  if (year < today.getFullYear()) return 12;
  if (year > today.getFullYear()) return 0;
  return today.getMonth() + 1;
}

function hasProgressInput(row: CoachMakerMoksilgiProgressRow) {
  return MONTHS.some((month) => safeNumber(monthRate(row, month)) > 0)
    || safeNumber(row.cumulative_rate) > 0;
}

function upToCurrentRate(row: CoachMakerMoksilgiProgressRow, year: number) {
  const cutoff = getCurrentMonthCutoff(year);
  if (cutoff === 0) return null;

  return average(
    Array.from({ length: cutoff }, (_, index) =>
      safeNumber(monthRate(row, index + 1)),
    ),
  );
}

function dateOnly(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function parseDueDate(value: string | null) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : dateOnly(date);
}

function parseReportDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : dateOnly(date);
}

function isWithinCreatedAtRange(
  note: CoachActionNoteReportItem,
  from: string | null,
  to: string | null,
) {
  const createdAt = parseReportDate(note.created_at);
  const fromDate = parseReportDate(from);
  const toDate = parseReportDate(to);

  if (!createdAt) return false;
  if (fromDate && createdAt.getTime() < fromDate.getTime()) return false;
  if (toDate && createdAt.getTime() > toDate.getTime()) return false;
  return true;
}

function collectTeamOptions(
  rows: CoachMakerMoksilgiProgressRow[],
  notes: CoachActionNoteReportItem[],
) {
  const teams = new Set<string>();
  let hasUnassigned = false;

  const collectTeam = (value: string | null | undefined) => {
    const trimmed = value?.trim();

    if (trimmed) {
      teams.add(trimmed);
    } else {
      hasUnassigned = true;
    }
  };

  for (const row of rows) {
    collectTeam(row.team_name);
  }

  for (const note of notes) {
    collectTeam(note.team_name);
  }

  return [
    ...(hasUnassigned ? [UNASSIGNED_LABEL] : []),
    ...Array.from(teams).sort((left, right) => left.localeCompare(right, "ko")),
  ];
}

function buildRowsReportSummary(
  allRows: CoachMakerMoksilgiProgressRow[],
  team: string | null,
  year: number,
) {
  const rows: CoachMakerMoksilgiProgressRow[] = [];
  const attentionRows: {
    rate: number;
    row: CoachMakerMoksilgiProgressRow;
  }[] = [];
  const statusCounts = { completed: 0, inProgress: 0, notStarted: 0 };
  let cumulativeRateTotal = 0;
  let upToCurrentRateTotal = 0;
  let missingCount = 0;
  let participantCount = 0;

  for (const row of allRows) {
    if (!matchesTeamFilter(row.team_name, team)) continue;

    rows.push(row);

    const cumulativeRate = safeNumber(row.cumulative_rate);
    const currentRate = upToCurrentRate(row, year);
    cumulativeRateTotal += cumulativeRate;
    upToCurrentRateTotal += currentRate ?? 0;

    if (cumulativeRate >= 100) {
      statusCounts.completed += 1;
    } else if (cumulativeRate > 0) {
      statusCounts.inProgress += 1;
    } else {
      statusCounts.notStarted += 1;
    }

    const hasInput = hasProgressInput(row);

    if (hasInput) {
      participantCount += 1;
    }

    if (!hasInput || currentRate === null) {
      missingCount += 1;
    } else {
      if (currentRate < 50) {
        attentionRows.push({ rate: currentRate, row });
      }
    }
  }

  attentionRows.sort((left, right) => left.rate - right.rate);

  return {
    attention: {
      attentionCount: attentionRows.length,
      attentionRows: attentionRows.slice(0, 5),
      missingCount,
    },
    averageCumulativeRate:
      rows.length === 0 ? 0 : cumulativeRateTotal / rows.length,
    averageUpToCurrentRate:
      rows.length === 0 ? 0 : upToCurrentRateTotal / rows.length,
    participantCount,
    rows,
    statusCounts,
  };
}

function buildFilterSummary({
  from,
  team,
  to,
  year,
}: {
  from: string | null;
  team: string | null;
  to: string | null;
  year: number;
}) {
  return [
    `기준 연도: ${year}년`,
    `팀: ${team ?? "전체"}`,
    `기간: ${from ?? "전체"} ~ ${to ?? "전체"}`,
    `목실기 기준: ${year}년 선택 연도`,
    `관리 메모 기준: 작성일 ${from ?? "전체"} ~ ${to ?? "전체"}`,
    `팀 기준: ${team ?? "전체 팀"}`,
  ];
}

function reportMonthLabel(value: string | null) {
  const date = parseReportDate(value);
  if (!date) return null;
  return `${date.getMonth() + 1}월`;
}

function buildReportPeriodLabel({
  from,
  to,
  year,
}: {
  from: string | null;
  to: string | null;
  year: number;
}) {
  const fromMonth = reportMonthLabel(from);
  const toMonth = reportMonthLabel(to);

  if (fromMonth && toMonth) {
    return `${year}년 ${fromMonth}~${toMonth} 기준`;
  }

  if (fromMonth) {
    return `${year}년 ${fromMonth} 이후 기준`;
  }

  if (toMonth) {
    return `${year}년 ${toMonth}까지 기준`;
  }

  return `${year}년 전체 기간 기준`;
}

function buildReportAutoSummary({
  attentionCount,
  averageAchievementRate,
  from,
  noteCount,
  participantCount,
  team,
  to,
  totalCount,
  year,
}: {
  attentionCount: number;
  averageAchievementRate: number;
  from: string | null;
  noteCount: number;
  participantCount: number;
  team: string | null;
  to: string | null;
  totalCount: number;
  year: number;
}) {
  if (totalCount === 0 && noteCount === 0) {
    return "선택한 조건에 해당하는 보고서 데이터가 없습니다.";
  }

  const safeAverage = Number.isFinite(averageAchievementRate)
    ? averageAchievementRate
    : 0;
  const teamLabel = team ? `${team} 기준` : "전체 팀 기준";
  const periodLabel = buildReportPeriodLabel({ from, to, year });

  return `${periodLabel}, ${teamLabel}으로 전체 ${totalCount}명 중 ${participantCount}명이 목실기 기록에 참여했으며, 평균 성취율은 ${formatPercent(safeAverage)}입니다. 현재 관심이 필요한 대상자는 ${attentionCount}명이며, 코치의 후속 관리가 필요합니다.`;
}

function isIncomplete(note: CoachActionNoteReportItem) {
  return note.status !== "completed" && note.status !== "archived";
}

function isOverdue(note: CoachActionNoteReportItem) {
  const dueDate = parseDueDate(note.due_date);
  return isIncomplete(note) && dueDate !== null && dueDate.getTime() < dateOnly(new Date()).getTime();
}

function isDueToday(note: CoachActionNoteReportItem) {
  const dueDate = parseDueDate(note.due_date);
  return isIncomplete(note) && dueDate !== null && dueDate.getTime() === dateOnly(new Date()).getTime();
}

function isDueThisWeek(note: CoachActionNoteReportItem) {
  const dueDate = parseDueDate(note.due_date);
  if (!isIncomplete(note) || dueDate === null) return false;

  const today = dateOnly(new Date());
  const weekEnd = new Date(today);
  weekEnd.setDate(today.getDate() + 6);

  return dueDate.getTime() >= today.getTime() && dueDate.getTime() <= weekEnd.getTime();
}

function buildNotesReportSummary(
  allNotes: CoachActionNoteReportItem[],
  team: string | null,
  from: string | null,
  to: string | null,
) {
  const notes: CoachActionNoteReportItem[] = [];
  const highPriorityIncompleteNotes: CoachActionNoteReportItem[] = [];
  const overdueIncompleteNotes: CoachActionNoteReportItem[] = [];
  const counts = {
    completed: 0,
    highPriority: 0,
    inProgress: 0,
    overdue: 0,
  };

  for (const note of allNotes) {
    if (
      !matchesTeamFilter(note.team_name, team) ||
      !isWithinCreatedAtRange(note, from, to)
    ) {
      continue;
    }

    notes.push(note);

    if (note.status === "in_progress") counts.inProgress += 1;
    if (note.status === "completed") counts.completed += 1;
    if (note.priority === "high") counts.highPriority += 1;

    const overdue = isOverdue(note);
    if (overdue) {
      counts.overdue += 1;
      if (overdueIncompleteNotes.length < 10) {
        overdueIncompleteNotes.push(note);
      }
    }

    if (
      note.priority === "high" &&
      isIncomplete(note) &&
      highPriorityIncompleteNotes.length < 10
    ) {
      highPriorityIncompleteNotes.push(note);
    }
  }

  const highPriorityIds = new Set(
    highPriorityIncompleteNotes.map((note) => note.id),
  );
  const priorityActionNotes = [
    ...highPriorityIncompleteNotes,
    ...overdueIncompleteNotes.filter((note) => !highPriorityIds.has(note.id)),
  ].slice(0, 10);

  return {
    counts,
    notes,
    priorityActionNotes,
  };
}

function formatDate(value: string | null | undefined) {
  if (!value) return "미입력";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "미입력";

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
  }).format(date);
}

function formatGeneratedAt(value: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(value);
}

function truncateText(value: string, maxLength = 120) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength)}...`;
}

function buildActionNotesReportParams({
  from,
  team,
  to,
}: {
  from: string | null;
  team: string | null;
  to: string | null;
}) {
  const params = new URLSearchParams({
    limit: "1000",
  });

  if (from) params.set("from", from);
  if (to) params.set("to", to);
  if (team && team !== UNASSIGNED_LABEL) params.set("team_name", team);

  return params;
}

function SummaryBox({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="report-card rounded-md border border-slate-200 p-4 print:break-inside-avoid print:border-slate-300 print:p-3">
      <p className="text-sm text-slate-500 print:text-slate-700">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950 print:text-xl">
        {value}
      </p>
    </div>
  );
}

function EmptyState({ children }: { children: string }) {
  return (
    <p className="report-card rounded-md border border-slate-200 px-4 py-5 text-center text-sm text-slate-500 print:border-slate-300">
      {children}
    </p>
  );
}

function formatWeekRange(weekRange: CoachMakerCoachStatsData["weekRange"]) {
  return `${weekRange.start} ~ ${weekRange.end}`;
}

function coachStatsErrorMessage(code: string) {
  if (code === "PROFILE_NOT_FOUND") return "아직 프로필이 생성되지 않았습니다.";
  if (code === "ACCESS_DENIED") return "코치메이커 권한이 없습니다.";
  return "코치별 현황 데이터를 불러오지 못했습니다.";
}

function checkNeededLabel(coach: CoachMakerCoachStatsRow) {
  const total = coach.weeklyMissingThisWeekCount + coach.feedbackPendingCount;

  if (total === 0) return "없음";
  return `미제출 ${coach.weeklyMissingThisWeekCount}명 / 피드백 ${coach.feedbackPendingCount}건`;
}

export default async function CoachMakerReportPage({
  searchParams,
}: ReportPageProps) {
  const params = await searchParams;
  const selectedYear = normalizeYear(params.year);
  const selectedTeam = normalizeOptionalText(params.team);
  const selectedFrom = normalizeDateParam(params.from);
  const selectedTo = normalizeDateParam(params.to);
  const [moksilgiResult, actionNotesResult, coachStatsResult] = await Promise.all([
    getCoachMakerMoksilgiProgress({
      year: selectedYear,
      generationLabel: null,
      regionName: null,
      roleLabel: null,
      search: null,
      teamName: null,
    }),
    getCoachActionNotesForReport(
      buildActionNotesReportParams({
        from: selectedFrom,
        team: selectedTeam,
        to: selectedTo,
      }),
    ),
    getCoachMakerCoachStats(),
  ]);

  if (
    moksilgiResult.error?.code === "UNAUTHORIZED"
    || coachStatsResult.error?.code === "UNAUTHORIZED"
  ) {
    redirect("/login?redirectTo=/coach-maker/report");
  }

  const generatedAt = new Date();
  const allRows = moksilgiResult.data?.rows ?? [];
  const allNotes = actionNotesResult.ok ? actionNotesResult.data : [];
  const coachStats = coachStatsResult.data;
  const teamOptions = collectTeamOptions(allRows, allNotes);
  const rowsSummary = buildRowsReportSummary(
    allRows,
    selectedTeam,
    selectedYear,
  );
  const notesSummary = buildNotesReportSummary(
    allNotes,
    selectedTeam,
    selectedFrom,
    selectedTo,
  );
  const { attention, averageCumulativeRate, averageUpToCurrentRate, participantCount, rows, statusCounts } =
    rowsSummary;
  const { counts: noteCounts, notes, priorityActionNotes } = notesSummary;
  const filterSummary = buildFilterSummary({
    from: selectedFrom,
    team: selectedTeam,
    to: selectedTo,
    year: selectedYear,
  });
  const autoSummary = buildReportAutoSummary({
    attentionCount: attention.attentionCount,
    averageAchievementRate: averageCumulativeRate,
    from: selectedFrom,
    noteCount: notes.length,
    participantCount,
    team: selectedTeam,
    to: selectedTo,
    totalCount: rows.length,
    year: selectedYear,
  });

  return (
    <main className="min-h-screen bg-slate-100 px-3 py-5 text-slate-950 sm:px-6 sm:py-8 print:bg-white print:px-0 print:py-0">
      <style>
        {`
          @page {
            size: A4 portrait;
            margin: 14mm;
          }

          @media print {
            html,
            body {
              background: #ffffff !important;
              color: #0f172a !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

            .report-controls,
            .print-hidden {
              display: none !important;
            }

            .print-report-shell {
              width: 100% !important;
              max-width: none !important;
              border-radius: 0 !important;
              box-shadow: none !important;
              padding: 0 !important;
            }

            .report-header {
              break-after: avoid;
              page-break-after: avoid;
            }

            .report-section {
              margin-top: 8mm !important;
              padding-top: 2mm !important;
              border-top: 1px solid #e2e8f0;
              break-inside: auto;
              page-break-inside: auto;
              orphans: 3;
              widows: 3;
            }

            .report-section-first {
              border-top: 0;
              padding-top: 0 !important;
            }

            .report-section-title {
              break-after: avoid;
              page-break-after: avoid;
            }

            .report-card {
              background: #ffffff !important;
              box-shadow: none !important;
              break-inside: avoid;
              page-break-inside: avoid;
              overflow: visible !important;
            }

            .report-table {
              width: 100% !important;
              min-width: 0 !important;
              border-collapse: collapse !important;
              font-size: 10.5pt !important;
              table-layout: fixed;
              page-break-inside: auto;
            }

            .report-table thead {
              display: table-header-group;
            }

            .report-table tr {
              break-inside: avoid;
              page-break-inside: avoid;
            }

            .report-table th,
            .report-table td,
            .report-note-cell {
              overflow-wrap: anywhere;
              word-break: break-word;
              vertical-align: top;
            }

            .report-table th,
            .report-table td {
              padding-top: 4pt !important;
              padding-bottom: 4pt !important;
            }

            .report-section p,
            .report-section li,
            .report-section dd {
              overflow-wrap: anywhere;
              word-break: break-word;
            }
          }
        `}
      </style>
      <section className="print-report-shell mx-auto max-w-[210mm] rounded-md bg-white p-4 shadow-sm sm:p-8 print:max-w-none print:rounded-none print:p-0 print:shadow-none">
        <div className="report-controls mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link
            className="inline-flex min-h-10 w-full justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:w-auto"
            href="/coach-maker"
          >
            대시보드로 돌아가기
          </Link>
          <PrintReportButton />
        </div>
        <p className="report-controls mb-6 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600 print:hidden">
          인쇄 전 연도, 팀, 기간 기준을 확인해 주세요. 브라우저 인쇄창에서
          PDF 저장을 선택할 수 있습니다. 모바일 브라우저에서는 PDF 저장
          옵션이 기기와 브라우저에 따라 다르게 표시될 수 있습니다. 인쇄창이
          열리지 않으면 Safari 또는 Chrome에서 다시 열어 주세요.
        </p>

        <header className="report-header border-b border-slate-300 pb-6">
          <p className="text-sm font-semibold text-slate-500 print:text-slate-700">
            코치메이커 보고서
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950 print:text-2xl">
            코치메이커 운영 보고서
          </h1>
          <div className="mt-4 grid gap-2 text-sm text-slate-600 print:text-slate-800 sm:grid-cols-2">
            <p>생성일: {formatGeneratedAt(generatedAt)}</p>
            <p>기준 연도: {selectedYear}년</p>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600 print:text-slate-800">
            목실기 성취 현황, 관심 필요 대상자, 관리 액션 메모의 핵심 운영 지표를 인쇄용으로 정리합니다.
          </p>
          <p className="mt-4 rounded-md border border-slate-200 bg-white p-4 text-sm leading-7 text-slate-800 print:border-slate-300 print:p-3">
            {autoSummary}
          </p>
          <div className="report-card mt-4 grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 print:bg-white print:text-slate-900 sm:grid-cols-2">
            {filterSummary.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>
        </header>

        <ReportFilters
          selectedFilters={{
            from: selectedFrom,
            team: selectedTeam,
            to: selectedTo,
            year: selectedYear,
          }}
          teamOptions={teamOptions}
        />
        <p className="report-controls mt-3 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600 print:hidden">
          목실기 성취 현황은 선택한 연도 기준으로 표시하고, 관리 액션
          메모는 작성일 기간 기준으로 필터링합니다. 현황 분석은 전체 목실기
          성취 현황에서 확인하고, 제출·공유용 출력은 이 보고서 화면에서
          준비합니다.
        </p>

        {moksilgiResult.error ? (
          <section className="report-card mt-6 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800 print:border-slate-300 print:bg-white print:text-slate-900">
            {moksilgiResult.error.code === "PROFILE_NOT_FOUND"
              ? "아직 프로필이 생성되지 않았습니다."
              : moksilgiResult.error.code === "ACCESS_DENIED"
                ? "코치메이커 권한이 없습니다."
                : "보고서 데이터를 불러오지 못했습니다."}
          </section>
        ) : (
          <>
            <section className="report-section report-section-first mt-8 print:break-inside-auto">
              <h2 className="report-section-title border-b border-slate-200 pb-2 text-xl font-semibold print:text-lg">
                코치메이커 담당 범위 요약
              </h2>
              {coachStatsResult.error ? (
                <p className="report-card mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-5 text-center text-sm text-red-800 print:border-slate-300 print:bg-white print:text-slate-900">
                  {coachStatsErrorMessage(coachStatsResult.error.code)}
                </p>
              ) : !coachStats ? (
                <div className="mt-4">
                  <EmptyState>선택한 조건에 해당하는 코치메이커 담당 범위 데이터가 없습니다.</EmptyState>
                </div>
              ) : (
                <>
                  <div className="report-card mt-4 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 print:border-slate-300 print:bg-white print:text-slate-900">
                    <p>담당 범위: {coachStats.scopeLabel}</p>
                    <p className="mt-1">이번 주 기준: {formatWeekRange(coachStats.weekRange)}</p>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <SummaryBox label="전체 코치 수" value={coachStats.summary.coachCount} />
                    <SummaryBox label="전체 담당 코치이 수" value={coachStats.summary.assignedCoacheeCount} />
                    <SummaryBox label="이번 주 제출" value={coachStats.summary.weeklySubmittedThisWeekCount} />
                    <SummaryBox label="이번 주 미제출" value={coachStats.summary.weeklyMissingThisWeekCount} />
                    <SummaryBox label="피드백 대기" value={coachStats.summary.feedbackPendingCount} />
                    <SummaryBox label="공유 기록" value={coachStats.summary.sharedDailyRecordCount + coachStats.summary.sharedMonthlyReflectionCount} />
                  </div>
                </>
              )}
            </section>

            <section className="report-section mt-8 print:break-inside-auto">
              <h2 className="report-section-title border-b border-slate-200 pb-2 text-xl font-semibold print:text-lg">
                코치별 담당 코치이 현황
              </h2>
              <p className="mt-2 text-sm text-slate-600 print:text-slate-800">
                이번 주 제출, 미제출, 피드백 대기 현황을 코치별로 요약합니다.
              </p>
              {coachStatsResult.error ? (
                <p className="report-card mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-5 text-center text-sm text-red-800 print:border-slate-300 print:bg-white print:text-slate-900">
                  {coachStatsErrorMessage(coachStatsResult.error.code)}
                </p>
              ) : !coachStats || coachStats.coaches.length === 0 ? (
                <div className="mt-4">
                  <EmptyState>선택한 조건에 해당하는 코치별 담당 현황 데이터가 없습니다.</EmptyState>
                </div>
              ) : (
                <div className="mt-4 overflow-x-auto print:overflow-visible">
                  <table className="report-table w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-300">
                        <th className="py-2 pr-3">코치</th>
                        <th className="py-2 pr-3">담당 코치이</th>
                        <th className="py-2 pr-3">이번 주 제출</th>
                        <th className="py-2 pr-3">이번 주 미제출</th>
                        <th className="py-2 pr-3">피드백 대기</th>
                        <th className="py-2 pr-3">확인 필요</th>
                      </tr>
                    </thead>
                    <tbody>
                      {coachStats.coaches.map((coach) => (
                        <tr className="border-b border-slate-100 align-top" key={coach.coachId}>
                          <td className="py-2 pr-3">
                            <p className="font-medium">{coach.coachName}</p>
                            {coach.coachEmail ? (
                              <p className="text-xs text-slate-500 print:text-slate-700">
                                {coach.coachEmail}
                              </p>
                            ) : null}
                          </td>
                          <td className="py-2 pr-3">{coach.assignedCoacheeCount}</td>
                          <td className="py-2 pr-3">{coach.weeklySubmittedThisWeekCount}</td>
                          <td className="py-2 pr-3">{coach.weeklyMissingThisWeekCount}</td>
                          <td className="py-2 pr-3">{coach.feedbackPendingCount}</td>
                          <td className="py-2 pr-3">{checkNeededLabel(coach)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="report-section mt-8 print:break-inside-auto">
              <h2 className="report-section-title border-b border-slate-200 pb-2 text-xl font-semibold print:text-lg">
                목실기 성취 요약
              </h2>
              {rows.length === 0 ? (
                <div className="mt-4">
                  <EmptyState>선택한 조건에 해당하는 목실기 성취 데이터가 없습니다.</EmptyState>
                </div>
              ) : (
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <SummaryBox label="전체 대상자 수" value={rows.length} />
                  <SummaryBox label="진행 중 인원" value={statusCounts.inProgress} />
                  <SummaryBox label="완료 인원" value={statusCounts.completed} />
                  <SummaryBox label="미완료 인원" value={statusCounts.notStarted} />
                  <SummaryBox
                    label="현재 월까지 평균 성취율"
                    value={formatPercent(averageUpToCurrentRate)}
                  />
                  <SummaryBox
                    label="12개월 전체 평균 성취율"
                    value={formatPercent(averageCumulativeRate)}
                  />
                </div>
              )}
            </section>

            <section className="report-section mt-8 print:break-inside-auto">
              <h2 className="report-section-title border-b border-slate-200 pb-2 text-xl font-semibold print:text-lg">
                관심 필요 대상자
              </h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <SummaryBox label="관심 필요 대상자 수" value={attention.attentionCount} />
                <SummaryBox label="미입력 대상자 수" value={attention.missingCount} />
              </div>
              {attention.attentionRows.length === 0 ? (
                <div className="mt-4">
                  <EmptyState>선택한 조건에 해당하는 관심 필요 대상자가 없습니다.</EmptyState>
                </div>
              ) : (
                <div className="mt-4 overflow-x-auto print:overflow-visible">
                  <table className="report-table w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-300">
                        <th className="py-2 pr-3">이름</th>
                        <th className="py-2 pr-3">국가/소속</th>
                        <th className="py-2 pr-3">공동체/팀</th>
                        <th className="py-2 pr-3">현재 월까지 성취율</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attention.attentionRows.map((item) => (
                        <tr className="border-b border-slate-100" key={item.row.plan_id}>
                          <td className="py-2 pr-3 font-medium">{personName(item.row)}</td>
                          <td className="py-2 pr-3">{displayValue(item.row.region_name)}</td>
                          <td className="py-2 pr-3">{displayValue(item.row.team_name)}</td>
                          <td className="py-2 pr-3">{formatPercent(item.rate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}

        <section className="report-section mt-8 print:break-inside-auto">
          <h2 className="report-section-title border-b border-slate-200 pb-2 text-xl font-semibold print:text-lg">
            관리 액션 메모 요약
          </h2>
          {!actionNotesResult.ok ? (
            <p className="report-card mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-5 text-center text-sm text-red-800 print:border-slate-300 print:bg-white print:text-slate-900">
              보고서 데이터를 불러오지 못했습니다.
            </p>
          ) : (
            <>
              <p className="mt-2 text-sm text-slate-600 print:text-slate-800">
                진행 전/진행 중/완료/보관됨 상태를 기준으로 집계합니다.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <SummaryBox label="전체 메모 수" value={notes.length} />
                <SummaryBox label="진행 중" value={noteCounts.inProgress} />
                <SummaryBox label="완료" value={noteCounts.completed} />
                <SummaryBox label="높은 우선순위" value={noteCounts.highPriority} />
                <SummaryBox label="기한 지난 메모" value={noteCounts.overdue} />
              </div>
            </>
          )}
        </section>

        <section className="report-section mt-8">
          <h2 className="report-section-title border-b border-slate-200 pb-2 text-xl font-semibold print:text-lg">
            우선 조치 목록
          </h2>
          <p className="mt-2 text-sm text-slate-600 print:text-slate-800">
            높은 우선순위 미완료 메모와 기한 지난 미완료 메모를 최대 10개까지 표시합니다.
          </p>
          {priorityActionNotes.length === 0 ? (
            <div className="mt-4">
              <EmptyState>선택한 팀/기간에 해당하는 관리 액션 메모가 없습니다.</EmptyState>
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto print:overflow-visible">
              <table className="report-table w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-300">
                    <th className="py-2 pr-3">대상</th>
                    <th className="py-2 pr-3">액션 유형</th>
                    <th className="py-2 pr-3">우선순위</th>
                    <th className="py-2 pr-3">상태</th>
                    <th className="py-2 pr-3">마감일</th>
                    <th className="py-2 pr-3">메모 요약</th>
                  </tr>
                </thead>
                <tbody>
                  {priorityActionNotes.map((note) => (
                    <tr className="border-b border-slate-100 align-top" key={note.id}>
                      <td className="py-2 pr-3">
                        <p className="font-medium">{note.target_name}</p>
                        <p className="text-slate-500">
                          {TARGET_TYPE_LABELS[note.target_type]}
                        </p>
                      </td>
                      <td className="py-2 pr-3">{ACTION_TYPE_LABELS[note.action_type]}</td>
                      <td className="py-2 pr-3">{PRIORITY_LABELS[note.priority]}</td>
                      <td className="py-2 pr-3">{STATUS_LABELS[note.status]}</td>
                      <td className="py-2 pr-3">{formatDate(note.due_date)}</td>
                      <td className="report-note-cell max-w-[260px] py-2 pr-3 leading-5 print:max-w-none">
                        {truncateText(note.note)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
