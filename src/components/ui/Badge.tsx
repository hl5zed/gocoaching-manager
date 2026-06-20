import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/ui/cn";
import { Icon, type IconName } from "./Icon";

type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info";

const toneClass: Record<BadgeTone, string> = {
  danger: "border-red-200 bg-red-50 text-red-700",
  info: "border-sky-200 bg-sky-50 text-sky-700",
  neutral: "border-line-base bg-surface-sunken text-ink-muted",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
};

export function Badge({
  children,
  className,
  icon,
  tone = "neutral",
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode;
  icon?: IconName;
  tone?: BadgeTone;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold leading-snug",
        toneClass[tone],
        className,
      )}
      {...props}
    >
      {icon ? <Icon className="h-3.5 w-3.5" name={icon} /> : null}
      <span className="min-w-0 break-words">{children}</span>
    </span>
  );
}
