import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/ui/cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-card border border-line-base bg-surface-card shadow-card",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("border-b border-line-soft px-5 py-4", className)}
      {...props}
    />
  );
}

export function CardTitle({
  children,
  className,
  icon,
}: HTMLAttributes<HTMLHeadingElement> & {
  icon?: ReactNode;
}) {
  return (
    <h2
      className={cn(
        "flex min-w-0 items-start gap-2 text-lg font-semibold leading-snug text-ink-strong",
        className,
      )}
    >
      {icon ? <span className="mt-0.5 shrink-0 text-brand-600">{icon}</span> : null}
      <span className="min-w-0 break-words">{children}</span>
    </h2>
  );
}

export function CardDescription({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("mt-1 text-sm leading-6 text-ink-muted", className)}
      {...props}
    />
  );
}

export function CardContent({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 py-4", className)} {...props} />;
}
