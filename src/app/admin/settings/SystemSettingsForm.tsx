"use client";

import { useState } from "react";

import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, FieldLabel, FieldText, SelectInput } from "@/components/ui";
import type { GlobalSystemSettings, SystemDefaultLocale } from "@/lib/api/admin/system-settings";
import type { PrintOptions } from "@/lib/print/print-options";

type CountryOption = {
  id: string;
  name: string;
};

type Props = {
  initialSettings: GlobalSystemSettings;
  countries: CountryOption[];
  initialError?: string | null;
};

const INVITATION_EXPIRE_OPTIONS = [1, 3, 7, 14, 30];

function getInvitationExpireOptions(currentValue: string) {
  const currentDays = Number(currentValue);

  if (
    Number.isInteger(currentDays) &&
    currentDays >= 1 &&
    currentDays <= 30 &&
    !INVITATION_EXPIRE_OPTIONS.includes(currentDays)
  ) {
    return [...INVITATION_EXPIRE_OPTIONS, currentDays].sort((left, right) => left - right);
  }

  return INVITATION_EXPIRE_OPTIONS;
}

export function SystemSettingsForm({
  initialSettings,
  countries,
  initialError = null,
}: Props) {
  const [defaultLocale, setDefaultLocale] = useState<SystemDefaultLocale>(
    initialSettings.default_locale,
  );
  const [defaultCountryId, setDefaultCountryId] = useState(
    initialSettings.default_country_id ?? "",
  );
  const [invitationExpiresInDays, setInvitationExpiresInDays] = useState(
    String(initialSettings.invitation_expires_in_days),
  );
  const [printOptions, setPrintOptions] = useState<PrintOptions>(
    initialSettings.print_options,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(initialError);
  const [messageType, setMessageType] = useState<"success" | "error">(
    initialError ? "error" : "success",
  );
  const invitationExpireOptions = getInvitationExpireOptions(invitationExpiresInDays);

  const setPrintOption = <Key extends keyof PrintOptions>(
    key: Key,
    value: PrintOptions[Key],
  ) => {
    setPrintOptions((current) => ({ ...current, [key]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          default_locale: defaultLocale,
          default_country_id: defaultCountryId || null,
          invitation_expires_in_days: Number(invitationExpiresInDays),
          print_options: printOptions,
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error ?? "설정을 저장하지 못했습니다.");
      }

      if (payload?.settings) {
        setDefaultLocale(payload.settings.default_locale);
        setDefaultCountryId(payload.settings.default_country_id ?? "");
        setInvitationExpiresInDays(String(payload.settings.invitation_expires_in_days));
        setPrintOptions(payload.settings.print_options);
      }

      setMessageType("success");
      setMessage("설정을 저장했습니다.");
    } catch (error) {
      setMessageType("error");
      setMessage(error instanceof Error ? error.message : "설정을 저장하지 못했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle>기본 운영 설정</CardTitle>
              <CardDescription>
                기본 언어, 기본 국가, 초대 만료 기간을 저장합니다.
              </CardDescription>
            </div>
            <Badge tone="info">저장 가능</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
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

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-2">
              <FieldLabel htmlFor="default_locale">기본 언어</FieldLabel>
              <SelectInput
                id="default_locale"
                value={defaultLocale}
                onChange={(event) => setDefaultLocale(event.target.value as SystemDefaultLocale)}
              >
                <option value="ko">한국어</option>
                <option value="en">English</option>
              </SelectInput>
              <p className="text-xs leading-5 text-slate-500">
                저장되며, 실제 적용 화면은 단계적으로 연결 예정입니다.
              </p>
            </div>

            <div className="space-y-2">
              <FieldLabel htmlFor="default_country_id">기본 국가</FieldLabel>
              <SelectInput
                id="default_country_id"
                value={defaultCountryId}
                onChange={(event) => setDefaultCountryId(event.target.value)}
              >
                <option value="">선택 안 함</option>
                {countries.map((country) => (
                  <option key={country.id} value={country.id}>
                    {country.name}
                  </option>
                ))}
              </SelectInput>
              <p className="text-xs leading-5 text-slate-500">
                저장되며, 실제 적용 화면은 단계적으로 연결 예정입니다.
              </p>
            </div>

            <div className="space-y-2">
              <FieldLabel htmlFor="invitation_expires_in_days">초대 만료 기간</FieldLabel>
              <SelectInput
                id="invitation_expires_in_days"
                value={invitationExpiresInDays}
                onChange={(event) => setInvitationExpiresInDays(event.target.value)}
              >
                {invitationExpireOptions.map((days) => (
                  <option key={days} value={days}>
                    {days}일
                  </option>
                ))}
              </SelectInput>
              <p className="text-xs leading-5 text-slate-500">
                /admin/invitations/new 초대 생성 화면의 기본 만료일로
                사용됩니다.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle>인쇄 기본 옵션</CardTitle>
              <CardDescription>
                목실기, 나의 기록, 보고서 출력에 사용할 기본 용지, 방향,
                여백과 표시 항목을 저장합니다.
              </CardDescription>
            </div>
            <Badge tone="warning">저장만 됨</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 lg:grid-cols-3">
            <FieldLabel>
              <FieldText>용지 크기</FieldText>
              <SelectInput
                value={printOptions.paper_size}
                onChange={(event) => setPrintOption("paper_size", "a4")}
              >
                <option value="a4">A4</option>
              </SelectInput>
            </FieldLabel>

            <FieldLabel>
              <FieldText>방향</FieldText>
              <SelectInput
                value={printOptions.orientation}
                onChange={(event) =>
                  setPrintOption(
                    "orientation",
                    event.target.value as PrintOptions["orientation"],
                  )
                }
              >
                <option value="portrait">세로</option>
                <option value="landscape">가로</option>
              </SelectInput>
            </FieldLabel>

            <FieldLabel>
              <FieldText>여백</FieldText>
              <SelectInput
                value={printOptions.margin}
                onChange={(event) =>
                  setPrintOption("margin", event.target.value as PrintOptions["margin"])
                }
              >
                <option value="compact">좁게</option>
                <option value="normal">보통</option>
                <option value="wide">넓게</option>
              </SelectInput>
            </FieldLabel>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["show_title", "제목 표시"],
              ["show_people_info", "작성자/대상자 정보 표시"],
              ["show_date", "날짜 표시"],
              ["show_logo", "로고 표시"],
              ["show_signature", "서명란 표시"],
              ["show_page_numbers", "페이지 번호 표시"],
            ].map(([key, label]) => (
              <label
                className="inline-flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700"
                key={key}
              >
                <input
                  checked={Boolean(printOptions[key as keyof PrintOptions])}
                  className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                  onChange={(event) =>
                    setPrintOption(
                      key as keyof PrintOptions,
                      event.target.checked as never,
                    )
                  }
                  type="checkbox"
                />
                <span className="min-w-0 break-words">{label}</span>
              </label>
            ))}
          </div>

          <p className="text-xs leading-5 text-slate-500">
            인쇄 옵션은 저장되지만 출력 화면 반영은 단계적으로 연결 예정입니다.
            페이지 번호, 로고, 서명란은 문서별 레이아웃 차이가 있어 현재는
            저장값 중심으로 관리합니다.
          </p>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <p className="text-xs leading-5 text-slate-500">
          설정 변경은 전체 운영 기본값에 영향을 줄 수 있습니다.
        </p>
        <Button type="button" onClick={handleSave} disabled={isSaving}>
          {isSaving ? "저장 중..." : "설정 저장"}
        </Button>
      </div>
    </div>
  );
}
