import { PasswordResetRequestForm } from "./PasswordResetRequestForm";

export const dynamic = "force-dynamic";

export default function PasswordResetPage() {
  return (
    <main className="min-h-screen bg-surface-app px-6 py-10 text-ink-strong">
      <section className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-md flex-col justify-center">
        <p className="text-sm font-medium uppercase tracking-wide text-ink-faint">
          GoCoaching Manager
        </p>

        <h1 className="mt-6 text-3xl font-semibold">비밀번호 재설정</h1>
        <p className="mt-4 leading-7 text-ink-muted">
          가입한 이메일을 입력하시면 비밀번호 재설정 링크를 보내드립니다.
        </p>

        <PasswordResetRequestForm />
      </section>
    </main>
  );
}
