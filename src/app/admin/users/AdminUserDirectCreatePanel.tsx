"use client";

import { useState } from "react";
import type { SyntheticEvent } from "react";
import { I18nText } from "@/lib/i18n/I18nProvider";
import { formatScope, getRoleLabel } from "@/lib/ui/labels";
import type { AdminCountrySummary } from "@/lib/api/admin/countries";
import type {
  AdminLookupSummary,
  AdminOrganizationSummary,
} from "@/lib/api/admin/users";
import { SCOPE_TYPES, USER_ROLES } from "@/types/database";
import { AdminUserAffiliationFields } from "./AdminUserAffiliationFields";

type GenerationOption = {
  generation_number: number;
  label: string;
};

type OptionsPayload = {
  options: {
    countries: AdminCountrySummary[];
    regions: AdminLookupSummary[];
    organizations: AdminOrganizationSummary[];
    churches: AdminLookupSummary[];
    groups: AdminLookupSummary[];
    generations: GenerationOption[];
  };
  optionErrors?: {
    countries?: string | null;
    regions?: string | null;
    organizations?: string | null;
    churches?: string | null;
    groups?: string | null;
  };
};

const MANAGEABLE_USER_ROLES = USER_ROLES.filter(
  (userRole) => userRole !== "super_admin",
);
const MINISTRY_POSITION_OPTIONS = [
  "목사",
  "선교사",
  "전도사",
  "장로",
  "권사",
  "집사",
  "목자",
  "순장",
  "교사",
  "리더",
  "성도",
  "기타",
];
const FALLBACK_GENERATION_OPTIONS = Array.from({ length: 10 }, (_, index) => ({
  generation_number: index + 1,
  label: `${index + 1}세대`,
}));

function getGenerationOptions(options: GenerationOption[]) {
  return options.length > 0 ? options : FALLBACK_GENERATION_OPTIONS;
}

