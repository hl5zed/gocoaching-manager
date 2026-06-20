import type { ReactNode } from "react";
import { CoacheeBottomTabs } from "@/components/navigation/CoacheeBottomTabs";
import { CoacheeTopBar } from "@/components/navigation/CoacheeTopBar";

/**
 * 피코치 모바일 셸 레이아웃.
 * 기존 my-coaching 하위 페이지를 그대로 감싸고, 하단에 5탭 내비게이션을 고정한다.
 * 콘텐츠와 인증/데이터 로직은 변경하지 않으며, 하단 탭이 콘텐츠를 가리지 않도록 여백만 추가한다.
 */
export default function MyCoachingLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-surface-app">
      <div className="mx-auto w-full max-w-md pb-24">
        <CoacheeTopBar />
        {children}
      </div>
      <CoacheeBottomTabs />
    </div>
  );
}
