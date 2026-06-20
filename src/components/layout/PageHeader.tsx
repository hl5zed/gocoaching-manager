import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/ui/cn";
import { Icon } from "@/components/ui/Icon";

export type PageHeaderProps = {
  title: ReactNode;
  /** 제목 아래 보조 설명 */
  description?: ReactNode;
  /** 오른쪽 액션 버튼 영역 */
  actions?: ReactNode;
  /** 뒤로 가기 링크 (예: 상위 목록 페이지) */
  backHref?: string;
  /** 뒤로 가기 링크 라벨 (기본: 뒤로 가기) */
  backLabel?: string;
  className?: string;
};

export function PageHeader({
  title,
  description,
  actions,
  backHref,
  backLabel = "뒤로 가기",
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("mb-6 flex flex-col gap-3", className)}>
      {backHref ? (
        <Link
          className="inline-flex w-fit items-center gap-1.5 text-sm text-ink-muted hover:text-brand-700"
          href={backHref}
        >
          <span aria-hidden>
            <Icon name="arrow-left" />
          </span>
          <span>{backLabel}</span>
        </Link>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-bold leading-tight text-ink-strong">
            {title}
          </h1>
          {description ? (
            <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-ink-muted">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );
}
