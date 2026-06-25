import { redirect } from "next/navigation";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { getSession } from "@/lib/auth/getSession";
import { I18nText } from "@/lib/i18n/I18nProvider";
import { SpiritualCompanionClient } from "./SpiritualCompanionClient";


export default async function SpiritualCompanionPage() {
  const session = await getSession();

  if (!session.user) {
    redirect("/login?redirectTo=%2Fmy-coaching%2Fspiritual-companion");
  }

  return (
    <main className="min-h-screen bg-surface-app px-6 py-10 text-ink-strong">
      <section className="mx-auto w-full max-w-5xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-ink-faint">
              <I18nText
                k="myCoaching.spiritualCompanion.badge"
                fallback="내 코칭"
              />
            </p>
            <h1 className="mt-3 text-3xl font-semibold">
              <I18nText
                k="myCoaching.spiritualCompanion.title"
                fallback="AI 영적 형성 도우미"
              />
            </h1>
            <p className="mt-3 max-w-3xl text-ink-muted">
              <I18nText
                k="myCoaching.spiritualCompanion.description"
                fallback="기도 제목, 감사 제목, 묵상 주제를 바탕으로 짧은 묵상 질문을 제공합니다."
              />
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 text-sm">
            <LanguageSwitcher />
          </div>
        </div>

        <section className="mt-8 rounded-card border border-line-base bg-surface-card p-5">
          <h2 className="text-base font-semibold text-ink-strong">
            <I18nText
              k="myCoaching.spiritualCompanion.noticeTitle"
              fallback="MVP 안내"
            />
          </h2>
          <p className="mt-2 text-sm leading-6 text-ink-muted">
            <I18nText
              k="myCoaching.spiritualCompanion.notice"
              fallback="현재는 외부 AI API를 호출하지 않는 mock 응답으로 동작합니다. 개인 묵상 보조 용도로만 사용해 주세요."
            />
          </p>
        </section>

        <SpiritualCompanionClient />
      </section>
    </main>
  );
}
