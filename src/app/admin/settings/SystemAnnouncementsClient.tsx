"use client";

import { useMemo, useState, type FormEvent } from "react";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  FieldLabel,
  FieldText,
  SelectInput,
  TextareaInput,
  TextInput,
} from "@/components/ui";
import type {
  SystemAnnouncement,
  SystemAnnouncementAudience,
  SystemAnnouncementPlacement,
} from "@/lib/api/admin/system-announcements";

type FormState = {
  audience: SystemAnnouncementAudience;
  body: string;
  ends_at: string;
  is_active: boolean;
  placement: SystemAnnouncementPlacement;
  priority: string;
  starts_at: string;
  title: string;
};

type SaveState =
  | {
      message: string;
      tone: "success" | "danger" | "warning";
    }
  | null;

const emptyForm: FormState = {
  audience: "all",
  body: "",
  ends_at: "",
  is_active: true,
  placement: "dashboard",
  priority: "0",
  starts_at: "",
  title: "",
};

const audienceLabels: Record<SystemAnnouncementAudience, string> = {
  admin: "관리자 전용",
  all: "전체 사용자",
};

const placementLabels: Record<SystemAnnouncementPlacement, string> = {
  admin: "관리자 센터",
  dashboard: "대시보드",
  login_after: "로그인 후",
};

function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

