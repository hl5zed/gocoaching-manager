"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { isValidDate } from "@/lib/validation/common";

type TargetType =
  | "coach"
  | "team"
  | "attention_target"
  | "coachee"
  | "church"
  | "organization";
type ActionType =
  | "contact_line"
  | "coaching_encouragement"
  | "team_leader_check"
  | "next_meeting_check"
  | "other";
type Priority = "low" | "normal" | "high";
type NoteStatus = "open" | "in_progress" | "completed" | "archived";
type StatusFilter = "all" | NoteStatus;
type PriorityFilter = "all" | Priority;
type TargetTypeFilter = "all" | TargetType;
type QuickUpdateField = "priority" | "status";
type SortKey =
  | "created_at"
  | "due_date"
  | "priority"
  | "status"
  | "target_name"
  | "target_type";
type SortDirection = "asc" | "desc";
type DrilldownFilter =
  | { type: "team"; value: string }
  | { type: "target"; value: string }
  | { type: "target_type"; value: TargetType }
  | { type: "status"; value: NoteStatus }
  | { type: "priority"; value: Priority }
  | { type: "overdue" };

type ActionNote = {
  id: string;
  action_type: ActionType;
  completed_at: string | null;
  created_at: string;
  due_date: string | null;
  note: string;
  priority: Priority;
  region: string | null;
  status: NoteStatus;
  target_name: string;
  target_type: TargetType;
  target_user_id: string | null;
  team_name: string | null;
  updated_at: string;
};

type EditForm = {
  actionType: ActionType;
  dueDate: string;
  note: string;
  priority: Priority;
  region: string;
  status: NoteStatus;
  teamName: string;
};

type QuickUpdatingState = {
  field: QuickUpdateField;
  id: string;
} | null;

export type ActionMemoAttentionTarget = {
  region: string | null;
  targetName: string;
  targetUserId: string | null;
  teamName: string | null;
};

type ApiErrorResponse = {
  ok?: false;
  message?: string;
};

type ListResponse =
  | {
      ok: true;
      notes: ActionNote[];
    }
  | ApiErrorResponse;

type MutationResponse =
  | {
      ok: true;
      note: ActionNote;
      message?: string;
    }
  | ApiErrorResponse;

const TARGET_TYPE_LABELS: Record<TargetType, string> = {
  attention_target: "관심 필요 대상자",
  church: "교회",
  coach: "코치",
  coachee: "코칭 대상자",
  organization: "기관",
  team: "팀",
};

const ACTION_TYPE_LABELS: Record<ActionType, string> = {
  coaching_encouragement: "코칭 권면",
  contact_line: "LINE/전화 연락",
  next_meeting_check: "다음 모임 점검",
  other: "기타",
  team_leader_check: "팀장 확인",
};

const PRIORITY_LABELS: Record<Priority, string> = {
  high: "높음",
  low: "낮음",
  normal: "보통",
};

const STATUS_LABELS: Record<NoteStatus, string> = {
  archived: "보관됨",
  completed: "완료",
  in_progress: "진행 중",
  open: "진행 전",
};

const STATUS_BADGE_CLASSES: Record<NoteStatus, string> = {
  archived: "border-slate-300 bg-slate-100 text-slate-700",
  completed: "border-emerald-300 bg-emerald-50 text-emerald-700",
  in_progress: "border-blue-300 bg-blue-50 text-blue-700",
  open: "border-amber-300 bg-amber-50 text-amber-700",
};

const PRIORITY_BADGE_CLASSES: Record<Priority, string> = {
  high: "border-red-300 bg-red-50 text-red-700",
  low: "border-slate-300 bg-slate-50 text-slate-700",
  normal: "border-blue-300 bg-blue-50 text-blue-700",
};

const PRIORITY_SORT_WEIGHT: Record<Priority, number> = {
  high: 3,
  low: 1,
  normal: 2,
};

const STATUS_SORT_WEIGHT: Record<NoteStatus, number> = {
  archived: 4,
  completed: 3,
  in_progress: 2,
  open: 1,
};

const DUE_DATE_BADGE_CLASSES = {
  missing: "border-slate-300 bg-slate-50 text-slate-700",
  overdue: "border-red-300 bg-red-50 text-red-700",
  today: "border-amber-300 bg-amber-50 text-amber-700",
  upcoming: "border-emerald-300 bg-emerald-50 text-emerald-700",
} as const;

