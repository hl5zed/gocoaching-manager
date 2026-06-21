function SkeletonBox({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-md bg-surface-sunken ${className}`} />
  );
}

function SkeletonAreaCard() {
  return (
    <div className="rounded-card border border-line-base bg-surface-card p-4 space-y-3">
      <SkeletonBox className="h-3 w-1/3" />
      <SkeletonBox className="h-2 w-full rounded-full" />
      <div className="space-y-2">
        <SkeletonBox className="h-3 w-5/6" />
        <SkeletonBox className="h-3 w-4/6" />
        <SkeletonBox className="h-3 w-3/6" />
      </div>
    </div>
  );
}

export default function GoalsLoading() {
  return (
    <main className="min-h-screen bg-surface-app px-4 py-5 pb-32 text-ink-base">
      <section className="mx-auto w-full max-w-2xl space-y-4">
        {/* 헤더 */}
        <div className="rounded-card border border-line-base bg-surface-card p-4 space-y-3">
          <SkeletonBox className="h-5 w-1/3" />
          <SkeletonBox className="h-3 w-1/2" />
          <SkeletonBox className="h-2 w-full rounded-full" />
        </div>

        {/* 핵심가치 */}
        <div className="rounded-card border border-line-base bg-surface-card p-4 space-y-2">
          <SkeletonBox className="h-4 w-24" />
          <div className="flex gap-2">
            <SkeletonBox className="h-6 w-16 rounded-full" />
            <SkeletonBox className="h-6 w-20 rounded-full" />
            <SkeletonBox className="h-6 w-14 rounded-full" />
          </div>
        </div>

        {/* 4영역 목표 카드 */}
        <SkeletonAreaCard />
        <SkeletonAreaCard />
        <SkeletonAreaCard />
        <SkeletonAreaCard />
      </section>
    </main>
  );
}
