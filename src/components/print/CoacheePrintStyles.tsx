"use client";

/**
 * 코치이 전용 인쇄 공통 스타일.
 *
 * 공용 PrintPageButton의 @media print 규칙은 코치·코치메이커 인쇄 화면과도 공유되므로
 * 그대로 두고, `.print-coachee` 스코프로 좁혀 코치이 출력물
 * (목실기 기획안 · 월별 성취표 · 연간 성취표)에만 적용한다.
 */
export function CoacheePrintStyles() {
  return (
    <style jsx global>{`
      @media print {
        /* 한글·태국어가 대체 글꼴에 의존하지 않도록 인쇄 글꼴을 명시하고,
           한국어는 어절 단위로 줄바꿈되게 한다 */
        .print-root.print-coachee {
          font-family: "Malgun Gothic", "맑은 고딕", "Noto Sans KR",
            "Noto Sans Thai", "Apple SD Gothic Neo", Arial, sans-serif !important;
          overflow-wrap: break-word;
          word-break: keep-all;
        }

        /* 코치이 · 코치 확인란(서명란) — 기획안/월별/연간 문서 말미에서 재사용 */
        .print-coachee .print-signature {
          break-inside: avoid;
          display: grid !important;
          gap: 12px !important;
          grid-template-columns: 1fr 1fr !important;
          margin-top: 10px !important;
          page-break-inside: avoid;
        }

        .print-coachee .print-signature > div {
          border-top: 1px solid #94a3b8 !important;
          font-size: 10px !important;
          padding-top: 3px !important;
        }

        /* 문서 식별 정보 — Chrome/Edge는 @page 마진박스(쪽번호)를 지원하지 않아
           대신 문서 하단에 고정 텍스트로 남긴다 */
        .print-coachee .print-footer {
          border-top: 1px solid #cbd5e1 !important;
          color: #64748b !important;
          display: block !important;
          font-size: 9px !important;
          margin-top: 8px !important;
          padding-top: 3px !important;
        }
      }
    `}</style>
  );
}
