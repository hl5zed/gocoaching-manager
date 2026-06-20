import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { I18nText } from "@/lib/i18n/I18nProvider";
import { getRoleLabel } from "@/lib/ui/labels";
import type { UserRole } from "@/types/database";

export function DashboardHero({
  navigation,
  roles,
  welcomeName,
}: {
  welcomeName: string;
  roles: Array<{ role: UserRole }>;
  navigation: ReactNode;
}) {
  const initial = welcomeName.trim().charAt(0).toUpperCase() || "?";

  return (
    <Card className="border-line-base bg-surface-card">
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <div
            aria-hidden
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-50 text-lg font-semibold text-brand-600"
          >
            {initial}
          </div>
          <div className="min-w-0 space-y-2">
            <Badge tone="info">
              <I18nText k="dashboard.personalHomeBadge" fallback="개인 홈" />
            </Badge>
            <h1 className="text-xl font-semibold text-ink-strong sm:text-2xl">
              <I18nText k="dashboard.title" fallback="나의 홈" />
            </h1>
            <p className="text-sm text-ink-base">
              <I18nText k="dashboard.hello" fallback="안녕하세요" />,{" "}
              <span className="font-semibold text-ink-strong">{welcomeName}</span>
            </p>
            <p className="text-sm text-ink-muted">
              <I18nText
                k="dashboard.subtitle"
                fallback="내 역할에 맞는 코칭 기록, 목실기, 담당 현황으로 이동하는 개인 시작 화면입니다."
              />
            </p>
            {roles.length > 0 ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {roles.map((role) => (
                  <Badge key={role.role} tone="neutral">
                    <I18nText
                      k={`roles.${role.role}`}
                      fallback={getRoleLabel(role.role)}
                    />
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <div className="shrink-0">{navigation}</div>
      </CardContent>
    </Card>
  );
}
