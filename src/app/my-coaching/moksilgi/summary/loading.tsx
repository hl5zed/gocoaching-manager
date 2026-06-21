function SkeletonBox({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-md bg-surface-sunken ${className}`} />
  );
}

function SkeletonMonthRow() {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-line-base last:border-0">
      <SkeletonBox className="h-4 w-16 shrink-0" />
      <SkeletonBox className="h-2 flex-1 rounded-full" />
      <SkeletonBox className="h-4 w-10 shrink-0" />
    </div>
  );
}

export default function MoksilgiSummaryLoading() {
  return (
    <main className="min-h-screen bg-surface-app px-4 py-5 pb-32 text-ink-base">
      <section className="mx-auto w-full max-w-2xl space-y-4">
        {/* 연도 네비게이션 */}
        <div className="flex items-center justify-between">
          <SkeletonBox className="h-8 w-8 rounded-control" />
          <SkeletonBox className="h-5 w-20" />
          <SkeletonBox className="h-8 w-8 rounded-control" />
        </div>

        {/* 연간 요약 카드 */}
        <div className="rounded-card border border-line-base bg-surface-card p-4 space-y-3">
          <SkeletonBox className="h-4 w-32" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-control border border-line-base bg-surface-sunken p-3 space-y-2">
                <SkeletonBox className="h-3 w-1/2" />
                <SkeletonBox className="h-6 w-1/3" />
              </div>
            ))}
          </div>
        </div>

        {/* 월별 실행률 목록 */}
        <div className="rounded-card border border-line-base bg-surface-card p-4">
          <SkeletonBox className="h-4 w-28 mb-3" />
          {Array.from({ length: 12 }).map((_, i) => (
            <SkeletonMonthRow key={i} />
          ))}
        </div>
      </section>
    </main>
  );
}
