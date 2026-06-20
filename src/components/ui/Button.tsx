import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/ui/cn";
import { Icon, type IconName } from "./Icon";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const variantClass: Record<ButtonVariant, string> = {
  danger:
    "border-red-200 bg-red-50 text-red-700 hover:border-red-300 hover:bg-red-100",
  ghost:
    "border-transparent bg-transparent text-ink-base hover:bg-surface-sunken",
  primary:
    "border-brand-600 bg-brand-600 text-white shadow-sm hover:border-brand-700 hover:bg-brand-700",
  secondary:
    "border-line-base bg-surface-card text-ink-base shadow-sm hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700",
};

const sizeClass: Record<ButtonSize, string> = {
  lg: "min-h-12 px-5 py-3 text-base",
  md: "min-h-10 px-4 py-2.5 text-sm",
  sm: "min-h-9 px-3 py-2 text-xs",
};

type SharedProps = {
  children: ReactNode;
  icon?: IconName;
  iconPosition?: "left" | "right";
  size?: ButtonSize;
  variant?: ButtonVariant;
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & SharedProps;

export function Button({
  children,
  className,
  icon,
  iconPosition = "left",
  size = "md",
  type = "button",
  variant = "secondary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={buttonClassName({ className, size, variant })}
      type={type}
      {...props}
    >
      {icon && iconPosition === "left" ? <Icon name={icon} /> : null}
      <span className="min-w-0 break-words leading-snug">{children}</span>
      {icon && iconPosition === "right" ? <Icon name={icon} /> : null}
    </button>
  );
}

export type ButtonLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> &
  SharedProps & {
    href: string;
  };

export function ButtonLink({
  children,
  className,
  href,
  icon,
  iconPosition = "left",
  size = "md",
  variant = "secondary",
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      className={buttonClassName({ className, size, variant })}
      href={href}
      {...props}
    >
      {icon && iconPosition === "left" ? <Icon name={icon} /> : null}
      <span className="min-w-0 break-words leading-snug">{children}</span>
      {icon && iconPosition === "right" ? <Icon name={icon} /> : null}
    </Link>
  );
}

function buttonClassName({
  className,
  size,
  variant,
}: {
  className?: string;
  size: ButtonSize;
  variant: ButtonVariant;
}) {
  return cn(
    "inline-flex max-w-full items-center justify-center gap-2 rounded-control border font-semibold tracking-normal transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:opacity-60",
    "whitespace-normal text-center",
    variantClass[variant],
    sizeClass[size],
    className,
  );
}
