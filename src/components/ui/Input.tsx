import type {
  InputHTMLAttributes,
  LabelHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/ui/cn";

const fieldClass =
  "min-h-10 w-full rounded-control border border-line-base bg-surface-card px-3 py-2 font-sans text-sm tracking-normal text-ink-strong shadow-sm transition placeholder:text-ink-faint focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-ink-muted";

export function FieldLabel({
  className,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={cn("grid min-w-0 gap-1.5 text-sm", className)} {...props} />
  );
}

export function FieldText({
  className,
  ...props
}: LabelHTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn("break-words font-semibold leading-snug text-ink-base", className)}
      {...props}
    />
  );
}

export function TextInput({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldClass, className)} {...props} />;
}

export function SelectInput({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(fieldClass, className)} {...props} />;
}

export function TextareaInput({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(fieldClass, "min-h-28 resize-y leading-6", className)}
      {...props}
    />
  );
}

export function FieldHint({
  className,
  ...props
}: LabelHTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={cn("text-xs leading-5 text-ink-muted", className)} {...props} />
  );
}
