import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type SupportedLanguagePreview = {
  id?: string | number;
  code?: string | null;
  name?: string | null;
  native_name?: string | null;
  is_active?: boolean | null;
};

function getFriendlyErrorMessage(message: string) {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("failed to fetch")) {
    return "Supabase 서버에 연결하지 못했습니다. 프로젝트 URL이 맞는지, 네트워크 연결이 가능한지 확인해 주세요.";
  }

  if (lowerMessage.includes("permission denied") || lowerMessage.includes("rls")) {
    return "테이블 접근 권한이 막혀 있습니다. Supabase의 RLS 정책에서 익명 사용자가 supported_languages를 읽을 수 있는지 확인해 주세요.";
  }

  if (lowerMessage.includes("does not exist")) {
    return "supported_languages 테이블을 찾지 못했습니다. SQL migration이 Supabase에 적용되었는지 확인해 주세요.";
  }

  if (lowerMessage.includes("invalid api key") || lowerMessage.includes("jwt")) {
    return "Supabase anon key가 올바르지 않은 것 같습니다. Vercel 환경변수 값을 다시 확인해 주세요.";
  }

  return `Supabase 요청 중 오류가 발생했습니다: ${message}`;
}

export default async function SupabaseDebugPage() {
  const hasUrl = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const hasAnonKey = Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  let rows: SupportedLanguagePreview[] = [];
  let errorMessage: string | null = null;

  if (hasUrl && hasAnonKey) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("supported_languages")
      .select("*")
      .limit(5);

    if (error) {
      errorMessage = getFriendlyErrorMessage(error.message);
    } else {
      rows = (data ?? []) as SupportedLanguagePreview[];
    }
  } else {
    errorMessage =
      "Supabase 환경변수가 아직 연결되지 않았습니다. NEXT_PUBLIC_SUPABASE_URL과 NEXT_PUBLIC_SUPABASE_ANON_KEY를 확인해 주세요.";
  }

  const isConnected = hasUrl && hasAnonKey && !errorMessage;

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
      <section className="mx-auto max-w-3xl">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
          Debug
        </p>
        <h1 className="mt-3 text-3xl font-semibold">Supabase 연결 확인</h1>
        <p className="mt-4 leading-7 text-slate-600">
          이 페이지는 실제 Supabase client를 만들고 supported_languages
          테이블에서 최대 5개 행을 조회합니다. URL 전체와 key 값은 화면에
          표시하지 않습니다.
        </p>

        <div className="mt-8 border-y border-slate-200 py-6">
          <h2 className="text-lg font-semibold">환경변수 상태</h2>
          <ul className="mt-4 space-y-2 text-slate-700">
            <li>
              NEXT_PUBLIC_SUPABASE_URL:{" "}
              <strong>{hasUrl ? "설정됨" : "없음"}</strong>
            </li>
            <li>
              NEXT_PUBLIC_SUPABASE_ANON_KEY:{" "}
              <strong>{hasAnonKey ? "설정됨" : "없음"}</strong>
            </li>
          </ul>
        </div>

        <div className="mt-6">
          {isConnected ? (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-5">
              <h2 className="text-lg font-semibold text-emerald-800">
                Supabase DB 연결 성공
              </h2>
              <p className="mt-2 text-emerald-700">
                supported_languages 테이블 조회가 정상적으로 완료되었습니다.
              </p>
            </div>
          ) : (
            <div className="rounded-md border border-red-200 bg-red-50 p-5">
              <h2 className="text-lg font-semibold text-red-800">
                Supabase DB 연결 실패
              </h2>
              <p className="mt-2 text-red-700">{errorMessage}</p>
            </div>
          )}
        </div>

        {isConnected && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold">
              supported_languages 조회 결과
            </h2>
            {rows.length > 0 ? (
              <div className="mt-4 overflow-x-auto rounded-md border border-slate-200 bg-white">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="bg-slate-100 text-slate-700">
                    <tr>
                      <th className="px-4 py-3">Code</th>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Native name</th>
                      <th className="px-4 py-3">Active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, index) => (
                      <tr
                        className="border-t border-slate-200"
                        key={`${row.id ?? row.code ?? "language"}-${index}`}
                      >
                        <td className="px-4 py-3">{row.code ?? "-"}</td>
                        <td className="px-4 py-3">{row.name ?? "-"}</td>
                        <td className="px-4 py-3">
                          {row.native_name ?? "-"}
                        </td>
                        <td className="px-4 py-3">
                          {row.is_active === null ||
                          row.is_active === undefined
                            ? "-"
                            : row.is_active
                              ? "yes"
                              : "no"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-3 text-slate-600">
                연결은 성공했지만 supported_languages 테이블에 표시할 행이
                없습니다.
              </p>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
