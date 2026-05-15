import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/ui/cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-lg border border-slate-200 bg-white shadow-sm",
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
      className={cn("border-b border-slate-100 px-5 py-4", className)}
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
        "flex min-w-0 items-start gap-2 text-lg font-semibold leading-snug text-slate-950",
        className,
      )}
    >
      {icon ? <span className="mt-0.5 shrink-0 text-teal-700">{icon}</span> : null}
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
      className={cn("mt-1 text-sm leading-6 text-slate-600", className)}
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
