"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/ui/cn";

type CoacheeTab = {
  /** 탭 식별자 */
  key: string;
  /** 화면 표시 라벨 (Korean-first) */
  label: string;
  /** 연결 경로 */
  href: string;
  /** 활성 판정 방식: exact = 정확히 일치, prefix = 해당 경로로 시작 */
  match: "exact" | "prefix";
  /** 탭 아이콘 */
  icon: ReactNode;
};

function IconToday() {
  return (
    <svg
      aria-hidden
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
    >
      <path
        d="M3 10.5 12 4l9 6.5M5 9.5V20h14V9.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg
      aria-hidden
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
    >
      <path
        d="M9 12.5 11.5 15 16 9.5M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconRecord() {
  return (
    <svg
      aria-hidden
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
    >
      <path
        d="M16.5 3.5 20.5 7.5 8 20H4v-4zM14.5 5.5 18.5 9.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconReport() {
  return (
    <svg
      aria-hidden
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
    >
      <path
        d="M4 20V10M10 20V4M16 20v-7M22 20H2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconGrowth() {
  return (
    <svg
      aria-hidden
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
    >
      <path
        d="M12 21v-7m0 0c0-3 2-5 5-5 0 3-2 5-5 5zm0 0c0-3-2-5-5-5 0 3 2 5 5 5zM12 14V8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const tabs: CoacheeTab[] = [
  {
    key: "today",
    label: "오늘",
    href: "/my-coaching",
    match: "exact",
    icon: <IconToday />,
  },
  {
    key: "goals",
    label: "목표",
    href: "/my-coaching/goals",
    match: "prefix",
    icon: <IconGrowth />,
  },
  {
    key: "check",
    label: "체크",
    href: "/my-coaching/moksilgi/monthly",
    match: "prefix",
    icon: <IconCheck />,
  },
  {
    key: "record",
    label: "기록",
    href: "/my-coaching/records",
    match: "prefix",
    icon: <IconRecord />,
  },
  {
    key: "report",
    label: "리포트",
    href: "/my-coaching/moksilgi/summary",
    match: "prefix",
    icon: <IconReport />,
  },
];

function isActive(pathname: string, tab: CoacheeTab): boolean {
  if (tab.match === "exact") {
    return pathname === tab.href;
  }

  return pathname === tab.href || pathname.startsWith(`${tab.href}/`);
}

/**
 * 피코치 모바일 하단 5탭 내비게이션.
 * presentational 컴포넌트로, 라우팅/권한 로직은 포함하지 않는다.
 */
export function CoacheeBottomTabs() {
  const pathname = usePathname() ?? "";

  return (
    <nav
      aria-label="피코치 하단 메뉴"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-line-base bg-surface-card",
        "pb-[env(safe-area-inset-bottom)]",
      )}
    >
      <ul className="mx-auto flex w-full max-w-md items-stretch justify-around">
        {tabs.map((tab) => {
          const active = isActive(pathname, tab);

          return (
            <li className="flex-1" key={tab.key}>
              <Link
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-[56px] flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] font-medium transition-colors",
                  active
                    ? "text-navy-900"
                    : "text-ink-muted hover:text-ink-base",
                )}
                href={tab.href}
              >
                <span aria-hidden>{tab.icon}</span>
                <span className="leading-none">{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
