"use client";

import Link from "next/link";
import { useState } from "react";

type AcceptInvitationButtonProps = {
  countries: Array<{
    code: string;
    id: string;
    name: string;
  }>;
  expiresAtLabel: string;
  generationOptions: Array<{
    id: string;
    generation_number: number;
    label: string;
  }>;
  invitedEmail: string;
  invitedRoleLabel: string;
  scopeLabel: string;
  scopeType: string;
  token: string;
};

type AcceptInvitationResponse =
  | {
      ok: true;
      data?: {
        message?: string;
      };
    }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
      };
};

const MINISTRY_POSITION_OPTIONS = [
  "목회자",
  "선교사",
  "전도사",
  "장로",
  "권사",
  "집사",
  "성도",
  "리더",
  "교사",
  "기타",
] as const;

type FieldBadgeTone = "new" | "auto";

function FieldBadge({
  children,
  tone,
}: {
  children: string;
  tone: FieldBadgeTone;
}) {
  const toneClass: Record<FieldBadgeTone, string> = {
    new: "border-emerald-200 bg-emerald-50 text-emerald-700",
    auto: "border-line-base bg-surface-sunken text-ink-muted",
  };

  return (
    <span
      className={`ml-2 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${toneClass[tone]}`}
    >
      {children}
    </span>
  );
}

function ReadOnlyField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-line-base bg-surface-card px-3 py-2">
      <dt className="text-sm font-medium text-ink-faint">
        {label}
        <FieldBadge tone="auto">자동</FieldBadge>
      </dt>
      <dd className="mt-1 break-words text-sm text-ink-strong">
        {value.trim().length > 0 ? value : "미지정"}
      </dd>
    </div>
  );
}

