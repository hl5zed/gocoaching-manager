function SkeletonBox({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-md bg-surface-sunken ${className}`} />
  );
}

function SkeletonNavCard() {
  return (
    <div className="rounded-card border border-line-base bg-surface-card p-4 space-y-2">
      <div className="flex items-center justify-between">
        <SkeletonBox className="h-4 w-1/3" />
        <SkeletonBox className="h-4 w-6" />
      </div>
      <SkeletonBox className="h-3 w-2/3" />
    </div>
  );
}

export default function MyCoachingLoading() {
  return (
    <main className="min-h-screen bg-surface-app px-4 py-5 pb-32">
      {/* 상단 네비 */}
      <div className="mb-4 flex items-center justify-between">
        <SkeletonBox className="h-6 w-28" />
        <SkeletonBox className="h-8 w-16 rounded-control" />
      </div>

      <section className="mx-auto w-full max-w-md space-y-4">
        {/* 오늘 현황 카드 */}
        <div className="rounded-card border border-line-base bg-surface-card p-4 space-y-3">
          <SkeletonBox className="h-4 w-24" />
          <div className="flex gap-2">
            <SkeletonBox className="h-2 flex-1 rounded-full" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <SkeletonBox className="h-12 rounded-card" />
            <SkeletonBox className="h-12 rounded-card" />
            <SkeletonBox className="h-12 rounded-card" />
          </div>
        </div>

        {/* 섹션 네비 카드들 */}
        <SkeletonNavCard />
        <SkeletonNavCard />
        <SkeletonNavCard />
        <SkeletonNavCard />
        <SkeletonNavCard />
      </section>
    </main>
  );
}
