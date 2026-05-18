import Link from "next/link";
import { redirect } from "next/navigation";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { getSession } from "@/lib/auth/getSession";
import { I18nText } from "@/lib/i18n/I18nProvider";
import { DailyRecordsClient } from "./DailyRecordsClient";

export const dynamic = "force-dynamic";

export default async function DailyRecordsPage() {
  const session = await getSession();

  if (!session.user) {
    redirect("/login?redirectTo=%2Fmy-coaching%2Frecords%2Fdaily");
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
      <section className="mx-auto w-full max-w-6xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
              <I18nText k="myCoaching.records.dailyPage.badge" fallback="나의 기록" />
            </p>
            <h1 className="mt-3 text-3xl font-semibold">
              <I18nText k="myCoaching.records.dailyPage.title" fallback="하루 기록" />
            </h1>
            <p className="mt-3 max-w-3xl text-slate-600">
              <I18nText
                k="myCoaching.records.dailyPage.description"
                fallback="오늘의 묵상, 실천, 적용, 기도제목을 기록합니다."
              />
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 text-sm">
            <LanguageSwitcher />
            <Link
              className="font-medium text-slate-700 underline"
              href="/my-coaching/records"
            >
              <I18nText
                k="myCoaching.records.dailyPage.backToRecords"
                fallback="기록 선택으로 돌아가기"
              />
            </Link>
            <Link
              className="font-medium text-slate-700 underline"
              href="/my-coaching"
            >
              <I18nText
                k="myCoaching.records.dailyPage.backToMyCoaching"
                fallback="마이코칭으로 돌아가기"
              />
            </Link>
            <Link
              className="font-medium text-slate-700 underline"
              href="/dashboard"
            >
              <I18nText k="myCoaching.backToDashboard" fallback="대시보드로 돌아가기" />
            </Link>
          </div>
        </div>

        <DailyRecordsClient />
      </section>
    </main>
  );
}