export function AcceptInvitationButton({
  countries,
  expiresAtLabel,
  generationOptions,
  invitedEmail,
  invitedRoleLabel,
  scopeLabel,
  scopeType,
  token,
}: AcceptInvitationButtonProps) {
  const [countryId, setCountryId] = useState("");
  const [ministryPosition, setMinistryPosition] = useState("");
  const [generationSelection, setGenerationSelection] = useState("");
  const [customGenerationNumber, setCustomGenerationNumber] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const organizationLabel =
    scopeType === "organization" ? scopeLabel : "미지정";
  const churchLabel = scopeType === "church" ? scopeLabel : "미지정";

  async function handleAccept() {
    setIsSubmitting(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    const generationValue =
      generationSelection === "custom"
        ? customGenerationNumber.trim()
        : generationSelection;
    const parsedGeneration =
      generationValue.length > 0 ? Number(generationValue) : null;

    if (
      parsedGeneration !== null &&
      (!Number.isInteger(parsedGeneration) || parsedGeneration < 1)
    ) {
      setIsSubmitting(false);
      setErrorMessage("세대는 1 이상의 숫자로 입력해 주세요.");
      return;
    }

    try {
      const response = await fetch("/api/invitations/accept", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          country_id: countryId || null,
          ministry_position: ministryPosition || null,
          generation_number: parsedGeneration,
        }),
      });

      const result = (await response.json()) as AcceptInvitationResponse;

      if (!response.ok || !result.ok) {
        setErrorMessage(
          result.ok === false
            ? result.error.message
            : "초대 수락 중 오류가 발생했습니다.",
        );
        return;
      }

      setSuccessMessage("초대를 수락했습니다.");
    } catch {
      setErrorMessage("초대 수락 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mt-6 space-y-5">
      <section className="rounded-card border border-line-base bg-surface-app p-4">
        <h2 className="text-base font-semibold text-ink-strong">기본 정보</h2>
        <p className="mt-1 text-sm text-ink-muted">
          초대 이메일은 자동으로 확인됩니다. 이름과 표시 이름은 현재 로그인 계정의 프로필 흐름을 따릅니다.
        </p>
        <dl className="mt-4 grid gap-3 md:grid-cols-2">
          <ReadOnlyField label="이메일" value={invitedEmail} />
          <ReadOnlyField label="초대 만료일" value={expiresAtLabel} />
        </dl>
      </section>

      <section className="rounded-card border border-line-base bg-surface-app p-4">
        <h2 className="text-base font-semibold text-ink-strong">소속 정보</h2>
        <p className="mt-1 text-sm text-ink-muted">
          소속 직분은 시스템 권한이 아니라 실제 소속 내 직분입니다.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <ReadOnlyField label="소속 기관 및 단체" value={organizationLabel} />
          <ReadOnlyField label="소속 교회" value={churchLabel} />

          <label className="grid gap-2">
            <span className="text-sm font-medium text-ink-base">
              소속 국가
              <FieldBadge tone="new">신규</FieldBadge>
            </span>
            <select
              className="rounded-md border border-line-base bg-surface-card px-3 py-2 font-sans tracking-normal"
              onChange={(event) => setCountryId(event.target.value)}
              value={countryId}
            >
              <option value="">미지정</option>
              {countries.map((country) => (
                <option key={country.id} value={country.id}>
                  {country.name}
                  {country.code ? ` (${country.code})` : ""}
                </option>
              ))}
            </select>
            {countries.length === 0 ? (
              <span className="text-xs text-ink-faint">
                등록된 국가가 없거나 국가 목록을 불러오지 못한 경우 미지정으로 수락할 수 있습니다.
              </span>
            ) : null}
          </label>

          <label className="grid gap-2 md:col-span-2">
            <span className="text-sm font-medium text-ink-base">
              소속 직분
              <FieldBadge tone="new">신규</FieldBadge>
            </span>
            <select
              className="rounded-md border border-line-base bg-surface-card px-3 py-2 font-sans tracking-normal"
              onChange={(event) => setMinistryPosition(event.target.value)}
              value={ministryPosition}
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
      </section>

      <section className="rounded-card border border-line-base bg-surface-app p-4">
        <h2 className="text-base font-semibold text-ink-strong">역할 및 세대</h2>
        <p className="mt-1 text-sm text-ink-muted">
          시스템 역할은 초대에 지정된 권한이고, 세대는 회원 프로필에 숫자로 저장됩니다.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <ReadOnlyField label="시스템 역할" value={invitedRoleLabel} />

          <label className="grid gap-2">
            <span className="text-sm font-medium text-ink-base">
              세대
              <FieldBadge tone="new">신규</FieldBadge>
            </span>
            <select
              className="rounded-md border border-line-base bg-surface-card px-3 py-2 font-sans tracking-normal"
              onChange={(event) => {
                setGenerationSelection(event.target.value);
                if (event.target.value !== "custom") {
                  setCustomGenerationNumber("");
                }
              }}
              value={generationSelection}
            >
              <option value="">미지정</option>
              {generationOptions.map((generation) => (
                <option
                  key={generation.id}
                  value={generation.generation_number}
                >
                  {generation.label}
                </option>
              ))}
              <option value="custom">직접 입력</option>
            </select>
          </label>

          {generationSelection === "custom" ? (
            <label className="grid gap-2 md:col-span-2">
              <span className="text-sm font-medium text-ink-base">
                직접 입력 세대
                <FieldBadge tone="new">신규</FieldBadge>
              </span>
              <input
                className="rounded-md border border-line-base bg-surface-card px-3 py-2 font-sans tracking-normal"
                min="1"
                onChange={(event) =>
                  setCustomGenerationNumber(event.target.value)
                }
                placeholder="세대 숫자를 입력하세요"
                type="number"
                value={customGenerationNumber}
              />
            </label>
          ) : null}
        </div>
        <p className="mt-3 text-xs text-ink-faint">
          직접 입력은 1 이상의 숫자만 저장되며, NaN 값은 저장하지 않습니다.
        </p>
      </section>

      <section className="rounded-card border border-line-base bg-surface-app p-4">
        <h2 className="text-base font-semibold text-ink-strong">계정 설정</h2>
        <p className="mt-1 text-sm text-ink-muted">
          이 초대는 현재 로그인한 계정에 연결됩니다. 아직 로그인하지 않았다면
          먼저 로그인한 뒤 다시 초대 링크를 열어 주세요. 비밀번호 설정은 이
          화면에서 진행하지 않습니다. 관리자로부터 받은 임시 비밀번호로 먼저
          로그인해 주세요.
        </p>
        <div className="mt-4 rounded-card border border-line-base bg-surface-card p-4">
          <h3 className="text-sm font-semibold text-ink-base">
            초대 수락 순서
          </h3>
          <ol className="mt-3 grid gap-2 text-sm leading-6 text-ink-muted">
            <li>1. 관리자로부터 받은 이메일과 임시 비밀번호로 먼저 로그인합니다.</li>
            <li>2. 로그인 후 다시 초대 링크를 엽니다.</li>
            <li>3. 소속 국가, 소속 직분, 세대를 확인합니다.</li>
            <li>4. 초대 수락 버튼을 눌러 가입을 완료합니다.</li>
          </ol>
          <Link
            className="mt-4 inline-flex rounded-control border border-line-base px-3 py-2 text-sm font-medium text-ink-base"
            href="/login"
          >
            먼저 로그인하기
          </Link>
        </div>
        <button
          className="mt-4 rounded-control bg-navy-900 px-4 py-2.5 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isSubmitting}
          onClick={handleAccept}
          type="button"
        >
          {isSubmitting ? "수락 중..." : "초대 수락"}
        </button>
      </section>

      {successMessage && (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          <p>{successMessage}</p>
          <Link className="mt-2 inline-block underline" href="/dashboard">
            대시보드로 이동
          </Link>
        </div>
      )}

      {errorMessage && (
        <div className="rounded-control border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}
    </div>
  );
}
