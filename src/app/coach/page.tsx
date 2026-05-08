import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/getSession";

export const dynamic = "force-dynamic";

export default async function CoachPage() {
  const session = await getSession();

  if (!session.user) {
    redirect("/login?redirectTo=%2Fcoach");
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
      <div className="mx-auto max-w-5xl">
        <nav className="text-sm">
          <Link href="/dashboard" className="text-blue-600 hover:underline">
            대시보드
          </Link>
        </nav>

        <h1 className="mt-6 text-2xl font-semibold">코치 홈</h1>
        <p className="mt-2 text-sm text-slate-600">
          코치 기능을 선택해 주세요.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Link
            href="/coach/relationships"
            className="rounded-md border border-slate-200 bg-white px-5 py-4 transition hover:border-blue-300 hover:shadow-sm"
          >
            <h2 className="text-lg font-semibold">코칭 관계 보기</h2>
            <p className="mt-1 text-sm text-slate-500">
              현재 담당 중인 코칭 관계를 확인합니다.
            </p>
          </Link>

          <Link
            href="/coach/weekly-logs"
            className="rounded-md border border-slate-200 bg-white px-5 py-4 transition hover:border-blue-300 hover:shadow-sm"
          >
            <h2 className="text-lg font-semibold">주간 기록 보기</h2>
            <p className="mt-1 text-sm text-slate-500">
              담당 코치이들의 주간 기록을 확인합니다.
            </p>
          </Link>

          <Link
            href="/coach/moksilgi"
            className="rounded-md border border-slate-200 bg-white px-5 py-4 transition hover:border-blue-300 hover:shadow-sm"
          >
            <h2 className="text-lg font-semibold">코치이 목실기 보기</h2>
            <p className="mt-1 text-sm text-slate-500">
              담당 코치이들의 목실기와 성취 요약을 확인합니다.
            </p>
          </Link>
        </div>
      </div>
    </main>
  );
}
