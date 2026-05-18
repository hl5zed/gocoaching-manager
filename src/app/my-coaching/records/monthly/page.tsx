import Link from "next/link";
import { redirect } from "next/navigation";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { getSession } from "@/lib/auth/getSession";
import { I18nText } from "@/lib/i18n/I18nProvider";
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
              <I18nText k="myCoaching.records.monthlyPage.badge" fallback="나의 기록" />
            </p>
            <h1 className="mt-3 text-3xl font-semibold">
              <I18nText k="myCoaching.records.monthlyPage.title" fallback="월간 회고" />
            </h1>
            <p className="mt-3 max-w-3xl text-slate-600">
              <I18nText
                k="myCoaching.records.monthlyPage.description"
                fallback="한 달 동안의 성장, 어려움, 감사, 다음 달 계획을 정리합니다."
              />
            </p>
            <div className="mt-4 rounded-md border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
              <p>
                <I18nText
                  k="myCoaching.records.monthlyPage.moksilgiNotice"
                  fallback="목실기 월별 점검은 실행 체크와 달성률을 기록하는 공간입니다."
                />
              </p>
              <p className="mt-1">
                <I18nText
                  k="myCoaching.records.monthlyPage.reflectionNotice"
                  fallback="월간 회고는 한 달의 성장과 다음 달 계획을 정리하는 기록입니다."
                />
              </p>
            </div>
          </div>
          <div className="flex flex-col items-start gap-2 text-sm">
            <LanguageSwitcher />
            <Link
              className="font-medium text-slate-700 underline"
              href="/my-coaching/records"
            >
              <I18nText
                k="myCoaching.records.monthlyPage.backToRecords"
                fallback="나의 기록으로 돌아가기"
              />
            </Link>
            <Link
              className="font-medium text-slate-700 underline"
              href="/my-coaching"
            >
              <I18nText
                k="myCoaching.records.monthlyPage.backToMyCoaching"
                fallback="내 코칭 공간으로 돌아가기"
              />
            </Link>
            <Link
              className="font-medium text-slate-700 underline"
              href="/my-coaching/moksilgi/monthly"
            >
              <I18nText
                k="myCoaching.records.monthlyPage.goMonthlyMoksilgi"
                fallback="목실기 월별 점검으로 이동"
              />
            </Link>
          </div>
        </div>

        <MonthlyReflectionsClient />
      </section>
    </main>
  );
}
