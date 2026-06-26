"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { I18nText } from "@/lib/i18n/I18nProvider";
import type {
  MoksilgiMonthlyDetailGoal,
  MoksilgiMonthlyRecord,
} from "@/lib/api/my-coaching/moksilgi-monthly";
import type { Json } from "@/types/database";

const INPUT_CLASS =
  "mt-1.5 w-full rounded-control border border-line-base bg-surface-card px-3 py-2 text-ink-base outline-none focus:border-brand-600";
const LABEL_CLASS = "text-sm font-medium text-ink-muted";

function asObject(value: Json): Record<string, Json> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }

  const result: Record<string, Json> = {};
  for (const [key, item] of Object.entries(value)) {
    if (item !== undefined) {
      result[key] = item;
    }
  }
  return result;
}

function boolMap(value: Json) {
  const object = asObject(value);
  const result = new Map<string, boolean>();
  for (const [key, item] of Object.entries(object)) {
    result.set(key, item === true);
  }
  return result;
}

function numberMap(value: Json) {
  const object = asObject(value);
  const result = new Map<string, number>();
  for (const [key, item] of Object.entries(object)) {
    result.set(key, typeof item === "number" ? item : 0);
  }
  return result;
}

function strategyList(value: Json) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function formatPercent(value: number | null | undefined) {
  const numeric = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return `${numeric.toFixed(1)}%`;
}

function rateTone(value: number | null | undefined): "success" | "info" | "warning" {
  const numeric = typeof value === "number" && Number.isFinite(value) ? value : 0;
  if (numeric >= 80) return "success";
  if (numeric >= 50) return "info";
  return "warning";
}

function displayValue(value: string | number | null | undefined) {
  if (value === null || value === undefined) return "-";
  if (typeof value === "number") return String(value);
  return value.trim().length > 0 ? value : "-";
}

function MeasurementLabel({ type }: { type: string }) {
  switch (type) {
    case "daily_check":
      return <I18nText k="myCoaching.moksilgi.measurement.dailyCheck" fallback="매일 실행 확인" />;
    case "weekly_count":
      return <I18nText k="myCoaching.moksilgi.measurement.weeklyCount" fallback="매주 실행 확인" />;
    case "monthly_number":
      return <I18nText k="myCoaching.moksilgi.measurement.monthlyNumber" fallback="월간 수치 입력" />;
    case "monthly_comment":
      return <I18nText k="myCoaching.moksilgi.measurement.monthlyComment" fallback="COMMENT" />;
    default:
      return type;
  }
}

function unitLabel(unit: string | null) {
  const normalized = unit?.trim();

  if (!normalized) return "실행량";
  if (normalized === "일") return "일 수";
  if (normalized === "권") return "권 수";
  if (normalized === "회" || normalized === "번") return "횟 수";
  if (normalized === "시간") return "시간";
  if (normalized === "명") return "명 수";
  return normalized;
}

function checkLabel(measurementType: string) {
  switch (measurementType) {
    case "daily_check":
      return <I18nText k="myCoaching.moksilgi.monthly.dailyCheckHeader" fallback="매일 실행 확인 V" />;
    case "weekly_count":
      return <I18nText k="myCoaching.moksilgi.monthly.weeklyCheckHeader" fallback="매주 실행 확인 V" />;
    case "monthly_number":
    case "monthly_comment":
      return "COMMENT";
    default:
      return "COMMENT";
  }
}

function actualDisplay({
  detailGoal,
  record,
  dailyChecks,
  weeklyCounts,
}: {
  detailGoal: MoksilgiMonthlyDetailGoal;
  record: MoksilgiMonthlyRecord | undefined;
  dailyChecks: Map<string, boolean>;
  weeklyCounts: Map<string, number>;
}) {
  const unit = detailGoal.unit?.trim() ?? "";

  if (detailGoal.measurement_type === "daily_check") {
    const checkedCount = [...dailyChecks.values()].filter(Boolean).length;
    return `${checkedCount}${unit || "일"}`;
  }

  if (detailGoal.measurement_type === "weekly_count") {
    const total = [...weeklyCounts.values()].reduce((sum, value) => sum + value, 0);
    return `${total}${unit || "회"}`;
  }

  if (record?.actual_value !== null && record?.actual_value !== undefined) {
    return `${record.actual_value}${unit ? unit : ""}`;
  }

  return "-";
}

function StatChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-control bg-surface-sunken px-2.5 py-1 text-xs font-medium text-ink-base">
      {children}
    </span>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();

  return (
    <Button disabled={pending} icon="save" type="submit" variant="primary">
      {pending ? (
        <I18nText k="myCoaching.moksilgi.monthly.saving" fallback="저장 중..." />
      ) : (
        <I18nText k="myCoaching.moksilgi.monthly.save" fallback="저장" />
      )}
    </Button>
  );
}

export function MoksilgiMonthlyRecordForm({
  action,
  detailGoal,
  record,
  year,
  month,
}: {
  action: (formData: FormData) => void | Promise<void>;
  detailGoal: MoksilgiMonthlyDetailGoal;
  record: MoksilgiMonthlyRecord | undefined;
  year: number;
  month: number;
}) {
  const dailyChecks = boolMap(record?.daily_checks_json ?? {});
  const weeklyCounts = numberMap(record?.weekly_counts_json ?? {});
  const strategies = strategyList(detailGoal.strategies_json);
  const unitHeader = unitLabel(detailGoal.unit);
  const actionHeader = checkLabel(detailGoal.measurement_type);
  const totalDays = daysInMonth(year, month);
  const checkedDays = [...dailyChecks.values()].filter(Boolean).length;
  const currentActualDisplay = actualDisplay({
    detailGoal,
    record,
    dailyChecks,
    weeklyCounts,
  });
  const isMonthly =
    detailGoal.measurement_type === "monthly_number" ||
    detailGoal.measurement_type === "monthly_comment";

  return (
    <form
      action={action}
      className="space-y-4 rounded-xl border border-line-base bg-surface-app p-4"
    >
      <input name="detail_goal_id" type="hidden" value={detailGoal.id} />
      <input name="year" type="hidden" value={year} />
      <input name="month" type="hidden" value={month} />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="font-semibold text-ink-strong">{detailGoal.title}</h4>
          <p className="mt-1 text-xs leading-5 text-ink-muted">
            <I18nText k="myCoaching.moksilgi.detailGoal.monthlyTarget" fallback="월 목표량" />:{" "}
            {displayValue(detailGoal.monthly_target)} ·{" "}
            <I18nText k="myCoaching.moksilgi.detailGoal.yearlyTarget" fallback="연간 목표량" />:{" "}
            {displayValue(detailGoal.annual_target)} ·{" "}
            <I18nText k="myCoaching.moksilgi.detailGoal.unit" fallback="단위" />:{" "}
            {displayValue(detailGoal.unit)}
          </p>
          <p className="mt-0.5 text-xs leading-5 text-ink-muted">
            <I18nText k="myCoaching.moksilgi.detailGoal.measurementMethod" fallback="측정 방식" />:{" "}
            <MeasurementLabel type={detailGoal.measurement_type} />
          </p>
          {strategies.length > 0 ? (
            <p className="mt-0.5 text-xs leading-5 text-ink-muted">
              <I18nText k="myCoaching.moksilgi.monthly.actionStrategies" fallback="실행전략" />:{" "}
              {strategies.join(", ")}
            </p>
          ) : null}
        </div>
        <Badge tone={rateTone(record?.achievement_rate)}>
          <I18nText k="myCoaching.moksilgi.monthly.currentAchievement" fallback="현재 달성률" />{" "}
          {formatPercent(record?.achievement_rate)}
        </Badge>
      </div>

      {detailGoal.measurement_type === "daily_check" ? (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-ink-muted">{actionHeader}</span>
            <span className="text-xs font-semibold text-brand-600">
              {checkedDays} / {totalDays}
            </span>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: totalDays }, (_, index) => index + 1).map((day) => (
              <label className="relative block" key={day}>
                <input
                  aria-label={`${day}일`}
                  className="peer sr-only"
                  defaultChecked={dailyChecks.get(String(day)) ?? false}
                  name={`day_${day}`}
                  type="checkbox"
                />
                <span className="flex h-9 items-center justify-center rounded-control border border-line-base bg-surface-card text-xs text-ink-muted transition-colors peer-checked:border-brand-600 peer-checked:bg-brand-600 peer-checked:font-medium peer-checked:text-white peer-disabled:opacity-60">
                  {day}
                </span>
              </label>
            ))}
          </div>
        </div>
      ) : null}

      {detailGoal.measurement_type === "weekly_count" ? (
        <div>
          <span className="text-xs font-medium text-ink-muted">{actionHeader}</span>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {[
              { fallback: "첫주", key: "myCoaching.moksilgi.monthly.week1" },
              { fallback: "둘째주", key: "myCoaching.moksilgi.monthly.week2" },
              { fallback: "셋째주", key: "myCoaching.moksilgi.monthly.week3" },
              { fallback: "넷째주", key: "myCoaching.moksilgi.monthly.week4" },
              { fallback: "다섯째주", key: "myCoaching.moksilgi.monthly.week5" },
            ].map((label, index) => (
              <label className="block" key={label.key}>
                <span className="text-xs font-medium text-ink-muted">
                  <I18nText k={label.key} fallback={label.fallback} />
                </span>
                <input
                  className={INPUT_CLASS}
                  defaultValue={weeklyCounts.get(`week${index + 1}`) ?? 0}
                  min={0}
                  name={`week${index + 1}`}
                  step="any"
                  type="number"
                />
              </label>
            ))}
          </div>
        </div>
      ) : null}

      {isMonthly ? (
        <div className="grid gap-3">
          <label className="block">
            <span className={LABEL_CLASS}>{unitHeader}</span>
            <input
              className={INPUT_CLASS}
              defaultValue={record?.actual_value ?? ""}
              name="actual_value"
              step="any"
              type="number"
            />
          </label>
          <label className="block">
            <span className={LABEL_CLASS}>
              <I18nText k="myCoaching.moksilgi.monthly.comment" fallback="코멘트" />
            </span>
            <textarea
              className={INPUT_CLASS}
              defaultValue={record?.comment ?? ""}
              maxLength={2000}
              name="comment"
              rows={3}
            />
          </label>
        </div>
      ) : null}

      {!isMonthly ? (
        <div className="flex flex-wrap gap-2">
          <StatChip>
            {unitHeader}: {currentActualDisplay}
          </StatChip>
          <StatChip>
            <I18nText k="myCoaching.moksilgi.monthly.achievementRate" fallback="달성률" />{" "}
            {formatPercent(record?.achievement_rate)}
          </StatChip>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={LABEL_CLASS}>
            <I18nText
              k="myCoaching.moksilgi.monthly.targetValue"
              fallback="월 목표량 / 현재 목표량 수정"
            />
          </span>
          <input
            className={INPUT_CLASS}
            defaultValue={record?.target_value ?? detailGoal.monthly_target ?? ""}
            name="target_value"
            step="any"
            type="number"
          />
        </label>
        {!isMonthly ? (
          <label className="block">
            <span className={LABEL_CLASS}>
              <I18nText k="myCoaching.moksilgi.monthly.comment" fallback="코멘트" />
            </span>
            <textarea
              className={INPUT_CLASS}
              defaultValue={record?.comment ?? ""}
              maxLength={2000}
              name="comment"
              rows={3}
            />
          </label>
        ) : null}
      </div>

      <SaveButton />
    </form>
  );
}
