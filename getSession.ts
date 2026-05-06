import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { GetSessionResult } from "@/types/auth";

export async function getSession(): Promise<GetSessionResult> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
      return { user: null, error: error?.message ?? "No authenticated user" };
    }

    return {
      user: {
        id: data.user.id,
        email: data.user.email ?? null,
      },
      error: null,
    };
  } catch (error) {
    return {
      user: null,
      error:
        error instanceof Error
          ? error.message
          : "Authentication service is unavailable.",
    };
  }
}
