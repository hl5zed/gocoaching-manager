import { cn } from "@/lib/ui/cn";

type ProgressBarProps = {
  className?: string;
  label?: string;
  showValue?: boolean;
  value: number | null | undefined;
};

export function ProgressBar({
  className,
  label,
  showValue = true,
  value,
}: ProgressBarProps) {
  const displayValue =
    typeof value === "number" && Number.isFinite(value)
      ? Math.max(value, 0)
      : 0;
  const barValue = Math.min(displayValue, 100);

  return (
    <div className={cn("grid min-w-0 gap-1.5", className)}>
      {label || showValue ? (
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 text-xs font-semibold text-ink-muted">
          {label ? <span className="break-words">{label}</span> : <span />}
          {showValue ? <span>{Math.round(displayValue)}%</span> : null}
        </div>
      ) : null}
      <div className="h-2.5 overflow-hidden rounded-full bg-surface-sunken">
        <div
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={barValue}
          aria-valuetext={`${Math.round(displayValue)}%`}
          className="h-full rounded-full bg-brand-600 transition-all"
          role="progressbar"
          style={{ width: `${barValue}%` }}
        />
      </div>
    </div>
  );
}
