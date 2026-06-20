import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";

export type GrowthVisibility = "coach" | "private";

function LockIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-3.5 w-3.5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <path d="M7 11V8a5 5 0 0 1 10 0v3" />
      <path d="M5 11h14v10H5z" />
    </svg>
  );
}

function VisibilityBadge({ visibility }: { visibility: GrowthVisibility }) {
  if (visibility === "coach") {
    return <Badge tone="info">코치 확인 가능</Badge>;
  }

  return (
    <Badge tone="neutral">
      <LockIcon />
      비공개
    </Badge>
  );
}

export function GrowthSection({
  title,
  visibility,
  editHref,
  editLabel = "수정",
  children,
}: {
  title: string;
  visibility: GrowthVisibility;
  editHref?: string;
  editLabel?: string;
  children: ReactNode;
}) {
  return (
    <Card className="border-line-base bg-surface-card">
      <CardHeader className="border-line-soft space-y-3 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-base">{title}</CardTitle>
          <VisibilityBadge visibility={visibility} />
        </div>
        {editHref ? (
          <Link
            className="text-sm font-medium text-brand-600 underline underline-offset-2"
            href={editHref}
          >
            {editLabel}
          </Link>
        ) : null}
      </CardHeader>
      <CardContent className="px-4 pb-4 text-sm text-ink-base">{children}</CardContent>
    </Card>
  );
}

export function GrowthCoreValueCard({
  meaning,
  practiceExample,
  valueName,
}: {
  valueName: string;
  meaning: string;
  practiceExample: string;
}) {
  return (
    <article className="rounded-control border border-line-base bg-surface-app p-3">
      <p className="font-semibold text-ink-base">{valueName}</p>
      {meaning.trim().length > 0 ? (
        <p className="mt-2 whitespace-pre-wrap text-sm text-ink-muted">{meaning}</p>
      ) : null}
      {practiceExample.trim().length > 0 ? (
        <p className="mt-2 whitespace-pre-wrap text-xs text-ink-muted">
          실천 예: {practiceExample}
        </p>
      ) : null}
    </article>
  );
}

export function GrowthAreaGoalCard({
  areaSubtitle,
  areaTitle,
  completionRate,
  detailGoalTitles,
}: {
  areaTitle: string;
  areaSubtitle: string | null;
  completionRate: number;
  detailGoalTitles: string[];
}) {
  return (
    <article className="rounded-control border border-line-base bg-surface-app p-3">
      <div className="space-y-1">
        <p className="font-semibold text-ink-base">{areaTitle}</p>
        {areaSubtitle && areaSubtitle.trim().length > 0 ? (
          <p className="text-xs text-ink-muted">{areaSubtitle}</p>
        ) : null}
      </div>

      <div className="mt-3">
        <ProgressBar label="이번 달 실행률" showValue value={completionRate} />
      </div>

      {detailGoalTitles.length > 0 ? (
        <ul className="mt-3 space-y-1 text-xs text-ink-muted">
          {detailGoalTitles.map((title, index) => (
            <li className="flex gap-2" key={`${title}-${index}`}>
              <span aria-hidden className="text-brand-600">
                •
              </span>
              <span>{title}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-ink-muted">등록된 세부 목표가 없습니다.</p>
      )}
    </article>
  );
}