function formatDateTime(value: string | null) {
  if (!value) return "미입력";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "미입력";

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function displayValue(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "미입력";
}

function dateOnly(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function getDueDateInfo(value: string | null) {
  if (!value) {
    return {
      className: DUE_DATE_BADGE_CLASSES.missing,
      label: "마감일 없음",
      sortValue: Number.POSITIVE_INFINITY,
    };
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return {
      className: DUE_DATE_BADGE_CLASSES.missing,
      label: "마감일 없음",
      sortValue: Number.POSITIVE_INFINITY,
    };
  }

  const today = dateOnly(new Date());
  const dueDate = dateOnly(date);
  const sortValue = dueDate.getTime();

  if (dueDate.getTime() < today.getTime()) {
    return {
      className: DUE_DATE_BADGE_CLASSES.overdue,
      label: "기한 지남",
      sortValue,
    };
  }

  if (dueDate.getTime() === today.getTime()) {
    return {
      className: DUE_DATE_BADGE_CLASSES.today,
      label: "오늘 마감",
      sortValue,
    };
  }

  return {
    className: DUE_DATE_BADGE_CLASSES.upcoming,
    label: value,
    sortValue,
  };
}

function compareText(left: string, right: string) {
  return left.localeCompare(right, "ko-KR");
}

function isOverdue(value: string | null) {
  if (!value) return false;

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) return false;

  return dateOnly(date).getTime() < dateOnly(new Date()).getTime();
}

function isOverdueIncomplete(note: ActionNote) {
  return note.status !== "completed" && isOverdue(note.due_date);
}

let actionNotesCache: ActionNote[] | null = null;
let actionNotesPromise: Promise<ActionNote[]> | null = null;

async function fetchActionNotesList(forceRefresh = false) {
  if (!forceRefresh && actionNotesCache) return actionNotesCache;
  if (!forceRefresh && actionNotesPromise) return actionNotesPromise;

  actionNotesPromise = (async () => {
    const response = await fetch("/api/coach-maker/action-notes", {
      cache: "no-store",
    });
    const payload = await parseJsonResponse(response);

    if (!response.ok || !isListResponse(payload) || !payload.ok) {
      throw new Error(
        isListResponse(payload)
          ? getApiErrorMessage(payload) ?? "관리 액션 메모를 불러오지 못했습니다."
          : "관리 액션 메모를 불러오지 못했습니다.",
      );
    }

    actionNotesCache = payload.notes;
    return payload.notes;
  })();

  try {
    return await actionNotesPromise;
  } finally {
    actionNotesPromise = null;
  }
}

function clearActionNotesCache() {
  actionNotesCache = null;
  actionNotesPromise = null;
}

export function ActionMemoTaskSummary() {
  const [notes, setNotes] = useState<ActionNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadSummary() {
      setIsLoading(true);
      setError(null);

      try {
        const nextNotes = await fetchActionNotesList();
        if (isMounted) {
          setNotes(nextNotes);
        }
      } catch (error) {
        if (isMounted) {
          setNotes([]);
          setError(
            error instanceof Error
              ? error.message
              : "관리 액션 메모를 불러오지 못했습니다.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadSummary();

    return () => {
      isMounted = false;
    };
  }, []);

  const overdueCount = notes.filter(isOverdueIncomplete).length;

  function openActionMemos() {
    window.dispatchEvent(new Event("coach-maker:open-action-memos"));
    document
      .getElementById("action-memos")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <article className="min-w-0 rounded-md border border-slate-200 bg-white p-4">
      <p className="text-sm font-medium text-slate-500">
        기한 지난 관리 메모
      </p>
      <p className="mt-2 text-3xl font-semibold text-slate-950">
        {isLoading ? "..." : `${overdueCount}개`}
      </p>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        {error ?? "오늘 먼저 처리할 메모입니다."}
      </p>
      <button
        className="mt-4 inline-flex min-h-10 w-full justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:w-auto"
        onClick={openActionMemos}
        type="button"
      >
        메모 처리
      </button>
    </article>
  );
}

function buildEditForm(note: ActionNote): EditForm {
  return {
    actionType: note.action_type,
    dueDate: note.due_date ?? "",
    note: note.note,
    priority: note.priority,
    region: note.region ?? "",
    status: note.status,
    teamName: note.team_name ?? "",
  };
}

function getDrilldownLabel(drilldown: DrilldownFilter | null) {
  if (!drilldown) return null;
  if (drilldown.type === "team") return `팀 = ${drilldown.value}`;
  if (drilldown.type === "target") return `대상 = ${drilldown.value}`;
  if (drilldown.type === "target_type") {
    return `대상 구분 = ${TARGET_TYPE_LABELS[drilldown.value]}`;
  }
  if (drilldown.type === "status") {
    return `상태 = ${STATUS_LABELS[drilldown.value]}`;
  }
  if (drilldown.type === "priority") {
    return `우선순위 = ${PRIORITY_LABELS[drilldown.value]}`;
  }

  return "기한 지난 메모";
}

function isListResponse(value: unknown): value is ListResponse {
  return typeof value === "object" && value !== null && "ok" in value;
}

function isMutationResponse(value: unknown): value is MutationResponse {
  return typeof value === "object" && value !== null && "ok" in value;
}

function getApiErrorMessage(payload: ListResponse | MutationResponse | null) {
  if (payload && payload.ok === false && payload.message) {
    return payload.message;
  }

  return null;
}

async function parseJsonResponse(response: Response) {
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

function csvEscape(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function buildCsvContent(rows: Array<Array<string | number | null | undefined>>) {
  return rows.map((row) => row.map(csvEscape).join(",")).join("\r\n");
}

function formatDateForFileName(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function downloadCsvFile(filename: string, csvContent: string) {
  const blob = new Blob(["\uFEFF", csvContent], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function ActionMemoDrafts({
  attentionTargets = [],
}: {
  attentionTargets?: ActionMemoAttentionTarget[];
}) {
  const [notes, setNotes] = useState<ActionNote[]>([]);
  const [targetType, setTargetType] = useState<TargetType>("attention_target");
  const [targetName, setTargetName] = useState("");
  const [targetUserId, setTargetUserId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState("");
  const [region, setRegion] = useState("");
  const [actionType, setActionType] = useState<ActionType>("contact_line");
  const [content, setContent] = useState("");
  const [priority, setPriority] = useState<Priority>("normal");
  const [dueDate, setDueDate] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [targetTypeFilter, setTargetTypeFilter] = useState<TargetTypeFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedNote, setSelectedNote] = useState<ActionNote | null>(null);
  const [isEditingDetail, setIsEditingDetail] = useState(false);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [isUpdatingDetail, setIsUpdatingDetail] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [quickUpdating, setQuickUpdating] = useState<QuickUpdatingState>(null);
  const [drilldownFilter, setDrilldownFilter] =
    useState<DrilldownFilter | null>(null);
  const [isFullViewOpen, setIsFullViewOpen] = useState(false);
  const [shouldScrollToCreate, setShouldScrollToCreate] = useState(false);

  const summary = useMemo(() => {
    let archivedCount = 0;
    let completedCount = 0;
    let highPriorityCount = 0;
    let inProgressCount = 0;
    let openCount = 0;
    let overdueCount = 0;
    const teamMap = new Map<
      string,
      {
        highPriorityCount: number;
        incompleteCount: number;
        totalCount: number;
      }
    >();
    const targetMap = new Map<string, number>();
    const targetTypeMap = new Map<TargetType, number>();

    for (const note of notes) {
      if (note.status === "archived") {
        archivedCount += 1;
      }
      if (note.status === "completed") {
        completedCount += 1;
      }
      if (note.status === "in_progress") {
        inProgressCount += 1;
      }
      if (note.status === "open") {
        openCount += 1;
      }
      if (note.priority === "high") {
        highPriorityCount += 1;
      }
      if (isOverdueIncomplete(note)) {
        overdueCount += 1;
      }

      const teamKey = note.team_name?.trim() || "미지정 팀";
      const currentTeam = teamMap.get(teamKey) ?? {
        highPriorityCount: 0,
        incompleteCount: 0,
        totalCount: 0,
      };

      currentTeam.totalCount += 1;
      if (note.status !== "completed" && note.status !== "archived") {
        currentTeam.incompleteCount += 1;
      }
      if (note.priority === "high") {
        currentTeam.highPriorityCount += 1;
      }
      teamMap.set(teamKey, currentTeam);

      const targetKey = note.target_name.trim() || "이름 없음";
      targetMap.set(targetKey, (targetMap.get(targetKey) ?? 0) + 1);
      targetTypeMap.set(
        note.target_type,
        (targetTypeMap.get(note.target_type) ?? 0) + 1,
      );
    }

    return {
      archivedCount,
      completedCount,
      highPriorityCount,
      inProgressCount,
      openCount,
      overdueCount,
      targetSummaries: [...targetMap.entries()]
        .map(([targetName, totalCount]) => ({ targetName, totalCount }))
        .sort((left, right) => {
          if (right.totalCount !== left.totalCount) {
            return right.totalCount - left.totalCount;
          }

          return compareText(left.targetName, right.targetName);
        })
        .slice(0, 5),
      targetTypeSummaries: [...targetTypeMap.entries()]
        .map(([targetType, totalCount]) => ({ targetType, totalCount }))
        .sort((left, right) => {
          if (right.totalCount !== left.totalCount) {
            return right.totalCount - left.totalCount;
          }

          return compareText(
            TARGET_TYPE_LABELS[left.targetType],
            TARGET_TYPE_LABELS[right.targetType],
          );
        }),
      teamSummaries: [...teamMap.entries()]
        .map(([teamName, counts]) => ({ teamName, ...counts }))
        .sort((left, right) => {
          if (right.totalCount !== left.totalCount) {
            return right.totalCount - left.totalCount;
          }

          return compareText(left.teamName, right.teamName);
        }),
      totalCount: notes.length,
    };
  }, [notes]);

  const filteredNotes = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    const baseNotes = notes;

    return baseNotes.filter((note) => {
      const matchesDrilldown =
        !drilldownFilter ||
        (drilldownFilter.type === "team" &&
          (note.team_name?.trim() || "미지정 팀") === drilldownFilter.value) ||
        (drilldownFilter.type === "target" &&
          (note.target_name.trim() || "이름 없음") === drilldownFilter.value) ||
        (drilldownFilter.type === "target_type" &&
          note.target_type === drilldownFilter.value) ||
        (drilldownFilter.type === "status" &&
          note.status === drilldownFilter.value) ||
        (drilldownFilter.type === "priority" &&
          note.priority === drilldownFilter.value) ||
        (drilldownFilter.type === "overdue" && isOverdueIncomplete(note));
      const matchesSearch =
        normalizedSearch.length === 0 ||
        [
          note.target_name,
          note.team_name ?? "",
          note.region ?? "",
          note.note,
        ].some((value) => value.toLowerCase().includes(normalizedSearch));
      const matchesStatus =
        statusFilter === "all"
          ? drilldownFilter?.type === "status"
            ? true
            : note.status !== "archived"
          : note.status === statusFilter;
      const matchesPriority =
        priorityFilter === "all" || note.priority === priorityFilter;
      const matchesTargetType =
        targetTypeFilter === "all" || note.target_type === targetTypeFilter;

      return (
        matchesDrilldown &&
        matchesSearch &&
        matchesStatus &&
        matchesPriority &&
        matchesTargetType
      );
    });
  }, [
    drilldownFilter,
    notes,
    priorityFilter,
    searchQuery,
    statusFilter,
    targetTypeFilter,
  ]);

  const sortedNotes = useMemo(() => {
    return [...filteredNotes].sort((left, right) => {
      let compareValue = 0;

      if (sortKey === "created_at") {
        compareValue =
          new Date(left.created_at).getTime() - new Date(right.created_at).getTime();
      } else if (sortKey === "due_date") {
        compareValue =
          getDueDateInfo(left.due_date).sortValue -
          getDueDateInfo(right.due_date).sortValue;
      } else if (sortKey === "priority") {
        compareValue =
          PRIORITY_SORT_WEIGHT[left.priority] - PRIORITY_SORT_WEIGHT[right.priority];
      } else if (sortKey === "status") {
        compareValue = STATUS_SORT_WEIGHT[left.status] - STATUS_SORT_WEIGHT[right.status];
      } else if (sortKey === "target_name") {
        compareValue = compareText(left.target_name, right.target_name);
      } else if (sortKey === "target_type") {
        compareValue = compareText(
          TARGET_TYPE_LABELS[left.target_type],
          TARGET_TYPE_LABELS[right.target_type],
        );
      }

      return sortDirection === "asc" ? compareValue : -compareValue;
    });
  }, [filteredNotes, sortDirection, sortKey]);

  const totalPages = Math.max(1, Math.ceil(sortedNotes.length / pageSize));
  const normalizedCurrentPage = Math.min(currentPage, totalPages);
  const paginatedNotes = sortedNotes.slice(
    (normalizedCurrentPage - 1) * pageSize,
    normalizedCurrentPage * pageSize,
  );
  const activeDrilldownLabel = getDrilldownLabel(drilldownFilter);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    drilldownFilter,
    pageSize,
    priorityFilter,
    searchQuery,
    statusFilter,
    targetTypeFilter,
  ]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  function resetFilters() {
    setDrilldownFilter(null);
    setSearchQuery("");
    setStatusFilter("all");
    setPriorityFilter("all");
    setTargetTypeFilter("all");
    setCurrentPage(1);
  }

  function applyDrilldown(nextFilter: DrilldownFilter | null) {
    setDrilldownFilter(nextFilter);
    setCurrentPage(1);
  }

  function clearDrilldown() {
    setDrilldownFilter(null);
    setCurrentPage(1);
  }

  function toggleSort(nextSortKey: SortKey) {
    setCurrentPage(1);

    if (sortKey === nextSortKey) {
      setSortDirection((currentDirection) =>
        currentDirection === "asc" ? "desc" : "asc",
      );
      return;
    }

    setSortKey(nextSortKey);
    setSortDirection(nextSortKey === "created_at" ? "desc" : "asc");
  }

  function exportFilteredNotesToCsv() {
    if (sortedNotes.length === 0) {
      setError("내보낼 메모가 없습니다.");
      setMessage(null);
      return;
    }

    const csvContent = buildCsvContent([
      [
        "대상 구분",
        "대상 이름",
        "팀명",
        "지역",
        "액션 유형",
        "우선순위",
        "상태",
        "마감일",
        "메모 내용",
        "작성일",
        "수정일",
        "완료일",
      ],
      ...sortedNotes.map((note) => [
        TARGET_TYPE_LABELS[note.target_type],
        note.target_name,
        displayValue(note.team_name),
        displayValue(note.region),
        ACTION_TYPE_LABELS[note.action_type],
        PRIORITY_LABELS[note.priority],
        STATUS_LABELS[note.status],
        note.due_date ?? "",
        note.note,
        formatDateTime(note.created_at),
        formatDateTime(note.updated_at),
        formatDateTime(note.completed_at),
      ]),
    ]);

    downloadCsvFile(
      `action-notes-${formatDateForFileName(new Date())}.csv`,
      csvContent,
    );
    setMessage(`${sortedNotes.length}개 메모를 CSV로 내보냈습니다.`);
    setError(null);
  }

  const loadNotes = useCallback(async (forceRefresh = false) => {
    setIsLoading(true);
    setError(null);

    try {
      const nextNotes = await fetchActionNotesList(forceRefresh);
      setNotes(nextNotes);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "관리 액션 메모를 불러오지 못했습니다.",
      );
      setNotes([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNotes();
  }, [loadNotes]);

  useEffect(() => {
    function openActionMemos() {
      setIsFullViewOpen(true);
      window.setTimeout(() => {
        document
          .getElementById("action-memos")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 0);
    }

    window.addEventListener("coach-maker:open-action-memos", openActionMemos);

    return () => {
      window.removeEventListener(
        "coach-maker:open-action-memos",
        openActionMemos,
      );
    };
  }, []);

  useEffect(() => {
    if (!isFullViewOpen || !shouldScrollToCreate) return;

    window.setTimeout(() => {
      document
        .getElementById("action-memo-create")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      setShouldScrollToCreate(false);
    }, 0);
  }, [isFullViewOpen, shouldScrollToCreate]);

  function fillAttentionTarget(target: ActionMemoAttentionTarget) {
    setTargetType("attention_target");
    setTargetName(target.targetName);
    setTargetUserId(target.targetUserId);
    setTeamName(target.teamName ?? "");
    setRegion(target.region ?? "");
    setMessage("관심 필요 대상자 정보가 입력되었습니다.");
    setError(null);
  }

  function openDetail(note: ActionNote) {
    setSelectedNote(note);
    setEditForm(buildEditForm(note));
    setIsEditingDetail(false);
    setMessage(null);
    setError(null);
  }

  function closeDetail() {
    setSelectedNote(null);
    setEditForm(null);
    setIsEditingDetail(false);
  }

  function startEditingDetail() {
    if (!selectedNote) return;
    setEditForm(buildEditForm(selectedNote));
    setIsEditingDetail(true);
    setMessage(null);
    setError(null);
  }

  function cancelEditingDetail() {
    if (selectedNote) {
      setEditForm(buildEditForm(selectedNote));
    }
    setIsEditingDetail(false);
  }

  function replaceNoteInList(updatedNote: ActionNote) {
    setNotes((currentNotes) =>
      currentNotes.map((note) => (note.id === updatedNote.id ? updatedNote : note)),
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedTargetName = targetName.trim();
    const trimmedContent = content.trim();

    if (!trimmedTargetName || !trimmedContent) {
      setError("대상과 메모 내용을 입력해 주세요.");
      setMessage(null);
      return;
    }

    if (dueDate && !isValidDate(dueDate)) {
      setError("마감일 형식이 올바르지 않습니다.");
      setMessage(null);
      return;
    }

    setIsSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/coach-maker/action-notes", {
        body: JSON.stringify({
          action_type: actionType,
          due_date: dueDate || null,
          note: trimmedContent,
          priority,
          region: region.trim() || null,
          target_name: trimmedTargetName,
          target_type: targetType,
          target_user_id: targetUserId,
          team_name: teamName.trim() || null,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const payload = await parseJsonResponse(response);

      if (!response.ok || !isMutationResponse(payload) || !payload.ok) {
        setError(
          isMutationResponse(payload)
            ? getApiErrorMessage(payload) ?? "관리 액션 메모 저장에 실패했습니다."
            : "관리 액션 메모 저장에 실패했습니다.",
        );
        return;
      }

      setTargetName("");
      setTargetUserId(null);
      setTeamName("");
      setRegion("");
      setContent("");
      setDueDate("");
      setMessage("관리 액션 메모가 저장되었습니다.");
      clearActionNotesCache();
      await loadNotes(true);
    } catch {
      setError("관리 액션 메모 저장에 실패했습니다.");
    } finally {
      setIsSaving(false);
    }
  }

  async function completeNote(id: string) {
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/coach-maker/action-notes/${id}`, {
        body: JSON.stringify({ status: "completed" }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "PATCH",
      });
      const payload = await parseJsonResponse(response);

      if (!response.ok || !isMutationResponse(payload) || !payload.ok) {
        setError(
          isMutationResponse(payload)
            ? getApiErrorMessage(payload) ?? "관리 액션 메모 상태 변경에 실패했습니다."
            : "관리 액션 메모 상태 변경에 실패했습니다.",
        );
        return;
      }

      setMessage("관리 액션 메모가 완료 처리되었습니다.");
      replaceNoteInList(payload.note);
      if (selectedNote?.id === payload.note.id) {
        setSelectedNote(payload.note);
        setEditForm(buildEditForm(payload.note));
      }
      clearActionNotesCache();
      await loadNotes(true);
    } catch {
      setError("관리 액션 메모 상태 변경에 실패했습니다.");
    }
  }

  async function updateNoteQuick(
    id: string,
    updates: Partial<Pick<ActionNote, "priority" | "status">>,
    field: QuickUpdateField,
  ) {
    setQuickUpdating({ field, id });
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/coach-maker/action-notes/${id}`, {
        body: JSON.stringify(updates),
        headers: {
          "Content-Type": "application/json",
        },
        method: "PATCH",
      });
      const payload = await parseJsonResponse(response);

      if (!response.ok || !isMutationResponse(payload) || !payload.ok) {
        setError(
          isMutationResponse(payload)
            ? getApiErrorMessage(payload) ??
                (field === "status"
                  ? "상태 변경에 실패했습니다."
                  : "우선순위 변경에 실패했습니다.")
            : field === "status"
              ? "상태 변경에 실패했습니다."
              : "우선순위 변경에 실패했습니다.",
        );
        return;
      }

      replaceNoteInList(payload.note);
      if (selectedNote?.id === payload.note.id) {
        setSelectedNote(payload.note);
        setEditForm(buildEditForm(payload.note));
      }
      setMessage(
        field === "status"
          ? "상태가 변경되었습니다."
          : "우선순위가 변경되었습니다.",
      );
      clearActionNotesCache();
      await loadNotes(true);
    } catch {
      setError(
        field === "status"
          ? "상태 변경에 실패했습니다."
          : "우선순위 변경에 실패했습니다.",
      );
    } finally {
      setQuickUpdating(null);
    }
  }

  async function saveDetailEdit() {
    if (!selectedNote || !editForm) return;

    const trimmedNote = editForm.note.trim();

    if (trimmedNote.length === 0) {
      setError("메모 내용을 입력해 주세요.");
      setMessage(null);
      return;
    }

    if (editForm.dueDate && !isValidDate(editForm.dueDate)) {
      setError("마감일 형식이 올바르지 않습니다.");
      setMessage(null);
      return;
    }

    setIsUpdatingDetail(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/coach-maker/action-notes/${selectedNote.id}`,
        {
          body: JSON.stringify({
            action_type: editForm.actionType,
            due_date: editForm.dueDate || null,
            note: trimmedNote,
            priority: editForm.priority,
            region: editForm.region.trim() || null,
            status: editForm.status,
            team_name: editForm.teamName.trim() || null,
          }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "PATCH",
        },
      );
      const payload = await parseJsonResponse(response);

      if (!response.ok || !isMutationResponse(payload) || !payload.ok) {
        setError(
          isMutationResponse(payload)
            ? getApiErrorMessage(payload) ?? "관리 액션 메모 수정에 실패했습니다."
            : "관리 액션 메모 수정에 실패했습니다.",
        );
        return;
      }

      replaceNoteInList(payload.note);
      setSelectedNote(payload.note);
      setEditForm(buildEditForm(payload.note));
      setIsEditingDetail(false);
      setMessage("관리 액션 메모가 수정되었습니다.");
      clearActionNotesCache();
      await loadNotes(true);
    } catch {
      setError("관리 액션 메모 수정에 실패했습니다.");
    } finally {
      setIsUpdatingDetail(false);
    }
  }

  async function archiveNote(id: string) {
    const note = notes.find((currentNote) => currentNote.id === id);
    const confirmed = window.confirm(
      `관리 액션 메모를 보관하시겠습니까?\n\n대상: ${
        note?.target_name ?? id
      }\n보관된 메모는 기본 목록에서 숨겨질 수 있습니다.`,
    );

    if (!confirmed) {
      return;
    }

    setError(null);
    setMessage(null);
    setArchivingId(id);

    try {
      const response = await fetch(`/api/coach-maker/action-notes/${id}`, {
        method: "DELETE",
      });
      const payload = await parseJsonResponse(response);

      if (!response.ok || !isMutationResponse(payload) || !payload.ok) {
        setError(
          isMutationResponse(payload)
            ? getApiErrorMessage(payload) ?? "관리 액션 메모 처리에 실패했습니다."
            : "관리 액션 메모 처리에 실패했습니다.",
        );
        return;
      }

      setMessage("관리 액션 메모가 보관되었습니다.");
      if (selectedNote?.id === id) {
        closeDetail();
      }
      clearActionNotesCache();
      await loadNotes(true);
    } catch {
      setError("관리 액션 메모 처리에 실패했습니다.");
    } finally {
      setArchivingId(null);
    }
  }

  return (
    <section
      className="mt-8 rounded-md border border-slate-200 bg-white p-4 sm:p-6"
      id="action-memos"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">저장된 기록</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">
            관리 액션 메모 요약
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            후속 액션을 메모로 남기고 진행 상태를 처리합니다.
          </p>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            완료: 처리한 메모로 남깁니다. 보관: 현재 목록에서 정리하지만
            기록은 보관합니다.
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:items-end">
          <div className="rounded-md bg-emerald-50 px-3 py-2 text-sm font-medium leading-6 text-emerald-800">
            <p>내부 관리 메모입니다. 코치이에게 공개되지 않습니다.</p>
            <p className="mt-1">필요하면 아래에서 전체 목록과 작성폼을 펼쳐 사용하세요.</p>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-5">
        {[
          { label: "전체 메모 수", value: summary.totalCount },
          { label: "진행 중", value: summary.inProgressCount },
          { label: "완료", value: summary.completedCount },
          { label: "높은 우선순위", value: summary.highPriorityCount },
          { label: "기한 지난 메모", value: summary.overdueCount },
        ].map((card) => (
          <div
            className="min-w-0 rounded-md border border-slate-200 bg-slate-50 p-4"
            key={card.label}
          >
            <p className="text-xs font-medium text-slate-500">{card.label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">
              {isLoading ? "..." : card.value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          className="min-h-10 w-full rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 sm:w-auto"
          onClick={() => setIsFullViewOpen(true)}
          type="button"
        >
          메모 전체 보기
        </button>
        <button
          className="min-h-10 w-full rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:w-auto"
          onClick={() => {
            setIsFullViewOpen(true);
            setShouldScrollToCreate(true);
          }}
          type="button"
        >
          새 메모 작성
        </button>
        {isFullViewOpen ? (
          <button
            className="min-h-10 w-full rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:w-auto"
            onClick={() => setIsFullViewOpen(false)}
            type="button"
          >
            접기
          </button>
        ) : null}
      </div>

      {isFullViewOpen ? (
        <div className="mt-6" id="action-memo-full">
      {attentionTargets.length > 0 ? (
        <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">
            관심 필요 대상자 내부 메모 작성
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {attentionTargets.map((target) => (
              <button
                className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-100"
                key={`${target.targetUserId ?? target.targetName}-${target.targetName}`}
                onClick={() => fillAttentionTarget(target)}
                type="button"
              >
                {target.targetName} 내부 메모 작성
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-500">
              오늘/이번 주 처리 필요
            </p>
            <h3 className="mt-1 text-base font-semibold text-slate-950">
              처리 필요 요약
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              전체 메모 기준의 상태, 우선순위, 팀/대상별 현황을 먼저 확인합니다.
            </p>
          </div>
          <button
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={() => void loadNotes(true)}
            type="button"
          >
            새로고침
          </button>
        </div>
        <section className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-4">
          <div>
            <h4 className="text-sm font-semibold text-slate-950">
              코치/팀별 메모 요약
            </h4>
            <p className="mt-1 text-sm text-slate-600">
              현재 조회된 전체 메모 기준 요약입니다. 검색/필터와 독립적으로 계산됩니다.
            </p>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            {[
              {
                drilldown: null,
                label: "전체 메모 수",
                value: summary.totalCount,
              },
              {
                drilldown: { type: "status", value: "open" } as DrilldownFilter,
                label: "진행 전",
                value: summary.openCount,
              },
              {
                drilldown: {
                  type: "status",
                  value: "in_progress",
                } as DrilldownFilter,
                label: "진행 중",
                value: summary.inProgressCount,
              },
              {
                drilldown: {
                  type: "status",
                  value: "completed",
                } as DrilldownFilter,
                label: "완료",
                value: summary.completedCount,
              },
              {
                drilldown: {
                  type: "status",
                  value: "archived",
                } as DrilldownFilter,
                label: "보관됨",
                value: summary.archivedCount,
              },
              {
                drilldown: {
                  type: "priority",
                  value: "high",
                } as DrilldownFilter,
                label: "높은 우선순위",
                value: summary.highPriorityCount,
              },
              {
                drilldown: { type: "overdue" } as DrilldownFilter,
                label: "기한 지난 메모",
                value: summary.overdueCount,
              },
            ].map((card) => (
              <button
                className="rounded-md border border-slate-200 bg-white p-3 text-left hover:bg-slate-50"
                key={card.label}
                onClick={() => applyDrilldown(card.drilldown)}
                type="button"
              >
                <p className="text-xs font-medium text-slate-500">{card.label}</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">
                  {card.value}
                </p>
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-3">
            <div className="rounded-md border border-slate-200 bg-white p-4">
              <h5 className="text-sm font-semibold text-slate-950">팀별 메모 요약</h5>
              {summary.teamSummaries.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">팀별 메모가 없습니다.</p>
              ) : (
                <div className="mt-3 grid gap-2">
                  {summary.teamSummaries.map((team) => (
                    <button
                      className="rounded-md border border-slate-200 bg-slate-50 p-3 text-left hover:bg-slate-100"
                      key={team.teamName}
                      onClick={() =>
                        applyDrilldown({ type: "team", value: team.teamName })
                      }
                      type="button"
                    >
                      <p className="font-medium text-slate-950">{team.teamName}</p>
                      <p className="mt-1 text-sm text-slate-600">
                        전체 {team.totalCount}개 · 미완료 {team.incompleteCount}개 · 높은 우선순위{" "}
                        {team.highPriorityCount}개
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-md border border-slate-200 bg-white p-4">
              <h5 className="text-sm font-semibold text-slate-950">
                대상별 메모 요약 상위 5개
              </h5>
              {summary.targetSummaries.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">대상별 메모가 없습니다.</p>
              ) : (
                <div className="mt-3 grid gap-2">
                  {summary.targetSummaries.map((target) => (
                    <button
                      className="rounded-md border border-slate-200 bg-slate-50 p-3 text-left hover:bg-slate-100"
                      key={target.targetName}
                      onClick={() =>
                        applyDrilldown({
                          type: "target",
                          value: target.targetName,
                        })
                      }
                      type="button"
                    >
                      <p className="font-medium text-slate-950">{target.targetName}</p>
                      <p className="mt-1 text-sm text-slate-600">
                        메모 {target.totalCount}개
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-md border border-slate-200 bg-white p-4">
              <h5 className="text-sm font-semibold text-slate-950">
                대상 구분별 메모 요약
              </h5>
              {summary.targetTypeSummaries.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">
                  대상 구분별 메모가 없습니다.
                </p>
              ) : (
                <div className="mt-3 grid gap-2">
                  {summary.targetTypeSummaries.map((targetTypeSummary) => (
                    <button
                      className="rounded-md border border-slate-200 bg-slate-50 p-3 text-left hover:bg-slate-100"
                      key={targetTypeSummary.targetType}
                      onClick={() =>
                        applyDrilldown({
                          type: "target_type",
                          value: targetTypeSummary.targetType,
                        })
                      }
                      type="button"
                    >
                      <p className="font-medium text-slate-950">
                        {TARGET_TYPE_LABELS[targetTypeSummary.targetType]}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        메모 {targetTypeSummary.totalCount}개
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
        {activeDrilldownLabel ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-blue-200 bg-blue-50 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-blue-800">
                현재 보기: {activeDrilldownLabel}
              </p>
              <p className="mt-1 text-xs text-blue-700">
                기존 검색어와 필터 조건이 함께 적용됩니다.
              </p>
            </div>
            <button
              className="rounded-md border border-blue-300 bg-white px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50"
              onClick={clearDrilldown}
              type="button"
            >
              드릴다운 해제
            </button>
          </div>
        ) : null}
        <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-4">
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-slate-950">
              검색/필터/정렬
            </h4>
            <p className="mt-1 text-sm text-slate-600">
              드릴다운 조건과 검색, 상태, 우선순위, 대상 구분 필터가 함께 적용됩니다.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="block md:col-span-2">
              <span className="text-sm font-medium text-slate-700">검색</span>
              <input
                className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="대상 이름, 팀명, 지역, 메모 내용"
                value={searchQuery}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">상태</span>
              <select
                className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
                onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                value={statusFilter}
              >
                <option value="all">전체</option>
                <option value="open">진행 전</option>
                <option value="in_progress">진행 중</option>
                <option value="completed">완료</option>
                <option value="archived">보관됨</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">우선순위</span>
              <select
                className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
                onChange={(event) =>
                  setPriorityFilter(event.target.value as PriorityFilter)
                }
                value={priorityFilter}
              >
                <option value="all">전체</option>
                <option value="low">낮음</option>
                <option value="normal">보통</option>
                <option value="high">높음</option>
              </select>
            </label>
            <label className="block md:col-span-2">
              <span className="text-sm font-medium text-slate-700">대상 구분</span>
              <select
                className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
                onChange={(event) =>
                  setTargetTypeFilter(event.target.value as TargetTypeFilter)
                }
                value={targetTypeFilter}
              >
                <option value="all">전체</option>
                <option value="coach">코치</option>
                <option value="team">팀</option>
                <option value="attention_target">관심 필요 대상자</option>
                <option value="coachee">코칭 대상자</option>
                <option value="church">교회</option>
                <option value="organization">기관</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">정렬 기준</span>
              <select
                className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
                onChange={(event) => {
                  setSortKey(event.target.value as SortKey);
                  setCurrentPage(1);
                }}
                value={sortKey}
              >
                <option value="created_at">작성일</option>
                <option value="due_date">마감일</option>
                <option value="priority">우선순위</option>
                <option value="status">상태</option>
                <option value="target_name">대상 이름</option>
                <option value="target_type">대상 구분</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">보기 개수</span>
              <select
                className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
                onChange={(event) => setPageSize(Number(event.target.value))}
                value={pageSize}
              >
                <option value={10}>10개</option>
                <option value={20}>20개</option>
                <option value={50}>50개</option>
              </select>
            </label>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">
              전체 {notes.length}개 중 {filteredNotes.length}개 표시
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => toggleSort(sortKey)}
                type="button"
              >
                {sortDirection === "asc" ? "오름차순" : "내림차순"}
              </button>
              <button
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                onClick={resetFilters}
                type="button"
              >
                필터 초기화
              </button>
            </div>
          </div>
        </div>
        <section
          className="mt-4 rounded-md border border-slate-200 bg-white p-4"
          id="action-memo-create"
        >
          <div>
            <h3 className="text-base font-semibold text-slate-950">
              관리 액션 메모 작성
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              대상과 액션을 정리해 저장하면 권한 범위 안에서 계속 확인할 수 있습니다.
            </p>
          </div>
          <form
            className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4"
            onSubmit={handleSubmit}
          >
            <label className="block">
              <span className="text-sm font-medium text-slate-700">대상 구분</span>
              <select
                className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
                onChange={(event) => setTargetType(event.target.value as TargetType)}
                value={targetType}
              >
                <option value="coach">코치</option>
                <option value="team">팀</option>
                <option value="attention_target">관심 필요 대상자</option>
                <option value="coachee">코칭 대상자</option>
                <option value="church">교회</option>
                <option value="organization">기관</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">
                대상 이름 또는 팀명
              </span>
              <input
                className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
                onChange={(event) => setTargetName(event.target.value)}
                placeholder="이름 또는 팀명"
                value={targetName}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">팀/목장</span>
              <input
                className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
                onChange={(event) => setTeamName(event.target.value)}
                placeholder="선택 입력"
                value={teamName}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">지역</span>
              <input
                className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
                onChange={(event) => setRegion(event.target.value)}
                placeholder="선택 입력"
                value={region}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">
                관리 액션 유형
              </span>
              <select
                className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
                onChange={(event) => setActionType(event.target.value as ActionType)}
                value={actionType}
              >
                <option value="contact_line">LINE/전화 연락</option>
                <option value="coaching_encouragement">코칭 권면</option>
                <option value="team_leader_check">팀장 확인</option>
                <option value="next_meeting_check">다음 모임 점검</option>
                <option value="other">기타</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">우선순위</span>
              <select
                className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
                onChange={(event) => setPriority(event.target.value as Priority)}
                value={priority}
              >
                <option value="low">낮음</option>
                <option value="normal">보통</option>
                <option value="high">높음</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">마감일</span>
              <input
                className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
                onChange={(event) => setDueDate(event.target.value)}
                type="date"
                value={dueDate}
              />
            </label>
            <label className="block md:col-span-2 xl:col-span-4">
              <span className="text-sm font-medium text-slate-700">메모 내용</span>
              <textarea
                className="mt-2 min-h-28 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
                onChange={(event) => setContent(event.target.value)}
                placeholder="후속 관리 액션 메모를 입력하세요."
                value={content}
              />
            </label>
            <div className="flex flex-wrap items-center gap-3 md:col-span-2 xl:col-span-4">
              <button
                className="rounded-md bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                disabled={isSaving}
                type="submit"
              >
                {isSaving ? "저장 중" : "메모 저장"}
              </button>
              {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
              {error ? <p className="text-sm text-red-700">{error}</p> : null}
            </div>
          </form>
        </section>
        <div className="mt-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-950">
                관리 액션 메모 목록
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                검색/필터/정렬 결과를 기준으로 메모를 확인하고 빠르게 처리합니다.
              </p>
            </div>
            <button
              className="inline-flex w-full justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:w-auto"
              onClick={exportFilteredNotesToCsv}
              type="button"
            >
              CSV 내보내기
            </button>
          </div>
        </div>
        {isLoading ? (
          <p className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-4 py-5 text-center text-sm text-slate-500">
            관리 액션 메모를 불러오는 중입니다.
          </p>
        ) : sortedNotes.length === 0 ? (
          <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-4 py-5 text-center text-sm text-slate-500">
            {notes.length === 0 ? (
              <p>아직 등록된 관리 메모가 없습니다.</p>
            ) : (
              <>
                <p>
                  선택한 필터에 해당하는 관리 메모가 없습니다.
                </p>
                <p className="mt-1">
                  필터를 초기화하거나 다른 조건으로 다시 조회해 주세요.
                </p>
                <button
                  className="mt-4 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  onClick={resetFilters}
                  type="button"
                >
                  필터 초기화
                </button>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="mt-3 grid gap-3">
            {paginatedNotes.map((note) => {
              const dueDateInfo = getDueDateInfo(note.due_date);

              return (
              <article
                className="rounded-md border border-slate-200 bg-slate-50 p-4"
                key={note.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-950">
                      {TARGET_TYPE_LABELS[note.target_type]}: {note.target_name}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {ACTION_TYPE_LABELS[note.action_type]}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${PRIORITY_BADGE_CLASSES[note.priority]}`}
                      >
                        우선순위 {PRIORITY_LABELS[note.priority]}
                      </span>
                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${STATUS_BADGE_CLASSES[note.status]}`}
                      >
                        {STATUS_LABELS[note.status]}
                      </span>
                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${dueDateInfo.className}`}
                      >
                        {dueDateInfo.label}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      팀 {displayValue(note.team_name)} · 지역 {displayValue(note.region)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      작성일: {formatDateTime(note.created_at)}
                      {note.due_date ? ` · 마감일: ${note.due_date}` : ""}
                    </p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <label className="block">
                        <span className="text-xs font-medium text-slate-600">
                          상태 빠른 변경
                        </span>
                        <select
                          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={
                            quickUpdating?.id === note.id &&
                            quickUpdating.field === "status"
                          }
                          onChange={(event) => {
                            const nextStatus = event.target.value as NoteStatus;
                            if (nextStatus === note.status) return;
                            void updateNoteQuick(
                              note.id,
                              { status: nextStatus },
                              "status",
                            );
                          }}
                          value={note.status}
                        >
                          <option value="open">진행 전</option>
                          <option value="in_progress">진행 중</option>
                          <option value="completed">완료</option>
                          <option value="archived">보관됨</option>
                        </select>
                      </label>
                      <label className="block">
                        <span className="text-xs font-medium text-slate-600">
                          우선순위 빠른 변경
                        </span>
                        <select
                          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={
                            quickUpdating?.id === note.id &&
                            quickUpdating.field === "priority"
                          }
                          onChange={(event) => {
                            const nextPriority = event.target.value as Priority;
                            if (nextPriority === note.priority) return;
                            void updateNoteQuick(
                              note.id,
                              { priority: nextPriority },
                              "priority",
                            );
                          }}
                          value={note.priority}
                        >
                          <option value="low">낮음</option>
                          <option value="normal">보통</option>
                          <option value="high">높음</option>
                        </select>
                      </label>
                    </div>
                    {quickUpdating?.id === note.id ? (
                      <p className="mt-2 text-xs font-medium text-blue-700">
                        변경 중...
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-white"
                      onClick={() => openDetail(note)}
                      type="button"
                    >
                      상세보기
                    </button>
                    {note.status !== "completed" && note.status !== "archived" ? (
                      <button
                        className="rounded-md border border-emerald-300 bg-white px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
                        onClick={() => void completeNote(note.id)}
                        type="button"
                      >
                        완료 처리
                      </button>
                    ) : null}
                    {note.status !== "archived" ? (
                      <button
                        className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-white"
                        disabled={archivingId === note.id}
                        onClick={() => void archiveNote(note.id)}
                        type="button"
                      >
                        {archivingId === note.id ? "보관 중..." : "보관"}
                      </button>
                    ) : null}
                  </div>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {note.note}
                </p>
              </article>
              );
            })}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
              <p className="text-sm text-slate-600">
                {normalizedCurrentPage} / {totalPages} 페이지 · 총 {sortedNotes.length}개
              </p>
              <div className="flex gap-2">
                <button
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={normalizedCurrentPage <= 1}
                  onClick={() =>
                    setCurrentPage((page) => Math.max(1, page - 1))
                  }
                  type="button"
                >
                  이전
                </button>
                <button
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={normalizedCurrentPage >= totalPages}
                  onClick={() =>
                    setCurrentPage((page) => Math.min(totalPages, page + 1))
                  }
                  type="button"
                >
                  다음
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {selectedNote && editForm ? (
        <aside className="mt-6 rounded-md border border-slate-300 bg-white">
          <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-950">
                관리 액션 메모 상세
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                상세 정보 확인과 제한된 필드 수정을 지원합니다.
              </p>
            </div>
            <button
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              onClick={closeDetail}
              type="button"
            >
              닫기
            </button>
          </div>

          <div className="max-h-[75vh] overflow-y-auto p-5">
            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-md border border-slate-200 bg-slate-50 p-4">
                <h4 className="text-sm font-semibold text-slate-950">기본정보</h4>
                <dl className="mt-3 grid gap-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">대상 구분</dt>
                    <dd className="font-medium text-slate-900">
                      {TARGET_TYPE_LABELS[selectedNote.target_type]}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">대상 이름</dt>
                    <dd className="font-medium text-slate-900">
                      {selectedNote.target_name}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">팀명</dt>
                    <dd className="font-medium text-slate-900">
                      {displayValue(selectedNote.team_name)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">지역</dt>
                    <dd className="font-medium text-slate-900">
                      {displayValue(selectedNote.region)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">작성일</dt>
                    <dd className="font-medium text-slate-900">
                      {formatDateTime(selectedNote.created_at)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">수정일</dt>
                    <dd className="font-medium text-slate-900">
                      {formatDateTime(selectedNote.updated_at)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">완료일</dt>
                    <dd className="font-medium text-slate-900">
                      {formatDateTime(selectedNote.completed_at)}
                    </dd>
                  </div>
                </dl>
              </section>

              <section className="rounded-md border border-slate-200 bg-slate-50 p-4">
                <h4 className="text-sm font-semibold text-slate-950">
                  상태/우선순위/마감일
                </h4>
                {isEditingDetail ? (
                  <div className="mt-3 grid gap-3">
                    <label className="block">
                      <span className="text-sm font-medium text-slate-700">
                        액션 유형
                      </span>
                      <select
                        className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
                        onChange={(event) =>
                          setEditForm({
                            ...editForm,
                            actionType: event.target.value as ActionType,
                          })
                        }
                        value={editForm.actionType}
                      >
                        <option value="contact_line">LINE/전화 연락</option>
                        <option value="coaching_encouragement">코칭 권면</option>
                        <option value="team_leader_check">팀장 확인</option>
                        <option value="next_meeting_check">다음 모임 점검</option>
                        <option value="other">기타</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-sm font-medium text-slate-700">
                        우선순위
                      </span>
                      <select
                        className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
                        onChange={(event) =>
                          setEditForm({
                            ...editForm,
                            priority: event.target.value as Priority,
                          })
                        }
                        value={editForm.priority}
                      >
                        <option value="low">낮음</option>
                        <option value="normal">보통</option>
                        <option value="high">높음</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-sm font-medium text-slate-700">상태</span>
                      <select
                        className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
                        onChange={(event) =>
                          setEditForm({
                            ...editForm,
                            status: event.target.value as NoteStatus,
                          })
                        }
                        value={editForm.status}
                      >
                        <option value="open">진행 전</option>
                        <option value="in_progress">진행 중</option>
                        <option value="completed">완료</option>
                        <option value="archived">보관됨</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-sm font-medium text-slate-700">
                        마감일
                      </span>
                      <input
                        className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
                        onChange={(event) =>
                          setEditForm({ ...editForm, dueDate: event.target.value })
                        }
                        type="date"
                        value={editForm.dueDate}
                      />
                    </label>
                    <label className="block">
                      <span className="text-sm font-medium text-slate-700">팀명</span>
                      <input
                        className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
                        onChange={(event) =>
                          setEditForm({ ...editForm, teamName: event.target.value })
                        }
                        value={editForm.teamName}
                      />
                    </label>
                    <label className="block">
                      <span className="text-sm font-medium text-slate-700">지역</span>
                      <input
                        className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
                        onChange={(event) =>
                          setEditForm({ ...editForm, region: event.target.value })
                        }
                        value={editForm.region}
                      />
                    </label>
                  </div>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span
                      className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${PRIORITY_BADGE_CLASSES[selectedNote.priority]}`}
                    >
                      우선순위 {PRIORITY_LABELS[selectedNote.priority]}
                    </span>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${STATUS_BADGE_CLASSES[selectedNote.status]}`}
                    >
                      {STATUS_LABELS[selectedNote.status]}
                    </span>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getDueDateInfo(selectedNote.due_date).className}`}
                    >
                      {getDueDateInfo(selectedNote.due_date).label}
                    </span>
                  </div>
                )}
              </section>
            </div>

            <section className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-4">
              <h4 className="text-sm font-semibold text-slate-950">메모 내용</h4>
              {isEditingDetail ? (
                <textarea
                  className="mt-3 min-h-36 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
                  onChange={(event) =>
                    setEditForm({ ...editForm, note: event.target.value })
                  }
                  value={editForm.note}
                />
              ) : (
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {selectedNote.note}
                </p>
              )}
            </section>

            <section className="mt-4 rounded-md border border-slate-200 bg-white p-4">
              <h4 className="text-sm font-semibold text-slate-950">작업</h4>
              <div className="mt-3 flex flex-wrap gap-2">
                {isEditingDetail ? (
                  <>
                    <button
                      className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                      disabled={isUpdatingDetail}
                      onClick={() => void saveDetailEdit()}
                      type="button"
                    >
                      {isUpdatingDetail ? "저장 중" : "수정 저장"}
                    </button>
                    <button
                      className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      onClick={cancelEditingDetail}
                      type="button"
                    >
                      수정 취소
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                      onClick={startEditingDetail}
                      type="button"
                    >
                      수정
                    </button>
                    {selectedNote.status !== "completed" &&
                    selectedNote.status !== "archived" ? (
                      <button
                        className="rounded-md border border-emerald-300 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
                        onClick={() => void completeNote(selectedNote.id)}
                        type="button"
                      >
                        완료 처리
                      </button>
                    ) : null}
                    {selectedNote.status !== "archived" ? (
                      <button
                        className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        disabled={archivingId === selectedNote.id}
                        onClick={() => void archiveNote(selectedNote.id)}
                        type="button"
                      >
                        {archivingId === selectedNote.id
                          ? "보관 중..."
                          : "보관"}
                      </button>
                    ) : null}
                  </>
                )}
              </div>
            </section>
          </div>
        </aside>
      ) : null}
        </div>
      ) : null}
    </section>
  );
}
