function SkeletonBox({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-md bg-surface-sunken ${className}`} />
  );
}

function SkeletonStatCard() {
  return (
    <div className="rounded-card border border-line-base bg-surface-card p-4 space-y-2">
      <SkeletonBox className="h-3 w-2/3" />
      <SkeletonBox className="h-8 w-1/3" />
      <SkeletonBox className="h-3 w-1/2" />
    </div>
  );
}

function SkeletonCoacheeRow() {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-line-base last:border-0">
      <SkeletonBox className="h-9 w-9 rounded-full shrink-0" />
      <div className="flex-1 space-y-1">
        <SkeletonBox className="h-3 w-1/3" />
        <SkeletonBox className="h-3 w-1/2" />
      </div>
      <SkeletonBox className="h-5 w-14 rounded-full" />
    </div>
  );
}

export default function CoachLoading() {
  return (
    <main className="min-h-screen bg-surface-app px-4 py-5 pb-32">
      {/* 상단 네비 */}
      <div className="mb-4 flex items-center justify-between">
        <SkeletonBox className="h-6 w-32" />
        <SkeletonBox className="h-8 w-20 rounded-control" />
      </div>

      <section className="mx-auto w-full max-w-md space-y-4">
        {/* 담당 코치이 통계 */}
        <div className="grid grid-cols-2 gap-3">
          <SkeletonStatCard />
          <SkeletonStatCard />
          <SkeletonStatCard />
          <SkeletonStatCard />
        </div>

        {/* 담당 코치이 목록 */}
        <div className="rounded-card border border-line-base bg-surface-card p-4">
          <div className="flex items-center justify-between mb-3">
            <SkeletonBox className="h-4 w-28" />
            <SkeletonBox className="h-8 w-20 rounded-control" />
          </div>
          <SkeletonCoacheeRow />
          <SkeletonCoacheeRow />
          <SkeletonCoacheeRow />
        </div>

        {/* 빠른 메뉴 */}
        <div className="rounded-card border border-line-base bg-surface-card p-4 space-y-2">
          <SkeletonBox className="h-4 w-20 mb-3" />
          <SkeletonBox className="h-10 w-full rounded-control" />
          <SkeletonBox className="h-10 w-full rounded-control" />
        </div>
      </section>
    </main>
  );
}