export function AdminUserDirectCreatePanel() {
  const [payload, setPayload] = useState<OptionsPayload | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleToggle(event: SyntheticEvent<HTMLDetailsElement>) {
    if (!event.currentTarget.open || payload || isLoading) {
      return;
    }

    setIsLoading(true);
    setError(null);

    void fetch("/api/admin/users/options", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("options request failed");
        }

        setPayload((await response.json()) as OptionsPayload);
      })
      .catch(() => {
        setError("회원 등록 선택값을 불러오지 못했습니다.");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }

  return (
    <details
      className="group mt-6 rounded-md border border-slate-200 bg-white"
      onToggle={handleToggle}
    >
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div>
          <h2 className="text-lg font-semibold">
            <I18nText k="members.directCreate" fallback="직접 회원 등록" />
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            <I18nText
              k="members.directCreateDescription"
              fallback="기존 이메일 초대 방식은 유지하고, 필요한 경우에만 직접 등록합니다."
            />
          </p>
        </div>
        <span className="rounded-md bg-slate-950 px-4 py-2.5 text-sm font-medium text-white">
          <span className="group-open:hidden">
            <I18nText k="members.openCreate" fallback="회원 등록 열기" />
          </span>
          <span className="hidden group-open:inline">
            <I18nText k="members.closeCreate" fallback="회원 등록 닫기" />
          </span>
        </span>
      </summary>

      <div className="border-t border-slate-200 px-5 pb-5 pt-4">
        {isLoading ? (
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            회원 등록 선택값을 불러오는 중...
          </div>
        ) : null}

        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        {payload ? (
          <>
            <p className="text-sm text-slate-600">
              <I18nText
                k="members.directCreateHelp"
                fallback="이메일 발송 없이 Supabase Auth 계정을 만들고 기존 프로필/역할 구조에 연결합니다."
              />
            </p>
            <form
              action="/api/admin/users"
              className="mt-4 grid gap-5"
              method="post"
            >
              <input name="intent" type="hidden" value="create_profile" />
              <fieldset className="grid gap-4 rounded-md border border-slate-200 p-4">
                <legend className="px-1 text-sm font-semibold text-slate-800">
                  기본 정보
                </legend>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-slate-700">이름</span>
                    <input
                      className="rounded-md border border-slate-300 px-3 py-2 font-sans tracking-normal"
                      maxLength={120}
                      name="full_name"
                      required
                      type="text"
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-slate-700">이메일</span>
                    <input
                      className="rounded-md border border-slate-300 px-3 py-2 font-sans tracking-normal"
                      name="email"
                      required
                      type="email"
                    />
                  </label>
                  <label className="grid gap-2 md:col-span-2">
                    <span className="text-sm font-medium text-slate-700">
                      임시 비밀번호
                    </span>
                    <input
                      className="rounded-md border border-slate-300 px-3 py-2 font-sans tracking-normal"
                      maxLength={72}
                      minLength={8}
                      name="temporary_password"
                      required
                      type="text"
                    />
                  </label>
                </div>
              </fieldset>

              <fieldset className="grid gap-4 rounded-md border border-slate-200 p-4">
                <legend className="px-1 text-sm font-semibold text-slate-800">
                  소속 정보
                </legend>
                <div className="grid gap-4 md:grid-cols-2">
                  <AdminUserAffiliationFields
                    churchOptions={payload.options.churches}
                    countryOptions={payload.options.countries}
                    errors={{
                      churches: payload.optionErrors?.churches,
                      countries: payload.optionErrors?.countries,
                      groups: payload.optionErrors?.groups,
                      organizations: payload.optionErrors?.organizations,
                      regions: payload.optionErrors?.regions,
                    }}
                    groupOptions={payload.options.groups}
                    organizationOptions={payload.options.organizations}
                    regionOptions={payload.options.regions}
                  />
                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-slate-700">
                      소속 직분
                    </span>
                    <select
                      className="rounded-md border border-slate-300 px-3 py-2 font-sans tracking-normal"
                      defaultValue=""
                      name="ministry_position"
                    >
                      <option value="">미지정</option>
                      {MINISTRY_POSITION_OPTIONS.map((position) => (
                        <option key={position} value={position}>
                          {position}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </fieldset>

              <fieldset className="grid gap-4 rounded-md border border-slate-200 p-4">
                <legend className="px-1 text-sm font-semibold text-slate-800">
                  역할 및 세대
                </legend>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-slate-700">
                      시스템 역할
                    </span>
                    <select
                      className="rounded-md border border-slate-300 px-3 py-2 font-sans tracking-normal"
                      defaultValue="coachee"
                      name="role"
                      required
                    >
                      {MANAGEABLE_USER_ROLES.map((userRole) => (
                        <option key={userRole} value={userRole}>
                          {getRoleLabel(userRole)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-slate-700">세대</span>
                    <select
                      className="rounded-md border border-slate-300 px-3 py-2 font-sans tracking-normal"
                      defaultValue=""
                      name="generation_number"
                    >
                      <option value="">미지정</option>
                      {getGenerationOptions(payload.options.generations).map(
                        (generation) => (
                          <option
                            key={generation.generation_number}
                            value={generation.generation_number}
                          >
                            {generation.label}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-slate-700">
                      권한 범위 유형
                    </span>
                    <select
                      className="rounded-md border border-slate-300 px-3 py-2 font-sans tracking-normal"
                      defaultValue="global"
                      name="scope_type"
                      required
                    >
                      {SCOPE_TYPES.map((scopeType) => (
                        <option key={scopeType} value={scopeType}>
                          {formatScope(scopeType, null)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-2 lg:col-span-3">
                    <span className="text-sm font-medium text-slate-700">
                      권한 범위 ID
                    </span>
                    <input
                      className="rounded-md border border-slate-300 px-3 py-2 font-sans tracking-normal"
                      name="scope_id"
                      placeholder="global이면 비워 둡니다"
                      type="text"
                    />
                  </label>
                </div>
              </fieldset>

              <div>
                <button
                  className="rounded-md bg-slate-950 px-4 py-2.5 text-sm font-medium text-white"
                  type="submit"
                >
                  직접 회원 등록
                </button>
                <p className="mt-2 text-sm text-slate-500">
                  생성 성공 후 임시 비밀번호를 사용자에게 직접 전달하세요.
                </p>
              </div>
            </form>
          </>
        ) : null}
      </div>
    </details>
  );
}
