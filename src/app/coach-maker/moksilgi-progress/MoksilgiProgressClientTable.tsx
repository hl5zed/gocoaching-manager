"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import {
  type CoachMakerMoksilgiProgressRow,
  type CoachMakerMoksilgiRelationshipProgressRow,
} from "@/lib/api/coach-maker/moksilgi-progress";
import { useI18n } from "@/lib/i18n/useI18n";

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);
const MISSING_LABEL = "-";

type ViewMode = "team" | "relationship" | "care";
type SortKey = "name" | "country" | "region" | "coach" | "achievement" | "care";
type SortDirection = "asc" | "desc";

type CareAssessment = {
  averageRate: number | null;
  missingMonths: number | null;
  recentRecordMonth: number | null;
  reasons: string[];
  actions: string[];
  severity: "good" | "attention" | "care" | "none";
};

type SelectOption = {
  label: string;
  value: string;
};

function safeText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function displayText(value: string | null | undefined) {
  return safeText(value) ?? MISSING_LABEL;
}

function formatPercent(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return MISSING_LABEL;
  }

  return `${value.toFixed(1)}%`;
}

function formatMonthLabel(month: number | null | undefined) {
  if (!month || month < 1 || month > 12) {
    return MISSING_LABEL;
  }

  return `${month}월`;
}

