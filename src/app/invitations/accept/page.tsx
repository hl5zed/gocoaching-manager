import { createHash } from "crypto";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import type { ScopeType, UserRole } from "@/types/database";
import { AcceptInvitationButton } from "./AcceptInvitationButton";

export const dynamic = "force-dynamic";

type AcceptInvitationPageProps = {
  searchParams: Promise<{
    token?: string | string[];
  }>;
};

type InvitationPreview = {
  invited_email: string;
  invited_role: UserRole;
  scope_type: ScopeType;
  expires_at: string;
};

type InvitationLookupResult =
  | {
      status: "missing_token";
      invitation: null;
      message: string;
    }
  | {
      status: "valid";
      invitation: InvitationPreview;
      message: string;
    }
  | {
      status: "invalid";
      invitation: null;
      message: string;
    };

function normalizeToken(value: string | string[] | undefined) {
  const token = Array.isArray(value) ? value[0] : value;
  return token?.trim() ?? "";
}

function hashToken(rawToken: string) {
  return createHash("sha256").update(rawToken).digest("hex");
}

async function lookupInvitation(
  rawToken: string,
): Promise<InvitationLookupResult> {
  if (!rawToken) {
    return {
      status: "missing_token",
      invitation: null,
      message: "초대 토큰이 없습니다",
    };
  }

  const { client: serviceClient } = createSupabaseServiceClient();

  if (!serviceClient) {
    return {
      status: "invalid",
      invitation: null,
      message:
        "초대 확인에 필요한 서버 설정이 아직 준비되지 않았습니다. 관리자에게 문의해 주세요.",
    };
  }

  const tokenHash = hashToken(rawToken);
  const invitationsTable = serviceClient.from("invitations") as any;
  const { data, error } = await invitationsTable
    .select("invited_email, invited_role, scope_type, expires_at")
    .eq("token_hash", tokenHash)
    .eq("status", "pending")
    .is("deleted_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error || !data) {
    return {
      status: "invalid",
      invitation: null,
      message: "유효하지 않거나 만료된 초대입니다.",
    };
  }

  return {
    status: "valid",
    invitation: data as InvitationPreview,
    message: "이 초대는 유효합니다",
  };
}

export default async function AcceptInvitationPage({
  searchParams,
}: AcceptInvitationPageProps) {
  const params = await searchParams;
  const token = normalizeToken(params.token);
  const result = await lookupInvitation(token);

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
      <section className="mx-auto w-full max-w-2xl">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
          Invitation
        </p>
        <h1 className="mt-3 text-3xl font-semibold">초대 확인</h1>
        <p className="mt-4 leading-7 text-slate-600">
          초대 링크의 토큰을 안전하게 확인합니다. raw token은 DB에 저장하지
          않고, 화면에도 길게 표시하지 않습니다.
        </p>

        <div className="mt-8 rounded-md border border-slate-200 bg-white p-6">
          {result.status === "valid" ? (
            <div className="space-y-5">
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-900">
                <p className="font-semibold">{result.message}</p>
                <p className="mt-1 text-sm">
                  아래 버튼을 누르면 이 초대를 현재 로그인한 계정으로
                  수락합니다.
                </p>
              </div>

              <dl className="grid gap-4">
                <div>
                  <dt className="text-sm font-medium text-slate-500">
                    invited_email
                  </dt>
                  <dd className="mt-1 text-slate-950">
                    {result.invitation.invited_email}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-slate-500">
                    invited_role
                  </dt>
                  <dd className="mt-1 text-slate-950">
                    {result.invitation.invited_role}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-slate-500">
                    scope_type
                  </dt>
                  <dd className="mt-1 text-slate-950">
                    {result.invitation.scope_type}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-slate-500">
                    expires_at
                  </dt>
                  <dd className="mt-1 text-slate-950">
                    {result.invitation.expires_at}
                  </dd>
                </div>
              </dl>

              <AcceptInvitationButton token={token} />
            </div>
          ) : (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-red-800">
              <p className="font-semibold">{result.message}</p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
