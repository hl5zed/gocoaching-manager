import { createHash } from "crypto";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { getActiveGlobalGenerationOptions } from "@/lib/api/admin/generations";
import type { ScopeType, UserRole } from "@/types/database";
import { formatScope, getRoleLabel } from "@/lib/ui/labels";
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

type CountryOption = {
  code: string;
  id: string;
  name: string;
};

type GenerationOption = {
  id: string;
  generation_number: number;
  label: string;
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

function formatDateTime(value: string | null) {
  if (!value) {
    return "미지정";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "미지정";
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Bangkok",
  }).formatToParts(date);

  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get(
    "minute",
  )}`;
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

async function loadCountries(): Promise<CountryOption[]> {
  const { client: serviceClient } = createSupabaseServiceClient();

  if (!serviceClient) {
    return [];
  }

  const { data, error } = await serviceClient
    .from("countries")
    .select("id, name, code")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    console.error("[INVITATION_COUNTRIES_LOOKUP_FAILED]", error.message);
    return [];
  }

  return (data ?? []) as CountryOption[];
}

async function loadGenerationOptions(): Promise<GenerationOption[]> {
  const generations = await getActiveGlobalGenerationOptions();

  if (generations.length > 0) {
    return generations.map((generation) => ({
      id: generation.id,
      generation_number: generation.generation_number,
      label: generation.label,
    }));
  }

  return [1, 2, 3, 4, 5].map((generation) => ({
    id: `fallback-${generation}`,
    generation_number: generation,
    label: `${generation}세대`,
  }));
}

export default async function AcceptInvitationPage({
  searchParams,
}: AcceptInvitationPageProps) {
  const params = await searchParams;
  const token = normalizeToken(params.token);
  const [result, countries, generationOptions] = await Promise.all([
    lookupInvitation(token),
    loadCountries(),
    loadGenerationOptions(),
  ]);

  return (
    <main className="min-h-screen bg-surface-app px-6 py-10 text-ink-strong">
      <section className="mx-auto w-full max-w-3xl">
        <p className="text-sm font-medium uppercase tracking-wide text-ink-faint">
          Invitation
        </p>
        <h1 className="mt-3 text-3xl font-semibold">초대 확인</h1>
        <p className="mt-4 leading-7 text-ink-muted">
          초대 정보를 확인하고, 필요한 프로필 정보를 입력한 뒤 현재 로그인한
          계정으로 초대를 수락합니다.
        </p>

        <div className="mt-8 rounded-card border border-line-base bg-surface-card p-6">
          {result.status === "valid" ? (
            <div className="space-y-6">
              <div className="rounded-control border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-900">
                <p className="font-semibold">{result.message}</p>
                <p className="mt-1 text-sm">
                  초대 이메일과 시스템 역할은 초대 정보에서 자동으로 적용됩니다.
                </p>
              </div>

              <AcceptInvitationButton
                countries={countries}
                expiresAtLabel={formatDateTime(result.invitation.expires_at)}
                generationOptions={generationOptions}
                invitedEmail={result.invitation.invited_email}
                invitedRoleLabel={getRoleLabel(result.invitation.invited_role)}
                scopeLabel={formatScope(result.invitation.scope_type, null)}
                scopeType={result.invitation.scope_type}
                token={token}
              />
            </div>
          ) : (
            <div className="rounded-control border border-red-200 bg-red-50 px-4 py-3 text-red-800">
              <p className="font-semibold">{result.message}</p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
