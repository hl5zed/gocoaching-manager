"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/ui/cn";
import { SidebarNav, type SidebarNavSection } from "./SidebarNav";

export type ShellLayoutProps = {
  children: ReactNode;
  /** 사이드바 메뉴 구성 */
  navSections: SidebarNavSection[];
  /** 상단 바 오른쪽 영역 (사용자 정보, 로그아웃 버튼 등) */
  topbarActions?: ReactNode;
  /** 사이드바 하단 고정 영역 (역할 배지, 언어 전환 등) */
  sidebarFooter?: ReactNode;
  /** 로고 클릭 시 이동 경로 (기본: /dashboard) */
  homeHref?: string;
  /** 서비스 이름 (기본: GoCoaching) */
  appName?: string;
};

export function ShellLayout({
  children,
  navSections,
  topbarActions,
  sidebarFooter,
  homeHref = "/dashboard",
  appName = "GoCoaching",
}: ShellLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMobile = () => setMobileOpen(false);

  const sidebarContent = (
    <div className="flex h-full flex-col">
      <div className="flex h-topbar shrink-0 items-center border-b border-line-soft px-4">
        <Link
          className="flex items-center gap-2 text-base font-bold text-ink-strong"
          href={homeHref}
          onClick={closeMobile}
        >
          <span
            aria-hidden
            className="flex h-7 w-7 items-center justify-center rounded-control bg-navy-900 text-sm font-extrabold text-white"
          >
            G
          </span>
          <span className="truncate">{appName}</span>
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <SidebarNav onNavigate={closeMobile} sections={navSections} />
      </div>
      {sidebarFooter ? (
        <div className="shrink-0 border-t border-line-soft px-4 py-3">
          {sidebarFooter}
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="min-h-screen bg-surface-app">
      {/* 데스크톱 사이드바 */}
      <aside
        aria-label="사이드바"
        className="fixed inset-y-0 left-0 z-30 hidden w-sidebar border-r border-line-soft bg-surface-sidebar lg:block print:hidden"
      >
        {sidebarContent}
      </aside>

      {/* 모바일 드로어 */}
      {mobileOpen ? (
        <div className="lg:hidden print:hidden">
          <div
            aria-hidden
            className="fixed inset-0 z-40 bg-black/40"
            onClick={closeMobile}
          />
          <aside
            aria-label="사이드바"
            className="fixed inset-y-0 left-0 z-50 w-sidebar max-w-[85vw] border-r border-line-soft bg-surface-sidebar shadow-overlay"
          >
            {sidebarContent}
          </aside>
        </div>
      ) : null}

      {/* 본문 영역 */}
      <div className="flex min-h-screen flex-col lg:pl-sidebar">
        <header className="print:hidden sticky top-0 z-20 flex h-topbar shrink-0 items-center gap-3 border-b border-line-soft bg-surface-card/95 px-4 backdrop-blur sm:px-6">
          <button
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? "메뉴 닫기" : "메뉴 열기"}
            className="flex h-9 w-9 items-center justify-center rounded-control border border-line-base text-ink-base hover:bg-surface-sunken lg:hidden"
            onClick={() => setMobileOpen((open) => !open)}
            type="button"
          >
            <span aria-hidden className="flex flex-col gap-1">
              <span
                className={cn(
                  "block h-0.5 w-4 bg-current transition-transform",
                  mobileOpen && "translate-y-1.5 rotate-45",
                )}
              />
              <span
                className={cn(
                  "block h-0.5 w-4 bg-current",
                  mobileOpen && "opacity-0",
                )}
              />
              <span
                className={cn(
                  "block h-0.5 w-4 bg-current transition-transform",
                  mobileOpen && "-translate-y-1.5 -rotate-45",
                )}
              />
            </span>
          </button>
          <div className="min-w-0 flex-1" />
          {topbarActions ? (
            <div className="flex shrink-0 items-center gap-2">
              {topbarActions}
            </div>
          ) : null}
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
