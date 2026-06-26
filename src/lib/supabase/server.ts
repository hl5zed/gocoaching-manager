import { cache } from "react";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

/**
 * React cache()로 래핑되어 동일한 서버 요청(렌더 패스) 내에서 여러 번 호출돼도
 * Supabase server client는 한 번만 생성되고 재사용됩니다.
 * (getSession 등과 동일한 패턴 — cookies()/createServerClient 중복 호출 제거)
 * 같은 요청 내에서는 쿠키가 변하지 않으므로 인스턴스 공유가 안전합니다.
 */
export const createSupabaseServerClient = cache(
  async function createSupabaseServerClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Missing Supabase server environment variables.");
    }

    const cookieStore = await cookies();

    return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Components cannot write cookies; middleware/route handlers can.
          }
        },
      },
    });
  },
);
