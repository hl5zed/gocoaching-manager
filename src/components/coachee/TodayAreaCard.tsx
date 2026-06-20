import { Card, CardContent } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import type { TodayAreaProgress } from "@/lib/coaching/progress";

type AreaVisual = {
  label: string;
  icon: string;
  dot: string;
  labelColor: string;
};

const AREA_VISUALS: Record<TodayAreaProgress["areaKey"], AreaVisual> = {
  spiritual: {
    label: "영적",
    icon: "🙏",
    dot: "bg-domain-spirit",
    labelColor: "text-domain-spirit",
  },
  intellectual: {
    label: "지적",
    icon: "📘",
    dot: "bg-domain-intellect",
    labelColor: "text-domain-intellect",
  },
  physical: {
    label: "신체적",
    icon: "💪",
    dot: "bg-domain-body",
    labelColor: "text-domain-body",
  },
  social: {
    label: "사회적",
    icon: "🤝",
    dot: "bg-domain-social",
    labelColor: "text-domain-social",
  },
};

export function TodayAreaCard({ area }: { area: TodayAreaProgress }) {
  const visual = AREA_VISUALS[area.areaKey];

  return (
    <Card className="border-line-base bg-surface-card">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${visual.dot}`}
            />
            <span className={`text-xs font-semibold ${visual.labelColor}`}>
              <span aria-hidden>{visual.icon} </span>
              {visual.label}
            </span>
          </div>
          <span className="text-xs font-semibold text-ink-muted">
            {area.completedGoals}/{area.totalGoals}
          </span>
        </div>

        <div className="space-y-1">
          <p className="text-sm font-semibold text-ink-base">{area.areaTitle}</p>
          <p className="text-xs text-ink-muted">
            오늘 완료 {area.completedGoals}개 / 전체 {area.totalGoals}개
          </p>
        </div>

        <ProgressBar showValue value={area.completionRate} />
      </CardContent>
    </Card>
  );
}