function toDateTimeLocal(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function toIsoOrNull(value: string) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function getAnnouncementStatus(announcement: SystemAnnouncement) {
  const now = Date.now();
  const startsAt = announcement.starts_at
    ? new Date(announcement.starts_at).getTime()
    : null;
  const endsAt = announcement.ends_at
    ? new Date(announcement.ends_at).getTime()
    : null;

  if (announcement.deleted_at) {
    return { label: "삭제됨", tone: "neutral" as const };
  }

  if (!announcement.is_active) {
    return { label: "비활성", tone: "warning" as const };
  }

  if (startsAt && startsAt > now) {
    return { label: "예약", tone: "info" as const };
  }

  if (endsAt && endsAt < now) {
    return { label: "종료", tone: "neutral" as const };
  }

  return { label: "활성", tone: "success" as const };
}

function createPayload(form: FormState) {
  return {
    audience: form.audience,
    body: form.body,
    ends_at: toIsoOrNull(form.ends_at),
    is_active: form.is_active,
    placement: form.placement,
    priority: Number.parseInt(form.priority, 10) || 0,
    starts_at: toIsoOrNull(form.starts_at),
    title: form.title,
  };
}

export function SystemAnnouncementsClient({
  initialAnnouncements,
  initialError,
}: {
  initialAnnouncements: SystemAnnouncement[];
  initialError?: string | null;
}) {
  const [announcements, setAnnouncements] = useState(initialAnnouncements);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>(
    initialError ? { message: initialError, tone: "warning" } : null,
  );

  const activeCount = useMemo(
    () =>
      announcements.filter(
        (announcement) =>
          !announcement.deleted_at && getAnnouncementStatus(announcement).label === "활성",
      ).length,
    [announcements],
  );

  const setField = <Key extends keyof FormState>(key: Key, value: FormState[Key]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const applyAnnouncement = (announcement: SystemAnnouncement) => {
    setAnnouncements((current) => {
      const exists = current.some((item) => item.id === announcement.id);
      const next = exists
        ? current.map((item) => (item.id === announcement.id ? announcement : item))
        : [announcement, ...current];

      return [...next].sort((a, b) => {
        if (a.deleted_at && !b.deleted_at) return 1;
        if (!a.deleted_at && b.deleted_at) return -1;
        if (b.priority !== a.priority) return b.priority - a.priority;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    });
  };

  const handleEdit = (announcement: SystemAnnouncement) => {
    setEditingId(announcement.id);
    setSaveState(null);
    setForm({
      audience: announcement.audience,
      body: announcement.body,
      ends_at: toDateTimeLocal(announcement.ends_at),
      is_active: announcement.is_active,
      placement: announcement.placement,
      priority: String(announcement.priority),
      starts_at: toDateTimeLocal(announcement.starts_at),
      title: announcement.title,
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPendingId(editingId ?? "create");
    setSaveState(null);

    try {
      const response = await fetch(
        editingId
          ? `/api/admin/system-announcements/${editingId}`
          : "/api/admin/system-announcements",
        {
          body: JSON.stringify(createPayload(form)),
          headers: {
            "Content-Type": "application/json",
          },
          method: editingId ? "PATCH" : "POST",
        },
      );
      const result = await response.json();

      if (!response.ok || !result.announcement) {
        throw new Error(result.error ?? "시스템 공지를 저장하지 못했습니다.");
      }

      applyAnnouncement(result.announcement);
      setSaveState({
        message: editingId ? "시스템 공지를 수정했습니다." : "시스템 공지를 추가했습니다.",
        tone: "success",
      });
      resetForm();
    } catch (error) {
      setSaveState({
        message:
          error instanceof Error
            ? error.message
            : "시스템 공지를 저장하지 못했습니다.",
        tone: "danger",
      });
    } finally {
      setPendingId(null);
    }
  };

  const handleToggle = async (announcement: SystemAnnouncement) => {
    setPendingId(announcement.id);
    setSaveState(null);

    try {
      const response = await fetch(`/api/admin/system-announcements/${announcement.id}`, {
        body: JSON.stringify({ is_active: !announcement.is_active }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "PATCH",
      });
      const result = await response.json();

      if (!response.ok || !result.announcement) {
        throw new Error(result.error ?? "공지 상태를 변경하지 못했습니다.");
      }

      applyAnnouncement(result.announcement);
      setSaveState({ message: "공지 상태를 변경했습니다.", tone: "success" });
    } catch (error) {
      setSaveState({
        message:
          error instanceof Error
            ? error.message
            : "공지 상태를 변경하지 못했습니다.",
        tone: "danger",
      });
    } finally {
      setPendingId(null);
    }
  };

  const handleDelete = async (announcement: SystemAnnouncement) => {
    const confirmed = window.confirm(
      `"${announcement.title}" 공지를 삭제하시겠습니까?\n이 작업은 soft delete로 처리됩니다.`,
    );

    if (!confirmed) {
      return;
    }

    setPendingId(announcement.id);
    setSaveState(null);

    try {
      const response = await fetch(`/api/admin/system-announcements/${announcement.id}`, {
        method: "DELETE",
      });
      const result = await response.json();

      if (!response.ok || !result.announcement) {
        throw new Error(result.error ?? "시스템 공지를 삭제하지 못했습니다.");
      }

      applyAnnouncement(result.announcement);
      setSaveState({ message: "시스템 공지를 삭제했습니다.", tone: "success" });
      if (editingId === announcement.id) {
        resetForm();
      }
    } catch (error) {
      setSaveState({
        message:
          error instanceof Error
            ? error.message
            : "시스템 공지를 삭제하지 못했습니다.",
        tone: "danger",
      });
    } finally {
      setPendingId(null);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="info">운영 공지</Badge>
            <Badge tone="success">저장/수정 가능</Badge>
            <Badge tone="success">활성 {activeCount}개</Badge>
          </div>
          <CardTitle className="mt-3 text-xl">시스템 공지 설정</CardTitle>
          <CardDescription className="mt-2 max-w-3xl leading-6">
            운영 공지 관리용 설정입니다. 공지 작성, 수정, 활성/비활성, 삭제와
            노출 기간을 관리합니다.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {saveState ? (
          <div className="flex flex-wrap items-center gap-2 rounded-card border border-line-base bg-surface-app p-3">
            <Badge tone={saveState.tone}>{saveState.tone === "success" ? "완료" : "확인"}</Badge>
            <p className="min-w-0 break-words text-sm text-ink-base">
              {saveState.message}
            </p>
          </div>
        ) : null}

        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 lg:grid-cols-2">
            <FieldLabel>
              <FieldText>공지 제목</FieldText>
              <TextInput
                name="title"
                onChange={(event) => setField("title", event.target.value)}
                placeholder="예: 5월 시스템 점검 안내"
                required
                value={form.title}
              />
            </FieldLabel>
            <FieldLabel>
              <FieldText>우선순위</FieldText>
              <TextInput
                inputMode="numeric"
                name="priority"
                onChange={(event) => setField("priority", event.target.value)}
                type="number"
                value={form.priority}
              />
            </FieldLabel>
          </div>

          <FieldLabel>
            <FieldText>공지 본문</FieldText>
            <TextareaInput
              name="body"
              onChange={(event) => setField("body", event.target.value)}
              placeholder="사용자에게 안내할 내용을 입력하세요."
              required
              value={form.body}
            />
          </FieldLabel>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <FieldLabel>
              <FieldText>대상</FieldText>
              <SelectInput
                name="audience"
                onChange={(event) =>
                  setField("audience", event.target.value as SystemAnnouncementAudience)
                }
                value={form.audience}
              >
                <option value="all">전체 사용자</option>
                <option value="admin">관리자 전용</option>
              </SelectInput>
            </FieldLabel>
            <FieldLabel>
              <FieldText>표시 위치</FieldText>
              <SelectInput
                name="placement"
                onChange={(event) =>
                  setField("placement", event.target.value as SystemAnnouncementPlacement)
                }
                value={form.placement}
              >
                <option value="dashboard">대시보드</option>
                <option value="login_after">로그인 후</option>
                <option value="admin">관리자 센터</option>
              </SelectInput>
            </FieldLabel>
            <FieldLabel>
              <FieldText>시작일</FieldText>
              <TextInput
                name="starts_at"
                onChange={(event) => setField("starts_at", event.target.value)}
                type="datetime-local"
                value={form.starts_at}
              />
            </FieldLabel>
            <FieldLabel>
              <FieldText>종료일</FieldText>
              <TextInput
                name="ends_at"
                onChange={(event) => setField("ends_at", event.target.value)}
                type="datetime-local"
                value={form.ends_at}
              />
            </FieldLabel>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="inline-flex min-w-0 items-center gap-2 text-sm font-semibold text-ink-base">
              <input
                checked={form.is_active}
                className="h-4 w-4 rounded border-line-base text-teal-700 focus:ring-teal-600"
                onChange={(event) => setField("is_active", event.target.checked)}
                type="checkbox"
              />
              활성 상태로 게시
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {editingId ? (
                <Button onClick={resetForm} type="button" variant="ghost">
                  취소
                </Button>
              ) : null}
              <Button
                disabled={pendingId === (editingId ?? "create")}
                icon="save"
                type="submit"
                variant="primary"
              >
                {pendingId === (editingId ?? "create")
                  ? "저장 중..."
                  : editingId
                    ? "공지 수정"
                    : "공지 추가"}
              </Button>
            </div>
          </div>
        </form>

        <div className="space-y-3">
          <div>
            <h3 className="text-lg font-semibold text-ink-strong">공지 목록</h3>
            <p className="mt-1 text-sm text-ink-muted">
              삭제된 공지는 관리 이력을 위해 목록에 흐리게 표시됩니다.
            </p>
          </div>

          {announcements.length === 0 ? (
            <div className="rounded-lg border border-dashed border-line-base bg-surface-app p-5 text-sm text-ink-muted">
              등록된 시스템 공지가 없습니다.
            </div>
          ) : (
            <div className="grid gap-3">
              {announcements.map((announcement) => {
                const status = getAnnouncementStatus(announcement);
                const disabled = Boolean(announcement.deleted_at);

                return (
                  <div
                    className={`rounded-card border border-line-base bg-surface-card p-4 ${
                      disabled ? "opacity-60" : ""
                    }`}
                    key={announcement.id}
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={status.tone}>{status.label}</Badge>
                          <Badge tone="neutral">{audienceLabels[announcement.audience]}</Badge>
                          <Badge tone="info">{placementLabels[announcement.placement]}</Badge>
                          <Badge tone="neutral">우선순위 {announcement.priority}</Badge>
                        </div>
                        <h4 className="mt-3 break-words text-base font-semibold text-ink-strong">
                          {announcement.title}
                        </h4>
                        <p className="mt-2 max-h-24 overflow-hidden whitespace-pre-line break-words text-sm leading-6 text-ink-muted">
                          {announcement.body}
                        </p>
                        <p className="mt-3 text-xs leading-5 text-ink-faint">
                          기간: {formatDateTime(announcement.starts_at)} ~{" "}
                          {formatDateTime(announcement.ends_at)}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <Button
                          disabled={disabled}
                          onClick={() => handleEdit(announcement)}
                          size="sm"
                          type="button"
                        >
                          수정
                        </Button>
                        <Button
                          disabled={disabled || pendingId === announcement.id}
                          onClick={() => handleToggle(announcement)}
                          size="sm"
                          type="button"
                          variant={announcement.is_active ? "secondary" : "primary"}
                        >
                          {announcement.is_active ? "비활성" : "활성"}
                        </Button>
                        <Button
                          disabled={disabled || pendingId === announcement.id}
                          icon="delete"
                          onClick={() => handleDelete(announcement)}
                          size="sm"
                          type="button"
                          variant="danger"
                        >
                          삭제
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
