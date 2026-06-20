import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { cn } from "@/lib/ui/cn";

export function DashboardSectionCard({
  action,
  children,
  className,
  title,
}: {
  title: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("border-line-base bg-surface-card", className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 border-line-soft px-4 py-4">
        <CardTitle className="text-base font-semibold text-ink-base">{title}</CardTitle>
        {action ? <div className="shrink-0">{action}</div> : null}
      </CardHeader>
      <CardContent className="px-4 pb-4">{children}</CardContent>
    </Card>
  );
}
