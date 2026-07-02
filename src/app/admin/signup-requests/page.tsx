import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout";
import { SignupRequestActions } from "@/components/admin/SignupRequestActions";
import { requireAdminProfile } from "@/lib/auth/require-admin-profile";
import { getPendingSignupRequests } from "@/lib/api/admin/signup-requests";
import { formatDateTimeInTimezone } from "@/lib/timezone";
import { getRoleLabel } from "@/lib/ui/labels";

export default async function AdminSignupRequestsPage() {
  const admin = await requireAdminProfile();

  if (!admin.ok) {
    redirect("/unauthorized");
  }

  if (!admin.roles.includes("super_admin")) {
    redirect("/unauthorized");
  }

  const result = await getPendingSignupRequests();
  const signupRequests = result.ok ? result.data : [];
  const error = result.ok ? null : result.error;

  return (
    <>
      <PageHeader
        description="회원이 직접 신청한 가입 요청을 확인하고 승인·반려할 수 있습니다."
        title="가입 신청 승인"
      />

      {error && (
        <div className="rounded-control border border-red-200 bg-red-50 p-4 text-red-800">
          지금 가입 신청 목록을 불러올 수 없습니다.
        </div>
      )}

      {!error && signupRequests.length === 0 && (
        <div className="rounded-card border border-line-base bg-surface-card p-6 text-ink-muted">
          <p className="font-medium text-ink-base">
            대기 중인 가입 신청이 없습니다.
          </p>
        </div>
      )}

      {!error && signupRequests.length > 0 && (
        <>
          <p className="text-sm text-ink-faint md:hidden">
            표는 가로로 스크롤해 전체 내용을 확인하세요.
          </p>
          <div className="overflow-x-auto rounded-md border border-line-base bg-surface-card">
            <table className="w-full min-w-[1200px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-line-soft text-ink-faint">
                  <th className="px-4 py-3 font-medium">이름</th>
                  <th className="px-4 py-3 font-medium">이메일</th>
                  <th className="px-4 py-3 font-medium">희망 역할</th>
                  <th className="px-4 py-3 font-medium">신청 시 제출 정보</th>
                  <th className="px-4 py-3 font-medium">신청일</th>
                  <th className="px-4 py-3 font-medium">작업</th>
                </tr>
              </thead>
              <tbody>
                {signupRequests.map((signupRequest) => (
                  <tr
                    className="border-b border-line-soft text-ink-base"
                    key={signupRequest.id}
                  >
                    <td className="px-4 py-3 font-medium text-ink-strong">
                      {signupRequest.name}
                    </td>
                    <td className="px-4 py-3">{signupRequest.email}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full border border-line-base bg-surface-sunken px-2.5 py-1 text-xs font-medium text-ink-base">
                        {getRoleLabel(signupRequest.requested_role)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs leading-5 text-ink-muted">
                      {signupRequest.affiliation_text && (
                        <p>소속: {signupRequest.affiliation_text}</p>
                      )}
                      {signupRequest.region_text && (
                        <p>지역: {signupRequest.region_text}</p>
                      )}
                      {signupRequest.generation_text && (
                        <p>기수: {signupRequest.generation_text}</p>
                      )}
                      {signupRequest.ministry_position && (
                        <p>직분: {signupRequest.ministry_position}</p>
                      )}
                      {signupRequest.self_introduction && (
                        <p>소개: {signupRequest.self_introduction}</p>
                      )}
                      {!signupRequest.affiliation_text &&
                        !signupRequest.region_text &&
                        !signupRequest.generation_text &&
                        !signupRequest.ministry_position &&
                        !signupRequest.self_introduction && (
                          <span className="text-ink-faint">—</span>
                        )}
                    </td>
                    <td className="px-4 py-3">
                      {formatDateTimeInTimezone(
                        signupRequest.created_at,
                        "Asia/Seoul",
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <SignupRequestActions
                        requestedRole={signupRequest.requested_role}
                        signupRequestId={signupRequest.id}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
