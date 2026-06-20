import Link from "next/link";
import { DashboardSectionCard } from "@/components/dashboard/DashboardSectionCard";
import { Icon, type IconName } from "@/components/ui/Icon";
import { I18nText } from "@/lib/i18n/I18nProvider";
import { cn } from "@/lib/ui/cn";

type CoacheeActionItem = {
  descriptionFallback: string;
  descriptionKey: string;
  emphasized?: boolean;
  href: string;
  icon: IconName;
  titleFallback: string;
  titleKey: string;
};

const coacheeActions: CoacheeActionItem[] = [
  {
    descriptionFallback: "오늘의 코칭 홈에서 하루를 시작합니다.",
    descriptionKey: "dashboard.coacheeTodayCheckDescription",
    href: "/my-coaching",
    icon: "check",
    titleFallback: "오늘 체크",
    titleKey: "dashboard.coacheeTodayCheck",
  },
  {
    descriptionFallback: "내 목실기 목표와 실행전략을 작성하고 점검합니다.",
    descriptionKey: "dashboard.myMoksilgiDescription",
    emphasized: true,
    href: "/my-coaching/moksilgi",
    icon: "report",
    titleFallback: "나의 목실기",
    titleKey: "dashboard.myMoksilgi",
  },
  {
    descriptionFallback: "하루기록, 주간기록, 월간기록을 확인하고 작성합니다.",
    descriptionKey: "dashboard.myRecordsDescription",
    href: "/my-coaching/records/daily",
    icon: "dashboard",
    titleFallback: "나의 기록",
    titleKey: "dashboard.myRecords",
  },
  {
    descriptionFallback: "목표와 성장 방향을 확인합니다.",
    descriptionKey: "dashboard.coacheeGrowthDescription",
    href: "/my-coaching/goals",
    icon: "users",
    titleFallback: "나의 성장",
    titleKey: "dashboard.coacheeGrowth",
  },
];

function CoacheeActionCard({
  descriptionFallback,
  descriptionKey,
  emphasized = false,
  href,
  icon,
  titleFallback,
  titleKey,
}: CoacheeActionItem) {
  return (
    <Link
      className={cn(
        "group flex h-full flex-col rounded-xl border bg-surface-card p-4 transition",
        emphasized
          ? "border-2 border-brand-600 bg-brand-50/40 hover:border-brand-700 hover:bg-brand-50"
          : "border-line-base hover:border-brand-200 hover:bg-brand-50/60",
      )}
      href={href}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
            emphasized
              ? "bg-brand-100 text-brand-700"
              : "bg-surface-app text-brand-600",
          )}
        >
          <Icon className="h-5 w-5" name={icon} />
        </span>
        <Icon
          className="h-4 w-4 shrink-0 text-ink-muted transition group-hover:text-brand-600"
          name="arrow-right"
        />
      </div>
      <h3 className="mt-3 font-semibold text-ink-strong">
        <I18nText k={titleKey} fallback={titleFallback} />
      </h3>
      <p className="mt-1 flex-1 text-sm leading-6 text-ink-muted">
        <I18nText k={descriptionKey} fallback={descriptionFallback} />
      </p>
    </Link>
  );
}

export function CoacheeActionHub() {
  return (
    <DashboardSectionCard
      className="border-brand-200 bg-surface-card shadow-sm"
      title={
        <I18nText k="dashboard.myCoachingSpace" fallback="내 코칭" />
      }
    >
      <nav
        aria-label="내 코칭 바로가기"
        className="grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        {coacheeActions.map((action) => (
          <CoacheeActionCard key={action.href} {...action} />
        ))}
      </nav>
    </DashboardSectionCard>
  );
}
