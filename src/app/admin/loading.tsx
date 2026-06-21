function SkeletonBox({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-md bg-surface-sunken ${className}`} />
  );
}

function SkeletonStatCard() {
  return (
    <div className="rounded-card border border-line-base bg-surface-card p-4 space-y-2">
      <SkeletonBox className="h-3 w-1/2" />
      <SkeletonBox className="h-7 w-1/3" />
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-line-base last:border-0">
      <SkeletonBox className="h-8 w-8 rounded-full shrink-0" />
      <div className="flex-1 space-y-1">
        <SkeletonBox className="h-3 w-1/3" />
        <SkeletonBox className="h-3 w-1/2" />
      </div>
      <SkeletonBox className="h-5 w-16 rounded-full" />
    </div>
  );
}

export default function AdminLoading() {
  return (
    <main className="min-h-screen bg-surface-app px-4 py-5 pb-32">
      {/* 상단 네비 */}
      <div className="mb-4 flex items-center justify-between">
        <SkeletonBox className="h-6 w-28" />
        <SkeletonBox className="h-8 w-20 rounded-control" />
      </div>

      <section className="mx-auto w-full max-w-2xl space-y-4">
        {/* 통계 카드 그리드 */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <SkeletonStatCard />
          <SkeletonStatCard />
          <SkeletonStatCard />
          <SkeletonStatCard />
          <SkeletonStatCard />
          <SkeletonStatCard />
        </div>

        {/* 회원 목록 카드 */}
        <div className="rounded-card border border-line-base bg-surface-card p-4">
          <div className="flex items-center justify-between mb-4">
            <SkeletonBox className="h-4 w-24" />
            <SkeletonBox className="h-8 w-24 rounded-control" />
          </div>
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      </section>
    </main>
  );
}
