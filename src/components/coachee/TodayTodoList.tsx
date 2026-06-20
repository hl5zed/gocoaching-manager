"use client";

import { useRef } from "react";

/** 오늘 홈에서 보여줄 4영역 daily_check To-do 한 건. */
export type TodayTodo = {
  detailGoalId: string;
  title: string;
  areaKey: "spiritual" | "intellectual" | "physical" | "social";
  areaTitle: string;
  /** 오늘 체크 여부 */
  checkedToday: boolean;
  /** 오늘을 제외하고 현재 체크되어 있는 날짜들(저장 시 보존용) */
  otherCheckedDays: number[];
};

/** 4영역 도메인 색상 dot */
const AREA_DOT: Record<TodayTodo["areaKey"], string> = {
  spiritual: "bg-domain-spirit",
  intellectual: "bg-domain-intellect",
  physical: "bg-domain-body",
  social: "bg-domain-social",
};

const AREA_ORDER: TodayTodo["areaKey"][] = [
  "spiritual",
  "intellectual",
  "physical",
  "social",
];

type TodoActionProp = (formData: FormData) => void | Promise<void>;

/**
 * 오늘 실행 To-do 인라인 체크.
 * 저장은 상위에서 내려준 서버 액션(기존 월별 저장 로직 재사용)을 그대로 호출한다.
 * 단일 토글이 다른 날짜를 지우지 않도록, 이미 체크된 다른 날짜를 hidden 필드로 함께 제출한다.
 */
export function TodayTodoList({
  todos,
  year,
  month,
  today,
  action,
}: {
  todos: TodayTodo[];
  year: number;
  month: number;
  today: number;
  action: TodoActionProp;
}) {
  const total = todos.length;
  const done = todos.filter((todo) => todo.checkedToday).length;

  const groups = AREA_ORDER.map((key) => ({
    key,
    items: todos.filter((todo) => todo.areaKey === key),
  })).filter((group) => group.items.length > 0);

  return (
    <section className="rounded-card border border-line-base bg-surface-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-ink-base">오늘 할 일</p>
        <span className="text-xs font-semibold text-brand-600">
          {done} / {total} 완료
        </span>
      </div>
      <p className="mt-1 text-xs text-ink-muted">
        탭하면 바로 저장돼요. 코치도 실행 현황을 함께 확인해요.
      </p>

      <div className="mt-3 space-y-4">
        {groups.map((group) => (
          <div key={group.key}>
            <div className="mb-2 flex items-center gap-2">
              <span
                aria-hidden
                className={`h-2.5 w-2.5 rounded-full ${AREA_DOT[group.key]}`}
              />
              <span className="text-xs font-medium text-ink-muted">
                {group.items[0]?.areaTitle}
              </span>
            </div>
            <ul className="space-y-2">
              {group.items.map((todo) => (
                <li key={todo.detailGoalId}>
                  <TodoCheckItem
                    action={action}
                    month={month}
                    today={today}
                    todo={todo}
                    year={year}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function TodoCheckItem({
  todo,
  year,
  month,
  today,
  action,
}: {
  todo: TodayTodo;
  year: number;
  month: number;
  today: number;
  action: TodoActionProp;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form action={action} ref={formRef}>
      <input name="detail_goal_id" type="hidden" value={todo.detailGoalId} />
      <input name="year" type="hidden" value={year} />
      <input name="month" type="hidden" value={month} />
      {todo.otherCheckedDays.map((day) => (
        <input key={day} name={`day_${day}`} type="hidden" value="on" />
      ))}
      <label
        className={`flex min-h-[52px] cursor-pointer items-center gap-3 rounded-control border px-3 py-2 transition-colors ${
          todo.checkedToday
            ? "border-brand-600 bg-brand-50"
            : "border-line-base bg-surface-card"
        }`}
      >
        <input
          aria-label={todo.title}
          className="peer sr-only"
          defaultChecked={todo.checkedToday}
          name={`day_${today}`}
          onChange={() => formRef.current?.requestSubmit()}
          type="checkbox"
        />
        <span
          aria-hidden
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-line-base text-transparent peer-checked:border-brand-600 peer-checked:bg-brand-600 peer-checked:text-white"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            viewBox="0 0 24 24"
          >
            <path
              d="M5 13l4 4L19 7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span
          className={`text-sm ${
            todo.checkedToday ? "font-medium text-ink-base" : "text-ink-base"
          }`}
        >
          {todo.title}
        </span>
      </label>
    </form>
  );
}
