"use client";

import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminUserAffiliationFields } from "@/app/admin/users/AdminUserAffiliationFields";
import {
  loadAdminUsersOptions,
  type AdminUsersOptionsPayload,
} from "@/app/admin/users/AdminUsersOptionsCache";
import { formatScope } from "@/lib/ui/labels";
import type { ScopeType, UserRole } from "@/types/database";

type SignupRequestActionsProps = {
  signupRequestId: string;
  requestedRole: UserRole;
};

type SignupRequestActionResponse =
  | { ok: true; data: unknown }
  | { ok: false; error: { message: string } };

// Mirrors ROLE_SCOPE_RULES in AdminUserDirectCreatePanel.tsx / admin/users/route.ts.
// "coach" scope (assigning a parent coach as the scope target) is intentionally
// left out of this approval UI — there is no coach-lookup selector here yet.
const ROLE_SCOPE_RULES: Partial<Record<UserRole, ScopeType[]>> = {
  country_admin: ["country"],
  organization_admin: ["organization"],
  church_admin: ["church"],
  group_leader: ["group"],
  coach_maker: ["organization", "church", "group"],
  coach: ["organization", "church", "group"],
  coachee: ["organization", "church", "group"],
};

export function SignupRequestActions({
  signupRequestId,
  requestedRole,
}: SignupRequestActionsProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [optionsPayload, setOptionsPayload] =
    useState<AdminUsersOptionsPayload | null>(null);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [scopeType, setScopeType] = useState<ScopeType | "">("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allowedScopeTypes = ROLE_SCOPE_RULES[requestedRole] ?? [];

  function handleOpenApprove() {
    setIsApproveOpen(true);
    setError(null);

    if (optionsPayload || isLoadingOptions) {
      return;
    }

    setIsLoadingOptions(true);
    void loadAdminUsersOptions()
      .then(setOptionsPayload)
      .catch(() => {
        setError("소속 선택값을 불러오지 못했습니다.");
      })
      .finally(() => {
        setIsLoadingOptions(false);
      });
  }

  function scopeIdFromFormData(formData: FormData): string | null {
    const fieldByScopeType: Partial<Record<ScopeType, string>> = {
      country: "country_id",
      organization: "organization_id",
      church: "church_id",
      group: "group_id",
    };
    const field = scopeType ? fieldByScopeType[scopeType] : undefined;
    const value = field ? formData.get(field) : null;
    return typeof value === "string" && value.trim().length > 0
      ? value.trim()
      : null;
  }

  async function handleConfirmApprove(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting || !formRef.current) {
      return;
    }

    if (allowedScopeTypes.length > 0 && !scopeType) {
      setError("권한 범위 유형을 선택하세요.");
      return;
    }

    const formData = new FormData(formRef.current);
    const scopeId = scopeType === "global" ? null : scopeIdFromFormData(formData);

    if (scopeType && scopeType !== "global" && !scopeId) {
      setError("선택한 권한 범위에 해당하는 대상을 선택하세요.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/admin/signup-requests/${encodeURIComponent(signupRequestId)}/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scope_type: scopeType || null,
            scope_id: scopeId,
            country_id: formData.get("country_id"),
            region_id: formData.get("region_id"),
            organization_id: formData.get("organization_id"),
            church_id: formData.get("church_id"),
            group_id: formData.get("group_id"),
          }),
        },
      );
      const result = (await response.json()) as SignupRequestActionResponse;

      if (!result.ok) {
        setError(result.error.message);
        return;
      }

      setIsApproveOpen(false);
      router.refresh();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "지금 승인할 수 없습니다.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleReject() {
    const reason = window.prompt("반려 사유를 입력하세요 (선택 사항)") ?? "";

    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/admin/signup-requests/${encodeURIComponent(signupRequestId)}/reject`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        },
      );
      const result = (await response.json()) as SignupRequestActionResponse;

      if (!result.ok) {
        setError(result.error.message);
        return;
      }

      router.refresh();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "지금 반려할 수 없습니다.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isApproveOpen) {
    return (
      <div className="w-full min-w-[280px] rounded-md border border-line-base bg-surface-app p-3">
        {isLoadingOptions && (
          <p className="text-xs text-ink-muted">소속 선택값을 불러오는 중...</p>
        )}

        {optionsPayload && (
          <form className="grid gap-3" onSubmit={handleConfirmApprove} ref={formRef}>
            <AdminUserAffiliationFields
              churchOptions={optionsPayload.options.churches}
              countryOptions={optionsPayload.options.countries}
              errors={{
                churches: optionsPayload.optionErrors?.churches,
                countries: optionsPayload.optionErrors?.countries,
                groups: optionsPayload.optionErrors?.groups,
                organizations: optionsPayload.optionErrors?.organizations,
                regions: optionsPayload.optionErrors?.regions,
              }}
              groupOptions={optionsPayload.options.groups}
              organizationOptions={optionsPayload.options.organizations}
              regionOptions={optionsPayload.options.regions}
            />

            {allowedScopeTypes.length > 0 && (
              <label className="grid gap-1 text-sm">
                <span className="font-medium text-ink-base">권한 범위 유형</span>
                <select
                  className="rounded-control border border-line-base px-3 py-2 font-sans tracking-normal"
                  onChange={(event) =>
                    setScopeType(event.currentTarget.value as ScopeType | "")
                  }
                  value={scopeType}
                >
                  <option value="">권한 범위 선택</option>
                  {allowedScopeTypes.map((allowedScopeType) => (
                    <option key={allowedScopeType} value={allowedScopeType}>
                      {formatScope(allowedScopeType, null)}
                    </option>
                  ))}
                </select>
                <span className="text-xs leading-5 text-ink-faint">
                  선택한 범위 유형에 대응하는 소속 값이 권한 범위로 사용됩니다.
                </span>
              </label>
            )}

            {error && <p className="text-xs text-rose-700">{error}</p>}

            <div className="flex flex-wrap gap-2">
              <button
                className="rounded-control bg-navy-900 px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting ? "처리 중..." : "승인 확정"}
              </button>
              <button
                className="rounded-control border border-line-base px-3 py-1.5 text-sm font-medium text-ink-base"
                disabled={isSubmitting}
                onClick={() => setIsApproveOpen(false)}
                type="button"
              >
                취소
              </button>
            </div>
          </form>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-2">
        <button
          className="rounded-control bg-navy-900 px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isSubmitting}
          onClick={handleOpenApprove}
          type="button"
        >
          승인
        </button>
        <button
          className="rounded-control border border-rose-300 px-3 py-1.5 text-sm font-medium text-rose-700 disabled:cursor-not-allowed disabled:border-line-base disabled:text-ink-faint"
          disabled={isSubmitting}
          onClick={handleReject}
          type="button"
        >
          반려
        </button>
      </div>
      {error && <p className="text-xs text-rose-700">{error}</p>}
    </div>
  );
}
