import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/ui/cn";

export function MoksilgiSection({
  anchorId,
  children,
  editQuery,
  isComplete,
  isOpen,
  summaryText,
  title,
}: {
  anchorId: string;
  title: ReactNode;
  summaryText: string;
  isComplete: boolean;
  isOpen: boolean;
  editQuery: string;
  children: ReactNode;
}) {
  const hasSummary = summaryText.trim().length > 0;

  return (
    <details
      className="moksilgi-accordion group rounded-xl border border-line-base bg-surface-card"
      id={anchorId}
      open={isOpen}
    >
      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <div className="flex items-start justify-between gap-3 px-4 py-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-ink-base">{title}</h2>
              {isComplete ? (
                <Badge icon="check" tone="success">
                  작성 완료
                </Badge>
              ) : (
                <Badge tone="warning">작성 필요</Badge>
              )}
            </div>
            {hasSummary ? (
              <p className="mt-2 line-clamp-2 text-sm text-ink-muted">{summaryText}</p>
            ) : (
              <p className="mt-2 text-sm text-ink-muted">아직 작성되지 않았습니다.</p>
            )}
          </div>
          <Link
            className="shrink-0 text-sm font-medium text-brand-600 underline underline-offset-2 print:hidden"
            href={`?edit=${editQuery}#${anchorId}`}
          >
            {hasSummary || isComplete ? "수정" : "작성하기"}
          </Link>
        </div>
      </summary>
      <CardContent className="border-t border-line-soft px-4 pb-4 pt-2">{children}</CardContent>
    </details>
  );
}

export function MoksilgiProgressCard({
  completedCount,
  totalCount,
}: {
  completedCount: number;
  totalCount: number;
}) {
  const rate =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <Card className="border-line-base bg-surface-card">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-ink-base">작성 진행률</span>
          <span className="font-semibold text-brand-600">
            {completedCount} / {totalCount} 영역
          </span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-surface-app">
          <div
            className="h-full rounded-full bg-brand-600 transition-all"
            style={{ width: `${Math.max(4, rate)}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

export function MoksilgiSectionNav({
  items,
}: {
  items: Array<{ anchorId: string; label: string }>;
}) {
  return (
    <nav
      aria-label="목실기 섹션 이동"
      className="print:hidden -mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
    >
      {items.map((item) => (
        <a
          className={cn(
            "shrink-0 rounded-full border border-line-base bg-surface-card px-3 py-1.5",
            "text-xs font-medium text-ink-muted hover:border-brand-200 hover:text-brand-700",
          )}
          href={`#${item.anchorId}`}
          key={item.anchorId}
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}

export function MoksilgiAppBar({
  actions,
}: {
  actions: ReactNode;
}) {
  return (
    <header className="print:hidden sticky top-0 z-30 -mx-4 border-b border-line-base bg-surface-app/95 px-4 py-3 backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <Link
          aria-label="오늘 홈으로 돌아가기"
          className="inline-flex items-center gap-1 text-sm font-medium text-ink-muted hover:text-brand-700"
          href="/my-coaching"
        >
          <Icon name="arrow-left" />
          <span className="sr-only sm:not-sr-only">뒤로</span>
        </Link>
        <h1 className="text-base font-semibold text-ink-strong">목실기</h1>
        <div className="flex items-center gap-2">{actions}</div>
      </div>
    </header>
  );
}
