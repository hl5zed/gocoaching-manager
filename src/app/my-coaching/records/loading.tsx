function SkeletonBox({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-md bg-surface-sunken ${className}`} />
  );
}

function SkeletonRecordCard() {
  return (
    <div className="rounded-card border border-line-base bg-surface-card p-4 space-y-3">
      <div className="flex gap-2">
        <SkeletonBox className="h-5 w-16 rounded-full" />
        <SkeletonBox className="h-5 w-14 rounded-full" />
      </div>
      <SkeletonBox className="h-4 w-2/3" />
      <SkeletonBox className="h-3 w-1/3" />
      <SkeletonBox className="h-12 w-full rounded-control" />
    </div>
  );
}

export default function RecordsLoading() {
  return (
    <main className="min-h-screen bg-surface-app px-4 py-5 pb-32 text-ink-base">
      <section className="mx-auto w-full max-w-md space-y-8">
        <div className="rounded-card border border-line-base bg-surface-card p-6 space-y-3">
          <SkeletonBox className="h-5 w-24" />
          <SkeletonBox className="h-8 w-40" />
          <SkeletonBox className="h-4 w-full" />
        </div>

        <div className="rounded-card border border-line-base bg-surface-card p-6 space-y-4">
          <SkeletonBox className="h-5 w-32" />
          <div className="grid gap-3">
            <SkeletonBox className="h-24 w-full rounded-card" />
            <SkeletonBox className="h-24 w-full rounded-card" />
            <SkeletonBox className="h-24 w-full rounded-card" />
          </div>
        </div>

        <div className="rounded-card border border-line-base bg-surface-card p-6 space-y-4">
          <SkeletonBox className="h-5 w-36" />
          <SkeletonBox className="h-10 w-full rounded-control" />
          <div className="grid gap-3">
            <SkeletonBox className="h-10 w-full rounded-control" />
            <SkeletonBox className="h-10 w-full rounded-control" />
            <SkeletonBox className="h-10 w-full rounded-control" />
          </div>
        </div>

        <div className="space-y-4">
          <SkeletonBox className="h-5 w-28" />
          <SkeletonRecordCard />
          <SkeletonRecordCard />
          <SkeletonRecordCard />
        </div>
      </section>
    </main>
  );
}
