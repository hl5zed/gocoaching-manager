"use client";

import { useMemo, useState } from "react";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  FieldLabel,
  FieldText,
  SelectInput,
} from "@/components/ui";
import type {
  OrganizationDefaultInvitationRolePolicy,
  OrganizationDefaultRoleSettingsItem,
} from "@/lib/api/admin/system-settings";

type Props = {
  initialError?: string | null;
  initialOrganizations: OrganizationDefaultRoleSettingsItem[];
};

type SaveResponse =
  | {
      ok: true;
      policy: OrganizationDefaultInvitationRolePolicy;
    }
  | {
      error: string;
    };

export function OrganizationDefaultRoleSettings({
  initialError = null,
  initialOrganizations,
}: Props) {
  const [organizations, setOrganizations] = useState(initialOrganizations);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState(
    initialOrganizations[0]?.organization_id ?? "",
  );
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(initialError);
  const [messageType, setMessageType] = useState<"success" | "error">(
    initialError ? "error" : "success",
  );

  const selectedOrganization = useMemo(
    () =>
      organizations.find(
        (organization) =>
          organization.organization_id === selectedOrganizationId,
      ) ?? null,
    [organizations, selectedOrganizationId],
  );
  const [enabled, setEnabled] = useState(
    initialOrganizations[0]?.policy.enabled ?? false,
  );

  const handleSelectOrganization = (organizationId: string) => {
    setSelectedOrganizationId(organizationId);
    const organization = organizations.find(
      (item) => item.organization_id === organizationId,
    );
    setEnabled(organization?.policy.enabled ?? false);
    setMessage(null);
  };

  const handleSave = async () => {
    if (!selectedOrganization) {
      setMessageType("error");
      setMessage("조직을 선택해 주세요.");
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch(
        "/api/admin/settings/organization-default-roles",
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            organization_id: selectedOrganization.organization_id,
            enabled,
            default_role: "coachee",
          }),
        },
      );
      const payload = (await response.json().catch(() => null)) as
        | SaveResponse
        | null;

      if (!response.ok || !payload || "error" in payload) {
        throw new Error(
          payload && "error" in payload
            ? payload.error
            : "조직별 기본 권한을 저장하지 못했습니다.",
        );
      }

      setOrganizations((current) =>
        current.map((organization) =>
          organization.organization_id === selectedOrganization.organization_id
            ? { ...organization, policy: payload.policy }
            : organization,
        ),
      );
      setEnabled(payload.policy.enabled);
      setMessageType("success");
      setMessage("조직별 기본 권한 설정을 저장했습니다.");
    } catch (error) {
      setMessageType("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "조직별 기본 권한을 저장하지 못했습니다.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle>조직별 기본 권한 설정</CardTitle>
            <CardDescription>
              조직별 신규 사용자 초대 폼에 제안할 기본 권한을 관리합니다.
              초대 생성 화면에서 조직 선택 시 기본 권한 제안에 사용됩니다.
            </CardDescription>
          </div>
          <Badge tone="success">초대 생성에 적용</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="rounded-control border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
          이 설정은 초대 생성 화면의 기본값 제안에만 사용되며, 최종 초대
          생성 시 서버에서 다시 검증됩니다.
        </p>

        {message ? (
          <div
            className={`rounded-xl border px-4 py-3 text-sm ${
              messageType === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-rose-200 bg-rose-50 text-rose-800"
            }`}
          >
            {message}
          </div>
        ) : null}

        {organizations.length === 0 ? (
          <p className="rounded-card border border-line-base bg-surface-app px-4 py-3 text-sm text-ink-muted">
            활성 조직이 없습니다. 기관/교회 관리에서 활성 조직을 먼저
            등록해 주세요.
          </p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            <FieldLabel>
              <FieldText>조직</FieldText>
              <SelectInput
                value={selectedOrganizationId}
                onChange={(event) =>
                  handleSelectOrganization(event.target.value)
                }
              >
                {organizations.map((organization) => (
                  <option
                    key={organization.organization_id}
                    value={organization.organization_id}
                  >
                    {organization.organization_name} ·{" "}
                    {organization.country_name}
                  </option>
                ))}
              </SelectInput>
            </FieldLabel>

            <FieldLabel>
              <FieldText>기본 초대 역할</FieldText>
              <SelectInput disabled value="coachee">
                <option value="coachee">코치이</option>
              </SelectInput>
            </FieldLabel>

            <label className="flex min-h-[74px] items-center gap-3 rounded-card border border-line-base bg-surface-app px-4 py-3">
              <input
                checked={enabled}
                className="h-4 w-4 rounded border-line-base text-teal-700 focus:ring-teal-600"
                onChange={(event) => setEnabled(event.target.checked)}
                type="checkbox"
              />
              <span className="text-sm font-semibold text-ink-base">
                초대 생성 기본값 제안 사용
              </span>
            </label>
          </div>
        )}

        {selectedOrganization ? (
          <div className="rounded-card border border-line-base bg-surface-app px-4 py-3 text-sm leading-6 text-ink-muted">
            <p className="font-semibold text-ink-base">
              적용 범위: {selectedOrganization.organization_name}
            </p>
            <p>
              초대 화면에서 이 조직을 선택하면 역할은 코치이, 범위 유형은
              기관, 범위 ID는 조직 ID로 제안됩니다.
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-end gap-3">
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !selectedOrganization}
          >
            {isSaving ? "저장 중..." : "기본 권한 저장"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
