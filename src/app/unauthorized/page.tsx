import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <main className="min-h-screen bg-surface-app px-6 py-10 text-ink-strong">
      <section className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-xl flex-col justify-center">
        <p className="text-sm font-medium uppercase tracking-wide text-ink-faint">
          Access
        </p>
        <h1 className="mt-3 text-3xl font-semibold">접근 권한이 없습니다.</h1>
        <p className="mt-4 leading-7 text-ink-muted">
          이 페이지에 접근할 권한이 없거나, 현재 계정으로는 사용할 수 없는
          기능입니다.
        </p>
        <div className="mt-8">
          <Link
            className="inline-flex rounded-control bg-navy-900 px-4 py-2.5 text-sm font-medium text-white"
            href="/dashboard"
          >
            대시보드로 돌아가기
          </Link>
        </div>
      </section>
    </main>
  );
}
