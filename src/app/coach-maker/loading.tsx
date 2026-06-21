function SkeletonBox({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-md bg-surface-sunken ${className}`} />
  );
}

function SkeletonSummaryCard() {
  return (
    <div className="rounded-card border border-line-base bg-surface-card p-4 space-y-2">
      <SkeletonBox className="h-3 w-1/2" />
      <SkeletonBox className="h-8 w-1/3" />
      <SkeletonBox className="h-2 w-full rounded-full" />
    </div>
  );
}

function SkeletonMemoRow() {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-line-base last:border-0">
      <SkeletonBox className="h-4 w-4 rounded shrink-0 mt-0.5" />
      <div className="flex-1 space-y-1">
        <SkeletonBox className="h-3 w-2/3" />
        <SkeletonBox className="h-3 w-1/2" />
      </div>
      <SkeletonBox className="h-5 w-12 rounded-full shrink-0" />
    </div>
  );
}

export default function CoachMakerLoading() {
  return (
    <main className="min-h-screen bg-surface-app px-4 py-5 pb-32">
      {/* 상단 네비 */}
      <div className="mb-4 flex items-center justify-between">
        <SkeletonBox className="h-6 w-36" />
        <SkeletonBox className="h-8 w-20 rounded-control" />
      </div>

      <section className="mx-auto w-full max-w-2xl space-y-4">
        {/* 목실기 요약 카드 */}
        <div className="rounded-card border border-line-base bg-surface-card p-4">
          <SkeletonBox className="h-4 w-32 mb-3" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SkeletonSummaryCard />
            <SkeletonSummaryCard />
            <SkeletonSummaryCard />
            <SkeletonSummaryCard />
          </div>
        </div>

        {/* 코치별 통계 */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <SkeletonSummaryCard />
          <SkeletonSummaryCard />
          <SkeletonSummaryCard />
        </div>

        {/* 관리 액션 메모 */}
        <div className="rounded-card border border-line-base bg-surface-card p-4">
          <div className="flex items-center justify-between mb-3">
            <SkeletonBox className="h-4 w-28" />
            <SkeletonBox className="h-8 w-20 rounded-control" />
          </div>
          {/* 검색 바 */}
          <SkeletonBox className="h-9 w-full rounded-control mb-3" />
          {/* 메모 행 */}
          <SkeletonMemoRow />
          <SkeletonMemoRow />
          <SkeletonMemoRow />
          <SkeletonMemoRow />
          <SkeletonMemoRow />
        </div>
      </section>
    </main>
  );
}
