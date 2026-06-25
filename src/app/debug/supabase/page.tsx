import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { requireSuperAdmin } from "@/lib/auth/requireSuperAdmin";


export default async function SupabaseDebugPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  await requireSuperAdmin();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const hasUrl = Boolean(supabaseUrl);
  const hasAnonKey = Boolean(supabaseAnonKey);

  let dbStatus = "not_tested";
  let errorMessage = "";
  let languages: Array<{
    id?: string;
    code?: string;
    name?: string;
    native_name?: string;
  }> = [];

  if (hasUrl && hasAnonKey) {
    try {
      const supabase = createClient(supabaseUrl!, supabaseAnonKey!);

      const { data, error } = await supabase
        .from("supported_languages")
        .select("id, code, name, native_name")
        .limit(5);

      if (error) {
        dbStatus = "failed";
        errorMessage = error.message;
      } else {
        dbStatus = "success";
        languages = data ?? [];
      }
    } catch (error) {
      dbStatus = "failed";
      errorMessage =
        error instanceof Error
          ? error.message
          : "예상하지 못한 오류가 발생했습니다.";
    }
  }

  const isEnvConnected = hasUrl && hasAnonKey;
  const isDbConnected = dbStatus === "success";

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
      <section className="mx-auto w-full max-w-3xl rounded-md border border-slate-200 bg-white p-6">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
          Debug
        </p>
        <h1 className="mt-3 text-3xl font-semibold">Supabase 연결 확인</h1>
        <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
          개발/관리자 전용 페이지입니다.
        </p>

        <hr className="my-6 border-slate-200" />

        <h2 className="text-xl font-semibold">1. 환경변수 연결 상태</h2>

        <ul className="mt-4 list-disc space-y-2 pl-6 text-slate-700">
          <li>
            NEXT_PUBLIC_SUPABASE_URL:{" "}
            <strong>{hasUrl ? "연결됨" : "없음"}</strong>
          </li>
          <li>
            NEXT_PUBLIC_SUPABASE_ANON_KEY:{" "}
            <strong>{hasAnonKey ? "연결됨" : "없음"}</strong>
          </li>
        </ul>

        {isEnvConnected ? (
          <p className="mt-4 font-semibold text-emerald-700">
            Supabase 환경변수 연결 성공
          </p>
        ) : (
          <p className="mt-4 font-semibold text-red-700">
            Supabase 환경변수 연결 실패
          </p>
        )}

        <hr className="my-6 border-slate-200" />

        <h2 className="text-xl font-semibold">2. 데이터베이스 연결 상태</h2>

        {!isEnvConnected && (
          <p className="mt-4 font-semibold text-red-700">
            환경변수가 없어 DB 연결 테스트를 진행할 수 없습니다.
          </p>
        )}

        {isEnvConnected && isDbConnected && (
          <div className="mt-4">
            <p className="font-semibold text-emerald-700">
              Supabase DB 연결 성공
            </p>
            <p className="mt-2 text-slate-700">
              `supported_languages` 테이블에서 최대 5개 데이터를 조회했습니다.
            </p>

            {languages.length > 0 ? (
              <ul className="mt-4 list-disc space-y-2 pl-6 text-slate-700">
                {languages.map((language) => (
                  <li key={language.id ?? language.code}>
                    {language.code} / {language.name} / {language.native_name}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-slate-700">
                조회할 언어 데이터가 없습니다.
              </p>
            )}
          </div>
        )}

        {isEnvConnected && dbStatus === "failed" && (
          <div className="mt-4">
            <p className="font-semibold text-red-700">
              Supabase DB 연결 실패
            </p>
            <pre className="mt-3 whitespace-pre-wrap rounded-md bg-slate-100 p-4 text-sm text-slate-800">
              {errorMessage}
            </pre>
          </div>
        )}
      </section>
    </main>
  );
}
