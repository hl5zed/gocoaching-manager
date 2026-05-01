import type { User as SupabaseUser } from "@supabase/supabase-js";

export type User = SupabaseUser;

export type GetSessionResult = {
  user: User | null;
  error: string | null;
};
