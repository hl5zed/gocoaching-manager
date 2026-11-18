import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-6 text-center">
      <p className="text-sm font-medium text-brand-600">404</p>
      <h1 className="mt-3 text-2xl font-semibold text-ink-strong">
        페이지를 찾을 수 없습니다
      </h1>
      <p className="mt-3 leading-7 text-ink-muted">
        요청하신 페이지가 존재하지 않거나 이동되었습니다. 주소를 다시 확인해
        주세요.
      </p>
      <Link
        className="mt-6 rounded-control bg-navy-900 px-4 py-2.5 font-medium text-white"
        href="/dashboard"
      >
        대시보드로 이동
      </Link>
    </main>
  );
}
