"use client";

/**
 * 연간 목실기 성취 요약(summary) 출력 전용 인쇄 스타일.
 *
 * 공용 PrintPageButton의 인쇄 CSS는 모든 출력 페이지가 공유하므로 그대로 두고,
 * 이 페이지에만 붙는 `.print-summary` 클래스로 범위를 좁혀 덮어쓴다.
 * 선택자는 `.print-root.print-summary ...` 형태로 공용 규칙(`.print-root ...`)보다
 * 명시도가 높아 스타일 주입 순서와 무관하게 항상 우선한다.
 */
export function MoksilgiSummaryPrintStyles() {
  return (
    <style jsx global>{`
      @media print {
        .print-root.print-summary section {
          border: 0 !important;
          border-radius: 0 !important;
          margin: 0 !important;
        }

        /* 요청 3: 보고서 맨 윗줄(제목)을 중앙 정렬 */
        .print-summary .print-report-title {
          margin: 0 0 10px !important;
          padding: 10px 18px !important;
        }

        .print-summary .print-report-title h1 {
          font-size: 20px !important;
          margin: 0 0 4px !important;
          text-align: center !important;
        }

        .print-summary .print-report-title p {
          font-size: 11px !important;
        }

        .print-root.print-summary section > div {
          padding: 12px !important;
        }

        /* 요청 2: 전체 글자 크기를 키워 가독성 향상 */
        .print-root.print-summary p {
          font-size: 11.5px !important;
        }

        .print-root.print-summary p.print-stat-value {
          font-size: 19px !important;
        }

        /* 요청 5: 목표별 현재 달성률 — 카드형 배경으로 구분해 가독성 향상 */
        .print-root.print-summary .print-goal-bars {
          display: grid !important;
          grid-template-columns: repeat(3, 1fr) !important;
          column-gap: 18px !important;
          row-gap: 6px !important;
        }

        .print-root.print-summary .print-goal-bars > div {
          background: #f4f6fa !important;
          border-radius: 5px !important;
          margin: 0 !important;
          padding: 4px 8px !important;
        }

        .print-root.print-summary .print-goal-bars span {
          font-size: 10.5px !important;
        }

        .print-root.print-summary .print-goal-bars .w-14 {
          font-weight: 600 !important;
          width: 34px !important;
        }

        .print-root.print-summary .print-goal-bars .w-11 {
          width: 36px !important;
        }

        .print-root.print-summary .print-goal-bars .h-2 {
          height: 6px !important;
        }

        /* 요청 1, 6: 월별 성취표 — 모든 셀 중앙 정렬. 행 높이는 12개월+누적 행이
           A4 한 장을 벗어나지 않는 선에서 하단 여백 직전까지 채우도록 조절한다 */
        .print-root.print-summary table {
          font-size: 11px !important;
          font-variant-numeric: tabular-nums !important;
          table-layout: fixed !important;
        }

        .print-root.print-summary th,
        .print-root.print-summary td {
          border-color: #e6ebf2 !important;
          line-height: 1.8 !important;
          padding: 12px 4px !important;
          text-align: center !important;
        }

        .print-root.print-summary thead th {
          font-size: 10.5px !important;
          white-space: nowrap !important;
        }

        .print-root.print-summary thead th:first-child,
        .print-root.print-summary tbody th {
          width: 10% !important;
        }

        .print-root.print-summary tbody th .rounded-full {
          font-size: 8px !important;
          padding: 1px 4px !important;
        }

        /* 8열을 눈으로 훑기 쉽도록 짝수 행에 옅은 음영 */
        .print-root.print-summary tbody tr:nth-of-type(even) {
          background: #f7f9fc !important;
        }

        /* 누적 행(표의 마지막 행)을 강조색으로 구분 */
        .print-root.print-summary tbody tr:last-child th,
        .print-root.print-summary tbody tr:last-child td {
          background: #1d2b4f !important;
          color: #ffffff !important;
        }
      }
    `}</style>
  );
}
