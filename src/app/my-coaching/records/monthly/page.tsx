import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/getSession";
import { MonthlyReflectionsClient } from "./MonthlyReflectionsClient";

export const dynamic = "force-dynamic";

export default async function MonthlyReflectionsPage() {
  const session = await getSession();

  if (!session.user) {
    redirect("/login?redirectTo=%2Fmy-coaching%2Frecords%2Fmonthly");
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
      <section className="mx-auto w-full max-w-6xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
              나의 기록
            </p>
            <h1 className="mt-3 text-3xl font-semibold">월간 회고</h1>
            <p className="mt-3 max-w-3xl text-slate-600">
              한 달 동안의 성장, 어려움, 감사, 다음 달 계획을 정리합니다.
            </p>
            <div className="mt-4 rounded-md border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
              <p>
                목실기 월별 점검은 실행 체크와 달성률을 기록하는
                공간입니다.
              </p>
              <p className="mt-1">
                월간 회고는 한 달의 성장과 다음 달 계획을 정리하는
                기록입니다.
              </p>
            </div>
          </div>
          <div className="flex flex-col items-start gap-2 text-sm">
            <Link
              className="font-medium text-slate-700 underline"
              href="/my-coaching/records"
            >
              기록 선택으로 돌아가기
            </Link>
            <Link
              className="font-medium text-slate-700 underline"
              href="/my-coaching"
            >
              마이코칭으로 돌아가기
            </Link>
            <Link
              className="font-medium text-slate-700 underline"
              href="/my-coaching/moksilgi/monthly"
            >
              목실기 월별 점검으로 이동
            </Link>
          </div>
        </div>

        <MonthlyReflectionsClient />
      </section>
    </main>
  );
}
