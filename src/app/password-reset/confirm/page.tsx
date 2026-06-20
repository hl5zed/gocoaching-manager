import { Suspense } from "react";
import { PasswordResetConfirmForm } from "./PasswordResetConfirmForm";

export const dynamic = "force-dynamic";

export default function PasswordResetConfirmPage() {
  return (
    <main className="min-h-screen bg-surface-app px-6 py-10 text-ink-strong">
      <section className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-md flex-col justify-center">
        <p className="text-sm font-medium uppercase tracking-wide text-ink-faint">
          GoCoaching Manager
        </p>

        <h1 className="mt-6 text-3xl font-semibold">새 비밀번호 설정</h1>
        <p className="mt-4 leading-7 text-ink-muted">
          새로 사용할 비밀번호를 입력해 주세요.
        </p>

        <Suspense
          fallback={
            <div className="mt-8 text-center text-ink-muted">불러오는 중...</div>
          }
        >
          <PasswordResetConfirmForm />
        </Suspense>
      </section>
    </main>
  );
}
