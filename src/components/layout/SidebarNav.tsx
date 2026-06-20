"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/ui/cn";
import { Icon, type IconName } from "@/components/ui/Icon";

export type SidebarNavItem = {
  href: string;
  label: string;
  icon?: IconName;
  /** true이면 경로가 정확히 일치할 때만 active 처리 (기본: prefix 일치) */
  exact?: boolean;
};

export type SidebarNavSection = {
  title?: string;
  items: SidebarNavItem[];
};

export type SidebarNavProps = {
  sections: SidebarNavSection[];
  /** 메뉴 클릭 시 호출 (모바일 드로어 닫기 용도) */
  onNavigate?: () => void;
};

function isActivePath(pathname: string, item: SidebarNavItem) {
  if (item.exact || item.href === "/") {
    return pathname === item.href;
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function SidebarNav({ sections, onNavigate }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <nav aria-label="주 메뉴" className="flex flex-col gap-5">
      {sections.map((section, sectionIndex) => (
        <div key={section.title ?? `section-${sectionIndex}`}>
          {section.title ? (
            <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-ink-faint">
              {section.title}
            </p>
          ) : null}
          <ul className="flex flex-col gap-0.5">
            {section.items.map((item) => {
              const active = isActivePath(pathname, item);
              return (
                <li key={item.href}>
                  <Link
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-10 items-center gap-2.5 rounded-control px-3 py-2 text-sm transition-colors",
                      active
                        ? "bg-navy-900 font-semibold text-white"
                        : "text-ink-muted hover:bg-surface-sidebar-hover hover:text-ink-base",
                    )}
                    href={item.href}
                    onClick={onNavigate}
                  >
                    {item.icon ? (
                      <span
                        aria-hidden
                        className={cn(
                          "shrink-0",
                          active ? "text-white" : "text-ink-faint",
                        )}
                      >
                        <Icon name={item.icon} />
                      </span>
                    ) : null}
                    <span className="min-w-0 break-words leading-snug">
                      {item.label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
