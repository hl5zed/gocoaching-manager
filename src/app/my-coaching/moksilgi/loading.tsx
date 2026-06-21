function SkeletonBox({
  className = "",
}: {
  className?: string;
}) {
  return (
    <div className={`animate-pulse rounded-md bg-surface-sunken ${className}`} />
  );
}

function SkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <div className="rounded-card border border-line-base bg-surface-card p-4 space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonBox key={i} className={i === 0 ? "h-4 w-1/3" : "h-3 w-full"} />
      ))}
    </div>
  );
}

function SkeletonSection() {
  return (
    <div className="rounded-card border border-line-base bg-surface-card">
      <div className="flex items-center justify-between p-4">
        <SkeletonBox className="h-4 w-40" />
        <SkeletonBox className="h-8 w-16 rounded-control" />
      </div>
    </div>
  );
}

export default function MoksilgiLoading() {
  return (
    <main className="min-h-screen bg-surface-app px-4 py-5 pb-32">
      {/* AppBar */}
      <div className="mb-4 flex items-center justify-between">
        <SkeletonBox className="h-6 w-24" />
        <div className="flex gap-2">
          <SkeletonBox className="h-8 w-16 rounded-control" />
          <SkeletonBox className="h-8 w-20 rounded-control" />
        </div>
      </div>

      <section className="mx-auto w-full max-w-md space-y-4">
        {/* 헤더 카드 */}
        <div className="rounded-card border border-line-base bg-surface-card p-4 space-y-3">
          <SkeletonBox className="h-5 w-20 rounded-full" />
          <SkeletonBox className="h-6 w-3/4" />
          <SkeletonBox className="h-4 w-1/2" />
          <SkeletonBox className="h-3 w-full" />
        </div>

        {/* 진행도 카드 */}
        <div className="rounded-card border border-line-base bg-surface-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <SkeletonBox className="h-4 w-32" />
            <SkeletonBox className="h-4 w-12" />
          </div>
          <SkeletonBox className="h-2 w-full rounded-full" />
        </div>

        {/* 섹션 네비 */}
        <div className="flex gap-2 overflow-hidden">
          {["기본정보", "사명", "비전", "핵심가치", "목표", "실행전략"].map((label) => (
            <SkeletonBox key={label} className="h-7 w-14 shrink-0 rounded-full" />
          ))}
        </div>

        {/* 섹션 카드 6개 */}
        <SkeletonSection />
        <SkeletonSection />
        <SkeletonSection />
        <SkeletonSection />
        <SkeletonSection />
        <SkeletonSection />
      </section>

      {/* 하단 고정 버튼 영역 */}
      <div className="fixed inset-x-0 bottom-20 z-20 mx-auto max-w-md px-4">
        <div className="flex gap-2 rounded-xl border border-line-base bg-surface-card p-3 shadow-lg">
          <SkeletonBox className="h-10 flex-1 rounded-control" />
          <SkeletonBox className="h-10 w-24 rounded-control" />
        </div>
      </div>
    </main>
  );
}
