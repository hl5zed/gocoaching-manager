"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import {
  calculateCompletionRate,
} from "@/lib/coaching/progress";

export type TodayCheckItem = {
  areaKey: "spiritual" | "intellectual" | "physical" | "social";
  areaTitle: string;
  goalId: string;
  goalTitle: string;
  isChecked: boolean;
  monthlyRecordId: string | null;
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

type SavePayload = {
  goalId: string;
  checked: boolean;
};

export type TodayCheckSaveResult =
  | { ok: true; message: string; monthlyRecordId: string | null }
  | { ok: false; message: string };

const AREA_VISUAL: Record<
  TodayCheckItem["areaKey"],
  { icon: string; label: string; tone: "success" | "info" | "warning" | "danger" }
> = {
  spiritual: { icon: "🙏", label: "영적", tone: "success" },
  intellectual: { icon: "📘", label: "지적", tone: "info" },
  physical: { icon: "💪", label: "신체적", tone: "warning" },
  social: { icon: "🤝", label: "사회적", tone: "danger" },
};

function formatTodayLabel(todayDateKey: string, timezone: string) {
  const date = new Date(`${todayDateKey}T00:00:00`);
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
    timeZone: timezone,
  }).format(date);
}

export function TodayCheckClient({
  initialItems,
  todayDateKey,
  timezone,
  onSaveCheck,
}: {
  initialItems: TodayCheckItem[];
  todayDateKey: string;
  timezone: string;
  onSaveCheck: (input: {
    detailGoalId: string;
    checked: boolean;
  }) => Promise<TodayCheckSaveResult>;
}) {
  const [items, setItems] = useState<TodayCheckItem[]>(initialItems);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [retryPayload, setRetryPayload] = useState<SavePayload | null>(null);
  const [isManualSaving, setIsManualSaving] = useState(false);

  const debounceTimerRef = useRef<number | null>(null);
  const pendingPayloadRef = useRef<SavePayload | null>(null);

  const totalCount = items.length;
  const completedCount = useMemo(
    () => items.filter((item) => item.isChecked).length,
    [items],
  );
  const completionRate = calculateCompletionRate(completedCount, totalCount);

  const groupedItems = useMemo(() => {
    const order: TodayCheckItem["areaKey"][] = [
      "spiritual",
      "intellectual",
      "physical",
      "social",
    ];
    return order.map((key) => ({
      areaKey: key,
      areaTitle: items.find((item) => item.areaKey === key)?.areaTitle ?? AREA_VISUAL[key].label,
      goals: items.filter((item) => item.areaKey === key),
    }));
  }, [items]);

  const runSave = useCallback(
    async (payload: SavePayload) => {
      setSaveStatus("saving");
      setStatusMessage("저장 중...");
      setRetryPayload(null);

      const targetItem = items.find((item) => item.goalId === payload.goalId);

      if (!targetItem) {
        setSaveStatus("error");
        setStatusMessage("저장 대상 목표를 찾을 수 없습니다.");
        setRetryPayload(payload);
        return;
      }

      try {
        const result = await onSaveCheck({
          detailGoalId: payload.goalId,
          checked: payload.checked,
        });

        if (!result.ok) {
          setSaveStatus("error");
          setStatusMessage(result.message);
          setRetryPayload(payload);
          return;
        }

        if (result.monthlyRecordId) {
          setItems((current) =>
            current.map((item) =>
              item.goalId === payload.goalId
                ? { ...item, monthlyRecordId: result.monthlyRecordId }
                : item,
            ),
          );
        }

        setSaveStatus("saved");
        setStatusMessage(result.message);
      } catch {
        setSaveStatus("error");
        setStatusMessage("저장 실패. 다시 시도해 주세요.");
        setRetryPayload(payload);
      }
    },
    [items, onSaveCheck],
  );

  const scheduleSave = useCallback(
    (payload: SavePayload) => {
      pendingPayloadRef.current = payload;
      setSaveStatus("saving");
      setStatusMessage("저장 대기 중...");

      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = window.setTimeout(() => {
        const nextPayload = pendingPayloadRef.current;
        if (nextPayload) {
          void runSave(nextPayload);
        }
      }, 800);
    },
    [runSave],
  );

  const toggleItem = useCallback(
    (goalId: string) => {
      let nextChecked = false;

      setItems((current) =>
        current.map((item) => {
          if (item.goalId !== goalId) {
            return item;
          }
          nextChecked = !item.isChecked;
          return {
            ...item,
            isChecked: nextChecked,
          };
        }),
      );

      scheduleSave({ goalId, checked: nextChecked });
    },
    [scheduleSave],
  );

  const handleManualSave = useCallback(async () => {
    const pendingPayload = pendingPayloadRef.current;
    if (!pendingPayload) {
      setSaveStatus("saved");
      setStatusMessage("저장됨");
      return;
    }

    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    setIsManualSaving(true);
    await runSave(pendingPayload);
    setIsManualSaving(false);
  }, [runSave]);

  const handleRetry = useCallback(async () => {
    if (!retryPayload) return;
    await runSave(retryPayload);
  }, [retryPayload, runSave]);

  return (
    <section className="mx-auto w-full max-w-md space-y-4">
      <Card className="border-line-base bg-surface-card">
        <CardHeader className="border-line-soft px-4 py-4">
          <div className="space-y-2">
            <Badge tone="info">오늘 실행 체크</Badge>
            <CardTitle className="text-xl">{formatTodayLabel(todayDateKey, timezone)}</CardTitle>
            <p className="text-xs text-ink-muted">
              오늘 {totalCount}개 중 {completedCount}개 완료
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 p-4">
          <ProgressBar showValue value={completionRate} />
          <div className="flex items-center justify-between gap-2">
            <p
              className={`text-xs ${
                saveStatus === "error"
                  ? "text-red-600"
                  : saveStatus === "saved"
                    ? "text-emerald-600"
                    : "text-ink-muted"
              }`}
            >
              {statusMessage}
            </p>
            <div className="flex gap-2">
              {saveStatus === "error" ? (
                <Button onClick={() => void handleRetry()} size="sm" variant="danger">
                  재시도
                </Button>
              ) : null}
              <Button
                disabled={isManualSaving}
                onClick={() => void handleManualSave()}
                size="sm"
                variant="secondary"
              >
                {isManualSaving ? "저장 중..." : "저장"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {totalCount === 0 ? (
        <Card className="border-line-base bg-surface-card">
          <CardContent className="p-4">
            <p className="text-sm font-semibold">아직 목표가 없어요</p>
            <p className="mt-1 text-xs text-ink-muted">
              먼저 목실기에서 4영역 목표를 작성해 주세요.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {groupedItems.map((group) => {
        const visual = AREA_VISUAL[group.areaKey];

        if (group.goals.length === 0) return null;

        return (
          <Card className="border-line-base bg-surface-card" key={group.areaKey}>
            <CardHeader className="border-line-soft px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <Badge tone={visual.tone}>
                  <span aria-hidden>{visual.icon}</span>
                  {visual.label}
                </Badge>
                <p className="text-xs text-ink-muted">{group.areaTitle}</p>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 p-3">
              {group.goals.map((item) => (
                <button
                  aria-label={`${item.goalTitle} ${item.isChecked ? "완료" : "미완료"}`}
                  className={`flex w-full items-center gap-3 rounded-control border px-3 py-3 text-left transition ${
                    item.isChecked
                      ? "border-emerald-300 bg-emerald-50"
                      : "border-line-soft bg-surface-card"
                  }`}
                  key={item.goalId}
                  onClick={() => toggleItem(item.goalId)}
                  type="button"
                >
                  <span
                    className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-control border text-lg ${
                      item.isChecked
                        ? "border-emerald-400 bg-emerald-100 text-emerald-700"
                        : "border-line-base bg-surface-sunken text-ink-muted"
                    }`}
                  >
                    {item.isChecked ? "✓" : ""}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink-base">
                      {item.goalTitle}
                    </span>
                    <span className="mt-1 block text-xs text-ink-muted">
                      {item.isChecked ? "완료" : "미완료"}
                    </span>
                  </span>
                </button>
              ))}
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}
