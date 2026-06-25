import { notFound } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth/requireSuperAdmin";
import { InvitationDebugForm } from "./InvitationDebugForm";


export default async function InvitationDebugPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  await requireSuperAdmin();

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
      <section className="mx-auto w-full max-w-3xl">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
          Debug
        </p>
        <h1 className="mt-3 text-3xl font-semibold">초대 생성 테스트</h1>
        <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
          개발/관리자 전용 페이지입니다.
        </p>

        <div className="mt-8 rounded-md border border-slate-200 bg-white p-6">
          <InvitationDebugForm />
        </div>
      </section>
    </main>
  );
}
