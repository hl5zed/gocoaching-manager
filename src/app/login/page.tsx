import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
      <section className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-md flex-col justify-center">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
          GoCoaching Manager
        </p>
        <h1 className="mt-3 text-3xl font-semibold">로그인</h1>
        <p className="mt-4 leading-7 text-slate-600">
          Supabase Auth에 등록된 이메일과 비밀번호로 로그인합니다.
        </p>
        <LoginForm />
      </section>
    </main>
  );
}
