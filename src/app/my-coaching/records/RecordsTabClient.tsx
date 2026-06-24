"use client";

import { useCallback } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui";

type RecordStatus = string | null;
type RecordType = "daily" | "weekly" | "monthly";

export type TabRecord = {
  id: string;
  type: RecordType;
  title: string;
  dateLabel: string;
  status: RecordStatus;
  href: string;
  primaryLabel: string;
  primaryText: string | null;
  secondaryLabel?: string;
  secondaryText?: string | null;
};

export type TabData = {
  ok: boolean;
  records: TabRecord[];
};

type Props = {
  initialTab: RecordType;
  daily: TabData;
  weekly: TabData;
  monthly: TabData;
};

const TAB_CONFIG = [
  {
    id: "daily" as RecordType,
    label: "하루",
    description: "오늘의 묵상, 실천, 기도제목을 간단히 기록합니다.",
    ctaLabel: "오늘 기록 작성",
    ctaHref: "/my-coaching/records/daily",
    emptyMessage: "아직 작성한 하루 기록이 없습니다.",
    errorMessage: "하루 기록을 불러오지 못했습니다.",
  },
  {
    id: "weekly" as RecordType,
    label: "주간",
    description: "한 주간의 목표 실행과 목실기 실천을 정리합니다.",
    ctaLabel: "이번 주 기록 작성",
    ctaHref: "/my-coaching/weekly-log",
    emptyMessage: "아직 작성한 주간 기록이 없습니다.",
    errorMessage: "주간 기록을 불러오지 못했습니다.",
  },
  {
    id: "monthly" as RecordType,
    label: "월간",
    description: "한 달 동안의 성장과 다음 달 계획을 정리합니다.",
    ctaLabel: "이번 달 회고 작성",
    ctaHref: "/my-coaching/records/monthly",
    emptyMessage: "아직 작성한 월간 회고가 없습니다.",
    errorMessage: "월간 회고를 불러오지 못했습니다.",
  },
] as const;

function getStatusLabel(status: RecordStatus) {
  if (status === "draft") return "임시저장";
  if (status === "submitted") return "제출완료";
  if (status === "reviewed") return "검토완료";
  return "확인 필요";
}

function getStatusTone(status: RecordStatus): "success" | "warning" | "neutral" {
  if (status === "submitted" || status === "reviewed") return "success";
  if (status === "draft") return "warning";
  return "neutral";
}

function RecordRow({ record }: { record: TabRecord }) {
  return (
    <a
      className="flex items-start justify-between gap-3 rounded-control border border-line-base bg-surface-card px-4 py-3 hover:bg-surface-hover"
      href={record.href}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-ink-strong">{record.title}</p>
        <p className="mt-0.5 text-sm text-ink-muted">{record.dateLabel}</p>
        {record.primaryText ? (
          <p className="mt-1 line-clamp-1 text-sm text-ink-base">{record.primaryText}</p>
        ) : null}
      </div>
      <div className="shrink-0 pt-0.5">
        <Badge tone={getStatusTone(record.status)}>
          {getStatusLabel(record.status)}
        </Badge>
      </div>
    </a>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-control border border-line-base bg-surface-sunken p-6 text-center text-sm text-ink-muted">
      {message}
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-control border border-red-200 bg-red-50 p-3 text-sm text-red-800">
      {message}
    </div>
  );
}

export function RecordsTabClient({ initialTab, daily, weekly, monthly }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const rawTab = searchParams.get("tab");
  const activeTab: RecordType =
    rawTab === "weekly" || rawTab === "monthly" || rawTab === "daily"
      ? rawTab
      : initialTab;

  const setTab = useCallback(
    (tab: RecordType) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", tab);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const tabDataMap: Record<RecordType, TabData> = { daily, weekly, monthly };

  const currentConfig = TAB_CONFIG.find((t) => t.id === activeTab) ?? TAB_CONFIG[0];
  const currentData = tabDataMap[activeTab];

  return (
    <div className="mt-6 rounded-card border border-line-base bg-surface-card shadow-sm print:hidden">
      {/* 탭 바 */}
      <div className="grid grid-cols-3 border-b border-line-base">
        {TAB_CONFIG.map((tab) => {
          const count = tabDataMap[tab.id].records.length;
          const isActive = tab.id === activeTab;

          return (
            <button
              key={tab.id}
              className={[
                "flex flex-col items-center gap-0.5 px-2 py-3 text-center transition-colors",
                isActive
                  ? "border-b-2 border-ink-strong font-medium text-ink-strong"
                  : "text-ink-muted hover:text-ink-base",
              ].join(" ")}
              onClick={() => setTab(tab.id)}
              type="button"
            >
              <span className="text-sm">{tab.label}</span>
              <span className="text-xs">{count}건</span>
            </button>
          );
        })}
      </div>

      {/* 탭 본문 */}
      <div className="p-4">
        {/* CTA 배너 */}
        <div className="mb-4 flex items-center justify-between gap-3 rounded-control border border-line-base bg-surface-sunken px-3 py-2.5">
          <p className="text-sm text-ink-muted">{currentConfig.description}</p>
          <ButtonLink className="shrink-0" href={currentConfig.ctaHref} size="sm">
            {currentConfig.ctaLabel}
          </ButtonLink>
        </div>

        {/* 기록 목록 */}
        {!currentData.ok ? (
          <ErrorState message={currentConfig.errorMessage} />
        ) : currentData.records.length === 0 ? (
          <EmptyState message={currentConfig.emptyMessage} />
        ) : (
          <div className="flex flex-col gap-2">
            {currentData.records.map((record) => (
              <RecordRow key={record.id} record={record} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
