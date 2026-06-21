function SkeletonBox({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-md bg-surface-sunken ${className}`} />
  );
}

function SkeletonCard({ rows = 2 }: { rows?: number }) {
  return (
    <div className="rounded-card border border-line-base bg-surface-card p-4 space-y-3">
      <SkeletonBox className="h-4 w-1/3" />
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonBox key={i} className="h-3 w-full" />
      ))}
    </div>
  );
}

export default function DashboardLoading() {
  return (
    <main className="min-h-screen bg-surface-app px-4 py-5 pb-32">
      {/* 상단 네비 */}
      <div className="mb-4 flex items-center justify-between">
        <SkeletonBox className="h-6 w-32" />
        <SkeletonBox className="h-8 w-20 rounded-control" />
      </div>

      <section className="mx-auto w-full max-w-md space-y-4">
        {/* 프로필 히어로 카드 */}
        <div className="rounded-card border border-line-base bg-surface-card p-5 space-y-3">
          <div className="flex items-center gap-3">
            <SkeletonBox className="h-12 w-12 rounded-full" />
            <div className="flex-1 space-y-2">
              <SkeletonBox className="h-5 w-1/2" />
              <SkeletonBox className="h-3 w-1/3" />
            </div>
          </div>
          <SkeletonBox className="h-3 w-3/4" />
          <SkeletonBox className="h-3 w-2/3" />
        </div>

        {/* 섹션 카드 3개 */}
        <SkeletonCard rows={2} />
        <SkeletonCard rows={3} />
        <SkeletonCard rows={2} />

        {/* 퀵 링크 영역 */}
        <div className="rounded-card border border-line-base bg-surface-card p-4">
          <SkeletonBox className="mb-3 h-4 w-24" />
          <div className="grid grid-cols-2 gap-2">
            <SkeletonBox className="h-10 rounded-control" />
            <SkeletonBox className="h-10 rounded-control" />
            <SkeletonBox className="h-10 rounded-control" />
            <SkeletonBox className="h-10 rounded-control" />
          </div>
        </div>
      </section>
    </main>
  );
}
