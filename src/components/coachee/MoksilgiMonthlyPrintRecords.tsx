import type {
  MoksilgiMonthlyArea,
  MoksilgiMonthlyDetailGoal,
  MoksilgiMonthlyRecord,
} from "@/lib/api/my-coaching/moksilgi-monthly";
import type { Json } from "@/types/database";

/**
 * 월별 목실기 "실행 기록" 인쇄 전용 표.
 *
 * 화면에서는 목표 카드가 접힌 <details>이고 실적·코멘트가 <input>/<textarea> 안에 있어
 * 인쇄물에 전혀 나오지 않는다(공용 인쇄 CSS가 입력 요소를 숨김).
 * 목실기 기획안 페이지의 MoksilgiPrintSummary와 동일한 패턴으로,
 * 화면 UI는 그대로 두고 인쇄 전용 텍스트 블록을 별도로 렌더한다.
 */

const MEASUREMENT_LABELS: Record<string, string> = {
  daily_check: "매일 실행 확인",
  weekly_count: "매주 실행 확인",
  monthly_number: "월간 수치 입력",
  monthly_comment: "COMMENT",
};

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

function countChecked(value: Json) {
  return Object.values(asObject(value)).filter((item) => item === true).length;
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function annualRate(
  goal: MoksilgiMonthlyDetailGoal,
  record: MoksilgiMonthlyRecord | undefined,
) {
  if (
    typeof goal.annual_target !== "number" ||
    goal.annual_target <= 0 ||
    typeof record?.actual_value !== "number" ||
    !Number.isFinite(record.actual_value)
  ) {
    return 0;
  }

  return (Math.max(0, record.actual_value) / goal.annual_target) * 100;
}

function actualText(
  goal: MoksilgiMonthlyDetailGoal,
  record: MoksilgiMonthlyRecord | undefined,
) {
  if (typeof record?.actual_value !== "number") {
    return "미기록";
  }

  const unit = goal.unit?.trim() ?? "";
  return `${record.actual_value}${unit}`;
}

function targetText(value: number | null) {
  return typeof value === "number" ? String(value) : "-";
}

function executionText(
  goal: MoksilgiMonthlyDetailGoal,
  record: MoksilgiMonthlyRecord | undefined,
  year: number,
  month: number,
) {
  if (goal.measurement_type === "daily_check") {
    const checked = record ? countChecked(record.daily_checks_json) : 0;
    return `${checked} / ${daysInMonth(year, month)}일`;
  }

  if (goal.measurement_type === "weekly_count") {
    const counts = record ? asObject(record.weekly_counts_json) : {};
    const weeks = [1, 2, 3, 4, 5].map((week) => {
      const value = counts[`week${week}`];
      return typeof value === "number" ? value : 0;
    });
    return weeks.join(" · ");
  }

  return "-";
}

export function MoksilgiMonthlyPrintRecords({
  areas,
  detailGoals,
  month,
  records,
  year,
}: {
  areas: MoksilgiMonthlyArea[];
  detailGoals: MoksilgiMonthlyDetailGoal[];
  month: number;
  records: MoksilgiMonthlyRecord[];
  year: number;
}) {
  const recordByGoalId = new Map(
    records.map((record) => [record.detail_goal_id, record]),
  );
  const blocks = areas
    .map((area) => ({
      area,
      goals: detailGoals.filter((goal) => goal.area_id === area.id),
    }))
    .filter((block) => block.goals.length > 0);

  if (blocks.length === 0) {
    return null;
  }

  return (
    <div aria-label="월별 실행 기록 인쇄본" className="print-only print-records">
      <h2 className="print-records-title">
        {year}년 {month}월 실행 기록
      </h2>
      {blocks.map(({ area, goals }) => (
        <div className="print-records-area" key={area.id}>
          <h3>
            목표 {area.sort_order}: {area.area_title}
          </h3>
          {/* 세부목표 제목을 영역 제목과 열 머리글(측정방식~달성률) 사이에 배치한다.
              세부목표가 여러 개인 영역(예: 지적 성장)은 세부목표별로 표를 따로 두어
              각 세부목표의 측정방식·연간목표·월목표·이달실적·실행현황·달성률을
              서로 섞이지 않게 개별 기록한다. */}
          {goals.map((goal) => {
            const record = recordByGoalId.get(goal.id);
            const comment = record?.comment;

            return (
              <div className="print-records-goal" key={goal.id}>
                <p className="print-records-goal-title">{goal.title}</p>
                <table>
                  <thead>
                    <tr>
                      <th scope="col">측정방식</th>
                      <th scope="col">연간목표</th>
                      <th scope="col">월 목표</th>
                      <th scope="col">이달 실적</th>
                      <th scope="col">실행 현황</th>
                      <th scope="col">달성률</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        {MEASUREMENT_LABELS[goal.measurement_type] ??
                          goal.measurement_type}
                      </td>
                      <td className="print-num">{targetText(goal.annual_target)}</td>
                      <td className="print-num">{targetText(goal.monthly_target)}</td>
                      <td className="print-num">{actualText(goal, record)}</td>
                      <td>{executionText(goal, record, year, month)}</td>
                      <td className="print-num">
                        {formatPercent(annualRate(goal, record))}
                      </td>
                    </tr>
                  </tbody>
                </table>
                {comment ? (
                  <p className="print-records-goal-comment">코멘트: {comment}</p>
                ) : null}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
