import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export function createSupabaseServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return {
      client: null,
      error:
        "서버 전용 환경변수 SUPABASE_SERVICE_ROLE_KEY가 설정되어 있지 않습니다. .env.local 또는 Vercel Environment Variables에 SUPABASE_SERVICE_ROLE_KEY를 추가해 주세요. 변수 이름에는 NEXT_PUBLIC_을 붙이면 안 됩니다.",
    };
  }

  return {
    client: createClient<Database>(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }),
    error: null,
  };
}