function monthRate(
  row: CoachMakerMoksilgiProgressRow | CoachMakerMoksilgiRelationshipProgressRow,
  month: number,
) {
  const key = `month_${month}_rate` as keyof typeof row;
  const value = row[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function currentMonthCutoff(year: number) {
  const today = new Date();

  if (year < today.getFullYear()) return 12;
  if (year > today.getFullYear()) return 0;
  return today.getMonth() + 1;
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function upToCurrentRate(row: CoachMakerMoksilgiProgressRow, year: number) {
  const cutoff = currentMonthCutoff(year);
  if (cutoff <= 0) return 0;

  const values = MONTHS.slice(0, cutoff).map((month) => monthRate(row, month) ?? 0);
  return average(values) ?? 0;
}

function recordedMonths(row: CoachMakerMoksilgiProgressRow, year: number) {
  const cutoff = currentMonthCutoff(year);
  return MONTHS.slice(0, cutoff).filter((month) => {
    const value = monthRate(row, month);
    return typeof value === "number" && value > 0;
  });
}

function assessCare(row: CoachMakerMoksilgiProgressRow, year: number): CareAssessment {
  const cutoff = currentMonthCutoff(year);
  const months = recordedMonths(row, year);
  const rates = months
    .map((month) => monthRate(row, month))
    .filter((value): value is number => typeof value === "number");
  const averageRate = average(rates);
  const recentRecordMonth = months.at(-1) ?? null;
  const missingMonths =
    cutoff > 0 && recentRecordMonth !== null ? Math.max(cutoff - recentRecordMonth, 0) : null;
  const reasons: string[] = [];
  const actions: string[] = [];

  if (rates.length === 0) {
    reasons.push("아직 목실기 기록이 없습니다.");
    actions.push("첫 기록 작성 안내 필요");
  }

  if (typeof averageRate === "number" && averageRate < 50) {
    reasons.push("평균 성취율이 50% 미만입니다.");
    actions.push("코치 상담 필요");
  }

  if (missingMonths !== null && missingMonths >= 2) {
    reasons.push("최근 2개월 이상 기록이 없습니다.");
    actions.push("기록 독려 필요");
  }

  if (rates.length === 0) {
    return {
      averageRate,
      missingMonths: null,
      recentRecordMonth,
      reasons,
      actions,
      severity: "none",
    };
  }

  if (reasons.length > 0) {
    return {
      averageRate,
      missingMonths,
      recentRecordMonth,
      reasons,
      actions,
      severity: "care",
    };
  }

  if (averageRate !== null && averageRate < 80) {
    return {
      averageRate,
      missingMonths,
      recentRecordMonth,
      reasons: ["성취율을 지속적으로 확인해 주세요."],
      actions: ["정기 점검 권장"],
      severity: "attention",
    };
  }

  return {
    averageRate,
    missingMonths,
    recentRecordMonth,
    reasons: ["현재 흐름이 안정적입니다."],
    actions: ["현재 코칭 흐름 유지"],
    severity: "good",
  };
}

function profileName(row: CoachMakerMoksilgiProgressRow) {
  return (
    safeText(row.display_name) ??
    safeText(row.full_name) ??
    safeText(row.author_name) ??
    safeText(row.email) ??
    MISSING_LABEL
  );
}

function personName({
  displayName,
  email,
  fullName,
}: {
  displayName?: string | null;
  email?: string | null;
  fullName?: string | null;
}) {
  return safeText(displayName) ?? safeText(fullName) ?? safeText(email) ?? MISSING_LABEL;
}

function countryLabel(row: Pick<CoachMakerMoksilgiProgressRow, "country_code" | "country_name">) {
  if (safeText(row.country_name) && safeText(row.country_code)) {
    return `${row.country_name} (${row.country_code})`;
  }

  return safeText(row.country_name) ?? safeText(row.country_code);
}

function relationshipCountryLabel(row: CoachMakerMoksilgiRelationshipProgressRow) {
  if (safeText(row.coachee_country_name) && safeText(row.coachee_country_code)) {
    return `${row.coachee_country_name} (${row.coachee_country_code})`;
  }

  return safeText(row.coachee_country_name) ?? safeText(row.coachee_country_code);
}

function rowRegion(row: CoachMakerMoksilgiProgressRow) {
  return safeText(row.region_name);
}

function rowOrganizationChurch(row: CoachMakerMoksilgiProgressRow) {
  return [row.organization_name, row.church_name]
    .map(safeText)
    .filter(Boolean)
    .join(" / ") || null;
}

function relationshipOrganizationChurch(row: CoachMakerMoksilgiRelationshipProgressRow) {
  return [row.coachee_organization_name, row.coachee_church_name]
    .map(safeText)
    .filter(Boolean)
    .join(" / ") || null;
}

function rowGroup(row: CoachMakerMoksilgiProgressRow) {
  return safeText(row.group_name) ?? safeText(row.team_name);
}

function rowMinistryPosition(row: CoachMakerMoksilgiProgressRow) {
  return safeText(row.ministry_position) ?? safeText(row.role_label);
}

function rowGeneration(row: CoachMakerMoksilgiProgressRow) {
  if (typeof row.generation_number === "number" && Number.isFinite(row.generation_number)) {
    return `${row.generation_number}세대`;
  }

  return safeText(row.generation_label);
}

function relationshipGeneration(row: CoachMakerMoksilgiRelationshipProgressRow) {
  if (
    typeof row.coachee_generation_number === "number" &&
    Number.isFinite(row.coachee_generation_number)
  ) {
    return `${row.coachee_generation_number}세대`;
  }

  return null;
}

function rowCoachingRole(row: CoachMakerMoksilgiProgressRow) {
  return safeText(row.primary_role) ?? safeText(row.role_label);
}

function relationshipCoachingRole(row: CoachMakerMoksilgiRelationshipProgressRow) {
  return safeText(row.coachee_primary_role);
}

function normalizeOptionValue(value: string | null | undefined) {
  return safeText(value)?.toLowerCase() ?? "";
}

function buildOptions(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const options: SelectOption[] = [];

  for (const value of values) {
    const label = safeText(value);
    if (!label) continue;

    const key = label.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    options.push({ label, value: key });
  }

  return options.sort((a, b) => a.label.localeCompare(b.label));
}

function buildIdOptions(rows: CoachMakerMoksilgiProgressRow[]) {
  const seen = new Set<string>();
  const options: SelectOption[] = [];

  for (const row of rows) {
    if (!row.country_id) continue;

    const label = countryLabel(row);
    if (!label || seen.has(row.country_id)) continue;

    seen.add(row.country_id);
    options.push({ label, value: row.country_id });
  }

  return options.sort((a, b) => a.label.localeCompare(b.label));
}

function buildCoachOptions(relationshipRows: CoachMakerMoksilgiRelationshipProgressRow[]) {
  const seen = new Set<string>();
  const options: SelectOption[] = [];

  for (const row of relationshipRows) {
    if (!row.coach_profile_id || seen.has(row.coach_profile_id)) continue;

    seen.add(row.coach_profile_id);
    options.push({
      label: personName({
        displayName: row.coach_display_name,
        email: row.coach_email,
        fullName: row.coach_full_name,
      }),
      value: row.coach_profile_id,
    });
  }

  return options.sort((a, b) => a.label.localeCompare(b.label));
}

function compareText(a: string | null | undefined, b: string | null | undefined) {
  return displayText(a).localeCompare(displayText(b));
}

function downloadCsv(fileName: string, rows: string[][]) {
  const csv = rows
    .map((row) =>
      row
        .map((cell) => {
          const text = String(cell ?? "");
          return `"${text.replace(/"/g, '""')}"`;
        })
        .join(","),
    )
    .join("\r\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function StatusBadge({ assessment }: { assessment: CareAssessment }) {
  const styles = {
    attention: "border-amber-200 bg-amber-50 text-amber-800",
    care: "border-red-200 bg-red-50 text-red-700",
    good: "border-emerald-200 bg-emerald-50 text-emerald-700",
    none: "border-slate-200 bg-slate-50 text-slate-600",
  } satisfies Record<CareAssessment["severity"], string>;
  const labels = {
    attention: "관심",
    care: "돌봄 필요",
    good: "양호",
    none: "기록 없음",
  } satisfies Record<CareAssessment["severity"], string>;

  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full border px-2 py-1 text-xs font-medium ${styles[assessment.severity]}`}
    >
      {labels[assessment.severity]}
    </span>
  );
}

function FilterSelect({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  value: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <select
        className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        <option value="">전체</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function SortButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button className="inline-flex items-center gap-1 font-semibold hover:text-slate-950" onClick={onClick} type="button">
      {children}
    </button>
  );
}

function ProgressDetailModal({
  coachName,
  onClose,
  row,
  year,
}: {
  coachName: string | null;
  onClose: () => void;
  row: CoachMakerMoksilgiProgressRow;
  year: number;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-500">목실기 상세</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-950">{profileName(row)}</h2>
            <p className="mt-1 text-sm text-slate-500">{displayText(row.email)}</p>
          </div>
          <button
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={onClose}
            type="button"
          >
            닫기
          </button>
        </div>

        <dl className="mt-6 grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <DetailItem label="국가" value={displayText(countryLabel(row))} />
          <DetailItem label="지역/도시" value={displayText(rowRegion(row))} />
          <DetailItem label="소속 기관/교회" value={displayText(rowOrganizationChurch(row))} />
          <DetailItem label="그룹/팀/목장" value={displayText(rowGroup(row))} />
          <DetailItem label="직책/직분" value={displayText(rowMinistryPosition(row))} />
          <DetailItem label="세대" value={displayText(rowGeneration(row))} />
          <DetailItem label="코칭 역할" value={displayText(rowCoachingRole(row))} />
          <DetailItem label="담당 코치" value={displayText(coachName)} />
        </dl>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                <th className="px-3 py-2">월</th>
                {MONTHS.map((month) => (
                  <th className="px-3 py-2 text-right" key={month}>
                    {month}월
                  </th>
                ))}
                <th className="px-3 py-2 text-right">현재 평균</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-100">
                <th className="px-3 py-2 text-left font-medium">성취율</th>
                {MONTHS.map((month) => (
                  <td className="px-3 py-2 text-right" key={month}>
                    {formatPercent(monthRate(row, month))}
                  </td>
                ))}
                <td className="px-3 py-2 text-right font-semibold">
                  {formatPercent(upToCurrentRate(row, year))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 font-medium text-slate-800">{value}</dd>
    </div>
  );
}

function ActionNoteModal({
  onClose,
  row,
}: {
  onClose: () => void;
  row: CoachMakerMoksilgiProgressRow;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = note.trim();

    if (!trimmed) {
      setMessage("메모 내용을 입력해 주세요.");
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch("/api/coach-maker/action-notes", {
        body: JSON.stringify({
          action_type: "coaching_encouragement",
          note: trimmed,
          priority: "normal",
          region: rowRegion(row),
          target_name: profileName(row),
          target_type: "attention_target",
          target_user_id: row.profile_id,
          team_name: rowGroup(row),
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;

      if (!response.ok) {
        setMessage(payload?.message ?? "관리 메모를 저장하지 못했습니다.");
        return;
      }

      setMessage(payload?.message ?? "관리 메모가 저장되었습니다.");
      setNote("");
    } catch {
      setMessage("관리 메모를 저장하는 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <form className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl" onSubmit={handleSubmit}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-500">내부 관리 메모</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">{profileName(row)}</h2>
            <p className="mt-1 text-sm text-slate-500">
              코치이 본인에게 공개되는 피드백이 아니라 관리자/코치 내부 관리 메모입니다.
            </p>
          </div>
          <button className="text-sm font-medium text-slate-500 hover:text-slate-900" onClick={onClose} type="button">
            닫기
          </button>
        </div>
        <textarea
          className="mt-5 min-h-32 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          maxLength={4000}
          onChange={(event) => setNote(event.target.value)}
          placeholder="필요한 돌봄 내용이나 다음 조치를 기록해 주세요."
          value={note}
        />
        {message ? <p className="mt-3 text-sm text-slate-600">{message}</p> : null}
        <div className="mt-5 flex justify-end gap-2">
          <button
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            disabled={submitting}
            onClick={onClose}
            type="button"
          >
            취소
          </button>
          <button
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={submitting}
            type="submit"
          >
            {submitting ? "저장 중..." : "메모 저장"}
          </button>
        </div>
      </form>
    </div>
  );
}

function RelationshipProgressTable({
  rows,
  year,
}: {
  rows: CoachMakerMoksilgiRelationshipProgressRow[];
  year: number;
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-md border border-slate-200 bg-white px-4 py-6 text-center text-slate-500">
        코치-코치이 관계별 목실기 데이터가 없습니다.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
      <table className="w-full min-w-[1500px] border-collapse text-sm">
        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-3">코치명</th>
            <th className="px-3 py-3">코치이명</th>
            <th className="px-3 py-3">관계상태</th>
            <th className="px-3 py-3">국가</th>
            <th className="px-3 py-3">지역/도시</th>
            <th className="px-3 py-3">소속 기관/교회</th>
            <th className="px-3 py-3">그룹/팀/목장</th>
            <th className="px-3 py-3">직책/직분</th>
            <th className="px-3 py-3">세대</th>
            <th className="px-3 py-3">코칭 역할</th>
            {MONTHS.map((month) => (
              <th className="px-3 py-3 text-right" key={month}>
                {month}월
              </th>
            ))}
            <th className="px-3 py-3 text-right">현재까지 평균</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => {
            const currentRates = MONTHS.slice(0, currentMonthCutoff(year))
              .map((month) => monthRate(row, month))
              .filter((value): value is number => value !== null);
            const currentAverage = average(currentRates);

            return (
              <tr className="align-top hover:bg-slate-50/70" key={row.relationship_id}>
                <td className="px-3 py-3 font-medium text-slate-900">
                  {personName({
                    displayName: row.coach_display_name,
                    email: row.coach_email,
                    fullName: row.coach_full_name,
                  })}
                </td>
                <td className="px-3 py-3">
                  <p className="font-medium text-slate-900">
                    {personName({
                      displayName: row.coachee_display_name,
                      email: row.coachee_email,
                      fullName: row.coachee_full_name,
                    })}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{displayText(row.coachee_email)}</p>
                </td>
                <td className="px-3 py-3">{displayText(row.relationship_status)}</td>
                <td className="px-3 py-3">{displayText(relationshipCountryLabel(row))}</td>
                <td className="px-3 py-3">{displayText(row.coachee_region_name)}</td>
                <td className="px-3 py-3">{displayText(relationshipOrganizationChurch(row))}</td>
                <td className="px-3 py-3">{displayText(row.coachee_group_name)}</td>
                <td className="px-3 py-3">{displayText(row.coachee_ministry_position)}</td>
                <td className="px-3 py-3">{displayText(relationshipGeneration(row))}</td>
                <td className="px-3 py-3">{displayText(relationshipCoachingRole(row))}</td>
                {MONTHS.map((month) => (
                  <td className="px-3 py-3 text-right tabular-nums" key={month}>
                    {formatPercent(monthRate(row, month))}
                  </td>
                ))}
                <td className="px-3 py-3 text-right font-semibold tabular-nums">
                  {formatPercent(currentAverage)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CareNeededTable({
  onCreateNote,
  rows,
  year,
}: {
  onCreateNote: (row: CoachMakerMoksilgiProgressRow) => void;
  rows: CoachMakerMoksilgiProgressRow[];
  year: number;
}) {
  const careRows = useMemo(
    () =>
      rows
        .map((row) => ({ assessment: assessCare(row, year), row }))
        .filter(({ assessment }) => assessment.severity === "care" || assessment.severity === "none")
        .sort((a, b) => {
          if (a.assessment.severity === "none" && b.assessment.severity !== "none") return -1;
          if (a.assessment.severity !== "none" && b.assessment.severity === "none") return 1;

          const missingA = a.assessment.missingMonths ?? Number.MAX_SAFE_INTEGER;
          const missingB = b.assessment.missingMonths ?? Number.MAX_SAFE_INTEGER;
          if (missingA !== missingB) return missingB - missingA;

          const avgA = a.assessment.averageRate ?? -1;
          const avgB = b.assessment.averageRate ?? -1;
          if (avgA !== avgB) return avgA - avgB;

          return profileName(a.row).localeCompare(profileName(b.row));
        }),
    [rows, year],
  );

  if (careRows.length === 0) {
    return (
      <p className="rounded-md border border-slate-200 bg-white px-4 py-6 text-center text-slate-500">
        현재 돌봄 필요자가 없습니다.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
      <table className="w-full min-w-[1200px] border-collapse text-sm">
        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-3">이름</th>
            <th className="px-3 py-3">소속 구조</th>
            <th className="px-3 py-3">직책/세대</th>
            <th className="px-3 py-3 text-right">현재까지 평균 성취율</th>
            <th className="px-3 py-3">최근 기록 월</th>
            <th className="px-3 py-3">미작성 개월 수</th>
            <th className="px-3 py-3">돌봄 사유</th>
            <th className="px-3 py-3">권장 조치</th>
            <th className="px-3 py-3">메모</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {careRows.map(({ assessment, row }) => (
            <tr className="align-top hover:bg-slate-50/70" key={row.profile_id}>
              <td className="px-3 py-3">
                <p className="font-medium text-slate-900">{profileName(row)}</p>
                <p className="mt-1 text-xs text-slate-500">{displayText(row.email)}</p>
              </td>
              <td className="px-3 py-3">
                <p>{displayText(countryLabel(row))}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {displayText(rowRegion(row))} · {displayText(rowOrganizationChurch(row))} ·{" "}
                  {displayText(rowGroup(row))}
                </p>
              </td>
              <td className="px-3 py-3">
                <p>{displayText(rowMinistryPosition(row))}</p>
                <p className="mt-1 text-xs text-slate-500">{displayText(rowGeneration(row))}</p>
              </td>
              <td className="px-3 py-3 text-right font-semibold tabular-nums">
                {assessment.averageRate === null ? "기록 없음" : formatPercent(assessment.averageRate)}
              </td>
              <td className="px-3 py-3">{formatMonthLabel(assessment.recentRecordMonth)}</td>
              <td className="px-3 py-3">
                {assessment.recentRecordMonth === null
                  ? "전체 미작성"
                  : assessment.missingMonths ?? "확인 필요"}
              </td>
              <td className="px-3 py-3">
                <ul className="space-y-1">
                  {assessment.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </td>
              <td className="px-3 py-3">
                <ul className="space-y-1">
                  {[...new Set(assessment.actions)].map((action) => (
                    <li key={action}>{action}</li>
                  ))}
                </ul>
              </td>
              <td className="px-3 py-3">
                <button
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  onClick={() => onCreateNote(row)}
                  type="button"
                >
                  메모 작성
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MoksilgiProgressClientTable({
  initialMemberId,
  relationshipRows,
  rows,
  year,
}: {
  initialMemberId: string | null;
  relationshipRows: CoachMakerMoksilgiRelationshipProgressRow[];
  rows: CoachMakerMoksilgiProgressRow[];
  year: number;
}) {
  const { t } = useI18n();
  const [coachFilter, setCoachFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [detailRow, setDetailRow] = useState<CoachMakerMoksilgiProgressRow | null>(
    initialMemberId ? rows.find((row) => row.profile_id === initialMemberId) ?? null : null,
  );
  const [generationFilter, setGenerationFilter] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [ministryFilter, setMinistryFilter] = useState("");
  const [noteTargetRow, setNoteTargetRow] = useState<CoachMakerMoksilgiProgressRow | null>(null);
  const [organizationFilter, setOrganizationFilter] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  const [search, setSearch] = useState("");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [viewMode, setViewMode] = useState<ViewMode>("team");

  const coachNameByCoacheeId = useMemo(() => {
    const map = new Map<string, string>();

    for (const relationship of relationshipRows) {
      map.set(
        relationship.coachee_profile_id,
        personName({
          displayName: relationship.coach_display_name,
          email: relationship.coach_email,
          fullName: relationship.coach_full_name,
        }),
      );
    }

    return map;
  }, [relationshipRows]);

  const coachIdByCoacheeId = useMemo(() => {
    const map = new Map<string, string>();

    for (const relationship of relationshipRows) {
      map.set(relationship.coachee_profile_id, relationship.coach_profile_id);
    }

    return map;
  }, [relationshipRows]);

  const countryOptions = useMemo(() => buildIdOptions(rows), [rows]);
  const regionOptions = useMemo(() => buildOptions(rows.map(rowRegion)), [rows]);
  const organizationOptions = useMemo(
    () => buildOptions(rows.map(rowOrganizationChurch)),
    [rows],
  );
  const groupOptions = useMemo(() => buildOptions(rows.map(rowGroup)), [rows]);
  const ministryOptions = useMemo(() => buildOptions(rows.map(rowMinistryPosition)), [rows]);
  const generationOptions = useMemo(() => buildOptions(rows.map(rowGeneration)), [rows]);
  const coachOptions = useMemo(() => buildCoachOptions(relationshipRows), [relationshipRows]);

  const filteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    const filtered = rows.filter((row) => {
      const coachName = coachNameByCoacheeId.get(row.profile_id) ?? null;
      const coachId = coachIdByCoacheeId.get(row.profile_id) ?? "";
      const fields = [
        profileName(row),
        row.email,
        countryLabel(row),
        rowRegion(row),
        rowOrganizationChurch(row),
        rowGroup(row),
        rowMinistryPosition(row),
        rowGeneration(row),
        rowCoachingRole(row),
        coachName,
      ];

      if (normalizedSearch && !fields.some((field) => (field ?? "").toLowerCase().includes(normalizedSearch))) {
        return false;
      }

      return (
        (!countryFilter || row.country_id === countryFilter) &&
        (!regionFilter || normalizeOptionValue(rowRegion(row)) === regionFilter) &&
        (!organizationFilter || normalizeOptionValue(rowOrganizationChurch(row)) === organizationFilter) &&
        (!groupFilter || normalizeOptionValue(rowGroup(row)) === groupFilter) &&
        (!ministryFilter || normalizeOptionValue(rowMinistryPosition(row)) === ministryFilter) &&
        (!generationFilter || normalizeOptionValue(rowGeneration(row)) === generationFilter) &&
        (!coachFilter || coachId === coachFilter)
      );
    });

    return filtered.sort((a, b) => {
      let result = 0;

      if (sortKey === "name") result = compareText(profileName(a), profileName(b));
      if (sortKey === "country") result = compareText(countryLabel(a), countryLabel(b));
      if (sortKey === "region") result = compareText(rowRegion(a), rowRegion(b));
      if (sortKey === "coach") {
        result = compareText(coachNameByCoacheeId.get(a.profile_id), coachNameByCoacheeId.get(b.profile_id));
      }
      if (sortKey === "achievement") result = upToCurrentRate(a, year) - upToCurrentRate(b, year);
      if (sortKey === "care") {
        result = assessCare(a, year).severity.localeCompare(assessCare(b, year).severity);
      }

      return sortDirection === "asc" ? result : -result;
    });
  }, [
    coachFilter,
    coachIdByCoacheeId,
    coachNameByCoacheeId,
    countryFilter,
    generationFilter,
    groupFilter,
    ministryFilter,
    organizationFilter,
    regionFilter,
    rows,
    search,
    sortDirection,
    sortKey,
    year,
  ]);

  const filteredProfileIds = useMemo(
    () => new Set(filteredRows.map((row) => row.profile_id)),
    [filteredRows],
  );
  const filteredRelationshipRows = useMemo(
    () =>
      relationshipRows.filter((row) => filteredProfileIds.has(row.coachee_profile_id)),
    [filteredProfileIds, relationshipRows],
  );

  function resetFilters() {
    setCoachFilter("");
    setCountryFilter("");
    setGenerationFilter("");
    setGroupFilter("");
    setMinistryFilter("");
    setOrganizationFilter("");
    setRegionFilter("");
    setSearch("");
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection("asc");
  }

  function exportVisibleRowsToCsv() {
    const header = [
      "이름",
      "국가",
      "지역/도시",
      "소속 기관/교회",
      "그룹/팀/목장",
      "직책/직분",
      "세대",
      "코칭 역할",
      "담당 코치",
      "목실기 성취율",
      "관심 상태",
      ...MONTHS.map((month) => `${month}월`),
      "12개월 누적",
    ];

    downloadCsv(`moksilgi-progress-${year}.csv`, [
      header,
      ...filteredRows.map((row) => {
        const assessment = assessCare(row, year);

        return [
          profileName(row),
          displayText(countryLabel(row)),
          displayText(rowRegion(row)),
          displayText(rowOrganizationChurch(row)),
          displayText(rowGroup(row)),
          displayText(rowMinistryPosition(row)),
          displayText(rowGeneration(row)),
          displayText(rowCoachingRole(row)),
          displayText(coachNameByCoacheeId.get(row.profile_id)),
          formatPercent(upToCurrentRate(row, year)),
          assessment.severity === "care"
            ? "돌봄 필요"
            : assessment.severity === "attention"
              ? "관심"
              : assessment.severity === "good"
                ? "양호"
                : "기록 없음",
          ...MONTHS.map((month) => formatPercent(monthRate(row, month))),
          formatPercent(row.cumulative_rate),
        ];
      }),
    ]);
  }

  return (
    <section className="print-section mt-8 space-y-5">
      <div className="print-hidden flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap gap-2">
          {[
            { label: "지역/팀별 보기", mode: "team" as const },
            { label: "코치-코치이 관계별 보기", mode: "relationship" as const },
            { label: "돌봄 필요자 보기", mode: "care" as const },
          ].map((item) => (
            <button
              className={`rounded-md px-3 py-2 text-sm font-medium ${
                viewMode === item.mode
                  ? "bg-slate-900 text-white"
                  : "border border-slate-300 text-slate-700 hover:bg-slate-50"
              }`}
              key={item.mode}
              onClick={() => setViewMode(item.mode)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
        <button
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          onClick={exportVisibleRowsToCsv}
          type="button"
        >
          CSV 내보내기
        </button>
      </div>

      <div className="print-hidden rounded-md border border-slate-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          <label className="block xl:col-span-2">
            <span className="text-xs font-medium text-slate-600">{t("common.search", "검색")}</span>
            <input
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="이름, 국가, 소속, 직분, 코치 검색"
              type="search"
              value={search}
            />
          </label>
          <FilterSelect label="국가" onChange={setCountryFilter} options={countryOptions} value={countryFilter} />
          <FilterSelect label="지역/도시" onChange={setRegionFilter} options={regionOptions} value={regionFilter} />
          <FilterSelect label="소속 기관/교회" onChange={setOrganizationFilter} options={organizationOptions} value={organizationFilter} />
          <FilterSelect label="그룹/팀/목장" onChange={setGroupFilter} options={groupOptions} value={groupFilter} />
          <FilterSelect label="직책/직분" onChange={setMinistryFilter} options={ministryOptions} value={ministryFilter} />
          <FilterSelect label="세대" onChange={setGenerationFilter} options={generationOptions} value={generationFilter} />
          <FilterSelect label="담당 코치" onChange={setCoachFilter} options={coachOptions} value={coachFilter} />
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
          <p>
            {filteredRows.length}명 표시 / 전체 {rows.length}명
          </p>
          <button
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={resetFilters}
            type="button"
          >
            필터 초기화
          </button>
        </div>
      </div>

      {viewMode === "relationship" ? (
        <RelationshipProgressTable rows={filteredRelationshipRows} year={year} />
      ) : viewMode === "care" ? (
        <CareNeededTable onCreateNote={setNoteTargetRow} rows={filteredRows} year={year} />
      ) : filteredRows.length === 0 ? (
        <p className="rounded-md border border-slate-200 bg-white px-4 py-6 text-center text-slate-500">
          선택한 조건에 해당하는 목실기 성취 현황이 없습니다.
        </p>
      ) : (
        <div className="print-card overflow-x-auto rounded-md border border-slate-200 bg-white">
          <table className="w-full min-w-[1900px] border-collapse text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-3">
                  <SortButton onClick={() => toggleSort("name")}>이름</SortButton>
                </th>
                <th className="px-3 py-3">
                  <SortButton onClick={() => toggleSort("country")}>국가</SortButton>
                </th>
                <th className="px-3 py-3">
                  <SortButton onClick={() => toggleSort("region")}>지역/도시</SortButton>
                </th>
                <th className="px-3 py-3">소속 기관/교회</th>
                <th className="px-3 py-3">그룹/팀/목장</th>
                <th className="px-3 py-3">직책/직분</th>
                <th className="px-3 py-3">세대</th>
                <th className="px-3 py-3">코칭 역할</th>
                <th className="px-3 py-3">
                  <SortButton onClick={() => toggleSort("coach")}>담당 코치</SortButton>
                </th>
                <th className="px-3 py-3 text-right">
                  <SortButton onClick={() => toggleSort("achievement")}>목실기 성취율</SortButton>
                </th>
                <th className="px-3 py-3">
                  <SortButton onClick={() => toggleSort("care")}>관심 상태</SortButton>
                </th>
                {MONTHS.map((month) => (
                  <th className="px-3 py-3 text-right" key={month}>
                    {month}월
                  </th>
                ))}
                <th className="px-3 py-3 text-right">12개월 누적</th>
                <th className="px-3 py-3">상세</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.map((row) => {
                const assessment = assessCare(row, year);

                return (
                  <tr className="align-top hover:bg-slate-50/70" key={row.plan_id}>
                    <td className="px-3 py-3">
                      <p className="font-medium text-slate-900">{profileName(row)}</p>
                      <p className="mt-1 text-xs text-slate-500">{displayText(row.email)}</p>
                    </td>
                    <td className="px-3 py-3">{displayText(countryLabel(row))}</td>
                    <td className="px-3 py-3">{displayText(rowRegion(row))}</td>
                    <td className="px-3 py-3">{displayText(rowOrganizationChurch(row))}</td>
                    <td className="px-3 py-3">{displayText(rowGroup(row))}</td>
                    <td className="px-3 py-3">{displayText(rowMinistryPosition(row))}</td>
                    <td className="px-3 py-3">{displayText(rowGeneration(row))}</td>
                    <td className="px-3 py-3">{displayText(rowCoachingRole(row))}</td>
                    <td className="px-3 py-3">{displayText(coachNameByCoacheeId.get(row.profile_id))}</td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums">
                      {formatPercent(upToCurrentRate(row, year))}
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge assessment={assessment} />
                    </td>
                    {MONTHS.map((month) => (
                      <td className="px-3 py-3 text-right tabular-nums" key={month}>
                        {formatPercent(monthRate(row, month))}
                      </td>
                    ))}
                    <td className="px-3 py-3 text-right font-semibold tabular-nums">
                      {formatPercent(row.cumulative_rate)}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          onClick={() => setDetailRow(row)}
                          type="button"
                        >
                          상세
                        </button>
                        <Link
                          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          href={`/coach-maker/moksilgi-progress/${row.plan_id}?year=${year}`}
                        >
                          기록 보기
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {detailRow ? (
        <ProgressDetailModal
          coachName={coachNameByCoacheeId.get(detailRow.profile_id) ?? null}
          onClose={() => setDetailRow(null)}
          row={detailRow}
          year={year}
        />
      ) : null}
      {noteTargetRow ? (
        <ActionNoteModal onClose={() => setNoteTargetRow(null)} row={noteTargetRow} />
      ) : null}
    </section>
  );
}
