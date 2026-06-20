import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { CardContent } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import type { MoksilgiAreaKey } from "@/types/database";
import { cn } from "@/lib/ui/cn";

type AreaVisual = {
  dotClass: string;
  icon: string;
  label: string;
  badgeTone: "success" | "info" | "warning" | "danger" | "neutral";
};

const AREA_VISUALS: Partial<Record<MoksilgiAreaKey, AreaVisual>> = {
  spiritual: {
    label: "영적",
    icon: "🙏",
    dotClass: "bg-violet-500",
    badgeTone: "success",
  },
  intellectual: {
    label: "지적",
    icon: "📘",
    dotClass: "bg-sky-500",
    badgeTone: "info",
  },
  physical: {
    label: "신체적",
    icon: "💪",
    dotClass: "bg-brand-600",
    badgeTone: "warning",
  },
  social: {
    label: "사회적",
    icon: "🤝",
    dotClass: "bg-amber-500",
    badgeTone: "danger",
  },
};

const DEFAULT_VISUAL: AreaVisual = {
  label: "기타",
  icon: "📋",
  dotClass: "bg-ink-faint",
  badgeTone: "neutral",
};

export function MoksilgiAreaCard({
  areaKey,
  areaSubtitle,
  areaTitle,
  children,
  detailGoalCount,
  defaultOpen = false,
  trailing,
}: {
  areaKey: MoksilgiAreaKey;
  areaTitle: ReactNode;
  areaSubtitle: ReactNode;
  detailGoalCount: number;
  children: ReactNode;
  defaultOpen?: boolean;
  trailing?: ReactNode;
}) {
  const visual = AREA_VISUALS[areaKey] ?? DEFAULT_VISUAL;

  return (
    <details
      className="moksilgi-accordion group rounded-xl border border-line-base bg-surface-card"
      open={defaultOpen}
    >
      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <span
              aria-hidden
              className={cn("mt-1 h-3 w-3 shrink-0 rounded-full", visual.dotClass)}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={visual.badgeTone}>
                  <span aria-hidden>{visual.icon}</span>
                  {visual.label}
                </Badge>
                <span className="text-xs text-ink-muted">
                  세부목표 {detailGoalCount}개
                </span>
                {trailing ? (
                  <span className="ml-auto shrink-0">{trailing}</span>
                ) : null}
              </div>
              <h3 className="mt-2 text-base font-semibold text-ink-base">{areaTitle}</h3>
              <p className="mt-1 text-sm text-ink-muted">{areaSubtitle}</p>
            </div>
            <Icon
              aria-hidden
              className="mt-1 h-4 w-4 shrink-0 text-ink-faint transition-transform group-open:rotate-180"
              name="chevron-down"
            />
          </div>
        </CardContent>
      </summary>
      <CardContent className="space-y-4 border-t border-line-soft p-4">{children}</CardContent>
    </details>
  );
}
