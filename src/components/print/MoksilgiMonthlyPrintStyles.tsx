"use client";

/**
 * 월별 목실기 출력 전용 인쇄 스타일.
 *
 * 공용 PrintPageButton의 인쇄 CSS는 모든 출력 페이지가 공유하므로 그대로 두고,
 * 이 페이지에만 붙는 `.print-monthly` 클래스로 범위를 좁혀 덮어쓴다.
 * 선택자는 `.print-root.print-monthly ...` 형태로 공용 규칙(`.print-root ...`)보다
 * 명시도가 높아 스타일 주입 순서와 무관하게 항상 우선한다.
 *
 * 기준값(덮어쓰기 전 인쇄 시점의 실제 값):
 * - 표: font 8.5px / padding 2px 4px  (공용 규칙)
 * - .mt-2 → 1px, .mt-3 → 2px          (공용 규칙이 압축)
 * - .space-y-4 → 16px, .space-y-3 → 12px, CardContent p-4 → 16px (공용 규칙 없음, 화면값 그대로)
 */
export function MoksilgiMonthlyPrintStyles() {
  return (
    <style jsx global>{`
      @media print {
        /* 페이지 전체를 감싸던 공용 section 프레임 제거 — 카드가 이미 경계를 만든다 */
        .print-root.print-monthly section {
          border: 0 !important;
          border-radius: 0 !important;
          margin: 0 !important;
        }

        /* ── 보고서 헤더 ── */
        .print-monthly .print-report-title {
          margin: 0 0 12px !important;
          padding: 11px 15px !important;
        }

        .print-monthly .print-report-title h1 {
          font-size: 16px !important;
          letter-spacing: -0.01em !important;
          margin: 0 0 7px !important;
        }

        .print-monthly .print-report-title p {
          font-size: 9.5px !important;
        }

        /* ── 세로 리듬 ── */
        /* 공용 규칙이 1~2px까지 조여 놓은 텍스트 간격을 읽기 좋은 수준으로 되돌린다 */
        .print-root.print-monthly .mt-2 {
          margin-top: 6px !important;
        }

        .print-root.print-monthly .mt-3 {
          margin-top: 8px !important;
        }

        /* 목표 카드 사이(12px)를 조금 더 벌린다 */
        .print-root.print-monthly .space-y-3 > * + * {
          margin-top: 14px !important;
        }

        /* 요청 사항: 현재 달성률 카드 + 목표1~5 카드(총 6개)를 1열 6행 대신 2열 3행으로 배치.
           space-y-3의 세로 margin은 grid gap과 겹치므로 이 컨테이너 안에서만 무효화한다. */
        .print-root.print-monthly .print-goal-grid {
          display: grid !important;
          grid-template-columns: repeat(2, 1fr) !important;
          gap: 5px !important;
        }

        .print-root.print-monthly .print-goal-grid > * + * {
          margin-top: 0 !important;
        }

        /* 요청 사항: 블록 사이 간격을 줄여 표까지 첫 페이지 안에서
           여백 없이 이어지게 한다 (기존 20px → 8px) */
        .print-root.print-monthly .space-y-4 > * + * {
          margin-top: 8px !important;
        }

        /* 요청 사항: 달성률 카드 + 목표 카드 6개(2열 3행)의 글자와 여백을 축소해
           표 앞까지 한 페이지 안에 담는다 */
        .print-root.print-monthly .print-goal-grid,
        .print-root.print-monthly .print-goal-grid * {
          font-size: 8px !important;
          line-height: 1.3 !important;
        }

        .print-root.print-monthly .print-goal-grid h3 {
          font-size: 9.5px !important;
          margin-top: 2px !important;
        }

        .print-root.print-monthly .print-goal-grid p {
          margin-top: 1px !important;
        }

        .print-root.print-monthly .print-goal-grid .text-lg {
          font-size: 11px !important;
        }

        .print-root.print-monthly .print-goal-grid .gap-4,
        .print-root.print-monthly .print-goal-grid .gap-3 {
          gap: 5px !important;
        }

        .print-root.print-monthly .print-goal-grid .h-20,
        .print-root.print-monthly .print-goal-grid .w-20 {
          height: 38px !important;
          width: 38px !important;
        }

        .print-root.print-monthly .print-goal-grid .h-3,
        .print-root.print-monthly .print-goal-grid .w-3 {
          height: 6px !important;
          width: 6px !important;
        }

        .print-root.print-monthly .print-goal-grid .h-2\.5 {
          height: 4px !important;
        }

        .print-root.print-monthly .print-goal-grid [class*="px-2.5"] {
          padding: 1px 5px !important;
        }

        /* 요청 사항: 달성률 카드의 텍스트 3줄(연도·월 / 현재 달성률 / 기록 영역)을
           2줄로 압축한다 — 연도·월과 현재 달성률을 한 줄로 합친다 */
        .print-root.print-monthly .print-goal-grid .gap-4 > div:last-child > p:nth-child(1),
        .print-root.print-monthly .print-goal-grid .gap-4 > div:last-child > p:nth-child(2) {
          display: inline !important;
          margin: 0 !important;
        }

        .print-root.print-monthly
          .print-goal-grid
          .gap-4
          > div:last-child
          > p:nth-child(2)::before {
          content: " · ";
        }

        .print-root.print-monthly .print-goal-grid .gap-4 > div:last-child > p:nth-child(3) {
          display: block !important;
          margin-top: 1px !important;
        }

        /* ── 카드 여백 (p-4 = 16px 기준) ── */
        .print-root.print-monthly .moksilgi-accordion > summary > div,
        .print-root.print-monthly .print-goal-grid > div > div {
          padding: 6px 9px !important;
        }

        /* 월별 요약 표를 감싸는 카드 여백은 유지하되 소폭만 줄인다 */
        .print-root.print-monthly > section > div > div {
          padding: 12px !important;
        }

        /* 접힌 아코디언의 펼침 화살표는 종이에서 의미가 없다 */
        .print-root.print-monthly .moksilgi-accordion summary svg {
          display: none !important;
        }

        /* ── 월별 요약 표 ── */
        .print-root.print-monthly table {
          font-size: 10pt !important;
          font-variant-numeric: tabular-nums !important;
          table-layout: fixed !important;
        }

        /* 요청 사항: 행 크기를 키워 A4 좌우 여백만큼만 아래쪽에 남도록 표를 페이지에 맞춰 채운다 */
        .print-root.print-monthly th,
        .print-root.print-monthly td {
          border-color: #e6ebf2 !important;
          line-height: 1.7 !important;
          padding: 11px 4px !important;
        }

        /* 요청 사항: 헤더 글자가 옆 칸으로 넘치지 않도록 칸 안에서 두 줄로 줄바꿈하고,
           헤더 칸에는 글자만 남기고 색상 점(•)은 숨긴다 */
        .print-root.print-monthly thead th {
          font-size: 10pt !important;
          line-height: 1.25 !important;
          overflow-wrap: normal !important;
          padding-bottom: 6px !important;
          padding-top: 6px !important;
          white-space: normal !important;
          word-break: keep-all !important;
        }

        .print-root.print-monthly thead th .rounded-full {
          display: none !important;
        }

        /* 요청 사항: "월" 열 폭을 확보하고, "현재 선택" 배지는 그 안에 들어가도록
           글자 크기를 줄인다(칸을 벗어나 옆으로 삐져나오는 문제 수정) */
        .print-root.print-monthly thead th:first-child,
        .print-root.print-monthly tbody th {
          width: 9% !important;
        }

        .print-root.print-monthly tbody th .rounded-full {
          border-width: 0 !important;
          display: block !important;
          font-size: 6.5px !important;
          margin: 2px auto 0 !important;
          padding: 1px 2px !important;
          white-space: nowrap !important;
          width: fit-content !important;
        }

        /* 요청 사항: 모든 셀 텍스트를 칸 내 중앙정렬로 표시한다 */
        .print-root.print-monthly td,
        .print-root.print-monthly th {
          text-align: center !important;
        }

        /* 8열을 눈으로 훑기 쉽도록 짝수 행에 옅은 음영 —
           선택 월(brand)과 누적 행(navy)의 강조색은 건드리지 않는다 */
        .print-root.print-monthly
          tbody
          tr:nth-of-type(even):not([class*="brand"]):not([class*="navy"]) {
          background: #f7f9fc !important;
        }

        .print-root.print-monthly tr[class*="navy"] th,
        .print-root.print-monthly tr[class*="navy"] td {
          border-color: #1d2b4f !important;
        }

        /* ── 인쇄 전용 실행 기록 표 (MoksilgiMonthlyPrintRecords) ── */
        .print-root.print-monthly .print-records {
          margin-top: 10px !important;
        }

        .print-root.print-monthly .print-records-title {
          border-bottom: 1.5px solid #1d2b4f !important;
          font-size: 12pt !important;
          font-weight: 700 !important;
          margin: 0 0 6px !important;
          padding-bottom: 3px !important;
          break-after: avoid;
          page-break-after: avoid;
        }

        /* 영역(목표) 구획 — 헤더가 다음 영역과 붙어 보이지 않도록 아래 여백만 둔다.
           세부목표가 여러 개면 안의 각 .print-records-goal 블록이 개별적으로 페이지 분리를 막는다. */
        .print-root.print-monthly .print-records-area {
          margin-bottom: 8px !important;
        }

        .print-root.print-monthly .print-records-area h3 {
          font-size: 10.5pt !important;
          font-weight: 700 !important;
          margin: 0 0 2px !important;
          break-after: avoid;
          page-break-after: avoid;
        }

        /* 세부목표 1건 = 제목 + 표 + (코멘트)를 하나의 블록으로 묶는다.
           제목이 영역 제목과 열 머리글(측정방식~달성률) 사이에 오도록 표 밖에 별도 줄로 둔다.
           영역에 세부목표가 여러 개면(예: 지적 성장) 이 블록이 세부목표 수만큼 반복되어
           각자의 측정방식·연간목표·월목표·이달실적·실행현황·달성률을 독립적으로 기록한다. */
        .print-root.print-monthly .print-records-goal {
          break-inside: avoid;
          margin-bottom: 6px !important;
          page-break-inside: avoid;
        }

        .print-root.print-monthly .print-records-goal-title {
          font-size: 9.5pt !important;
          font-weight: 700 !important;
          line-height: 1.3 !important;
          margin: 0 0 2px !important;
          white-space: normal !important;
          break-after: avoid;
          page-break-after: avoid;
        }

        /* 실행 기록 표는 월별 요약표와 달리 행을 늘리지 않는다 */
        .print-root.print-monthly .print-records table {
          font-size: 9pt !important;
          table-layout: auto !important;
        }

        /* 요청 사항: 측정방식~달성률 모든 칸(머리글 포함)을 동일하게 가운데 정렬한다 */
        .print-root.print-monthly .print-records th,
        .print-root.print-monthly .print-records td {
          line-height: 1.35 !important;
          padding: 4px 5px !important;
          text-align: center !important;
          vertical-align: middle !important;
        }

        .print-root.print-monthly .print-records .print-num {
          font-variant-numeric: tabular-nums !important;
          text-align: center !important;
          white-space: nowrap !important;
        }

        .print-root.print-monthly .print-records thead th {
          background: #f4f6fa !important;
          text-align: center !important;
          white-space: nowrap !important;
        }

        /* 코멘트: 코치이가 직접 쓴 문장이므로 본문 크기를 유지한다 */
        .print-root.print-monthly .print-records-goal-comment {
          font-size: 9pt !important;
          margin: 3px 0 0 !important;
          white-space: pre-wrap !important;
          word-break: break-word !important;
        }

        /* 연간 월별 요약표는 실행 기록 다음 페이지에서 시작 */
        .print-root.print-monthly .print-records + section {
          break-before: page;
          page-break-before: always;
        }
      }
    `}</style>
  );
}
