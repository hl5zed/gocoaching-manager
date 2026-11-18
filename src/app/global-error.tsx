"use client";

// 루트 레이아웃까지 렌더에 실패한 경우의 최종 폴백.
// 이 컴포넌트는 root layout을 대체하므로 자체 <html>/<body>가 필요하며,
// globals.css가 적용되지 않을 수 있어 인라인 스타일로 최소 화면을 그린다.
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
          backgroundColor: "#f4f6fa",
          color: "#1f2733",
        }}
      >
        <main
          style={{
            maxWidth: "32rem",
            padding: "1.5rem",
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600, margin: 0 }}>
            문제가 발생했습니다
          </h1>
          <p style={{ marginTop: "0.75rem", lineHeight: 1.7, color: "#5b6472" }}>
            일시적인 오류로 페이지를 표시할 수 없습니다. 잠시 후 다시 시도해
            주세요.
          </p>
          <button
            onClick={() => reset()}
            style={{
              marginTop: "1.5rem",
              padding: "0.625rem 1rem",
              borderRadius: "0.5rem",
              border: "none",
              backgroundColor: "#0f1b3d",
              color: "#ffffff",
              fontWeight: 500,
              cursor: "pointer",
            }}
            type="button"
          >
            다시 시도
          </button>
        </main>
      </body>
    </html>
  );
}
