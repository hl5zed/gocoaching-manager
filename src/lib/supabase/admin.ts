import "server-only";

import { createSupabaseServiceClient } from "@/lib/supabase/service";

export function createSupabaseAdminClient() {
  return createSupabaseServiceClient();
}
