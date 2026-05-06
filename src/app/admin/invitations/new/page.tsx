import Link from "next/link";
import { AdminInvitationCreateForm } from "@/components/admin/AdminInvitationCreateForm";

export const dynamic = "force-dynamic";

export default function NewAdminInvitationPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
      <section className="mx-auto w-full max-w-4xl">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
          관리자
        </p>
        <h1 className="mt-3 text-3xl font-semibold">초대 생성</h1>
        <p className="mt-4 max-w-2xl leading-7 text-slate-600">
          특정 역할과 범위를 가진 사용자를 위한 대기 중 초대를 생성합니다.
        </p>

        <AdminInvitationCreateForm />

        <div className="mt-6">
          <Link
            className="text-sm font-medium text-slate-700 underline"
            href="/admin/invitations"
          >
            초대 목록 보기
          </Link>
        </div>
      </section>
    </main>
  );
}
