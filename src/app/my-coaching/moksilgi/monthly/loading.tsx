function SkeletonBox({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-md bg-surface-sunken ${className}`} />
  );
}

function SkeletonDayGrid() {
  return (
    <div className="grid grid-cols-7 gap-1">
      {Array.from({ length: 35 }).map((_, i) => (
        <SkeletonBox key={i} className="h-8 w-full rounded-control" />
      ))}
    </div>
  );
}

function SkeletonGoalRow() {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-line-base last:border-0">
      <SkeletonBox className="h-4 w-4 rounded shrink-0" />
      <SkeletonBox className="h-3 flex-1" />
      <SkeletonBox className="h-5 w-12 rounded-full shrink-0" />
    </div>
  );
}

export default function MoksilgiMonthlyLoading() {
  return (
    <main className="min-h-screen bg-surface-app px-4 py-5 pb-32 text-ink-base">
      <section className="mx-auto w-full max-w-2xl space-y-4">
        {/* 월 네비게이션 */}
        <div className="flex items-center justify-between">
          <SkeletonBox className="h-8 w-8 rounded-control" />
          <SkeletonBox className="h-5 w-32" />
          <SkeletonBox className="h-8 w-8 rounded-control" />
        </div>

        {/* 달력 그리드 */}
        <div className="rounded-card border border-line-base bg-surface-card p-4 space-y-3">
          <SkeletonBox className="h-4 w-28" />
          <SkeletonDayGrid />
        </div>

        {/* 영역별 목표 체크 */}
        {["영적", "지적", "신체적", "사회적"].map((label) => (
          <div key={label} className="rounded-card border border-line-base bg-surface-card p-4 space-y-2">
            <SkeletonBox className="h-4 w-20" />
            <SkeletonGoalRow />
            <SkeletonGoalRow />
            <SkeletonGoalRow />
          </div>
        ))}
      </section>
    </main>
  );
}
