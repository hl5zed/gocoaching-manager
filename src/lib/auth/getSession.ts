import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { GetSessionResult } from "@/types/auth";

export async function getSession(): Promise<GetSessionResult> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return { user: null, error: error?.message ?? "No authenticated user" };
  }

  return { user: data.user, error: null };
}
